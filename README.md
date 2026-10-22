# 🌊 WAVY - Modern Autonomous AI Chat Platform

<p align="center">
  <img src="public/favicon.svg" alt="WAVY Logo" width="80" height="80" />
</p>

<p align="center">
  <b>เว็บแอปพลิเคชันสนทนา AI ยุคใหม่ ดีไซน์พรีเมียม สไตล์ Minimalist Dark-Mode</b><br>
  พร้อมระบบเชื่อมต่อคลาวด์ดาต้าเบส <b>Neon PostgreSQL</b>, รองรับการแนบไฟล์/รูปภาพ, ระบบบัญชีผู้ใช้ และการดีพลอยขึ้น <b>Vercel</b> ได้ทันที
</p>

---

## ✨ คุณสมบัติเด่น (Key Features)

### 1. 🤖 Next-Gen AI Chat & Typewriter Streaming
- รองรับการตอบกลับแบบ **Smooth Typewriter Streaming** (อัปเดตอัตราเร็วสูง ~8ms ต่อรอบ ไม่หน่วง ไม่สะดุด)
- ระบบ **Smart Auto-Scroll Lock**: ขณะ AI กำลังตอบ ถ้าผู้ใช้เลื่อนขึ้นไปอ่านข้อความเก่า หน้าจอจะไม่ถูกดึงลงมาเอง
- ปุ่ม **Quick Scroll-to-Bottom**: แสดงผลอัตโนมัติเมื่อเลื่อนออกห่างจากข้อความล่าสุด กดปุ่มเดียวเด้งลงล่างสุดทันที
- Markdown Renderer สมบูรณ์แบบ รองรับตาราง, ลิงก์, และ **Syntax Highlighting** พร้อมปุ่ม Copy Code ในตัว

### 2. 🗄️ Neon Cloud PostgreSQL Database
- เชื่อมต่อ **Neon Serverless PostgreSQL** เพื่อจัดเก็บข้อมูลอย่างปลอดภัยบนคลาวด์:
  - **`users`**: ระบบสมัครสมาชิก และเข้าสู่ระบบ (รหัสผ่านเข้ารหัส SHA-256)
  - **`chats`**: จัดเก็บประวัติเซสชันแชททั้งหมดของผู้ใช้
  - **`messages`**: จัดเก็บบันทึกประวัติข้อความและไฟล์แนบ
- อัปเดตและ Sync ข้อมูลอัตโนมัติระหว่าง LocalStorage และ Neon Cloud Database

### 3. 📎 Multimedia & Code File Attachments
- รองรับการแนบไฟล์หลากหลายรูปแบบผ่านปุ่มคลิปหนีบกระดาษ:
  - รูปภาพ (`PNG`, `JPG`, `WEBP`, `GIF`, etc.) พร้อมแท็กแสดงรูปย่อ (Image Preview Thumbnail)
  - ไฟล์ซอร์สโค้ดและข้อความ (`.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.html`, `.css`, `.json`, `.md`, `.txt`, `.csv`, etc.)
- ส่งเนื้อหาไฟล์ไปยัง AI ได้อย่างแม่นยำ พร้อมปุ่มลบไฟล์ก่อนกดส่ง

### 4. 🔒 Authentication & Account Management
- หน้าต่าง Popup Login/Register ดีไซน์ล้ำสมัยสไตล์โมเดิร์น AI
- จัดเก็บ Session ผู้ใช้ในเบราว์เซอร์และบน Neon Database
- ระบบปุ่ม Sign out ล้างประวัติเพื่อความปลอดภัย

### 5. 🗑️ Chat Session Safety & Modal Confirmations
- ระบบยืนยันก่อนลบแชท (**Delete Confirmation Modal**) ป้องกันการเผลอกดลบประวัติโดยไม่ได้ตั้งใจ
- ฟังก์ชัน New Chat สลับห้องแชทได้ทันทีผ่าน Sidebar

### 6. 📊 Real-time AI Token & Model Pool Viewer
- ตรวจสอบโควตาและการกระจาย Token ของโมเดลต่างๆ แบบ Multi-segmented Progress Bar
- หน้าต่างแจกแจง Platform AI: Google, Groq, Mistral, OpenRouter, Cloudflare, HuggingFace, Cerebras

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: [React 19](https://react.dev/), [Vite 8](https://vite.dev/)
- **Styling**: Vanilla CSS (CSS Variables, Flexbox, Grid, Glassmorphism, Custom Sleek Scrollbars)
- **Markdown & Code Highlighting**: `marked`, `highlight.js`
- **Backend / Serverless**: Vercel Serverless Functions (`/api/*`), Node.js native crypto
- **Database**: [Neon](https://neon.tech/) Serverless PostgreSQL (`pg`)
- **Deployment**: [Vercel](https://vercel.com/) (SPA Rewrites via `vercel.json`)

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```bash
wavy-chat/
├── api/                   # Vercel Serverless Functions
│   ├── _db.js             # ตัวเชื่อมต่อ Neon PostgreSQL & DDL Auto-migration
│   ├── auth.js            # API ตรวจสอบสิทธิ์ผู้ใช้ (Sign Up / Sign In)
│   └── chats.js           # API จัดการข้อมูลแชทและประวัติข้อความ (CRUD)
├── public/                # Static assets และ Icons
├── src/
│   ├── assets/            # รูปภาพประกอบและกราฟิก
│   ├── App.jsx            # คอมโพเนนต์หลักของระบบแชททั้งหมด
│   ├── index.css          # สไตล์ตกแต่ง Dark-Mode และ Component CSS
│   └── main.jsx           # Entry point ของ React
├── .env.example           # ตัวอย่าง Environment Variables
├── vercel.json            # การตั้งค่า Routing สำหรับ Vercel
├── package.json           # Dependencies และ Scripts
└── vite.config.js         # การตั้งค่า Vite Dev Server & Build
```

---

## 🚀 การติดตั้งและเริ่มใช้งานในเครื่อง (Local Setup)

### 1. โคลนโปรเจกต์ (Clone Repository)
```bash
git clone https://github.com/satetapongsa/WAVYFREELLM.git
cd WAVYFREELLM
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. ตั้งค่า Environment Variables
สร้างไฟล์ `.env` ที่โฟลเดอร์ราก (Root Directory):
```env
DATABASE_URL="postgresql://neondb_owner:npg_RXx2bKvQkNo0@ep-divine-darkness-ao3xdpbn-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# (ไม่บังคับ) หากต้องการระบุ Backend Gateway เอง
# VITE_API_BASE_URL="http://localhost:3001"
# VITE_API_KEY="freellmapi-..."
# VITE_MODEL_NAME="auto:default"
```

### 4. รัน Dev Server
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่: `http://localhost:5174`

---

## ☁️ วิธีดีพลอยขึ้น Vercel (Vercel Deployment Guide)

1. สมัครหรือเข้าสู่ระบบที่ [Vercel](https://vercel.com/)
2. คลิก **Add New...** -> **Project**
3. เลือก Repository: **`satetapongsa/WAVYFREELLM`**
4. ตรวจสอบการตั้งค่า:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. ไปที่หัวข้อ **Environment Variables** แล้วเพิ่ม:
   - **`DATABASE_URL`**:
     ```
     postgresql://neondb_owner:npg_RXx2bKvQkNo0@ep-divine-darkness-ao3xdpbn-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
   - *(หากใช้ Backend Gateway ภายนอก)* เพิ่ม `VITE_API_BASE_URL`
6. กดปุ่ม **Deploy** ระบบจะ Build และเปิดใช้งานเว็บแอปพลิเคชันของคุณทันที!

---

## 📜 ตารางฐานข้อมูลใน Neon (Database Schema)

```sql
-- 1. ตารางผู้ใช้งาน
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตารางห้องแชท
CREATE TABLE chats (
  id VARCHAR(100) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. ตารางข้อความ
CREATE TABLE messages (
  id VARCHAR(100) PRIMARY KEY,
  chat_id VARCHAR(100) REFERENCES chats(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  files JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📄 ใบอนุญาต (License)
โปรเจกต์นี้เผยแพร่ภายใต้ลิขสิทธิ์ [MIT License](LICENSE)
