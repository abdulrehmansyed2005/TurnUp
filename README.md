# TurnUp ⚽ — University Futsal Turf Booking

A Progressive Web App for digitizing turf booking at FAST NUCES Lahore.

## Features

- 📱 **PWA** — Install on any device, no app store needed
- 🔐 **Email Verification** — OTP-based `@lhr.nu.edu.pk` email verification
- 📅 **Same-Day Booking** — View and book today's slots (Mon-Fri, 9AM-5PM)
- ✅ **Admin Approval** — Sports head approves/rejects bookings
- 🔒 **Privacy** — Only admin sees who booked; students see "Booked"
- 🚫 **Fair Usage** — One slot per student per day, 2-hour cancellation rule, max 3 cancellations/day
- 📊 **Admin Dashboard** — Date-aware stats, approve/reject, block slots, new booking alerts

---

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier)
- Gmail account with 2-Step Verification enabled (for OTPs)

### 1. Clone & Install
```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 2. Configure Environment
```bash
# Copy template and fill in your values
cp .env.example server/.env
```

### 3. Run
```bash
# Terminal 1 — Backend (port 5000)
cd server && npm run dev

# Terminal 2 — Frontend (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Production Deployment

### Recommended Stack (both free tier)
| Service | Purpose |
|---|---|
| [Render](https://render.com) | Backend (Node.js server) |
| [Vercel](https://vercel.com) | Frontend (React/Vite) |
| [MongoDB Atlas](https://cloud.mongodb.com) | Database |

---

### Step 1 — MongoDB Atlas

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user and copy the connection string
3. In **Network Access**, add `0.0.0.0/0` to allow connections from Render

---

### Step 2 — Deploy the Backend on Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo and set:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: `Node`

4. Add the following **Environment Variables** on Render:

```
MONGODB_URI        = <your Atlas connection string>
JWT_SECRET         = <a long random string, 32+ chars>
PORT               = 10000
CLIENT_URL         = https://your-frontend.vercel.app   ← set after Step 3
ADMIN_EMAIL        = <your email for admin account>
ADMIN_PASSWORD     = <strong password>
ADMIN_NAME         = Sports Head
EMAIL_USER         = TurnUp.nu@gmail.com
EMAIL_PASS         = <16-char Gmail App Password>
TZ                 = Asia/Karachi                        ← CRITICAL — do not skip
```

> ⚠️ **`TZ=Asia/Karachi` is required.** Render servers run on UTC. Without this, slot times and date logic will be 5 hours behind Lahore time.

5. Deploy. Render gives you a URL like `https://turnup-api.onrender.com`.

---

### Step 3 — Deploy the Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo
2. Set:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. Add the following **Environment Variable** on Vercel:

```
VITE_API_URL = https://turnup-api.onrender.com/api
```

4. Update `client/src/utils/api.js` to use:
```js
baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
```

5. Deploy. Vercel gives you a URL like `https://turnup.vercel.app`.

---

### Step 4 — Connect Frontend ↔ Backend

Go back to **Render** → your backend service → **Environment** and update:
```
CLIENT_URL = https://turnup.vercel.app
```

Then **redeploy** the backend (Manual Deploy → Deploy Latest Commit).

---

### Step 5 — First Login

On first startup, the server auto-creates the admin account using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Log in at `https://turnup.vercel.app` with those credentials.

---

### Gmail SMTP Setup

1. Enable **2-Step Verification** on the Gmail account used for `EMAIL_USER`
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create an App Password → select **Mail** → copy the 16-character code → set as `EMAIL_PASS`

> **Note:** New Gmail accounts may have OTP emails land in spam. This improves as the account builds a sending reputation. Tell students to check their spam folder.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Vanilla CSS (Dark theme) |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt + OTP |
| Email | Nodemailer (Gmail SMTP) |
| Security | helmet, express-rate-limit |

## License

MIT
