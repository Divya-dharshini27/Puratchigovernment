-- FIX PERMISSIONS & RLS FOR SUPABASE AUTHENTICATED USERS

-- 1. Grant Schema & Table Privileges to authenticated role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;

-- 2. Profiles Table Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = auth_user_id);

-- 3. Events Table Policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hosts can view their own events" ON public.events;
DROP POLICY IF EXISTS "Hosts can insert their own events" ON public.events;
DROP POLICY IF EXISTS "Hosts can update their own events" ON public.events;
DROP POLICY IF EXISTS "Hosts can delete their own draft events" ON public.events;

CREATE POLICY "Hosts can view their own events" ON public.events FOR SELECT USING (auth.uid() = host_id);
CREATE POLICY "Hosts can insert their own events" ON public.events FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update their own events" ON public.events FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Hosts can delete their own draft events" ON public.events FOR DELETE USING (auth.uid() = host_id AND status = 'draft');

-- 4. Event Documents Policies
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hosts can view documents for their events" ON public.event_documents;
DROP POLICY IF EXISTS "Hosts can upload documents for their events" ON public.event_documents;

CREATE POLICY "Hosts can view documents for their events" ON public.event_documents FOR SELECT USING (auth.uid() = host_id);
CREATE POLICY "Hosts can upload documents for their events" ON public.event_documents FOR INSERT WITH CHECK (auth.uid() = host_id);

-- 5. Volunteer Requirements Policies
ALTER TABLE public.event_volunteer_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hosts can manage volunteer requirements for their events" ON public.event_volunteer_requirements;
CREATE POLICY "Hosts can manage volunteer requirements for their events" ON public.event_volunteer_requirements FOR ALL USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

-- 6. Volunteer Applications Policies
ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hosts can view volunteer applications for their events" ON public.volunteer_applications;
DROP POLICY IF EXISTS "Hosts can update volunteer applications for their events" ON public.volunteer_applications;

CREATE POLICY "Hosts can view volunteer applications for their events" ON public.volunteer_applications FOR SELECT USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));
CREATE POLICY "Hosts can update volunteer applications for their events" ON public.volunteer_applications FOR UPDATE USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

-- 7. Event Updates Policies
ALTER TABLE public.event_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hosts can view updates for their events" ON public.event_updates;
DROP POLICY IF EXISTS "Hosts can insert updates for their events" ON public.event_updates;

CREATE POLICY "Hosts can view updates for their events" ON public.event_updates FOR SELECT USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));
CREATE POLICY "Hosts can insert updates for their events" ON public.event_updates FOR INSERT WITH CHECK (auth.uid() = host_id);

-- 8. Online Support Policies
ALTER TABLE public.online_support ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hosts can view online support for their events" ON public.online_support;
CREATE POLICY "Hosts can view online support for their events" ON public.online_support FOR SELECT USING (event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid()));

-- Storage Bucket Policies
INSERT INTO storage.buckets (id, name, public) VALUES ('permit-documents', 'permit-documents', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Hosts can upload permit documents" ON storage.objects;
DROP POLICY IF EXISTS "Hosts can read their uploaded permit documents" ON storage.objects;

CREATE POLICY "Hosts can upload permit documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'permit-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Hosts can read their uploaded permit documents" ON storage.objects FOR SELECT USING (bucket_id = 'permit-documents' AND auth.role() = 'authenticated');
