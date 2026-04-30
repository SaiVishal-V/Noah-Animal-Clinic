// services/supabase.js
// All database operations via Supabase REST API (no SDK needed on edge/serverless)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for server-side

function assertSupabaseConfig() {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured");
  }
  if (!SUPABASE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
}

function getHeaders() {
  assertSupabaseConfig();
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Prefer: "return=representation",
  };
}

/**
 * Create a new appointment
 * @param {Object} data - appointment fields
 */
export async function createAppointment(data) {
  assertSupabaseConfig();

  const payload = {
    owner_name: data.owner_name,
    phone: data.phone,
    owner_email: data.owner_email || null,
    pet_name: data.pet_name || null,
    pet_type: data.pet_type,
    service: data.service,
    preferred_date: data.preferred_date,
    preferred_time: data.preferred_time,
    notes: data.notes || null,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(`Unable to reach Supabase at ${SUPABASE_URL}: ${err.message}`);
  }

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = result.message || result.error || JSON.stringify(result);
    throw new Error(message);
  }
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Fetch all appointments, optionally filtered by status
 * @param {string|null} status - 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | null
 */
export async function getAppointments(status = null) {
  assertSupabaseConfig();

  let url = `${SUPABASE_URL}/rest/v1/appointments?order=created_at.desc`;
  if (status) url += `&status=eq.${status}`;

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
  } catch (err) {
    throw new Error(`Unable to reach Supabase at ${SUPABASE_URL}: ${err.message}`);
  }

  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.message || result.error || JSON.stringify(result));
  return result;
}

/**
 * Update appointment status and optional reschedule info
 * @param {string} id - appointment uuid
 * @param {Object} updates - { status, reschedule_date?, reschedule_time?, admin_note? }
 */
export async function updateAppointment(id, updates) {
  assertSupabaseConfig();

  const payload = {
    status: updates.status,
    updated_at: new Date().toISOString(),
  };

  if (updates.reschedule_date) payload.reschedule_date = updates.reschedule_date;
  if (updates.reschedule_time) payload.reschedule_time = updates.reschedule_time;
  if (updates.admin_note) payload.admin_note = updates.admin_note;
  if (updates.calendar_event_id) payload.calendar_event_id = updates.calendar_event_id;

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(`Unable to reach Supabase at ${SUPABASE_URL}: ${err.message}`);
  }

  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.message || result.error || JSON.stringify(result));
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Get a single appointment by id
 */
export async function getAppointmentById(id) {
  assertSupabaseConfig();

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "GET",
      headers: getHeaders(),
    });
  } catch (err) {
    throw new Error(`Unable to reach Supabase at ${SUPABASE_URL}: ${err.message}`);
  }
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.message || result.error || JSON.stringify(result));
  return result[0] || null;
}
