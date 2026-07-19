UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'member-photos';
