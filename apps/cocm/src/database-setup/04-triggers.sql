-- ============================================================================
-- STEP 4: CREATE TRIGGERS
-- Run this script after creating functions
-- ============================================================================

-- Trigger to auto-update attendance count
CREATE TRIGGER update_attendance_count_trigger
AFTER INSERT OR DELETE ON attendance_entries
FOR EACH ROW
EXECUTE FUNCTION update_attendance_total_count();

-- Triggers for updated_at timestamps
CREATE TRIGGER update_profiles_updated_at 
BEFORE UPDATE ON profiles
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at 
BEFORE UPDATE ON members
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at 
BEFORE UPDATE ON visitors
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_services_updated_at 
BEFORE UPDATE ON custom_services
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_giving_types_updated_at 
BEFORE UPDATE ON custom_giving_types
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
