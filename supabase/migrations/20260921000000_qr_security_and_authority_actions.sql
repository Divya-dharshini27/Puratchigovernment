-- =====================================================================
-- PURATCHI — QR Security, 3-Way Authority Actions, Total Log & Audit Trail
-- Migration: 20260921000000_qr_security_and_authority_actions.sql
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- STEP 1: Extend Event Status Constraint to include 'request_info'
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN (
    'draft', 
    'pending', 
    'request_info', 
    'approved', 
    'rejected', 
    'expired', 
    'upcoming', 
    'ongoing', 
    'completed', 
    'archived'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- STEP 2: Add Secure QR Token & Validity Fields to Events
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS qr_status TEXT DEFAULT 'active' CHECK (qr_status IN ('active', 'revoked', 'expired')),
  ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMPTZ;

-- Backfill qr_token for any existing events that don't have one
UPDATE public.events
SET qr_token = 'PQ-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 16)
WHERE qr_token IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 3: Create Table for Authority Information / Clarification Requests
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_info_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id             UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    requested_by         UUID NOT NULL REFERENCES public.profiles(auth_user_id),
    officer_name         TEXT NOT NULL,
    officer_jurisdiction TEXT,
    request_message      TEXT NOT NULL,
    required_documents   TEXT[] DEFAULT '{}',
    host_response        TEXT,
    status               TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'resolved')),
    created_at           TIMESTAMPTZ DEFAULT now(),
    responded_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_info_requests_event_id ON public.event_info_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_info_requests_created_at ON public.event_info_requests(created_at DESC);

-- Enable RLS on event_info_requests
ALTER TABLE public.event_info_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Government and Authority can view info requests" ON public.event_info_requests;
CREATE POLICY "Government and Authority can view info requests"
    ON public.event_info_requests FOR SELECT
    USING (
        public.get_my_role() IN ('government', 'authority')
        OR auth.uid() IN (SELECT host_id FROM public.events WHERE id = event_id)
    );

DROP POLICY IF EXISTS "Authority can insert info requests" ON public.event_info_requests;
CREATE POLICY "Authority can insert info requests"
    ON public.event_info_requests FOR INSERT
    WITH CHECK (
        public.get_my_role() IN ('government', 'authority')
        AND auth.uid() = requested_by
    );

DROP POLICY IF EXISTS "Host and Authority can update info requests" ON public.event_info_requests;
CREATE POLICY "Host and Authority can update info requests"
    ON public.event_info_requests FOR UPDATE
    USING (
        public.get_my_role() IN ('government', 'authority')
        OR auth.uid() IN (SELECT host_id FROM public.events WHERE id = event_id)
    );

-- ─────────────────────────────────────────────────────────────────────
-- STEP 4: Expand Audit Trail Actions Constraint
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_audit_logs
  DROP CONSTRAINT IF EXISTS admin_audit_logs_action_check;

ALTER TABLE public.admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_action_check
  CHECK (action IN (
    'QR_SCANNED',
    'EVENT_REVIEWED',
    'APPROVED',
    'REQUEST_INFO',
    'REJECTED',
    'CONDITIONS_ATTACHED',
    'DOCUMENT_ACCESSED',
    'ADMINISTRATIVE_CHANGES',
    'REVIEWED',
    'FLAGGED'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- STEP 5: Helper Function for QR Code Token Generation on Event Insert
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_event_qr_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_token IS NULL OR NEW.qr_token = '' THEN
    NEW.qr_token := 'PQ-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 16);
  END IF;
  IF NEW.qr_expires_at IS NULL THEN
    NEW.qr_expires_at := NEW.created_at + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_event_qr_token ON public.events;
CREATE TRIGGER trigger_generate_event_qr_token
BEFORE INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.generate_event_qr_token();
