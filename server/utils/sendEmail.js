const nodemailer = require('nodemailer');

// L10: Create transporter ONCE at module load — not on every email call.
// Creating a new SMTP connection per email causes connection limit issues under burst load.
const transporter = nodemailer.createTransport({
  // Explicit host/port instead of service:'gmail' so socketOptions are honoured.
  // service:'gmail' short-circuit ignores the family option, causing ENETUNREACH
  // on Railway where IPv6 routing to Google SMTP is broken.
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
  // Force IPv4 at the TCP socket level — prevents ENETUNREACH on IPv6-only DNS answers
  socketOptions: { family: 4 },
});

const sendEmail = async (to, subject, html) => {
  await transporter.sendMail({
    from: `"TurnUp ⚽" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

const sendOTPEmail = async (email, otp) => {
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #0a0f1c 0%, #111827 100%); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #10b981; font-size: 28px; margin: 0;">⚽ TurnUp</h1>
        <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0;">FAST NUCES Lahore — Turf Booking</p>
      </div>
      <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; text-align: center;">
        <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 16px;">Your verification code is:</p>
        <div style="background: rgba(16, 185, 129, 0.1); border: 2px dashed #10b981; border-radius: 12px; padding: 16px; display: inline-block;">
          <span style="color: #10b981; font-size: 36px; font-weight: 700; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #9ca3af; font-size: 13px; margin: 16px 0 0;">This code expires in <strong style="color: #f59e0b;">10 minutes</strong>.</p>
      </div>
      <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 20px 0 0;">If you didn't request this, ignore this email.</p>
    </div>
  `;

  await sendEmail(email, 'TurnUp — Verify Your Email', html);
};

module.exports = { sendEmail, sendOTPEmail };
