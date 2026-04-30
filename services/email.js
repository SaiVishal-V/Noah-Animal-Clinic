// services/email.js
// Email notifications for appointment events (via Resend HTTP API)

const CLINIC_NAME = "Noah Animal Clinic";
const CLINIC_PHONE = "76720 55007";
const CLINIC_EMAIL = process.env.CLINIC_EMAIL; // clinic's email for admin notifications

/**
 * Send an email via Resend HTTP API (works on Vercel — no SMTP needed)
 */
async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email.");
    return null;
  }

  if (!to) {
    console.warn("[Email] No recipient address provided, skipping.");
    return null;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${CLINIC_NAME} <onboarding@resend.dev>`,
        to,
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[Email] Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }
    console.log(`[Email] Sent to ${to}: ${data.id}`);
    return data;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    throw err;
  }
}

// ─── Shared HTML helpers ─────────────────────────────────────────────────────

function emailWrapper(bodyContent) {
  return `
    <div style="font-family:'Inter',sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:24px;">
      <div style="background:#0f766e;border-radius:12px 12px 0 0;padding:20px 28px;text-align:center;">
        <h1 style="color:#fff;font-size:20px;margin:0;">🐾 ${CLINIC_NAME}</h1>
        <p style="color:rgba(255,255,255,.8);font-size:13px;margin:4px 0 0;">Your trusted companion for pet health</p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px;">
        ${bodyContent}
      </div>
      <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;">
        ${CLINIC_NAME} &nbsp;|&nbsp; 📞 ${CLINIC_PHONE} &nbsp;|&nbsp; Kurnool, Andhra Pradesh
      </p>
    </div>`;
}

function detailsTable(rows) {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#374151;font-size:13px;white-space:nowrap;">${label}</td>
          <td style="padding:8px 12px;color:#1e293b;font-size:13px;">${value}</td>
        </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;margin:16px 0;">${cells}</table>`;
}

// ─── Templates – Clinic Notifications ────────────────────────────────────────

export async function emailBookingReceived(appointment) {
  const { owner_name, pet_type, service, preferred_date, preferred_time } = appointment;
  await sendEmail(
    CLINIC_EMAIL,
    `🐾 New Appointment Request – ${owner_name}`,
    emailWrapper(`
      <h2 style="font-size:18px;color:#0f172a;margin:0 0 8px;">New Appointment Booking</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">A new appointment request has been submitted.</p>
      ${detailsTable([
        ["Owner",   owner_name],
        ["Phone",   appointment.phone],
        ["Email",   appointment.owner_email || "—"],
        ["Pet",     `${appointment.pet_name || "—"} (${pet_type})`],
        ["Service", service],
        ["Date",    preferred_date],
        ["Time",    preferred_time],
        ["Notes",   appointment.notes || "—"],
      ])}
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/dashboard"
         style="display:inline-block;background:#0f766e;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;margin-top:4px;">
        Open Admin Dashboard →
      </a>`)
  );
}

export async function emailStatusUpdate(appointment, newStatus) {
  await sendEmail(
    CLINIC_EMAIL,
    `Appointment ${newStatus.toUpperCase()} – ${appointment.owner_name}`,
    emailWrapper(`
      <h2 style="font-size:18px;color:#0f172a;margin:0 0 16px;">Appointment Status Updated</h2>
      ${detailsTable([
        ["Patient",    `${appointment.owner_name} (${appointment.phone})`],
        ["New Status", `<strong style="text-transform:uppercase;">${newStatus}</strong>`],
        ...(appointment.reschedule_date
          ? [["New Slot", `${appointment.reschedule_date} at ${appointment.reschedule_time}`]]
          : []),
        ...(appointment.admin_note ? [["Note", appointment.admin_note]] : []),
      ])}`)
  );
}

// ─── Templates – Patient Notifications ───────────────────────────────────────

/**
 * Confirmation email sent to the patient when the doctor accepts the appointment.
 */
export async function emailPatientConfirmed(appointment) {
  if (!appointment.owner_email) return null;
  const petLabel = appointment.pet_name
    ? `${appointment.pet_name} (${appointment.pet_type})`
    : appointment.pet_type;

  return sendEmail(
    appointment.owner_email,
    `✅ Appointment Confirmed – ${CLINIC_NAME}`,
    emailWrapper(`
      <h2 style="font-size:18px;color:#15803d;margin:0 0 8px;">Your Appointment is Confirmed! ✅</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">
        Hi <strong>${appointment.owner_name}</strong>, great news! Dr. Ranjith Kumar has confirmed your appointment at ${CLINIC_NAME}.
      </p>
      ${detailsTable([
        ["Pet",     petLabel],
        ["Service", appointment.service],
        ["Date",    `<strong>${appointment.preferred_date}</strong>`],
        ["Time",    `<strong>${appointment.preferred_time}</strong>`],
      ])}
      <p style="font-size:13px;color:#374151;margin:16px 0 8px;">
        📍 <strong>Location:</strong> Noah Animal Clinic, Kurnool, Andhra Pradesh<br>
        ⏰ Please arrive <strong>10 minutes early</strong>.
      </p>
      <p style="font-size:13px;color:#64748b;margin:0;">
        Need to reschedule or have questions? Call us at 📞 <strong>${CLINIC_PHONE}</strong>.
      </p>`)
  );
}

/**
 * Cancellation email sent to the patient.
 */
export async function emailPatientCancelled(appointment) {
  if (!appointment.owner_email) return null;
  return sendEmail(
    appointment.owner_email,
    `❌ Appointment Unavailable – ${CLINIC_NAME}`,
    emailWrapper(`
      <h2 style="font-size:18px;color:#b91c1c;margin:0 0 8px;">Appointment Unavailable</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">
        Hi <strong>${appointment.owner_name}</strong>, unfortunately the doctor is unavailable for your requested time slot.
      </p>
      ${appointment.admin_note
        ? `<p style="font-size:13px;color:#374151;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:0 0 16px;">
            📝 <strong>Note from the clinic:</strong> ${appointment.admin_note}
           </p>`
        : ""}
      <p style="font-size:13px;color:#374151;margin:0;">
        We're sorry for the inconvenience. Please call us at 📞 <strong>${CLINIC_PHONE}</strong> to find a convenient time.
      </p>`)
  );
}

/**
 * Reschedule email sent to the patient with the proposed new slot.
 */
export async function emailPatientRescheduled(appointment) {
  if (!appointment.owner_email) return null;
  return sendEmail(
    appointment.owner_email,
    `🔄 New Appointment Time Proposed – ${CLINIC_NAME}`,
    emailWrapper(`
      <h2 style="font-size:18px;color:#1d4ed8;margin:0 0 8px;">New Appointment Time Proposed 🔄</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">
        Hi <strong>${appointment.owner_name}</strong>, the doctor has proposed a new time for your appointment.
      </p>
      ${detailsTable([
        ["Proposed Date", `<strong>${appointment.reschedule_date}</strong>`],
        ["Proposed Time", `<strong>${appointment.reschedule_time}</strong>`],
      ])}
      ${appointment.admin_note
        ? `<p style="font-size:13px;color:#374151;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin:0 0 16px;">
            📝 <strong>Note:</strong> ${appointment.admin_note}
           </p>`
        : ""}
      <p style="font-size:13px;color:#374151;margin:0;">
        Please reply or call us at 📞 <strong>${CLINIC_PHONE}</strong> to confirm or request a different time.
      </p>`)
  );
}

