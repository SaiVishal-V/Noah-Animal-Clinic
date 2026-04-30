// pages/api/appointments/[id].js

import {
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
} from "@/services/supabase";
import {
  notifyAppointmentConfirmed,
  notifyAppointmentCancelled,
  notifyAppointmentRescheduled,
} from "@/services/whatsapp";
import {
  emailStatusUpdate,
  emailPatientConfirmed,
  emailPatientCancelled,
  emailPatientRescheduled,
} from "@/services/email";
import { addCalendarEvent, updateCalendarEvent } from "@/services/calendar";
import { verifyAdminToken, getTokenFromRequest } from "@/lib/auth";

const VALID_STATUSES = ["confirmed", "cancelled", "rescheduled"];

export default async function handler(req, res) {
  // All methods on this route require admin auth
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyAdminToken(token) : null;

  if (!payload) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const { id } = req.query;

  // ─── PATCH /api/appointments/:id ── Update status ────────────────────────
  if (req.method === "PATCH") {
    const { status, reschedule_date, reschedule_time, admin_note } = req.body;

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Reschedule requires both date and time
    if (
      status === "rescheduled" &&
      (!reschedule_date || !reschedule_time)
    ) {
      return res.status(400).json({
        success: false,
        error: "reschedule_date and reschedule_time are required when rescheduling",
      });
    }

    try {
      // 1. Get existing appointment
      const existing = await getAppointmentById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: "Appointment not found" });
      }

      // 2. Update in DB
      const updates = { status, admin_note };
      if (status === "rescheduled") {
        updates.reschedule_date = reschedule_date;
        updates.reschedule_time = reschedule_time;
      }

      const updated = await updateAppointment(id, updates);

      // Merge for notification (updated may not include all fields)
      const fullRecord = { ...existing, ...updates };

      // 3. Fire appropriate WhatsApp notification (non-blocking)
      const waNotify =
        status === "confirmed"
          ? notifyAppointmentConfirmed(fullRecord)
          : status === "cancelled"
          ? notifyAppointmentCancelled(fullRecord)
          : notifyAppointmentRescheduled(fullRecord);

      waNotify.catch((err) =>
        console.error(`[WhatsApp] ${status} notification failed:`, err.message)
      );

      // 4. Email clinic staff notification (non-blocking)
      emailStatusUpdate(fullRecord, status).catch((err) =>
        console.error("[Email] status update notification failed:", err.message)
      );

      // 5. Email patient confirmation (non-blocking)
      if (status === "confirmed") {
        emailPatientConfirmed(fullRecord).catch((err) =>
          console.error("[Email] patient confirmation failed:", err.message)
        );
        // 6. Add to Google Calendar and persist the event ID (non-blocking)
        addCalendarEvent(fullRecord)
          .then((eventId) => {
            if (eventId) {
              updateAppointment(id, { calendar_event_id: eventId }).catch((err) =>
                console.error("[Calendar] failed to save event ID:", err.message)
              );
            }
          })
          .catch((err) =>
            console.error("[Calendar] add event failed:", err.message)
          );
      } else if (status === "cancelled") {
        emailPatientCancelled(fullRecord).catch((err) =>
          console.error("[Email] patient cancellation failed:", err.message)
        );
      } else if (status === "rescheduled") {
        emailPatientRescheduled(fullRecord).catch((err) =>
          console.error("[Email] patient reschedule failed:", err.message)
        );
        // Update existing calendar event (or create one if none exists) (non-blocking)
        updateCalendarEvent(fullRecord)
          .then((eventId) => {
            if (eventId && eventId !== fullRecord.calendar_event_id) {
              updateAppointment(id, { calendar_event_id: eventId }).catch((err) =>
                console.error("[Calendar] failed to save event ID:", err.message)
              );
            }
          })
          .catch((err) =>
            console.error("[Calendar] update event failed:", err.message)
          );
      }

      return res.status(200).json({
        success: true,
        message: `Appointment ${status} successfully. WhatsApp notification sent.`,
        data: updated,
      });
    } catch (err) {
      console.error(`[PATCH /api/appointments/${id}]`, err);
      return res.status(500).json({ success: false, error: "Failed to update appointment" });
    }
  }

  // ─── GET /api/appointments/:id ── Fetch single ───────────────────────────
  if (req.method === "GET") {
    try {
      const appointment = await getAppointmentById(id);
      if (!appointment) {
        return res.status(404).json({ success: false, error: "Not found" });
      }
      return res.status(200).json({ success: true, data: appointment });
    } catch (err) {
      return res.status(500).json({ success: false, error: "Failed to fetch" });
    }
  }

  // ─── DELETE /api/appointments/:id ── Permanently delete ──────────────────
  if (req.method === "DELETE") {
    try {
      const existing = await getAppointmentById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: "Appointment not found" });
      }
      await deleteAppointment(id);
      return res.status(200).json({ success: true, message: "Appointment deleted successfully." });
    } catch (err) {
      console.error(`[DELETE /api/appointments/${id}]`, err);
      return res.status(500).json({ success: false, error: "Failed to delete appointment" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
