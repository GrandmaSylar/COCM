-- Migration: Add default_paper_size to user_settings

ALTER TABLE user_settings
ADD COLUMN default_paper_size TEXT NOT NULL DEFAULT 'a4'
CHECK (default_paper_size IN ('a4', 'letter', 'legal', 'tabloid', 'executive', 'a5'));
