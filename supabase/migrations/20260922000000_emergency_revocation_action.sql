-- =====================================================================
-- PURATCHI — Authority Emergency Revocation & Invalidation Action
-- Migration: 20260922000000_emergency_revocation_action.sql
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- STEP 1: Extend Event Status Constraint to include 'revoked'
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
    'revoked',
    'expired', 
    'upcoming', 
    'ongoing', 
    'completed', 
    'archived'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- STEP 2: Expand Audit Trail Actions Constraint to include 'REVOKED'
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
    'REVOKED',
    'UNVERIFIED',
    'CONDITIONS_ATTACHED',
    'DOCUMENT_ACCESSED',
    'ADMINISTRATIVE_CHANGES',
    'REVIEWED',
    'FLAGGED'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- STEP 3: Ensure RLS policy allows Authority & Government to update status to revoked
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authority can update event status" ON public.events;
CREATE POLICY "Authority can update event status"
    ON public.events FOR UPDATE
    USING (
        public.get_my_role() IN ('authority', 'government')
        OR auth.uid() = host_id
    )
    WITH CHECK (
        (public.get_my_role() IN ('authority', 'government'))
        OR (auth.uid() = host_id AND status NOT IN ('approved', 'rejected', 'revoked'))
    );
