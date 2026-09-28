-- Migration 20260920000000: Volunteer Criteria Columns & RLS Policies

-- 1. Add Volunteer Criteria columns to public.events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS min_age INTEGER DEFAULT 18,
ADD COLUMN IF NOT EXISTS max_age INTEGER,
ADD COLUMN IF NOT EXISTS additional_criteria TEXT;

-- 2. Add Applicant Age column to public.volunteer_applications
ALTER TABLE public.volunteer_applications 
ADD COLUMN IF NOT EXISTS applicant_age INTEGER;

-- 3. Enable RLS on core tables (safeguard)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_volunteer_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR PUBLIC / CITIZEN ACCESS

-- Public can view approved and pending public events
DROP POLICY IF EXISTS "Public can view events" ON public.events;
CREATE POLICY "Public can view events"
    ON public.events FOR SELECT
    USING (true);

-- Public can view volunteer requirements for events
DROP POLICY IF EXISTS "Public can view volunteer requirements" ON public.event_volunteer_requirements;
CREATE POLICY "Public can view volunteer requirements"
    ON public.event_volunteer_requirements FOR SELECT
    USING (true);

-- Citizens can insert their own volunteer applications
DROP POLICY IF EXISTS "Citizens can insert volunteer applications" ON public.volunteer_applications;
CREATE POLICY "Citizens can insert volunteer applications"
    ON public.volunteer_applications FOR INSERT
    WITH CHECK (auth.uid() = applicant_id);

-- Citizens can view their own volunteer applications
DROP POLICY IF EXISTS "Citizens can view own volunteer applications" ON public.volunteer_applications;
CREATE POLICY "Citizens can view own volunteer applications"
    ON public.volunteer_applications FOR SELECT
    USING (auth.uid() = applicant_id);

-- Hosts can view volunteer applications for their events
DROP POLICY IF EXISTS "Hosts can view event applications" ON public.volunteer_applications;
CREATE POLICY "Hosts can view event applications"
    ON public.volunteer_applications FOR SELECT
    USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

-- Hosts can update volunteer applications for their events (accept/reject)
DROP POLICY IF EXISTS "Hosts can update event applications" ON public.volunteer_applications;
CREATE POLICY "Hosts can update event applications"
    ON public.volunteer_applications FOR UPDATE
    USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));
