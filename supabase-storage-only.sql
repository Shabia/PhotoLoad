-- Use this if uploads fail with "bucket not found" or similar.
-- 1) Create the bucket in Supabase Dashboard: Storage → New bucket → name: photos, Private → Create.
-- 2) Then run this in SQL Editor (to add policies only).

-- Drop existing policies if you re-run (optional)
-- DROP POLICY IF EXISTS "Users can upload in own folder" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can read own folder" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete own folder" ON storage.objects;

CREATE POLICY "Users can upload in own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
