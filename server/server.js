const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const connectDB = require('./config/db');
const seedAdmin = require('./utils/seedAdmin');

// Load env vars
dotenv.config();

const app = express();

// Security headers (FIX #12)
app.use(helmet());

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' })); // M7: prevent memory exhaustion via huge request bodies

// ── Rate limiting ─────────────────────────────────────────────────────────────
// H3: Global limiter for all API routes — prevents flooding of bookings/admin/turfs
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // generous for legitimate use; still blocks scripted floods
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again.' },
});

// Stricter limiter for auth routes: 10 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please wait 15 minutes and try again.' },
});
// ─────────────────────────────────────────────────────────────────────────────

// Routes — global limiter first, then per-route stricter limits
app.use(globalLimiter);
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/turfs', require('./routes/turfs'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// Start server
const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    await seedAdmin();

    app.listen(PORT, () => {
      console.log(`\n🚀 TurnUp Server running on port ${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
      console.log(`💚 Health: http://localhost:${PORT}/api/health`);

      // FIX #2: Warn if timezone is not set to PKT — critical for date/slot logic
      if (process.env.TZ !== 'Asia/Karachi') {
        console.warn(`\n⚠️  WARNING: TZ is not set to Asia/Karachi (current: ${process.env.TZ || 'system default'}).`);
        console.warn(`   Slot availability and date logic may be incorrect on UTC servers.`);
        console.warn(`   Set TZ=Asia/Karachi in your environment or hosting platform.\n`);
      } else {
        console.log(`🕐 Timezone: Asia/Karachi (PKT) ✅\n`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
