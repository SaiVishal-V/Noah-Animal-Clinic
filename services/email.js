// services/email.js
// Nodemailer email fallback - fires when WhatsApp fails OR as additional notification

import nodemailer from "nodemailer";

const CLINIC_NAME = "Noah Animal Clinic";
const CLINIC_EMAIL = process.env.CLINIC_EMAIL; // clinic's Gmail

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD, // Gmail App Password (not login password)
    },
  });
}

async function sendEmail(to, subject, html) {
  // Skip if email config is missing
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.warn("[Email] Email env vars not configured, skipping.");
    return null;
  }

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `"${CLINIC_NAME}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
  console.log(`[Email] Sent: ${info.messageId}`);
  return info;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function emailBookingReceived(appointment) {
  const { owner_name, pet_type, service, preferred_date, preferred_time } = appointment;
  // Notify clinic owner
  await sendEmail(
    CLINIC_EMAIL,
    `🐾 New Appointment Request – ${owner_name}`,
    `<h2>New Appointment Booking</h2>
     <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
       <tr><td style="padding:8px;font-weight:bold">Owner</td><td style="padding:8px">${owner_name}</td></tr>
       <tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">${appointment.phone}</td></tr>
       <tr><td style="padding:8px;font-weight:bold">Pet</td><td style="padding:8px">${appointment.pet_name || "—"} (${pet_type})</td></tr>
       <tr><td style="padding:8px;font-weight:bold">Service</td><td style="padding:8px">${service}</td></tr>
       <tr><td style="padding:8px;font-weight:bold">Date</td><td style="padding:8px">${preferred_date}</td></tr>
       <tr><td style="padding:8px;font-weight:bold">Time</td><td style="padding:8px">${preferred_time}</td></tr>
       <tr><td style="padding:8px;font-weight:bold">Notes</td><td style="padding:8px">${appointment.notes || "—"}</td></tr>
     </table>
     <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/dashboard">Open Admin Dashboard →</a></p>`
  );
}

export async function emailStatusUpdate(appointment, newStatus) {
  // Optionally send status update email to clinic staff
  await sendEmail(
    CLINIC_EMAIL,
    `Appointment ${newStatus.toUpperCase()} – ${appointment.owner_name}`,
    `<h2>Appointment Status Updated</h2>
     <p><strong>Patient:</strong> ${appointment.owner_name} (${appointment.phone})</p>
     <p><strong>New Status:</strong> <span style="text-transform:uppercase;font-weight:bold">${newStatus}</span></p>
     ${appointment.reschedule_date ? `<p><strong>New Slot:</strong> ${appointment.reschedule_date} at ${appointment.reschedule_time}</p>` : ""}
     ${appointment.admin_note ? `<p><strong>Note:</strong> ${appointment.admin_note}</p>` : ""}`
  );
}
