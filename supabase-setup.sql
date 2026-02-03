-- Run this in Supabase: SQL Editor → New query → paste → Run

-- 1. Table for photo metadata
CREATE TABLE IF NOT EXISTS public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  filename text,
  created_at timestamptz DEFAULT now()
);

-- 2. Only allow users to see/insert/delete their own photos
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own photos" ON public.photos;
CREATE POLICY "Users can read own photos"
  ON public.photos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own photos" ON public.photos;
CREATE POLICY "Users can insert own photos"
  ON public.photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own photos" ON public.photos;
CREATE POLICY "Users can delete own photos"
  ON public.photos FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Storage bucket (create via Dashboard if this fails: Storage → New bucket → name: photos, private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies: users can only access their own folder (path starts with their user_id)
DROP POLICY IF EXISTS "Users can upload in own folder" ON storage.objects;
CREATE POLICY "Users can upload in own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own folder" ON storage.objects;
CREATE POLICY "Users can read own folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own folder" ON storage.objects;
CREATE POLICY "Users can delete own folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
