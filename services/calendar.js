// services/calendar.js
// Google Calendar integration – adds confirmed appointments to the doctor's calendar
// using a Google Service Account.
//
// Setup:
//  1. In Google Cloud Console, create a Service Account and download the JSON key.
//  2. Enable the "Google Calendar API" for the project.
//  3. Share the doctor's Google Calendar with the service account email
//     (give it "Make changes to events" / Editor permission).
//  4. Set env vars:
//       GOOGLE_CLIENT_EMAIL  – service account email (xxx@project.iam.gserviceaccount.com)
//       GOOGLE_PRIVATE_KEY   – private key from the JSON key file
//                              (replace literal \n with actual newlines, or paste as-is)
//       GOOGLE_CALENDAR_ID   – the doctor's calendar ID (usually their Gmail address)

import { google } from "googleapis";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const CLINIC_NAME = "Noah Animal Clinic";

/**
 * Build an authenticated Google Calendar client using the service account.
 */
function getCalendarClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey || !CALENDAR_ID) {
    return null; // Calendar not configured – callers should handle null gracefully
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

/**
 * Parse a time-slot string like "9:00 AM – 11:00 AM" into ISO datetime strings.
 * @param {string} date        - "YYYY-MM-DD"
 * @param {string} timeSlot    - "9:00 AM – 11:00 AM"
 * @returns {{ start: string, end: string }} ISO 8601 datetime strings (Asia/Kolkata)
 */
function parseSlot(date, timeSlot) {
  const TIMEZONE = "Asia/Kolkata";

  // Split on en-dash or regular dash, handle both "–" and "-"
  const parts = timeSlot.split(/[–-]/);
  const startStr = parts[0]?.trim() || "09:00 AM";
  const endStr = parts[1]?.trim() || "11:00 AM";

  function toISO(dateStr, timeStr) {
    // timeStr examples: "9:00 AM", "11:00 AM", "2:00 PM"
    const [time, meridiem] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (meridiem?.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (meridiem?.toUpperCase() === "AM" && hours === 12) hours = 0;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes || 0).padStart(2, "0");
    return `${dateStr}T${hh}:${mm}:00`;
  }

  return {
    start: toISO(date, startStr),
    end: toISO(date, endStr),
    timeZone: TIMEZONE,
  };
}

/**
 * Add a confirmed appointment to the doctor's Google Calendar.
 * @param {Object} appointment - full appointment record from DB
 * @returns {Promise<string|null>} Google Calendar event ID to store in DB, or null if not configured
 */
export async function addCalendarEvent(appointment) {
  const calendar = getCalendarClient();
  if (!calendar) {
    console.warn("[Calendar] Google Calendar env vars not configured, skipping.");
    return null;
  }

  const {
    owner_name,
    owner_email,
    phone,
    pet_name,
    pet_type,
    service,
    preferred_date,
    preferred_time,
    notes,
  } = appointment;

  const petLabel = pet_name ? `${pet_name} (${pet_type})` : pet_type;
  const slot = parseSlot(preferred_date, preferred_time);

  const description = [
    `🐾 ${CLINIC_NAME} – Confirmed Appointment`,
    ``,
    `Owner:   ${owner_name}`,
    `Phone:   ${phone}`,
    owner_email ? `Email:   ${owner_email}` : null,
    `Pet:     ${petLabel}`,
    `Service: ${service}`,
    notes ? `Notes:   ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Attendees: include patient if they provided an email
  const attendees = owner_email ? [{ email: owner_email }] : [];

  const event = {
    summary: `🐾 ${service} – ${owner_name} (${petLabel})`,
    description,
    start: { dateTime: slot.start, timeZone: slot.timeZone },
    end:   { dateTime: slot.end,   timeZone: slot.timeZone },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email",  minutes: 60 },
        { method: "popup",  minutes: 15 },
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event,
    // Use 'none' – patient already receives a dedicated confirmation email via
    // emailPatientConfirmed(); sending a Google Calendar invite on top would duplicate it.
    sendUpdates: "none",
  });

  console.log(`[Calendar] Event created: ${response.data.htmlLink}`);
  return response.data.id; // Return event ID so caller can persist it
}

/**
 * Update an existing calendar event with a new date/time (for rescheduled appointments).
 * Falls back to creating a new event if no existing event ID is available.
 * @param {Object} appointment - appointment record (uses reschedule_date / reschedule_time)
 * @returns {Promise<string|null>} Google Calendar event ID
 */
export async function updateCalendarEvent(appointment) {
  const calendar = getCalendarClient();
  if (!calendar) {
    console.warn("[Calendar] Google Calendar env vars not configured, skipping.");
    return null;
  }

  const existingEventId = appointment.calendar_event_id;
  const newDate = appointment.reschedule_date;
  const newTime = appointment.reschedule_time;

  if (existingEventId) {
    // Update the existing event's time slot rather than creating a duplicate
    const slot = parseSlot(newDate, newTime);
    const noteAddendum = appointment.admin_note
      ? `\n\n📝 Rescheduled note: ${appointment.admin_note}`
      : "\n\n(Rescheduled by clinic)";

    try {
      const existing = await calendar.events.get({
        calendarId: CALENDAR_ID,
        eventId: existingEventId,
      });

      await calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: existingEventId,
        resource: {
          ...existing.data,
          start: { dateTime: slot.start, timeZone: slot.timeZone },
          end:   { dateTime: slot.end,   timeZone: slot.timeZone },
          description: (existing.data.description || "") + noteAddendum,
        },
        sendUpdates: "none",
      });

      console.log(`[Calendar] Event updated: ${existingEventId}`);
      return existingEventId;
    } catch (err) {
      console.error("[Calendar] Failed to update event, creating new one:", err.message);
    }
  }

  // No existing event (or update failed) – create a new event for the rescheduled slot
  const patched = {
    ...appointment,
    preferred_date: newDate,
    preferred_time: newTime,
  };
  return addCalendarEvent(patched);
}
