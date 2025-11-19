# Permission System Documentation

## Overview
The Church Management System (ChMS) implements a sophisticated role-based access control (RBAC) system with support for temporary permissions and custom role management.

## Role Definitions

### 1. Developer (Dev) - Supreme Access
**Capabilities:**
- Full, unrestricted access to all system features
- Create, modify, and delete custom roles
- Assign/unassign roles to users (permanent or temporary)
- Customize system theme colors (applies to both light and dark modes)
- Override all permission restrictions
- System administration and technical management

**Default Permissions:**
All permissions including `manage_theme`, `manage_roles`, `manage_permissions`

### 2. Administrator (Admin) - Full Operational Access
**Capabilities:**
- Full CRUD operations on all data
- User management (except Dev accounts)
- Grant temporary permissions to Pastor and Elder accounts
- Revoke temporary permissions
- System configuration and settings
- View all reports and analytics

**Default Permissions:**
- `manage_users`, `manage_members`, `view_members`, `edit_members`, `delete_members`
- `manage_attendance`, `view_attendance`, `record_attendance`
- `manage_giving`, `view_giving`, `record_giving`, `manage_giving_types`
- `view_reports`, `manage_settings`, `manage_services`, `grant_permissions`

### 3. Pastor - View-Only by Default
**Capabilities:**
- Read-only access to all member and church data
- Can be granted temporary write/manage permissions by Admin or Dev
- View all reports and analytics
- Cannot perform write operations without temporary permissions

**Default Permissions:**
- `view_members`, `view_attendance`, `view_giving`, `view_reports`

**Available Temporary Permissions:**
- `manage_members`, `edit_members`, `delete_members`
- `record_attendance`, `manage_attendance`
- `record_giving`, `manage_giving`, `manage_giving_types`
- `manage_services`

### 4. Elder - View-Only by Default
**Capabilities:**
- Read-only access to member and basic church data
- Can be granted limited temporary permissions by Admin
- View reports and analytics

**Default Permissions:**
- `view_members`, `view_attendance`, `view_giving`, `view_reports`

**Available Temporary Permissions:**
- `edit_members`
- `record_attendance`
- `record_giving`

## Temporary Permission System

### Features
1. **Time-Limited Access**: Permissions expire automatically after specified duration
2. **Flexible Durations**: 1hr, 3hr, 6hr, 12hr, 24hr, 48hr, or 1 week
3. **Easy Management**: Grant and revoke permissions through UI
4. **Automatic Cleanup**: Expired permissions are removed automatically
5. **Audit Trail**: Track who granted permissions and when

### Granting Temporary Permissions

**Prerequisites:**
- User must be Admin or Dev
- Target user must be Pastor or Elder
- Permission must not already be in the user's default role permissions

**Process:**
1. Navigate to Settings → Users & Permissions tab
2. Find the target user (Pastor or Elder)
3. Click "Grant Permission" button
4. Select the specific permission from dropdown
5. Choose duration (1hr to 1 week)
6. Confirm the grant

**Result:**
- Permission is immediately active for the user
- Displayed on user's card with expiration countdown
- User can access features requiring that permission
- Permission auto-expires after duration

### Revoking Temporary Permissions

**Process:**
1. Navigate to Settings → Users & Permissions tab
2. Find the user with active temporary permissions
3. Locate the permission in the "Temporary Permissions" section
4. Click the trash icon next to the permission
5. Permission is immediately revoked

### Implementation Details

**Data Structure:**
```typescript
interface TemporaryPermission {
  permission: string;        // Permission identifier
  expiresAt: Date;          // Expiration timestamp
  grantedBy: string;        // User ID who granted it
  grantedAt: Date;          // Grant timestamp
}
```

**Permission Check Logic:**
1. Check if user is Dev → grant all access
2. Check role-based permissions → grant if exists
3. Check temporary permissions → grant if valid (not expired)
4. Otherwise → deny access

**Automatic Cleanup:**
- System checks for expired permissions every minute
- Expired permissions are automatically removed from user objects
- No manual cleanup required

## Theme Customization (Dev Only)

### Features
- Customize primary, secondary, and accent colors
- Changes apply to both light and dark modes
- Real-time preview of changes
- Persistent across all user sessions
- Can reset to default theme

### Customization Process
1. Navigate to Settings → Theme tab (Dev only)
2. Use color pickers or enter hex values
3. Click "Apply Colors" to save changes
4. Or click "Reset to Default" to restore original theme

### Technical Details
- Colors stored in localStorage
- Applied via CSS custom properties
- Automatic HSL conversion for theme integration
- Affects all UI components system-wide

## Permission List

### User Management
- `manage_users` - Create, edit, delete users
- `manage_roles` - Create and modify roles
- `manage_permissions` - Assign/revoke permissions
- `grant_permissions` - Grant temporary permissions

### Member Management
- `view_members` - View member directory and profiles
- `manage_members` - Create new members
- `edit_members` - Edit member information (Dev by default, can be granted temporarily to others)
- `delete_members` - Delete member records

### Attendance
- `view_attendance` - View attendance records
- `record_attendance` - Mark individual attendance
- `manage_attendance` - Full attendance management

### Giving
- `view_giving` - View giving records
- `record_giving` - Record new giving
- `manage_giving` - Full giving management
- `manage_giving_types` - Create custom giving types

### Reports & Settings
- `view_reports` - Access all reports
- `manage_settings` - System configuration
- `manage_services` - Service type management
- `manage_theme` - Theme customization (Dev only)

### Super Permissions
- `view_all` - View everything
- `edit_all` - Edit everything
- `delete_all` - Delete everything

## Best Practices

### For Administrators
1. Grant temporary permissions only when needed
2. Use shortest duration that meets the need
3. Revoke permissions when task is complete
4. Monitor active temporary permissions regularly
5. Document permission grants for audit purposes

### For Developers
1. Use Dev access responsibly
2. Test permission changes in non-production first
3. Document custom roles and their purposes
4. Keep theme customizations aligned with church branding
5. Maintain audit logs of system changes

### Security Considerations
1. Regular permission audits
2. Monitor for permission abuse
3. Use temporary permissions instead of permanent role changes
4. Limit Dev role to technical staff only
5. Implement activity logging for sensitive operations

## Edit Member Functionality

### Overview
The Edit Member feature allows authorized users to modify existing member information. This is a sensitive operation that requires the `edit_members` permission.

### Permission Control
**Default Access:**
- **Dev Role**: Has permanent `edit_members` permission
- **Admin Role**: Has permanent `edit_members` permission  
- **Pastor Role**: No access by default (view-only)
- **Elder Role**: No access by default (view-only)

**Temporary Access:**
- Dev can grant temporary `edit_members` permission to Pastor or Elder
- Admin can grant temporary `edit_members` permission to Pastor or Elder
- Duration can be set from 1 hour to 1 week
- Permission automatically expires after the set duration

### Using Edit Member

**Accessing the Feature:**
1. Navigate to Members section
2. Click on a member to view their profile
3. If you have `edit_members` permission, an "Edit" button appears in the top-right
4. Click "Edit" to enter edit mode

**Editable Information:**
The edit form includes all member fields:
- **Basic Information**: First name, other names, last name, gender, date of birth
- **Member Status**: Active, Semi-Active, Inactive, Sabbatical, or Blacklisted
- **Contact Information**: Phone numbers (primary & secondary), email
- **Location**: Residence location, digital address, zone assignment
- **Baptism Information**: Baptism date (full/month-year/year only), previous congregation, role
- **Ministry Assignments**: Multiple ministry selections from 24 available ministries
- **Family Members**: Add/edit/remove family connections (minimum 2 required)
- **Legal Information**: Ghana Card details, alternative ID information
- **Profile Photo**: Upload or change passport-size photo
- **Additional Notes**: General notes about the member

**Validation Rules:**
- First name, last name, phone, gender, date of birth, residence, and zone are required
- At least 2 family members must be added
- Photo must be under 5MB
- All existing validation rules from member registration apply

**Saving Changes:**
1. Make desired changes to any fields
2. Click "Update Member" button (or "Cancel" to discard changes)
3. System validates all inputs
4. Success message confirms the update
5. Returns to member profile view with updated information

### Security Considerations
- Edit button only appears for users with `edit_members` permission
- Permission check happens before displaying edit functionality
- Temporary permissions are checked in real-time (expired permissions deny access)
- All changes are tracked in demo mode (in production, would create audit logs)

### Use Cases

**Scenario 1: Regular Updates (Dev/Admin)**
- Dev or Admin notices outdated member information
- Clicks Edit from member profile
- Updates contact information or zone assignment
- Saves changes immediately

**Scenario 2: Temporary Access for Pastor**
- Pastor needs to update ministry assignments for multiple members
- Admin grants `edit_members` permission for 6 hours
- Pastor edits member profiles and assigns ministries
- Permission expires after 6 hours, returning to view-only access

**Scenario 3: Temporary Access for Elder**
- Elder is organizing a zone event and needs to update member locations
- Dev grants `edit_members` permission for 24 hours
- Elder updates residence locations and digital addresses
- Permission auto-expires after 24 hours

### Technical Implementation
**Components:**
- `EditMember.tsx` - Main edit form component
- `MemberProfile.tsx` - Shows edit button when permission exists
- `AuthContext.tsx` - Handles permission checking via `canAccess('edit_members')`

**Permission Flow:**
```
User clicks Edit → canAccess('edit_members') check →
  if Dev: allow
  if in role permissions: allow
  if in valid temporary permissions: allow
  else: deny (button not shown)
```

## Future Enhancements

### Planned Features
1. Custom role creation UI (currently Dev-only via API)
2. Permission request workflow (users request, admin approves)
3. Bulk permission grants for multiple users
4. Permission templates for common scenarios
5. Detailed audit log viewer in UI
6. Email notifications for permission grants/revocations
7. Permission usage analytics

### Potential Improvements
1. More granular permissions (e.g., zone-specific)
2. Scheduled permission grants (activate at future time)
3. Recurring temporary permissions
4. Permission groups for easier management
5. Role inheritance system
6. Two-factor authentication for sensitive operations
