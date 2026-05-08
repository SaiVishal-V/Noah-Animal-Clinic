// pages/api/appointments/index.js

import { createAppointment, getAppointments } from "@/services/supabase";
import { emailBookingReceived } from "@/services/email";
import { verifyAdminToken, getTokenFromRequest } from "@/lib/auth";

function normalizeIndianPhone(value) {
  const digits = (value || "").trim().replace(/\D/g, "");
  let localDigits = "";
  if (digits.length === 10) {
    localDigits = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    localDigits = digits.slice(2);
  } else {
    return null;
  }
  if (!/^[6-9]\d{9}$/.test(localDigits)) return null;
  return `+91 ${localDigits}`;
}

export default async function handler(req, res) {
  // ─── POST /api/appointments ── Create new booking ──────────────────────────
  if (req.method === "POST") {
    const {
      owner_name,
      phone,
      owner_email,
      pet_name,
      pet_type,
      service,
      preferred_date,
      preferred_time,
      notes,
    } = req.body;

    // ── Validation ───────────────────────────────────────────────────────────
    const errors = {};
    let normalizedPhone = null;
    if (!owner_name?.trim()) errors.owner_name = "Name is required";
    if (!phone?.trim()) errors.phone = "Phone is required";
    else {
      normalizedPhone = normalizeIndianPhone(phone);
      if (!normalizedPhone) errors.phone = "Enter a valid Indian mobile number (10 digits starting with 6-9, optionally with +91 or 91 prefix)";
    }
    if (owner_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email.trim()))
      errors.owner_email = "Enter a valid email address";
    if (!pet_type) errors.pet_type = "Pet type is required";
    if (!service) errors.service = "Service is required";
    if (!preferred_date) errors.preferred_date = "Preferred date is required";
    if (!preferred_time) errors.preferred_time = "Preferred time is required";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    try {
      // 1. Save to database
      const appointment = await createAppointment({
        owner_name: owner_name.trim(),
        phone: normalizedPhone,
        owner_email: owner_email?.trim() || null,
        pet_name: pet_name?.trim() || null,
        pet_type,
        service,
        preferred_date,
        preferred_time,
        notes: notes?.trim() || null,
      });

      // 2. Email notification to clinic (await so Vercel doesn't kill the function)
      try {
        await emailBookingReceived(appointment);
      } catch (err) {
        console.error("[Email] booking notification failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Appointment request received! We'll confirm via email shortly.",
        data: appointment,
      });
    } catch (err) {
      console.error("[POST /api/appointments]", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Server error. Please try again.",
      });
    }
  }

  // ─── GET /api/appointments ── Fetch all (admin only) ─────────────────────
  if (req.method === "GET") {
    const token = getTokenFromRequest(req);
    const payload = token ? await verifyAdminToken(token) : null;

    if (!payload) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { status } = req.query; // optional filter ?status=pending

    try {
      const appointments = await getAppointments(status || null);
      return res.status(200).json({ success: true, data: appointments });
    } catch (err) {
      console.error("[GET /api/appointments]", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to fetch appointments" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
