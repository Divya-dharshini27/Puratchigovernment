-- Migration 20260919000001: Create PURATCHI Host Dashboard Database Schema & RLS Policies

-- 1. Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES public.profiles(auth_user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    purpose TEXT NOT NULL,
    description TEXT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location_name TEXT NOT NULL,
    place_of_assembly TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    expected_attendance INTEGER NOT NULL DEFAULT 100,
    route_details TEXT,
    equipment_details TEXT,
    jurisdiction_requirements TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'expired', 'upcoming', 'ongoing', 'completed', 'archived')),
    approval_deadline TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
    rejection_reason TEXT,
    authority_notes TEXT,
    whatsapp_group_link TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create event_documents table (private permit files)
CREATE TABLE IF NOT EXISTS public.event_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES public.profiles(auth_user_id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create event_volunteer_requirements table
CREATE TABLE IF NOT EXISTS public.event_volunteer_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL CHECK (role_name IN (
        'Safety Volunteer',
        'First-Aid / Medical Support Volunteer',
        'Emergency Assistance Volunteer',
        'Camera Crew',
        'Journalist / Reporter',
        'Logistics Volunteer'
    )),
    target_count INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (event_id, role_name)
);

-- 4. Create volunteer_applications table
CREATE TABLE IF NOT EXISTS public.volunteer_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES public.profiles(auth_user_id) ON DELETE CASCADE,
    selected_roles TEXT[] NOT NULL,
    motivation_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(auth_user_id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (event_id, applicant_id)
);

-- 5. Create event_updates table
CREATE TABLE IF NOT EXISTS public.event_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES public.profiles(auth_user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    update_type TEXT NOT NULL DEFAULT 'VERIFIED HOST UPDATE',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create online_support table (Prepared for future Razorpay integration)
CREATE TABLE IF NOT EXISTS public.online_support (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    supporter_id UUID REFERENCES public.profiles(auth_user_id) ON DELETE SET NULL,
    supporter_name TEXT,
    support_message TEXT,
    pledge_amount NUMERIC(10,2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'pledged' CHECK (payment_status IN ('pledged', 'completed', 'failed')),
    razorpay_payment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_volunteer_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_support ENABLE ROW LEVEL SECURITY;

-- ROW LEVEL SECURITY POLICIES FOR HOSTS

-- Events Policies
CREATE POLICY "Hosts can view their own events"
    ON public.events FOR SELECT
    USING (auth.uid() = host_id);

CREATE POLICY "Hosts can insert their own events"
    ON public.events FOR INSERT
    WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their own events"
    ON public.events FOR UPDATE
    USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their own draft events"
    ON public.events FOR DELETE
    USING (auth.uid() = host_id AND status = 'draft');

-- Event Documents Policies (Private storage access)
CREATE POLICY "Hosts can view documents for their events"
    ON public.event_documents FOR SELECT
    USING (auth.uid() = host_id);

CREATE POLICY "Hosts can upload documents for their events"
    ON public.event_documents FOR INSERT
    WITH CHECK (auth.uid() = host_id);

-- Volunteer Requirements Policies
CREATE POLICY "Hosts can manage volunteer requirements for their events"
    ON public.event_volunteer_requirements FOR ALL
    USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

-- Volunteer Applications Policies
CREATE POLICY "Hosts can view volunteer applications for their events"
    ON public.volunteer_applications FOR SELECT
    USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

CREATE POLICY "Hosts can update volunteer applications for their events"
    ON public.volunteer_applications FOR UPDATE
    USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

-- Event Updates Policies
CREATE POLICY "Hosts can view updates for their events"
    ON public.event_updates FOR SELECT
    USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

CREATE POLICY "Hosts can insert updates for their events"
    ON public.event_updates FOR INSERT
    WITH CHECK (auth.uid() = host_id);

-- Online Support Policies
CREATE POLICY "Hosts can view online support for their events"
    ON public.online_support FOR SELECT
    USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

-- Storage Bucket for Permit Documents (Private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('permit-documents', 'permit-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Hosts can upload permit documents"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'permit-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Hosts can read their uploaded permit documents"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'permit-documents' AND auth.role() = 'authenticated');
