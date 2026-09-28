-- =====================================================================
-- PURATCHI Admin Console — Database Migration (Fix Infinite Recursion)
-- Run this in Supabase Dashboard > SQL Editor > New Query
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- STEP 1: Helper function to get current user role without RLS recursion
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 2: Expand the role constraint to include government & authority
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('citizen', 'host', 'government', 'authority'));

-- ─────────────────────────────────────────────────────────────────────
-- STEP 3: Add jurisdiction & credential columns to profiles
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS jurisdiction_level TEXT
    CHECK (jurisdiction_level IN ('central', 'state', 'district', 'taluk')),
  ADD COLUMN IF NOT EXISTS state       TEXT,
  ADD COLUMN IF NOT EXISTS district    TEXT,
  ADD COLUMN IF NOT EXISTS department  TEXT,
  ADD COLUMN IF NOT EXISTS badge_number TEXT,
  ADD COLUMN IF NOT EXISTS designation  TEXT,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_act     BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 4: Non-recursive RLS policies on public.profiles
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Government can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or government can view all" ON public.profiles;

CREATE POLICY "Users can view own profile or government can view all"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = auth_user_id 
        OR public.get_my_role() = 'government'
    );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Government can update authority profiles" ON public.profiles;

CREATE POLICY "Users can update own profile or government can update authority"
    ON public.profiles FOR UPDATE
    USING (
        auth.uid() = auth_user_id 
        OR public.get_my_role() = 'government'
    );

-- ─────────────────────────────────────────────────────────────────────
-- STEP 5: Add review tracking columns to events
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS state        TEXT,
  ADD COLUMN IF NOT EXISTS district     TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES public.profiles(auth_user_id),
  ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 6: Create the immutable Admin Audit Trail table
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    performed_by     UUID        NOT NULL REFERENCES public.profiles(auth_user_id),
    performer_name   TEXT        NOT NULL,
    role             TEXT        NOT NULL CHECK (role IN ('government', 'authority')),
    jurisdiction     TEXT        NOT NULL,
    action           TEXT        NOT NULL CHECK (action IN ('APPROVED','REJECTED','CONDITIONS_ATTACHED','REVIEWED','FLAGGED')),
    previous_status  TEXT,
    new_status       TEXT,
    rejection_reason TEXT,
    authority_notes  TEXT,
    created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_id   ON public.admin_audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- STEP 7: Enable RLS on audit logs
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Government and Authority can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Government and Authority can view audit logs"
    ON public.admin_audit_logs FOR SELECT
    USING (
        public.get_my_role() IN ('government', 'authority')
    );

DROP POLICY IF EXISTS "Government and Authority can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Government and Authority can insert audit logs"
    ON public.admin_audit_logs FOR INSERT
    WITH CHECK (
        auth.uid() = performed_by
        AND public.get_my_role() IN ('government', 'authority')
    );

-- ─────────────────────────────────────────────────────────────────────
-- STEP 8: Allow Government & Authority to READ events (SELECT)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Government and Authority can view events" ON public.events;
CREATE POLICY "Government and Authority can view events"
    ON public.events FOR SELECT
    USING (
        public.get_my_role() IN ('government', 'authority')
        OR auth.uid() = host_id
        OR status = 'approved'
    );

-- ─────────────────────────────────────────────────────────────────────
-- STEP 9: Allow Authority to UPDATE event status (Approve / Reject)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authority can update event status" ON public.events;
CREATE POLICY "Authority can update event status"
    ON public.events FOR UPDATE
    USING (
        public.get_my_role() = 'authority'
        OR auth.uid() = host_id
    )
    WITH CHECK (
        (public.get_my_role() = 'authority')
        OR (auth.uid() = host_id AND status NOT IN ('approved', 'rejected'))
    );

-- ─────────────────────────────────────────────────────────────────────
-- STEP 10: Allow Government & Authority to view event documents
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Government and Authority can view event documents" ON public.event_documents;
CREATE POLICY "Government and Authority can view event documents"
    ON public.event_documents FOR SELECT
    USING (
        public.get_my_role() IN ('government', 'authority')
        OR auth.uid() = host_id
    );

-- ─────────────────────────────────────────────────────────────────────
-- STEP 11: Storage policy for permit documents (Supabase Storage)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Government and Authority can read permit documents" ON storage.objects;
CREATE POLICY "Government and Authority can read permit documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'permit-documents'
        AND auth.role() = 'authenticated'
        AND public.get_my_role() IN ('government', 'authority', 'host')
    );
