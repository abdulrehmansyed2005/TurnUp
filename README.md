# TurnUp ⚽ — University Futsal Turf Booking

A Progressive Web App for digitizing turf booking at FAST NUCES Lahore.

## Features

- 📱 **PWA** — Install on any device, no app store needed
- 🔐 **Email Verification** — OTP-based `@lhr.nu.edu.pk` email verification
- 📅 **Same-Day Booking** — View and book today's slots (Mon-Fri, 9AM-5PM)
- ✅ **Admin Approval** — Sports head approves/rejects bookings
- 🔒 **Privacy** — Only admin sees who booked; students see "Booked"
- 🚫 **Fair Usage** — One slot per student per day, 2-hour cancellation rule
- 📊 **Admin Dashboard** — Stats, approve/reject, block slots

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier)
- Gmail account for sending OTPs

### 1. Clone & Install
```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Configure Environment
```bash
# Create server/.env from template
cp .env.example server/.env
# Edit server/.env with your MongoDB URI, JWT secret, admin credentials, and Gmail SMTP
```

### 3. Run
```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS (Dark theme) |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt + OTP |
| Email | Nodemailer (Gmail SMTP) |

## License

MIT
