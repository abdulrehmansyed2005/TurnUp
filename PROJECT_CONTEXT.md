# TurnUp ⚽ — Agent Context File
> **Read this at the start of every session before touching any code.**
> Last updated: 2026-08-02

---

## What Is This Project?

**TurnUp** is a Progressive Web App (PWA) for digitizing futsal turf slot booking at **FAST NUCES Lahore**.
Students register with their `@lhr.nu.edu.pk` university email, verify via OTP, and can book a single 1-hour slot per day (Mon–Fri, 9AM–5PM). A sports-head admin approves or rejects bookings, blocks slots, and views stats.

### Deployment Context (Critical — Shapes All Decisions)
- **Audience**: FAST NUCES Lahore students and one sports-head admin only.
- **Closed registration**: Only `@lhr.nu.edu.pk` emails can register. The general public cannot create accounts.
- **Scale**: Small — a few hundred students at most, 8 bookable slots per day.
- **Geography**: Lahore, Pakistan. Server timezone should be `Asia/Karachi` (PKT, UTC+5).
- **Nature**: Internal tool, not a public product. Think of it like a university portal, not a SaaS app.
- **Consequence**: Many "enterprise" security concerns (e.g., JWT in httpOnly cookies, full GDPR compliance) are **low priority** for this scope. The email domain restriction is the primary access control barrier.

---

## Repository Structure

```
TurnUp/
├── client/                    # React 18 + Vite frontend (PWA)
│   ├── public/
│   │   └── sw.js              # Service worker (network-first for /api, stale-while-revalidate for static)
│   ├── src/
│   │   ├── App.jsx            # Root router + layout wrappers
│   │   ├── main.jsx           # Entry point
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # Global auth state, always verifies role from server
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Bottom nav bar for authenticated app
│   │   │   ├── ProtectedRoute.jsx # Route guard (redirects unauthenticated / non-admin)
│   │   │   ├── Toast.jsx          # Global toast notification system
│   │   │   ├── Modal.jsx          # Reusable modal component
│   │   │   └── OtpInput.jsx       # 6-digit OTP input UI
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── VerifyEmail.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   ├── Home.jsx           # Slot grid — today's availability
│   │   │   ├── BookSlot.jsx       # Booking confirmation form
│   │   │   ├── MyBookings.jsx     # Student's booking history + cancel
│   │   │   ├── Profile.jsx        # User profile view
│   │   │   └── AdminDashboard.jsx # Admin: stats, approve/reject, block slots, date filter
│   │   ├── styles/
│   │   │   └── index.css          # Single CSS file (~39KB), dark theme, all component styles
│   │   └── utils/
│   │       └── api.js             # Axios instance with Bearer token interceptor + 401 auto-logout
│   ├── index.html
│   ├── vite.config.js
│   ├── tsconfig.json              # TypeScript config (JS files checked via checkJs)
│   └── package.json
│
├── server/                    # Node.js + Express backend
│   ├── server.js              # Entry: CORS, routes, 404/error handlers, DB connect, seedAdmin
│   ├── config/
│   │   └── db.js              # Mongoose connect to MongoDB Atlas
│   ├── models/
│   │   ├── User.js            # Student/admin, bcrypt pre-save, toJSON strips sensitive fields
│   │   ├── Booking.js         # Compound unique index prevents double-booking
│   │   ├── Turf.js            # Single turf, generateSlots() method, configurable hours/duration
│   │   └── BlockedSlot.js     # Admin-created slot blocks with reason
│   ├── controllers/
│   │   ├── authController.js  # register, verifyOTP, resendOTP, login, getMe, forgotPassword, resetPassword
│   │   ├── bookingController.js # getAvailableSlots, createBooking, getMyBookings, cancelBooking
│   │   ├── adminController.js # getAllBookings, updateBookingStatus, blockSlot, unblockSlot, getStats, getBlockedSlots
│   │   └── turfController.js  # getTurfs (list active turfs)
│   ├── middleware/
│   │   ├── auth.js            # JWT verify + isVerified check → attaches req.user
│   │   └── adminOnly.js       # Role check: req.user.role === 'admin'
│   ├── routes/
│   │   ├── auth.js            # /api/auth/*
│   │   ├── bookings.js        # /api/bookings/*
│   │   ├── admin.js           # /api/admin/* (auth + adminOnly)
│   │   └── turfs.js           # /api/turfs/*
│   ├── utils/
│   │   ├── generateToken.js   # jwt.sign with expiresIn: '7d'
│   │   ├── seedAdmin.js       # Creates admin + default turf on first startup if not present
│   │   └── sendEmail.js       # Nodemailer via Gmail SMTP — sendEmail() + sendOTPEmail()
│   ├── scripts/
│   │   └── resetPassword.js   # One-off CLI script to reset admin password directly in DB
│   └── package.json
│
├── .env.example               # Template for server/.env
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 19.1 |
| Frontend build | Vite | 8.1 |
| Routing | react-router-dom | 7.18 |
| HTTP client | Axios | 1.18 |
| Styling | Vanilla CSS (single file, dark theme) | — |
| PWA | Manual service worker (sw.js) | — |
| Backend framework | Express | 5.2 |
| Database | MongoDB via Mongoose | 9.7 |
| Auth tokens | jsonwebtoken (JWT, 7-day expiry) | 9.0 |
| Password hashing | bcryptjs (salt rounds: 12) | 3.0 |
| Email | Nodemailer via Gmail SMTP | 9.0 |
| Runtime | Node.js | 18+ |

---

## Authorization Architecture

### Backend (real enforcement)
1. **`auth.js` middleware** — Extracts `Bearer <token>` from `Authorization` header, calls `jwt.verify()`, looks up user in DB, confirms `isVerified === true`, attaches `req.user`.
2. **`adminOnly.js` middleware** — Checks `req.user.role === 'admin'`. Stacked after `auth` on all `/api/admin/*` routes.
3. Handles: missing token → 401, invalid/expired token → 401, unverified email → 403, non-admin on admin route → 403.

### Frontend (UX guard only, not security)
1. **`api.js` Axios interceptor** — Auto-attaches `Authorization: Bearer <token>` from `localStorage` on every request. On 401 response, clears localStorage and redirects to `/login`.
2. **`AuthContext.jsx`** — On app load, always calls `/api/auth/me` to verify token and get fresh user data from server. **Role is never trusted from localStorage** (comment explicitly states this).
3. **`ProtectedRoute.jsx`** — Redirects unauthenticated users to `/login`; redirects non-admin users away from `/admin` to `/`.

### Token storage
- JWT stored in `localStorage` under key `turnup_token`.
- User object cached in `localStorage` under key `turnup_user` (only for display, never for auth decisions).

---

## Business Rules (Important for Any Feature Work)

| Rule | Implementation |
|---|---|
| Only `@lhr.nu.edu.pk` emails allowed | Validated in `authController.register` + Mongoose schema |
| Student must verify email via OTP before login | `isVerified` flag on User; `auth.js` middleware enforces it |
| OTP expires in 10 minutes | `otpExpiry` field, checked in `verifyOTP` and `resetPassword` |
| OTP is hashed with bcrypt before storing | `bcrypt.hash(otp, salt)` in auth controller |
| One active booking per student per day | Checked in `createBooking`; Booking model has compound unique index |
| Cancellation ≥ 2 hours before slot → can rebook | `canRebook` flag on Booking; checked in `cancelBooking` |
| Cancellation < 2 hours before slot → locked out for the day | `canRebook: false`; checked before allowing new booking |
| Past slots auto-expire | `autoExpirePendingBookings()` called on slot fetch and booking creation |
| Admins cannot make bookings | Explicit check in `createBooking` controller |
| Turf operates Mon–Fri, 09:00–17:00, 1-hour slots | Stored in Turf model; `generateSlots()` method computes slot list |
| Team name is shown publicly on slot grid | `teamName` field on Booking; returned in `getAvailableSlots` |
| Only admin sees who booked (name, roll, dept, email) | `getAvailableSlots` returns `teamName` only; `getAllBookings` (admin) populates full user |
| Blocked slots show reason to students | `BlockedSlot.reason` returned in `getAvailableSlots` |
| Admin dashboard auto-refreshes every 15 seconds | `setInterval(fetchData, 15000)` in `AdminDashboard.jsx` |

---

## API Endpoints

### Auth — `/api/auth`
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Register student, send OTP email |
| POST | `/verify-otp` | Public | Verify OTP, get JWT token |
| POST | `/resend-otp` | Public | Resend OTP to email |
| POST | `/login` | Public | Login, get JWT token |
| GET | `/me` | Private | Get current user profile |
| POST | `/forgot-password` | Public | Send password reset OTP |
| POST | `/reset-password` | Public | Verify OTP, set new password |

### Bookings — `/api/bookings`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/available` | Private | Today's slot grid with availability |
| POST | `/` | Private | Create a new booking |
| GET | `/my` | Private | Get current user's booking history |
| PATCH | `/:id/cancel` | Private | Cancel a booking |

### Admin — `/api/admin`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/bookings` | Admin | All bookings, filterable by date + status |
| PATCH | `/bookings/:id` | Admin | Approve or reject a booking |
| GET | `/stats` | Admin | Dashboard stats (today counts + total users) |
| POST | `/block-slot` | Admin | Block a slot with a reason |
| DELETE | `/block-slot/:id` | Admin | Unblock a slot |
| GET | `/blocked-slots` | Admin | Get blocked slots for a date |

### Turfs — `/api/turfs`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Private | List active turfs |

---

## Database Models Summary

### User
Fields: `name`, `email` (unique, `@lhr.nu.edu.pk` for students), `password` (bcrypt, `select: false`), `role` (`student`|`admin`), `department`, `rollNumber`, `isVerified`, `otp` (`select: false`), `otpExpiry` (`select: false`), timestamps.

### Booking
Fields: `user` (ref User), `turf` (ref Turf), `date`, `startTime`, `endTime`, `teamName`, `status` (`pending`|`approved`|`rejected`|`cancelled`|`expired`), `cancelledAt`, `canRebook`, `adminNote`, timestamps.
Indexes: Compound unique on `{turf, date, startTime}` for active statuses; `{user, date}`; `{date, status}`.

### Turf
Fields: `name`, `university`, `sportTypes`, `location`, `openTime` (`09:00`), `closeTime` (`17:00`), `slotDuration` (60 min), `operatingDays` ([1,2,3,4,5]), `isActive`.
Method: `generateSlots()` — computes all slot pairs from open to close time.

### BlockedSlot
Fields: `turf` (ref Turf), `date`, `startTime`, `endTime`, `reason`, `blockedBy` (ref User), timestamps.
Unique index on `{turf, date, startTime}`.

---

## ✅ What Is Complete (Feature-Complete MVP)

### Backend
- [x] Express server with CORS, 404 and error handlers
- [x] MongoDB connection + all 4 Mongoose models with proper indexes
- [x] Auto-seed admin account + default turf on first startup
- [x] Full auth flow: register → OTP email → verify → login → JWT
- [x] Forgot/reset password via OTP email
- [x] OTP resend
- [x] JWT middleware with `isVerified` check
- [x] Admin-only middleware
- [x] Slot availability endpoint with auto-expire, blocked slots, user lock-out state
- [x] Booking creation with all 7+ validation guards
- [x] Booking cancellation with 2-hour rule
- [x] Admin: approve/reject bookings
- [x] Admin: block/unblock slots with reason
- [x] Admin: dashboard stats
- [x] Admin: historical date filter for bookings
- [x] HTML email templates for OTP + password reset (styled dark theme)
- [x] `generateToken.js` with `expiresIn: '7d'`
- [x] CLI script `resetPassword.js` for emergency admin password reset

### Frontend
- [x] All 9 pages implemented and routed
- [x] `AuthContext` with server-verified role (never trusts localStorage)
- [x] Axios interceptor: auto-attach token, auto-logout on 401
- [x] `ProtectedRoute` with `adminOnly` prop
- [x] `Toast` notification system (global)
- [x] `OtpInput` component (6-digit)
- [x] `Modal` component
- [x] Bottom `Navbar` with active state
- [x] Dark theme CSS system (~39KB)
- [x] PWA service worker: network-first for `/api`, stale-while-revalidate for static assets, offline fallback

---

## ❌ Known Gaps & Missing Features (TODO)

> **Scope reminder**: This is a closed internal app for FAST NUCES Lahore. The `@lhr.nu.edu.pk` domain restriction is the primary access gate. Priorities below reflect this — enterprise-grade hardening is not the goal.

### 🔴 Must Fix — Real Risks Even for Internal Use

1. **No rate limiting on `/api/auth/*` routes**
   - Risk: a student could spam OTP resend and exhaust Gmail daily quota (500 emails/day free limit), or run a slow brute-force on login
   - Fix: `npm install express-rate-limit` → ~10 req/15min on auth routes
   - Files: `server/server.js`

2. **Timezone: server uses local time, must be set to PKT**
   - `getTodayDate()` and `getCurrentTime()` use `new Date()` — depends on server OS timezone
   - If deployed on Render/Railway (UTC servers), "today" will be 5 hours behind Lahore time → slots expire wrong, date logic breaks
   - Fix: set `TZ=Asia/Karachi` as an environment variable on the hosting platform
   - Files: `server/controllers/bookingController.js`, `server/controllers/adminController.js`

3. **CORS `CLIENT_URL` must be the production frontend URL**
   - Must be set in production `.env` to the exact deployed frontend domain
   - Files: `server/.env`, `server/server.js`

4. **`offline.html` does not exist**
   - `sw.js` tries to cache and serve `/offline.html` as a fallback — if the file doesn't exist in `client/public/`, the service worker install will fail and PWA won't work offline
   - Fix: create `client/public/offline.html`

### 🟡 Medium Priority — Better UX for Students

5. **No email notification when booking is approved/rejected**
   - Students must manually open the app to check status
   - Fix: call `sendEmail()` inside `adminController.updateBookingStatus()` after saving
   - Files: `server/controllers/adminController.js`, `server/utils/sendEmail.js`

6. **Admin block-slot form has hardcoded slot times**
   - `slotOptions` array in `AdminDashboard.jsx` is hardcoded (9AM–5PM, 1hr slots)
   - If turf hours ever change in the DB, the form won't reflect it
   - Fix: derive slot options dynamically from the turf data already fetched
   - Files: `client/src/pages/AdminDashboard.jsx`

7. **Admin stats cards don't respect the selected date**
   - `getStats()` always returns today's counts
   - The date picker changes the booking list below but the 4 stat cards always show today
   - Fix: pass `date` query param to `/api/admin/stats`
   - Files: `server/controllers/adminController.js`, `client/src/pages/AdminDashboard.jsx`

8. **No push/audio notification for admin on new booking**
   - Admin relies on 15-second polling; a pending booking could sit for 14 seconds unnoticed
   - Simple fix: play a subtle sound or show a browser notification badge when `pendingCount` increases

### 🟢 Low Priority / Nice to Have

9. **Roll number has no uniqueness constraint in DB**
   - Two students could register with the same roll number
   - Fix: add `unique: true` to `rollNumber` field in `User.js`

10. **No production deployment guide**
    - README only covers local dev
    - Recommended stack: Render (backend) + Vercel or Netlify (frontend) — both have free tiers

11. **No OTP attempt counter**
    - A 6-digit OTP has 1,000,000 possibilities; with no limit, it could be brute-forced in 10 min
    - For an internal app where users are identifiable university students, risk is low but non-zero
    - Fix: invalidate OTP after 5 wrong attempts

12. **`helmet.js` (HTTP security headers) not installed**
    - Low risk for internal tool but a 1-line fix
    - Fix: `npm install helmet` → `app.use(helmet())` before routes

13. **JWT in localStorage (theoretical XSS risk)**
    - `httpOnly` cookies would be more secure
    - For this internal app with no user-generated rich content, XSS is very unlikely — acceptable trade-off, keep as-is unless there's a specific reason to change

---

## Development Setup

```bash
# Terminal 1 — Backend (port 5000)
cd server
npm install
# Create server/.env from .env.example and fill in values
npm run dev

# Terminal 2 — Frontend (port 5173)
cd client
npm install
npm run dev
```

Open `http://localhost:5173`

### Required `.env` values (server/.env)
```
MONGODB_URI=          # MongoDB Atlas connection string
JWT_SECRET=           # Long random string (32+ chars)
PORT=5000
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=          # Email for admin account (any valid email)
ADMIN_PASSWORD=       # Admin password
ADMIN_NAME=Sports Head
EMAIL_USER=           # Gmail address for sending OTPs
EMAIL_PASS=           # Gmail App Password (NOT the regular Gmail password)
```

### Email Configuration Status
- **Provider**: Gmail SMTP via Nodemailer — ✅ **Working**
- **Account**: `TurnUp.nu@gmail.com` — configured in `server/.env`
- **App Password**: ✅ Set in `EMAIL_PASS` in `server/.env` (16-char Gmail App Password)
- **Known issue**: Emails land in **spam** on recipient inboxes — expected for a new Gmail account with no sending reputation. Improves over time as the account sends more emails.
- **Workaround**: Tell students to check their spam/junk folder if OTP doesn't arrive within 30 seconds.
- **Important fix**: Transporter is created inside `sendEmail()` (not at module level) — this ensures it always reads fresh `process.env` values after hot-reloads. Do not move it back to module scope.

---

## Key Design Decisions (Context for Future Work)

- **Single CSS file**: All styles are in `client/src/styles/index.css`. There are no CSS modules or component-scoped styles. Follow existing class naming conventions when adding new components.
- **No state management library**: Auth state is in `AuthContext`. No Redux/Zustand. Keep it that way unless complexity grows significantly.
- **No TypeScript strictness**: `tsconfig.json` has `checkJs: true` but the project is `.jsx` files, not `.tsx`. Don't enforce strict typing unless refactoring.
- **CommonJS on backend**: Server uses `require()`/`module.exports`. Do not mix in ES module `import/export` syntax.
- **Single active turf**: The entire booking flow assumes one active turf found via `Turf.findOne({ isActive: true })`. Multi-turf support would require significant refactoring.
- **Same-day only bookings**: The app intentionally only shows today's slots. There is no advance booking. This is a product decision.
- **Passwords minimum 6 characters**: Validated in Mongoose schema and `resetPassword` controller.
