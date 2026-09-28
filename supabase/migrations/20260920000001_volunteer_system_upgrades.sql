-- Migration 20260920000001: Volunteer System Upgrades (Media, Articles, RLS)

-- 1. Create event_photos table for Camera Crew uploads
CREATE TABLE IF NOT EXISTS public.event_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.profiles(auth_user_id) ON DELETE CASCADE,
    uploader_name TEXT,
    image_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create event_articles table for Journalist / Reporter submissions
CREATE TABLE IF NOT EXISTS public.event_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(auth_user_id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS on new tables
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_articles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for event_photos
DROP POLICY IF EXISTS "Public can view event photos" ON public.event_photos;
CREATE POLICY "Public can view event photos"
    ON public.event_photos FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Approved Camera Crew can upload photos" ON public.event_photos;
CREATE POLICY "Approved Camera Crew can upload photos"
    ON public.event_photos FOR INSERT
    WITH CHECK (
        auth.uid() = uploader_id
    );

-- 5. RLS Policies for event_articles
DROP POLICY IF EXISTS "Public can view event articles" ON public.event_articles;
CREATE POLICY "Public can view event articles"
    ON public.event_articles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Approved Journalists can create articles" ON public.event_articles;
CREATE POLICY "Approved Journalists can create articles"
    ON public.event_articles FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
    );
