-- Create storage bucket for member photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-photos',
  'member-photos',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for member photos
CREATE POLICY "Authenticated users can upload member photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'member-photos');

CREATE POLICY "Authenticated users can view member photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'member-photos');

CREATE POLICY "Authenticated users can update member photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'member-photos');

CREATE POLICY "Authenticated users can delete member photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'member-photos');
