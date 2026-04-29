// pages/api/appointments/[id].js

import {
  getAppointmentById,
  updateAppointment,
} from "@/services/supabase";
import {
  notifyAppointmentConfirmed,
  notifyAppointmentCancelled,
  notifyAppointmentRescheduled,
} from "@/services/whatsapp";
import { emailStatusUpdate } from "@/services/email";
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

      // 4. Email staff notification (non-blocking)
      emailStatusUpdate(fullRecord, status).catch((err) =>
        console.error("[Email] status update notification failed:", err.message)
      );

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

  return res.status(405).json({ error: "Method not allowed" });
}
