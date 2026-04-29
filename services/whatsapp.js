// services/whatsapp.js
// Twilio WhatsApp integration for all appointment notifications

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
const CLINIC_NAME = "Noah Animal Clinic";

/**
 * Send a WhatsApp message via Twilio
 */
async function sendWhatsApp(toPhone, message) {
  // Normalize phone: strip non-digits, ensure country code
  const digits = toPhone.replace(/\D/g, "");
  const normalized = digits.startsWith("91") ? digits : `91${digits}`;
  const to = `whatsapp:+${normalized}`;

  const body = new URLSearchParams({
    From: FROM_NUMBER,
    To: to,
    Body: message,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
      },
      body: body.toString(),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("[WhatsApp] Twilio error:", result);
    throw new Error(result.message || "Failed to send WhatsApp message");
  }

  console.log(`[WhatsApp] Sent to ${to}: SID ${result.sid}`);
  return result;
}

// ─── Message Templates ───────────────────────────────────────────────────────

/**
 * Sent immediately when a user books an appointment
 */
export async function notifyBookingReceived(appointment) {
  const { owner_name, pet_name, pet_type, service, preferred_date, preferred_time, phone } = appointment;
  const petLabel = pet_name ? `${pet_name} (${pet_type})` : pet_type;
  const message =
    `🐾 *${CLINIC_NAME}* – Booking Received!\n\n` +
    `Hi ${owner_name}, your appointment request has been received.\n\n` +
    `📋 *Details:*\n` +
    `• Pet: ${petLabel}\n` +
    `• Service: ${service}\n` +
    `• Requested Date: ${preferred_date}\n` +
    `• Requested Time: ${preferred_time}\n\n` +
    `Our team will confirm your slot shortly. For urgent help, call 📞 76720 55007.`;

  return sendWhatsApp(phone, message);
}

/**
 * Sent when doctor accepts the appointment
 */
export async function notifyAppointmentConfirmed(appointment) {
  const { owner_name, pet_name, pet_type, service, preferred_date, preferred_time, phone } = appointment;
  const petLabel = pet_name ? `${pet_name} (${pet_type})` : pet_type;
  const message =
    `✅ *${CLINIC_NAME}* – Appointment Confirmed!\n\n` +
    `Hi ${owner_name}, your appointment is *confirmed*.\n\n` +
    `📅 *Confirmed Slot:*\n` +
    `• Pet: ${petLabel}\n` +
    `• Service: ${service}\n` +
    `• Date: *${preferred_date}*\n` +
    `• Time: *${preferred_time}*\n\n` +
    `📍 Noah Animal Clinic, Kurnool\n` +
    `Please arrive 10 minutes early. See you soon! 🐶🐱`;

  return sendWhatsApp(phone, message);
}

/**
 * Sent when doctor rejects / is unavailable
 */
export async function notifyAppointmentCancelled(appointment) {
  const { owner_name, phone, admin_note } = appointment;
  const reasonLine = admin_note
    ? `\n📝 Reason: ${admin_note}`
    : "";
  const message =
    `❌ *${CLINIC_NAME}* – Appointment Unavailable\n\n` +
    `Hi ${owner_name}, unfortunately the doctor is unavailable for your requested time slot.${reasonLine}\n\n` +
    `Please call 📞 76720 55007 or WhatsApp us to reschedule at a convenient time. We apologise for the inconvenience.`;

  return sendWhatsApp(phone, message);
}

/**
 * Sent when doctor proposes a new time (reschedule)
 */
export async function notifyAppointmentRescheduled(appointment) {
  const { owner_name, phone, reschedule_date, reschedule_time, admin_note } = appointment;
  const noteLine = admin_note ? `\n📝 Note: ${admin_note}` : "";
  const message =
    `🔄 *${CLINIC_NAME}* – New Time Proposed\n\n` +
    `Hi ${owner_name}, the doctor has proposed a new appointment time.\n\n` +
    `📅 *Proposed New Slot:*\n` +
    `• Date: *${reschedule_date}*\n` +
    `• Time: *${reschedule_time}*${noteLine}\n\n` +
    `Please reply or call 📞 76720 55007 to confirm or request a different time.`;

  return sendWhatsApp(phone, message);
}
