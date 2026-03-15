// ============================================
// server.js - Main Backend Server (OTP System)
// ============================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/randomchat')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// ============================================
// MODELS
// ============================================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  interests: [{ type: String }],
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const chatHistorySchema = new mongoose.Schema({
  user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  messages: [{
    sender: mongoose.Schema.Types.ObjectId,
    text: String,
    time: { type: Date, default: Date.now }
  }],
  lastChat: { type: Date, default: Date.now }
});
const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

// ============================================
// EMAIL SETUP
// ============================================


function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, name, otp) {
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: '🔐 Your RandomChat OTP Code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:30px;background:#13131a;color:#f0eeff;border-radius:16px;">
        <h2 style="color:#7c6fff;">Hello ${name}! 👋</h2>
        <p style="color:#8882aa;">Your OTP code:</p>
        <div style="font-size:2.5rem;font-weight:bold;letter-spacing:12px;color:#7c6fff;text-align:center;padding:20px;background:#1c1c28;border-radius:12px;margin:20px 0;">
          ${otp}
        </div>
        <p style="color:#8882aa;">Valid for 10 minutes only.</p>
      </div>
    `
  });
}

// ============================================
// ROUTES
// ============================================

// REGISTER - Send OTP
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, age, gender, interests } = req.body;

    const existing = await User.findOne({ email, isVerified: true });
    if (existing) return res.status(400).json({ msg: 'Email already registered!' });

    // Delete old unverified account
    await User.deleteOne({ email, isVerified: false });

    const hashedPass = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = new User({
      name, email, age, gender, interests,
      password: hashedPass,
      isVerified: false,
      otp, otpExpiry
    });
    await user.save();

    await sendOTPEmail(email, name, otp);

    res.json({ msg: 'OTP sent to your email!', email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// VERIFY OTP
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User not found!' });
    if (user.otp !== otp) return res.status(400).json({ msg: '❌ Wrong OTP! Try again.' });
    if (new Date() > user.otpExpiry) return res.status(400).json({ msg: '⏰ OTP expired! Register again.' });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ msg: '✅ Email verified! You can now login.' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// RESEND OTP
app.post('/api/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, isVerified: false });
    if (!user) return res.status(400).json({ msg: 'User not found!' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(email, user.name, otp);
    res.json({ msg: 'New OTP sent!' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User not found!' });
    if (!user.isVerified) return res.status(400).json({ msg: 'Please verify your email with OTP first!', needsVerification: true, email });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: 'Wrong password!' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, gender: user.gender, interests: user.interests } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// CHAT HISTORY
app.get('/api/history/:userId', async (req, res) => {
  try {
    const histories = await ChatHistory.find({
      $or: [{ user1: req.params.userId }, { user2: req.params.userId }]
    }).populate('user1', 'name gender').populate('user2', 'name gender').sort({ lastChat: -1 });
    res.json(histories);
  } catch (err) {
    res.status(500).json({ msg: 'Error' });
  }
});

app.get('/api/chat/:chatId', async (req, res) => {
  try {
    const chat = await ChatHistory.findById(req.params.chatId).populate('user1', 'name').populate('user2', 'name');
    res.json(chat);
  } catch (err) {
    res.status(500).json({ msg: 'Error' });
  }
});

app.post('/api/chat/:chatId/message', async (req, res) => {
  try {
    const { senderId, text } = req.body;
    const chat = await ChatHistory.findById(req.params.chatId);
    chat.messages.push({ sender: senderId, text });
    chat.lastChat = new Date();
    await chat.save();
    res.json({ msg: 'Sent!' });
  } catch (err) {
    res.status(500).json({ msg: 'Error' });
  }
});

// ============================================
// SOCKET.IO
// ============================================
let waitingMale = [], waitingFemale = [], waitingOther = [];
let activeRooms = {}, connectedUsers = {};

io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

  socket.on('user-join', (userData) => {
    connectedUsers[socket.id] = { ...userData, socketId: socket.id };
  });

  socket.on('find-random', (userData) => {
    connectedUsers[socket.id] = { ...userData, socketId: socket.id };
    matchUser(socket, userData);
  });

  socket.on('offer', ({ offer, roomId }) => socket.to(roomId).emit('offer', { offer }));
  socket.on('answer', ({ answer, roomId }) => socket.to(roomId).emit('answer', { answer }));
  socket.on('ice-candidate', ({ candidate, roomId }) => socket.to(roomId).emit('ice-candidate', { candidate }));

  socket.on('chat-message', async ({ roomId, message, senderName }) => {
    socket.to(roomId).emit('chat-message', { message, senderName });
    if (activeRooms[roomId]) {
      const room = activeRooms[roomId];
      try {
        let chat = await ChatHistory.findOne({ $or: [{ user1: room.user1Id, user2: room.user2Id }, { user1: room.user2Id, user2: room.user1Id }] });
        if (!chat) chat = new ChatHistory({ user1: room.user1Id, user2: room.user2Id });
        chat.messages.push({ sender: socket.id === room.socket1 ? room.user1Id : room.user2Id, text: message });
        chat.lastChat = new Date();
        await chat.save();
      } catch (e) { console.error(e); }
    }
  });

  socket.on('next-user', (userData) => { leaveCurrentRoom(socket); matchUser(socket, userData); });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
    removeFromQueues(socket.id);
    delete connectedUsers[socket.id];
  });
});

function matchUser(socket, userData) {
  const { gender } = userData;
  let partner = null;

  if (gender === 'male') {
    if (Math.random() < 0.7 && waitingFemale.length > 0) partner = waitingFemale.shift();
    else partner = waitingFemale.shift() || waitingOther.shift() || waitingMale.shift();
  } else if (gender === 'female') {
    partner = waitingMale.shift() || waitingOther.shift() || waitingFemale.shift();
  } else {
    partner = waitingMale.shift() || waitingFemale.shift() || waitingOther.shift();
  }

  if (partner) {
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    activeRooms[roomId] = { socket1: partner.socketId, socket2: socket.id, user1Id: partner.userId, user2Id: userData.userId };
    socket.join(roomId);
    io.sockets.sockets.get(partner.socketId)?.join(roomId);
    io.to(partner.socketId).emit('match-found', { roomId, partnerName: userData.name, partnerGender: gender, isInitiator: true });
    socket.emit('match-found', { roomId, partnerName: partner.name, partnerGender: partner.gender, isInitiator: false });
    console.log(`✅ Matched: ${partner.name} <-> ${userData.name}`);
  } else {
    const userInfo = { ...userData, socketId: socket.id };
    if (gender === 'male') waitingMale.push(userInfo);
    else if (gender === 'female') waitingFemale.push(userInfo);
    else waitingOther.push(userInfo);
    socket.emit('waiting', { msg: 'Looking for someone...' });
  }
}

function leaveCurrentRoom(socket) {
  for (const roomId in activeRooms) {
    const room = activeRooms[roomId];
    if (room.socket1 === socket.id || room.socket2 === socket.id) {
      socket.to(roomId).emit('partner-left');
      socket.leave(roomId);
      delete activeRooms[roomId];
      break;
    }
  }
}

function removeFromQueues(socketId) {
  waitingMale = waitingMale.filter(u => u.socketId !== socketId);
  waitingFemale = waitingFemale.filter(u => u.socketId !== socketId);
  waitingOther = waitingOther.filter(u => u.socketId !== socketId);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
