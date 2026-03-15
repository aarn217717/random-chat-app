# 🎲 RandomChat App - Setup Guide

Ek random video calling aur chatting app!

---

## 📁 Files Structure
```
random-chat-app/
├── server.js          ← Backend server
├── package.json       ← Dependencies list
├── .env               ← Your secret settings
└── public/
    ├── index.html     ← Home/Login page
    ├── register.html  ← Account banane ka page
    ├── chat.html      ← Video call + Chat
    ├── history.html   ← Purani chats
    └── style.css      ← Design
```

---

## 🚀 Step-by-Step Setup

### Step 1: Node.js Install karo
👉 https://nodejs.org pe jao aur Node.js download karo (LTS version)

### Step 2: MongoDB Install karo
👉 https://www.mongodb.com/try/download/community se MongoDB Community Server download karo

### Step 3: Project folder VS Code mein kholo
1. VS Code kholo
2. File → Open Folder → `random-chat-app` folder select karo

### Step 4: Terminal mein packages install karo
VS Code mein Terminal → New Terminal kholo aur likho:
```
npm install
```

### Step 5: .env file setup karo
`.env` file mein apni details dalo:
```
MONGO_URI=mongodb://localhost:27017/randomchat
JWT_SECRET=koi_bhi_random_text_likho
EMAIL_USER=apna_gmail@gmail.com
EMAIL_PASS=gmail_app_password
```

> **Gmail App Password kaise banayein:**
> 1. Gmail settings → Security → 2-Step Verification ON karo
> 2. App Passwords → "Mail" select karo → Generate karo
> 3. Woh 16-character password yahan paste karo

### Step 6: Server Start karo
Terminal mein:
```
npm start
```

### Step 7: Browser mein kholo
👉 http://localhost:3000

---

## ✨ Features
- 🔐 Email verification wala account system
- 👤 Name, Age, Gender, Interests ke saath profile
- 🎲 Random user se video call
- 💬 Video call ke dauran temporary chat
- 📜 Chat history
- 👥 Males mostly females se match honge

---

## 🛠️ Tech Used
- **Frontend:** HTML + CSS + JavaScript
- **Backend:** Node.js + Express
- **Real-time:** Socket.io
- **Video:** WebRTC
- **Database:** MongoDB
- **Email:** Nodemailer

---

Koi problem ho toh apne teacher ya Claude se poochho! 😊
