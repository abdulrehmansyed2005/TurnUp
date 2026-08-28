# TurnUp ⚽🏀 — Sports Slot Booking System
### Technical & Product Pitch Document
**Prepared for:** FAST NUCES Lahore Administration
**Prepared by:** Abdul Rehman Syed
**Version:** 1.0 — August 2026

---

## 1. Executive Summary

**TurnUp** is a digital sports slot booking platform built specifically for FAST NUCES Lahore. It replaces the manual, informal process of reserving futsal and basketball court time with a structured, fair, and transparent system accessible from any device — including mobile phones — without requiring an app installation.

Students register with their official university email, book a 1-hour sports slot for the day, and receive an instant email notification when the admin approves or rejects their request. The sports head manages everything from a dedicated admin dashboard — approving bookings, blocking slots for maintenance, and monitoring daily usage statistics in real time.

**The system is fully built, deployed, and live.**

---

## 2. The Problem

Currently, court time at FAST NUCES Lahore is allocated through:
- WhatsApp messages to the sports head
- Walk-ins to the sports office
- Word-of-mouth arrangements

This creates several problems:
- **No transparency** — students don't know if a slot is taken
- **No fairness** — no first-come, first-served enforcement
- **No records** — no history of who used the court and when
- **Admin burden** — the sports head manually tracks everything
- **Conflicts** — multiple groups showing up for the same slot

TurnUp solves all of these in one system.

---

## 3. Live Deployment

The system is already running in production:

| Service | URL |
|---|---|
| **Student App** | https://turnup-pi.vercel.app |
| **Backend API** | https://turnup-production-9e71.up.railway.app |
| **API Health** | https://turnup-production-9e71.up.railway.app/api/health |

- **Frontend** hosted on Vercel (free tier, global CDN)
- **Backend** hosted on Railway (Node.js server)
- **Database** hosted on MongoDB Atlas (cloud database, free tier)
- **Emails** sent via Gmail SMTP through a dedicated `TurnUp.nu@gmail.com` account

---

## 4. Technology Stack

| Layer | Technology | Details |
|---|---|---|
| Frontend Framework | **React 19** | Component-based UI library |
| Build Tool | **Vite 8** | Lightning-fast dev + production builds |
| Routing | **React Router 7** | Client-side navigation |
| HTTP Client | **Axios 1.18** | API calls with interceptors |
| Styling | **Vanilla CSS** | Single 1,700-line design system file |
| PWA | **Service Worker** | Installable on mobile, works offline |
| Backend Framework | **Express 5** | Node.js REST API server |
| Database | **MongoDB + Mongoose 9** | Cloud-hosted via MongoDB Atlas |
| Authentication | **JWT (JSON Web Tokens)** | 7-day session tokens |
| Password Hashing | **bcryptjs** | 12 salt rounds |
| Email | **Nodemailer + Gmail SMTP** | OTP + booking notification emails |
| Runtime | **Node.js 18+** | Server-side JavaScript |
| Deployment | **Vercel + Railway** | Zero-downtime cloud deployment |

**No paid licenses required.** All technologies used are open source or free-tier cloud services.

---

## 5. System Architecture

```
┌─────────────────────────────────────────┐
│          Student / Admin Browser         │
│    (Mobile PWA or Desktop Browser)       │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────┐
│         Vercel (Frontend CDN)            │
│  React 19 + Vite PWA                    │
│  9 Pages, 5 Components                  │
└──────────────┬──────────────────────────┘
               │ HTTPS REST API (JWT Bearer Token)
               ▼
┌─────────────────────────────────────────┐
│         Railway (Backend Server)         │
│  Express 5 API — 4 Route Groups         │
│  • /api/auth      (7 endpoints)         │
│  • /api/bookings  (4 endpoints)         │
│  • /api/admin     (6 endpoints)         │
│  • /api/turfs     (1 endpoint)          │
└──────────────┬──────────────────────────┘
               │ Mongoose ODM
               ▼
┌─────────────────────────────────────────┐
│      MongoDB Atlas (Cloud Database)      │
│  4 Collections:                          │
│  • users   • bookings                   │
│  • turfs   • blockedslots               │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    Gmail SMTP (Email Notifications)      │
│  • OTP verification emails              │
│  • Password reset emails                │
│  • Booking approval/rejection emails    │
│  • Waitlist "moved up" emails           │
└─────────────────────────────────────────┘
```

---

## 6. Repository Structure

```
TurnUp/
├── client/                         # React 19 + Vite frontend (PWA)
│   ├── public/
│   │   ├── sw.js                   # Service Worker (offline support)
│   │   └── offline.html            # Offline fallback page
│   └── src/
│       ├── App.jsx                 # Root router + layout
│       ├── context/
│       │   └── AuthContext.jsx     # Global auth state (server-verified)
│       ├── components/
│       │   ├── Navbar.jsx          # Bottom navigation bar
│       │   ├── ProtectedRoute.jsx  # Route guard
│       │   ├── Toast.jsx           # Global notification system
│       │   ├── Modal.jsx           # Reusable modal
│       │   └── OtpInput.jsx        # 6-digit OTP input
│       ├── pages/
│       │   ├── Login.jsx           # Login page
│       │   ├── Register.jsx        # Registration page
│       │   ├── VerifyEmail.jsx     # OTP verification
│       │   ├── ForgotPassword.jsx  # Password reset flow
│       │   ├── Home.jsx            # Today's slot grid (⚽/🏀 tabs)
│       │   ├── BookSlot.jsx        # Booking confirmation + waitlist screen
│       │   ├── MyBookings.jsx      # Student booking history + cancel
│       │   ├── Profile.jsx         # User profile
│       │   └── AdminDashboard.jsx  # Admin: stats, approve/reject, blocks
│       ├── styles/
│       │   └── index.css           # Full design system (~1,700 lines)
│       └── utils/
│           └── api.js              # Axios instance with auto-auth
│
├── server/                         # Node.js + Express backend
│   ├── server.js                   # App entry: middleware, routes, startup
│   ├── config/db.js                # MongoDB connection
│   ├── models/
│   │   ├── User.js                 # Student/admin schema
│   │   ├── Booking.js              # Booking schema + indexes
│   │   ├── Turf.js                 # Court config + slot generator
│   │   └── BlockedSlot.js          # Admin-blocked slot schema
│   ├── controllers/
│   │   ├── authController.js       # All auth logic (register, OTP, login...)
│   │   ├── bookingController.js    # Slot availability + booking logic
│   │   ├── adminController.js      # Admin actions + stats
│   │   └── turfController.js       # Turf listing
│   ├── middleware/
│   │   ├── auth.js                 # JWT verification middleware
│   │   └── adminOnly.js            # Admin role guard
│   ├── routes/
│   │   ├── auth.js, bookings.js, admin.js, turfs.js
│   ├── utils/
│   │   ├── generateToken.js        # JWT signing
│   │   ├── seedAdmin.js            # Auto-create admin on first boot
│   │   └── sendEmail.js            # Nodemailer email helper
│   └── scripts/
│       └── seedBasketball.js       # One-time Basketball Court setup
│
├── railway.toml                    # Railway deployment config
└── .env.example                    # Environment variable template
```

---

## 7. User Roles

### Student
- Registers with `l######@lhr.nu.edu.pk` email only (strictly enforced)
- Verifies identity via 6-digit OTP sent to their university email
- Can book **one Futsal slot** and **one Basketball slot** per day (independently)
- Sees today's court availability in real time
- Receives email when their booking is approved or rejected
- Can cancel bookings (with restrictions)

### Sports Head Admin
- Pre-configured account (no public registration)
- Views all pending, approved, and rejected bookings
- Approves or rejects bookings with an optional note
- Blocks specific time slots with a reason (e.g., "Court maintenance")
- Views daily statistics for both courts
- Filters bookings by sport (Futsal / Basketball) and by date
- Receives browser notification + audio alert when a new booking arrives

---

## 8. Complete User Flow

### 8.1 Student Registration & Login

```
Student visits TurnUp
    → Fills registration form (name, email, roll number, department, password)
    → System validates: must be l######@lhr.nu.edu.pk format
    → System sends 6-digit OTP to their university email (expires in 10 min)
    → Student enters OTP on verification screen
    → Account activated → JWT token issued → Student logged in
    → Token stored locally, valid for 7 days
```

### 8.2 Booking a Slot (Waitlist System)

```
Student opens Home → selects sport tab (⚽ Futsal or 🏀 Basketball)
    → Sees today's 8 time slots (9AM–5PM, 1-hour each, Mon–Fri)
    → Taps an available slot
    → Enters team name → submits booking

IF slot has no pending requests:
    → Booking created (status: pending)
    → Student sees "Added to Queue!" confirmation
    → Admin sees booking with "#1 Priority" badge

IF slot already has pending requests:
    → Booking joins the waitlist (first-come, first-served)
    → Student sees "Added to Queue!" (no position revealed)
    → Admin sees all requests for that slot sorted by priority
```

### 8.3 Admin Approval Flow

```
Admin opens dashboard → sees all pending bookings sorted by time + priority
    → Reviews student details (name, roll number, department, team name)

IF Admin APPROVES booking #1:
    → Booking status → approved
    → Student receives approval email instantly
    → ALL other pending requests for that slot are auto-rejected
    → Each displaced student receives a "Slot filled" email
    → Slot marked as confirmed on the public grid

IF Admin REJECTS booking #1:
    → Booking status → rejected
    → Student receives rejection email
    → Next person in the waitlist receives "You've moved up!" email
    → Admin then sees #2 (now #1) as the next to review
```

### 8.4 Cancellation Rules

```
Student cancels a booking:

  IF more than 2 hours before slot start:
      → Booking cancelled
      → Student CAN book a different slot today
      → canRebook = true

  IF less than 2 hours before slot start:
      → Booking cancelled
      → Student is LOCKED OUT from rebooking today for that sport
      → canRebook = false

  Maximum 3 cancellations per day enforced.
  Cannot cancel a slot that has already ended.
```

---

## 9. All Business Rules

| # | Rule | How It's Enforced |
|---|---|---|
| 1 | Only `@lhr.nu.edu.pk` emails | Mongoose regex validation in User model |
| 2 | Email must be verified before login | `isVerified` flag; middleware rejects unverified users |
| 3 | OTP expires in 10 minutes | `otpExpiry` field checked on every OTP attempt |
| 4 | OTP locked after 3 wrong attempts | `otpAttempts` counter with lockout |
| 5 | Login locked after 5 failed attempts | `loginAttempts` + `loginLockUntil` (15-min lockout) |
| 6 | One Futsal booking per student per day | Compound DB index: `(user, turf, date)` |
| 7 | One Basketball booking per student per day | Same index, scoped per-turf (independent of Futsal) |
| 8 | Slots only available Mon–Fri | `operatingDays: [1,2,3,4,5]` in Turf model |
| 9 | Only 9AM–5PM, 1-hour slots | `openTime`, `closeTime`, `slotDuration` in Turf |
| 10 | Cannot book a past or current slot | `timeToMinutes` comparison before creating booking |
| 11 | Cannot book a slot rejected for you today | `rejected` + same `startTime` check in controller |
| 12 | Cancelled within 2 hours = locked out today | `canRebook: false` flag; checked on new booking attempt |
| 13 | Max 3 cancellations per day | `countDocuments` check in cancel endpoint |
| 14 | Cannot cancel after slot end time | End time vs. current time check |
| 15 | Past pending slots auto-expire | `autoExpirePendingBookings()` runs on every slot fetch |
| 16 | Admins cannot book slots | Explicit `role === 'admin'` block in `createBooking` |
| 17 | Blocked slots show reason publicly | `BlockedSlot.reason` returned in slot availability API |
| 18 | Admin cannot act on expired slots | Slot end time vs. now check before approve/reject |
| 19 | Approving a slot auto-rejects all others | Bulk `updateMany` on sibling pending bookings |
| 20 | Waitlist is first-come, first-served | Sorted by `createdAt: 1` (ascending) throughout |
| 21 | Admin note max 300 characters | Length validation in `updateBookingStatus` |
| 22 | Team name sanitised (no HTML) | Strip HTML tags before saving to DB |
| 23 | Team name max 50 characters | `maxLength: 50` on input field |
| 24 | Slot can only be approved once | Status check: only `pending` bookings can be acted on |

---

## 10. Security Measures

| Measure | Implementation |
|---|---|
| **Domain-restricted registration** | Only `l######@lhr.nu.edu.pk` emails accepted |
| **Email OTP verification** | 6-digit OTP, bcrypt-hashed in DB, 10-min expiry |
| **Password hashing** | bcryptjs with 12 salt rounds |
| **JWT authentication** | 7-day tokens, verified on every protected request |
| **Role-based access** | `auth.js` + `adminOnly.js` middleware stack |
| **Rate limiting** | 200 req/15min global; 10 req/15min on auth routes |
| **Security headers** | `helmet.js` applied to all responses |
| **Request body limit** | 10KB max to prevent memory attacks |
| **OTP brute-force protection** | Locked after 3 wrong OTP attempts |
| **Login brute-force protection** | Locked 15 minutes after 5 failed logins |
| **Input sanitisation** | HTML stripped from team name; length limits on all fields |
| **Query injection prevention** | Status/date params validated as string enums before use |
| **MongoDB ObjectId validation** | All `:id` params validated before querying |
| **Sensitive fields never returned** | `password`, `otp`, `otpExpiry` use `select: false` |
| **No sensitive data in localStorage** | Role never trusted from localStorage; always re-verified from server |

---

## 11. Database Models

### User
| Field | Type | Notes |
|---|---|---|
| `name` | String | 2–50 characters |
| `email` | String | Unique; `l######@lhr.nu.edu.pk` for students |
| `password` | String | bcrypt hash; never returned in API |
| `role` | String | `student` or `admin` |
| `department` | String | e.g., "Computer Science" |
| `rollNumber` | String | Unique |
| `isVerified` | Boolean | Must be `true` to log in |
| `otp` | String | Hashed; `select: false` |
| `otpExpiry` | Date | 10 minutes from generation |
| `otpAttempts` | Number | Resets on success; locks at 3 |
| `loginAttempts` | Number | Locks at 5 for 15 minutes |

### Booking
| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → User | Who booked |
| `turf` | ObjectId → Turf | Which court |
| `date` | Date | Midnight-normalised |
| `startTime` | String | "HH:MM" format |
| `endTime` | String | "HH:MM" format |
| `teamName` | String | Publicly visible on slot grid |
| `status` | String | `pending`, `approved`, `rejected`, `cancelled`, `expired` |
| `cancelledAt` | Date | Set on cancellation |
| `canRebook` | Boolean | `false` if cancelled within 2 hours |
| `adminNote` | String | Optional; shown to student |

**Indexes:**
- Unique compound index on `{turf, date, startTime, status: approved}` — prevents two approved bookings for the same slot
- Index on `{user, turf, date}` — enforces one-booking-per-sport-per-day

### Turf
| Field | Type | Current Value |
|---|---|---|
| `name` | String | "FAST NUCES Futsal Turf" / "Basketball Court" |
| `sportTypes` | String[] | `['Futsal']` or `['Basketball']` |
| `openTime` | String | `"09:00"` |
| `closeTime` | String | `"17:00"` |
| `slotDuration` | Number | `60` (minutes) |
| `operatingDays` | Number[] | `[1,2,3,4,5]` (Mon–Fri) |
| `isActive` | Boolean | `true` |

`generateSlots()` method auto-computes all time slots from open to close time.

### BlockedSlot
| Field | Type | Notes |
|---|---|---|
| `turf` | ObjectId → Turf | Which court |
| `date` | Date | The blocked date |
| `startTime` / `endTime` | String | Slot time range |
| `reason` | String | Shown publicly to students |
| `blockedBy` | ObjectId → User | Which admin blocked it |

---

## 12. API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register new student; sends OTP email |
| POST | `/verify-otp` | Public | Verify OTP; returns JWT token |
| POST | `/resend-otp` | Public | Resend OTP to email |
| POST | `/login` | Public | Login; returns JWT token |
| GET | `/me` | Private | Get current user profile |
| POST | `/forgot-password` | Public | Send password reset OTP |
| POST | `/reset-password` | Public | Set new password with OTP |

### Bookings (`/api/bookings`)
| Method | Endpoint | Access | Query Params | Description |
|---|---|---|---|---|
| GET | `/available` | Private | `?sport=Futsal\|Basketball` | Today's slot grid |
| POST | `/` | Private | — | Create booking / join waitlist |
| GET | `/my` | Private | `?status=pending\|...` | Student's booking history |
| PATCH | `/:id/cancel` | Private | — | Cancel a booking |

### Admin (`/api/admin`)
| Method | Endpoint | Access | Query Params | Description |
|---|---|---|---|---|
| GET | `/bookings` | Admin | `?date=&status=&sport=` | All bookings with waitlist positions |
| PATCH | `/bookings/:id` | Admin | — | Approve or reject; triggers emails |
| GET | `/stats` | Admin | `?date=&sport=` | Dashboard statistics |
| POST | `/block-slot` | Admin | — | Block a slot with reason |
| DELETE | `/block-slot/:id` | Admin | — | Unblock a slot |
| GET | `/blocked-slots` | Admin | `?date=` | List blocked slots |

### Turfs (`/api/turfs`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/` | Private | List active courts |

---

## 13. Email Notifications

All emails use styled HTML templates with the TurnUp branding.

| Trigger | Recipient | Email Content |
|---|---|---|
| Registration | Student | 6-digit OTP for email verification |
| Forgot password | Student | 6-digit OTP for password reset |
| Booking approved | Student | Approval confirmation + slot details |
| Booking rejected | Student | Rejection notice + optional admin note |
| Slot filled (auto-rejected) | Student | "Another team was confirmed for this slot" |
| Moved up in waitlist | Student | "You've moved up — you're now #N in the queue" |

---

## 14. Admin Dashboard Features

- **Live statistics** — pending, approved, rejected, cancelled booking counts; total student count
- **Sport filter** — view Futsal bookings, Basketball bookings, or both at once
- **Date filter** — browse historical bookings by any date
- **Pending bookings list** — sorted by time slot, then by priority (#1, #2... within each slot)
- **Priority badges** — `#1 Priority` (green), `#2 In Queue` (amber), etc.
- **Queue size indicator** — shows "3 requests for this slot" on relevant cards
- **Approve/Reject with note** — optional message sent to the student
- **Auto-reject warning** — modal warns admin that approving will auto-reject N other waitlisted requests
- **Block slots** — prevent booking of a specific slot with a public reason
- **Unblock slots** — remove a block in one click
- **Auto-refresh** — dashboard refreshes every 15 seconds automatically
- **New booking alerts** — browser notification, audio ping, and tab title flash when a new booking arrives

---

## 15. Progressive Web App (PWA)

TurnUp is installable on any device as a PWA:

- Students on Android can tap **"Add to Home Screen"** — the app opens full-screen like a native app
- iOS Safari also supports installation via the Share menu
- **Offline support** — if the internet drops, the app shows a branded offline page instead of a browser error
- **Caching strategy** — API calls always go to the network (live data); static assets are cached for fast load

---

## 16. Why TurnUp vs. Alternatives

| Approach | Problem |
|---|---|
| WhatsApp groups | No accountability, no records, conflicts |
| Google Forms | No real-time availability, admin still processes manually |
| Generic booking app | Not integrated with university emails, no domain restriction |
| Excel sheet | Not accessible on mobile, no notifications, manual updates |
| **TurnUp** | ✅ University-specific, real-time, automated notifications, full audit trail |

---

## 17. Environment & Configuration

### Required Server Environment Variables
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for signing tokens (128-char hex) |
| `CLIENT_URL` | Frontend URL for CORS (e.g., `https://turnup-pi.vercel.app`) |
| `ADMIN_EMAIL` | Sports head admin email |
| `ADMIN_PASSWORD` | Admin account password |
| `ADMIN_NAME` | Display name for admin |
| `EMAIL_USER` | Gmail address for sending emails |
| `EMAIL_PASS` | Gmail App Password (16-char) |
| `TZ` | `Asia/Karachi` — critical for correct slot times in PKT |
| `NODE_ENV` | `production` |

### Required Frontend Environment Variables
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base URL |

---

## 18. Operational Notes

- **Operating hours**: Monday–Friday, 9:00 AM – 5:00 PM (8 slots per court per day)
- **Email delivery**: OTP and notification emails come from `TurnUp.nu@gmail.com`. Students should check spam/junk if OTP doesn't arrive within 30 seconds — normal for a new sender account; improves over time.
- **Timezone**: Server is configured to `Asia/Karachi` (PKT, UTC+5). All slot times are in local time.
- **Database**: MongoDB Atlas free tier (512MB) — sufficient for hundreds of students and years of booking history.
- **Hosting cost**: Currently **free** across all platforms (Vercel free tier, Railway trial/free tier, MongoDB Atlas free tier).

---

## 19. Future Roadmap (Possible Enhancements)

| Feature | Description |
|---|---|
| Advance booking | Allow booking 1–2 days ahead instead of same-day only |
| Recurring reservations | Weekly standing slots for sports societies |
| Multi-campus support | Extend to other FAST campuses (Islamabad, Karachi, etc.) |
| Usage analytics | Charts showing peak usage hours, most popular slots |
| SMS notifications | WhatsApp/SMS fallback if email isn't checked |
| Student feedback | Post-session rating system |
| Equipment booking | Reserve footballs, basketballs alongside the slot |
| Multiple admins | Support for more than one sports administrator |

---

## 20. Summary

TurnUp is a production-ready, fully deployed digital sports court booking system built from the ground up for FAST NUCES Lahore. It handles the complete lifecycle — registration, verification, booking, waitlisting, approval, notification, and cancellation — with proper security, fairness, and audit trails.

It is accessible from any device, requires no installation, restricts access to university students only, and requires zero ongoing cost to run.

The system is live today at **https://turnup-pi.vercel.app** and ready for official adoption.

---

*Built by Abdul Rehman Syed — FAST NUCES Lahore*
*Stack: React · Express · MongoDB · Railway · Vercel*
