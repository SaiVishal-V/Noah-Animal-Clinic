-- ============================================================
-- Noah Animal Clinic – Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Create the appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Patient info
  owner_name      TEXT NOT NULL,
  phone           TEXT NOT NULL,
  owner_email     TEXT,                  -- Patient email for confirmation emails
  pet_name        TEXT,
  pet_type        TEXT NOT NULL,         -- Dog | Cat | Bird / Parrot | Exotic Pet | Other
  
  -- Appointment details
  service         TEXT NOT NULL,
  preferred_date  DATE NOT NULL,
  preferred_time  TEXT NOT NULL,
  notes           TEXT,
  
  -- Status workflow
  -- pending → confirmed | cancelled | rescheduled
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled')),
  
  -- Reschedule data (filled when status = rescheduled)
  reschedule_date DATE,
  reschedule_time TEXT,
  
  -- Admin note (reason for rejection, reschedule note, etc.)
  admin_note      TEXT,

  -- Google Calendar event ID (stored after confirmed/rescheduled to allow event updates)
  calendar_event_id TEXT,
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

-- 2. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_created ON public.appointments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_phone  ON public.appointments (phone);

-- 3. Row Level Security (RLS)
--    API routes use the service_role key which bypasses RLS.
--    This policy blocks direct client-side access with the anon key.
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Allow INSERT with anon key (for the booking form using anon key)
-- NOTE: If you use service_role key in API routes only (recommended), 
--       you don't strictly need these policies. But they're good to have.
CREATE POLICY "Allow public insert" ON public.appointments
  FOR INSERT TO anon WITH CHECK (true);

-- Block anon SELECT/UPDATE/DELETE – only service_role can do those
CREATE POLICY "Block anon select" ON public.appointments
  FOR SELECT TO anon USING (false);

-- 4. Automatically update 'updated_at' on any PATCH
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. View: appointments summary (useful for admin dashboard queries)
CREATE OR REPLACE VIEW public.appointments_summary AS
SELECT
  id,
  owner_name,
  phone,
  COALESCE(pet_name, '—') AS pet_name,
  pet_type,
  service,
  preferred_date,
  preferred_time,
  status,
  reschedule_date,
  reschedule_time,
  admin_note,
  created_at
FROM public.appointments
ORDER BY created_at DESC;

-- ── Verification Queries ──────────────────────────────────────────────────────
-- Run these after setup to confirm everything works:

-- SELECT * FROM public.appointments LIMIT 5;
-- SELECT status, COUNT(*) FROM public.appointments GROUP BY status;

-- ── Migration: add owner_email column (run if table already exists) ───────────
-- ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS owner_email TEXT;
-- ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
