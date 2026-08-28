# TurnUp ⚽🏀 — University Sports Court Booking

A Progressive Web App for digitizing Futsal and Basketball court bookings at FAST NUCES Lahore.

**Live:** https://turnup-pi.vercel.app

---

## Features

- 📱 **PWA** — Install on any device, no app store needed
- ⚽🏀 **Multi-Sport** — Independent Futsal and Basketball booking tabs
- 🔐 **Email Verification** — OTP-based `@lhr.nu.edu.pk`-only registration
- 📅 **Same-Day Booking** — View and book today's slots (Mon–Fri, 9AM–5PM)
- 📋 **Waitlist System** — Multiple students can queue for the same slot; first-come, first-served priority
- ✅ **Admin Approval** — Sports head approves/rejects bookings with optional note
- 📧 **Email Notifications** — Instant email on approval, rejection, auto-rejection, or waitlist movement
- 🔒 **Privacy** — Only admin sees who booked; students only see team name
- 🚫 **Fair Usage** — One slot per sport per student per day; 2-hour cancellation rule; max 3 cancellations/day
- 📊 **Admin Dashboard** — Date-aware stats, priority badges, sport filter, block slots, real-time alerts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 |
| Routing | React Router 7 |
| Styling | Vanilla CSS (single file design system) |
| PWA | Manual Service Worker |
| Backend | Node.js 18 + Express 5 |
| Database | MongoDB via Mongoose 9 |
| Auth | JWT (7-day) + bcryptjs (12 rounds) + OTP |
| Email | Nodemailer via Gmail SMTP |
| Security | helmet, express-rate-limit |
| Hosting | Vercel (frontend) + Railway (backend) + MongoDB Atlas |

---

## How the Waitlist Works

1. A student books a slot → they join the queue (status: `pending`)
2. Multiple students can queue for the same slot — ordered by request time
3. Admin sees `#1 Priority`, `#2 In Queue`, etc. on the dashboard
4. **Admin approves #1** → all others for that slot are **auto-rejected** with email notification
5. **Admin rejects #1** → next person in queue gets a "You've moved up!" email
6. Students only see "Added to Queue!" — their position is not revealed

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
cp .env.example server/.env
# Fill in all values — see Environment Variables section below
```

### 3. Run
```bash
# Terminal 1 — Backend (port 5000)
cd server && npm run dev

# Terminal 2 — Frontend (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173`

### 4. Seed Basketball Court (first time only)
```bash
cd server && node scripts/seedBasketball.js
```

---

## Production Deployment

Currently live on:
| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://turnup-pi.vercel.app |
| Backend | Railway | https://turnup-production-9e71.up.railway.app |
| Database | MongoDB Atlas | cloud.mongodb.com |

### Deploy Your Own

#### Step 1 — MongoDB Atlas
1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user and copy the connection string
3. In **Network Access**, add `0.0.0.0/0` to allow connections from Railway/Render

#### Step 2 — Deploy Backend (Railway or Render)

Set the following environment variables:

```
MONGODB_URI        = <your Atlas connection string>
JWT_SECRET         = <long random string, 32+ chars>
CLIENT_URL         = https://your-frontend.vercel.app
ADMIN_EMAIL        = <admin account email>
ADMIN_PASSWORD     = <strong password>
ADMIN_NAME         = Sports Head
EMAIL_USER         = <gmail address for sending OTPs>
EMAIL_PASS         = <16-char Gmail App Password>
TZ                 = Asia/Karachi    ← CRITICAL — do not skip
NODE_ENV           = production
```

> ⚠️ **`TZ=Asia/Karachi` is required.** Cloud servers run UTC. Without this, slot times will be 5 hours off.

- **Root Directory**: `server`
- **Start Command**: `node server.js`

#### Step 3 — Deploy Frontend (Vercel)

- **Root Directory**: `client`
- **Framework**: Vite
- **Build Command**: `npm run build`

Add environment variable:
```
VITE_API_URL = https://your-backend-url.railway.app/api
```

#### Step 4 — Seed Basketball Court
Run once after first deploy:
```bash
node scripts/seedBasketball.js
```

#### Step 5 — Drop Old Index (if migrating from a previous version)
In MongoDB Atlas shell:
```js
db.bookings.dropIndex("unique_active_booking_per_user_per_day")
```

---

## Environment Variables Reference

### Server (`server/.env`)
| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Secret for signing tokens (32+ chars) |
| `CLIENT_URL` | ✅ | Frontend URL (for CORS) |
| `ADMIN_EMAIL` | ✅ | Admin account email |
| `ADMIN_PASSWORD` | ✅ | Admin account password |
| `ADMIN_NAME` | ✅ | Admin display name |
| `EMAIL_USER` | ✅ | Gmail address for sending emails |
| `EMAIL_PASS` | ✅ | Gmail App Password (16-char) |
| `TZ` | ✅ | Must be `Asia/Karachi` |
| `NODE_ENV` | ✅ | `production` |
| `PORT` | Optional | Defaults to `5000` |

### Client (`client/.env.local`)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ (prod) | Backend API URL (not needed for local dev) |

---

## Gmail SMTP Setup

1. Enable **2-Step Verification** on the Gmail account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create an App Password → select **Mail** → copy the 16-character code → set as `EMAIL_PASS`

> **Note:** New Gmail accounts may have OTP emails land in spam. Tell students to check their spam folder. Delivery improves as the account builds a reputation.

---

## Business Rules

| Rule | Detail |
|---|---|
| Registration | `@lhr.nu.edu.pk` emails only (format: `l######@lhr.nu.edu.pk`) |
| OTP expiry | 10 minutes |
| OTP lockout | Locked after 3 wrong attempts |
| Login lockout | 15-minute lockout after 5 failed attempts |
| Booking limit | 1 Futsal + 1 Basketball booking per student per day (independent) |
| Operating hours | Mon–Fri, 9:00 AM – 5:00 PM, 1-hour slots |
| Cancellation | Free if ≥ 2 hours before slot; locks rebooking if < 2 hours |
| Daily cancellation cap | Max 3 cancellations per student per day |
| Past slot protection | Cannot book, cancel, or approve slots that have already passed |
| Waitlist | First-come, first-served; position not shown to students |
| Auto-expire | Pending bookings for past slots expire automatically |

---

## Security

- `@lhr.nu.edu.pk` domain restriction (closed registration)
- OTP emails for registration and password reset
- bcryptjs password hashing (12 salt rounds)
- JWT authentication (7-day expiry)
- `helmet.js` security headers
- Rate limiting: 200 req/15min global; 10 req/15min on auth routes
- 10KB request body size limit
- Input sanitisation and length limits on all user-facing fields
- Sensitive fields (`password`, `otp`) never returned in API responses

---

## License

MIT
