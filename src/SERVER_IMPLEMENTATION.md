# Complete Server Implementation

This file contains the complete backend API implementation for the Church Management System. Replace the contents of `/supabase/functions/server/index.tsx` with this code.

## File: `/supabase/functions/server/index.tsx`

```typescript
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Create Supabase client for auth operations
function getSupabaseClient(accessToken?: string) {
  if (accessToken) {
    return createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );
  }
  return supabase;
}

// Helper to get user from token
async function getUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  return user;
}

// Middleware
app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get("/make-server-cac55325/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Sign up new user
app.post("/make-server-cac55325/auth/signup", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();

    // Validate input
    if (!email || !password || !name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate role
    if (!['dev', 'admin', 'pastor', 'elder'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since we don't have email server configured
      user_metadata: { name, role }
    });

    if (authError) {
      console.error('Auth error during signup:', authError);
      return c.json({ error: authError.message }, 400);
    }

    if (!authData.user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        name,
        email,
        role,
        is_active: true
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Try to delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return c.json({ error: 'Failed to create user profile' }, 500);
    }

    return c.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name,
        role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Internal server error during signup' }, 500);
  }
});

// Sign in
app.post("/make-server-cac55325/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    if (!data.session) {
      return c.json({ error: 'No session created' }, 500);
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return c.json({ error: 'User profile not found' }, 404);
    }

    if (!profile.is_active) {
      return c.json({ error: 'Account is deactivated' }, 403);
    }

    return c.json({
      session: data.session,
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        isActive: profile.is_active
      }
    });
  } catch (error) {
    console.error('Sign in error:', error);
    return c.json({ error: 'Internal server error during sign in' }, 500);
  }
});

// Sign out
app.post("/make-server-cac55325/auth/signout", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      const userClient = getSupabaseClient(token);
      await userClient.auth.signOut();
    }

    return c.json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Sign out error:', error);
    return c.json({ error: 'Internal server error during sign out' }, 500);
  }
});

// Get current session
app.get("/make-server-cac55325/auth/session", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ session: null }, 401);
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json({
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        isActive: profile.is_active
      }
    });
  } catch (error) {
    console.error('Session check error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// MEMBERS ROUTES
// ============================================================================

// Get all members
app.get("/make-server-cac55325/members", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: members, error } = await supabase
      .from('members')
      .select(`
        *,
        family_members (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching members:', error);
      return c.json({ error: 'Failed to fetch members' }, 500);
    }

    return c.json(members);
  } catch (error) {
    console.error('Get members error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single member
app.get("/make-server-cac55325/members/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    const { data: member, error } = await supabase
      .from('members')
      .select(`
        *,
        family_members (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching member:', error);
      return c.json({ error: 'Member not found' }, 404);
    }

    return c.json(member);
  } catch (error) {
    console.error('Get member error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create member
app.post("/make-server-cac55325/members", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const memberData = await c.req.json();
    const { family_members, ...memberInfo } = memberData;

    // Insert member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        ...memberInfo,
        created_by: user.id
      })
      .select()
      .single();

    if (memberError) {
      console.error('Error creating member:', memberError);
      return c.json({ error: 'Failed to create member: ' + memberError.message }, 500);
    }

    // Insert family members if provided
    if (family_members && family_members.length > 0) {
      const familyMembersData = family_members.map((fm: any) => ({
        ...fm,
        member_id: member.id,
        id: undefined // Let database generate IDs
      }));

      const { error: familyError } = await supabase
        .from('family_members')
        .insert(familyMembersData);

      if (familyError) {
        console.error('Error creating family members:', familyError);
        // Don't fail the whole operation, just log the error
      }
    }

    // Fetch complete member with family members
    const { data: completeMember } = await supabase
      .from('members')
      .select(`
        *,
        family_members (*)
      `)
      .eq('id', member.id)
      .single();

    return c.json(completeMember || member, 201);
  } catch (error) {
    console.error('Create member error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update member
app.put("/make-server-cac55325/members/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const memberData = await c.req.json();
    const { family_members, ...memberInfo } = memberData;

    // Update member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .update(memberInfo)
      .eq('id', id)
      .select()
      .single();

    if (memberError) {
      console.error('Error updating member:', memberError);
      return c.json({ error: 'Failed to update member' }, 500);
    }

    // Update family members if provided
    if (family_members) {
      // Delete existing family members
      await supabase
        .from('family_members')
        .delete()
        .eq('member_id', id);

      // Insert new family members
      if (family_members.length > 0) {
        const familyMembersData = family_members.map((fm: any) => ({
          ...fm,
          member_id: id,
          id: undefined
        }));

        await supabase
          .from('family_members')
          .insert(familyMembersData);
      }
    }

    // Fetch complete member
    const { data: completeMember } = await supabase
      .from('members')
      .select(`
        *,
        family_members (*)
      `)
      .eq('id', id)
      .single();

    return c.json(completeMember || member);
  } catch (error) {
    console.error('Update member error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete member
app.delete("/make-server-cac55325/members/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting member:', error);
      return c.json({ error: 'Failed to delete member' }, 500);
    }

    return c.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// ATTENDANCE ROUTES
// ============================================================================

// Get all attendance records
app.get("/make-server-cac55325/attendance", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: records, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        attendance_entries (
          member_id
        )
      `)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching attendance:', error);
      return c.json({ error: 'Failed to fetch attendance records' }, 500);
    }

    // Transform to match frontend format
    const transformed = records.map(record => ({
      ...record,
      attendees: record.attendance_entries.map((entry: any) => entry.member_id)
    }));

    return c.json(transformed);
  } catch (error) {
    console.error('Get attendance error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create attendance record
app.post("/make-server-cac55325/attendance", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const data = await c.req.json();
    const { attendees, ...recordInfo } = data;

    // Create attendance record
    const { data: record, error: recordError } = await supabase
      .from('attendance_records')
      .insert({
        ...recordInfo,
        created_by: user.id,
        total_count: attendees?.length || 0
      })
      .select()
      .single();

    if (recordError) {
      console.error('Error creating attendance record:', recordError);
      return c.json({ error: 'Failed to create attendance record: ' + recordError.message }, 500);
    }

    // Create attendance entries
    if (attendees && attendees.length > 0) {
      const entries = attendees.map((memberId: string) => ({
        attendance_record_id: record.id,
        member_id: memberId
      }));

      const { error: entriesError } = await supabase
        .from('attendance_entries')
        .insert(entries);

      if (entriesError) {
        console.error('Error creating attendance entries:', entriesError);
      }
    }

    return c.json({ ...record, attendees }, 201);
  } catch (error) {
    console.error('Create attendance error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update attendance record
app.put("/make-server-cac55325/attendance/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const data = await c.req.json();
    const { attendees, ...recordInfo } = data;

    // Update record
    const { data: record, error: recordError } = await supabase
      .from('attendance_records')
      .update({
        ...recordInfo,
        total_count: attendees?.length || 0
      })
      .eq('id', id)
      .select()
      .single();

    if (recordError) {
      console.error('Error updating attendance:', recordError);
      return c.json({ error: 'Failed to update attendance' }, 500);
    }

    // Update attendees if provided
    if (attendees) {
      // Delete existing entries
      await supabase
        .from('attendance_entries')
        .delete()
        .eq('attendance_record_id', id);

      // Insert new entries
      if (attendees.length > 0) {
        const entries = attendees.map((memberId: string) => ({
          attendance_record_id: id,
          member_id: memberId
        }));

        await supabase
          .from('attendance_entries')
          .insert(entries);
      }
    }

    return c.json({ ...record, attendees });
  } catch (error) {
    console.error('Update attendance error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete attendance record
app.delete("/make-server-cac55325/attendance/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    const { error } = await supabase
      .from('attendance_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting attendance:', error);
      return c.json({ error: 'Failed to delete attendance' }, 500);
    }

    return c.json({ message: 'Attendance deleted successfully' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get custom services
app.get("/make-server-cac55325/services", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: services, error } = await supabase
      .from('custom_services')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching services:', error);
      return c.json({ error: 'Failed to fetch services' }, 500);
    }

    return c.json(services);
  } catch (error) {
    console.error('Get services error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create custom service
app.post("/make-server-cac55325/services", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const serviceData = await c.req.json();

    const { data: service, error } = await supabase
      .from('custom_services')
      .insert({
        ...serviceData,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating service:', error);
      return c.json({ error: 'Failed to create service' }, 500);
    }

    return c.json(service, 201);
  } catch (error) {
    console.error('Create service error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// GIVING ROUTES
// ============================================================================

// Get all giving records
app.get("/make-server-cac55325/giving", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: records, error } = await supabase
      .from('giving_records')
      .select('*')
      .order('service_date', { ascending: false });

    if (error) {
      console.error('Error fetching giving records:', error);
      return c.json({ error: 'Failed to fetch giving records' }, 500);
    }

    // Transform to match frontend format
    const transformed = records.map(record => ({
      id: record.id,
      serviceName: record.service_name,
      serviceDate: record.service_date,
      serviceType: record.service_type,
      offerings: {
        offering: parseFloat(record.offering_amount),
        donation: parseFloat(record.donation_amount),
        thanksgiving: parseFloat(record.thanksgiving_amount),
        customTypes: record.custom_types
      },
      totalAmount: parseFloat(record.total_amount),
      paymentBreakdown: {
        cash: parseFloat(record.cash_amount),
        mobile_money: parseFloat(record.mobile_money_amount),
        card: parseFloat(record.card_amount),
        bank_transfer: parseFloat(record.bank_transfer_amount)
      },
      notes: record.notes,
      recordedBy: 'User',
      recordedDate: record.created_at
    }));

    return c.json(transformed);
  } catch (error) {
    console.error('Get giving error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create giving record
app.post("/make-server-cac55325/giving", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const data = await c.req.json();

    const { data: record, error } = await supabase
      .from('giving_records')
      .insert({
        service_name: data.serviceName,
        service_date: data.serviceDate,
        service_type: data.serviceType,
        offering_amount: data.offerings.offering,
        donation_amount: data.offerings.donation,
        thanksgiving_amount: data.offerings.thanksgiving,
        custom_types: data.offerings.customTypes,
        total_amount: data.totalAmount,
        cash_amount: data.paymentBreakdown.cash,
        mobile_money_amount: data.paymentBreakdown.mobile_money,
        card_amount: data.paymentBreakdown.card,
        bank_transfer_amount: data.paymentBreakdown.bank_transfer,
        notes: data.notes,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating giving record:', error);
      return c.json({ error: 'Failed to create giving record: ' + error.message }, 500);
    }

    return c.json(record, 201);
  } catch (error) {
    console.error('Create giving error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get custom giving types
app.get("/make-server-cac55325/giving/types", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: types, error } = await supabase
      .from('custom_giving_types')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching giving types:', error);
      return c.json({ error: 'Failed to fetch giving types' }, 500);
    }

    return c.json(types);
  } catch (error) {
    console.error('Get giving types error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create custom giving type
app.post("/make-server-cac55325/giving/types", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const typeData = await c.req.json();

    const { data: type, error } = await supabase
      .from('custom_giving_types')
      .insert({
        ...typeData,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating giving type:', error);
      return c.json({ error: 'Failed to create giving type' }, 500);
    }

    return c.json(type, 201);
  } catch (error) {
    console.error('Create giving type error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// VISITORS ROUTES
// ============================================================================

// Get all visitors
app.get("/make-server-cac55325/visitors", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: visitors, error } = await supabase
      .from('visitors')
      .select('*')
      .order('visit_date', { ascending: false });

    if (error) {
      console.error('Error fetching visitors:', error);
      return c.json({ error: 'Failed to fetch visitors' }, 500);
    }

    // Transform to match frontend format
    const transformed = visitors.map(v => ({
      id: v.id,
      firstName: v.first_name,
      lastName: v.last_name,
      otherNames: v.other_names,
      email: v.email,
      phone: v.phone,
      secondPhone: v.second_phone,
      gender: v.gender,
      dateOfBirth: v.date_of_birth,
      residenceLocation: v.residence_location,
      visitDate: v.visit_date,
      serviceType: v.service_type,
      referredBy: v.referred_by,
      interestedInMembership: v.interested_in_membership,
      notes: v.notes,
      followUpStatus: v.follow_up_status,
      potentialZone: v.potential_zone
    }));

    return c.json(transformed);
  } catch (error) {
    console.error('Get visitors error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create visitor
app.post("/make-server-cac55325/visitors", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const data = await c.req.json();

    const { data: visitor, error } = await supabase
      .from('visitors')
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        other_names: data.otherNames,
        email: data.email,
        phone: data.phone,
        second_phone: data.secondPhone,
        gender: data.gender,
        date_of_birth: data.dateOfBirth,
        residence_location: data.residenceLocation,
        visit_date: data.visitDate,
        service_type: data.serviceType,
        referred_by: data.referredBy,
        interested_in_membership: data.interestedInMembership,
        notes: data.notes,
        follow_up_status: data.followUpStatus,
        potential_zone: data.potentialZone,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating visitor:', error);
      return c.json({ error: 'Failed to create visitor: ' + error.message }, 500);
    }

    return c.json(visitor, 201);
  } catch (error) {
    console.error('Create visitor error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update visitor
app.put("/make-server-cac55325/visitors/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const data = await c.req.json();

    const { data: visitor, error } = await supabase
      .from('visitors')
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        other_names: data.otherNames,
        email: data.email,
        phone: data.phone,
        second_phone: data.secondPhone,
        gender: data.gender,
        date_of_birth: data.dateOfBirth,
        residence_location: data.residenceLocation,
        visit_date: data.visitDate,
        service_type: data.serviceType,
        referred_by: data.referredBy,
        interested_in_membership: data.interestedInMembership,
        notes: data.notes,
        follow_up_status: data.followUpStatus,
        potential_zone: data.potentialZone
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating visitor:', error);
      return c.json({ error: 'Failed to update visitor' }, 500);
    }

    return c.json(visitor);
  } catch (error) {
    console.error('Update visitor error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Convert visitor to member
app.post("/make-server-cac55325/visitors/:id/convert", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const memberData = await c.req.json();

    // Get visitor
    const { data: visitor, error: visitorError } = await supabase
      .from('visitors')
      .select('*')
      .eq('id', id)
      .single();

    if (visitorError || !visitor) {
      return c.json({ error: 'Visitor not found' }, 404);
    }

    // Create member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        ...memberData,
        created_by: user.id
      })
      .select()
      .single();

    if (memberError) {
      console.error('Error converting visitor to member:', memberError);
      return c.json({ error: 'Failed to convert visitor' }, 500);
    }

    // Mark visitor as converted
    await supabase
      .from('visitors')
      .update({
        converted_to_member: true,
        converted_member_id: member.id,
        follow_up_status: 'completed'
      })
      .eq('id', id);

    return c.json(member, 201);
  } catch (error) {
    console.error('Convert visitor error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// PERMISSIONS ROUTES
// ============================================================================

// Grant temporary permission
app.post("/make-server-cac55325/permissions/grant", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { userId, permission, durationHours } = await c.req.json();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    const { data, error } = await supabase
      .from('temporary_permissions')
      .insert({
        user_id: userId,
        permission,
        expires_at: expiresAt.toISOString(),
        granted_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error granting permission:', error);
      return c.json({ error: 'Failed to grant permission' }, 500);
    }

    return c.json(data, 201);
  } catch (error) {
    console.error('Grant permission error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Revoke temporary permission
app.post("/make-server-cac55325/permissions/revoke", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { userId, permission } = await c.req.json();

    const { error } = await supabase
      .from('temporary_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission', permission);

    if (error) {
      console.error('Error revoking permission:', error);
      return c.json({ error: 'Failed to revoke permission' }, 500);
    }

    return c.json({ message: 'Permission revoked successfully' });
  } catch (error) {
    console.error('Revoke permission error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// REPORTS & STATISTICS
// ============================================================================

// Get dashboard statistics
app.get("/make-server-cac55325/stats", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true });

    // Get recent attendance
    const { data: recentAttendance } = await supabase
      .from('attendance_records')
      .select('total_count')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // Get total giving this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { data: givingRecords } = await supabase
      .from('giving_records')
      .select('total_amount')
      .gte('service_date', startOfMonth.toISOString().split('T')[0]);

    const totalGiving = givingRecords?.reduce((sum, r) => sum + parseFloat(r.total_amount), 0) || 0;

    // Get visitor count
    const { count: visitorCount } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true });

    return c.json({
      memberCount: memberCount || 0,
      recentAttendance: recentAttendance?.total_count || 0,
      monthlyGiving: totalGiving,
      visitorCount: visitorCount || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// START SERVER
// ============================================================================

Deno.serve(app.fetch);
```

## Notes

1. **Authentication**: Uses Supabase Auth with custom profiles table
2. **Authorization**: Checks user authentication for all protected routes
3. **Error Handling**: Comprehensive error logging and user-friendly error messages
4. **CORS**: Configured for cross-origin requests
5. **Database**: Uses Supabase PostgreSQL with Row Level Security
6. **Format Transformation**: Converts between database format and frontend format

## Environment Variables Required

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin operations)
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key (for user operations)

## Deployment

Deploy this code using:

```bash
supabase functions deploy server
```

Make sure you've run all the database migrations from `BACKEND_INTEGRATION_GUIDE.md` before deploying.
