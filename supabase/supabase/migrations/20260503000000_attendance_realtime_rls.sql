-- Authenticated users can insert entries
CREATE POLICY "Volunteers can mark attendance"
ON attendance_entries FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated users can read entries
CREATE POLICY "Authenticated can read attendance"
ON attendance_entries FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can delete (unmark)
CREATE POLICY "Volunteers can unmark attendance"
ON attendance_entries FOR DELETE
TO authenticated
USING (true);
