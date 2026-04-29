# 🐾 Noah Animal Clinic – Appointment Booking System

Full-stack appointment booking system with admin dashboard and WhatsApp notifications.

## Architecture Overview

```
public/index.html          ← Static landing page (existing site, form-fixed)
pages/
  admin/
    index.js               ← Admin login (/admin)
    dashboard.js           ← Doctor dashboard (/admin/dashboard)
  api/
    appointments/
      index.js             ← POST (create) + GET (list, admin-only)
      [id].js              ← PATCH (update status, admin-only)
    admin/
      login.js             ← POST login / DELETE logout / GET session check
services/
  supabase.js              ← All DB operations (createAppointment, getAppointments, etc.)
  whatsapp.js              ← Twilio WhatsApp message templates
  email.js                 ← Nodemailer Gmail fallback
lib/
  auth.js                  ← JWT session management (sign, verify, cookie helpers)
supabase-schema.sql        ← Run this once in Supabase SQL editor
.env.local.example         ← Copy to .env.local and fill in your values
```

---

## Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) → Create new project
2. Go to **SQL Editor** → New Query
3. Paste and run the contents of **`supabase-schema.sql`**
4. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ Use `service_role` key only in server-side API routes. Never expose it in the browser.

---

## Step 2: Twilio WhatsApp Setup

### Sandbox (for testing – free, no approval needed)

1. Go to [console.twilio.com](https://console.twilio.com)
2. Click **Messaging → Try it out → Send a WhatsApp message**
3. Copy your **Account SID** and **Auth Token** from the main dashboard
4. The sandbox **From** number is: `whatsapp:+14155238886`
5. **You must join the sandbox first** on your phone:
   - Send `join <your-sandbox-keyword>` to `+1 415 523 8886` on WhatsApp

### Production (requires Twilio WhatsApp Business approval)
- Register at [twilio.com/whatsapp](https://www.twilio.com/en-us/whatsapp)
- Once approved, replace `TWILIO_WHATSAPP_FROM` with your approved number

---

## Step 3: Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR...

TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

ADMIN_EMAIL=doctor@noahclinic.com
ADMIN_PASSWORD=YourSecurePassword!
ADMIN_JWT_SECRET=generate-with-openssl-rand-hex-32

EMAIL_USER=clinic@gmail.com
EMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
CLINIC_EMAIL=doctor@noahclinic.com

NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
```

---

## Step 4: Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
# Admin: http://localhost:3000/admin
```

---

## Step 5: Deploy to Vercel

### Option A: Via Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Option B: Via GitHub (recommended)
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → Select repo
3. Framework: **Next.js** (auto-detected)
4. Go to **Settings → Environment Variables** and add all variables from `.env.local`
5. Click **Deploy**

> ✅ Vercel automatically handles serverless API routes (`pages/api/**`)

---

## API Reference

### `POST /api/appointments`
Create a new appointment.
```json
{
  "owner_name": "Rahul Sharma",
  "phone": "9876543210",
  "pet_name": "Bruno",
  "pet_type": "Dog",
  "service": "Wellness Check-up",
  "preferred_date": "2024-07-20",
  "preferred_time": "11:00 AM – 1:00 PM",
  "notes": "Bruno has been lethargic for 2 days"
}
```
Response `201`:
```json
{ "success": true, "message": "Appointment request received!", "data": { "id": "uuid...", "status": "pending" } }
```

### `GET /api/appointments` *(admin only)*
Get all appointments. Filter: `?status=pending`

### `PATCH /api/appointments/:id` *(admin only)*
Update status.
```json
// Accept:
{ "status": "confirmed" }

// Reject:
{ "status": "cancelled", "admin_note": "Doctor on leave" }

// Reschedule:
{ "status": "rescheduled", "reschedule_date": "2024-07-22", "reschedule_time": "2:00 PM – 4:00 PM", "admin_note": "Rescheduled due to emergency" }
```

---

## End-to-End Test Flow

1. **Book an appointment**: Open `/`, fill form → submit → check WhatsApp
2. **Login as admin**: Open `/admin` → use `ADMIN_EMAIL` / `ADMIN_PASSWORD`
3. **View dashboard**: `/admin/dashboard` → see the pending appointment
4. **Accept**: Click ✅ Accept → patient gets WhatsApp: "Appointment confirmed"
5. **Reject**: Click ❌ Reject → patient gets WhatsApp: "Doctor unavailable"
6. **Reschedule**: Click 🔄 Reschedule → pick new date/time → save → patient gets new time on WhatsApp

---

## WhatsApp Message Flow

| Event | Trigger | Message to Patient |
|---|---|---|
| Booking | User submits form | "Your request is received" + details |
| Accept | Admin clicks Accept | "Appointment confirmed" + date/time |
| Reject | Admin clicks Reject | "Doctor unavailable" + note |
| Reschedule | Admin picks new slot | "New proposed time: X" |

---

## Security Notes

- Admin JWT stored in `HttpOnly` cookie (not accessible via JS)
- `SUPABASE_SERVICE_ROLE_KEY` only used server-side (never in browser)
- Admin routes return `401` without valid session cookie
- `/admin` pages have `noindex,nofollow` robots meta tags
- HTTPS enforced via Vercel (and `Secure` cookie flag in production)

---

## Gmail App Password Setup (for email fallback)

1. Enable 2FA on your Google account
2. Go to: **Google Account → Security → 2-Step Verification → App Passwords**
3. Create an app password for "Mail"
4. Use that 16-char code as `EMAIL_APP_PASSWORD`
