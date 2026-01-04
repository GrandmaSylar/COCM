import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "@supabase/supabase-js";

// Create Hono app with basePath matching function name
const app = new Hono().basePath('/server');

// DEBUG: Check for required Env Vars
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

// Log fatal errors but DO NOT throw (prevents 500 crash)
if (!supabaseUrl || !serviceRoleKey) {
    console.error("FATAL ERROR: Missing Supabase Environment Variables!");
    console.error("SUPABASE_URL present:", !!supabaseUrl);
    console.error("SUPABASE_SERVICE_ROLE_KEY present:", !!serviceRoleKey);
}

// Create Supabase client with fallbacks
// This ensures the script compiles and runs even if secrets are missing
const supabase = createClient(
    supabaseUrl || 'https://missing-url.supabase.co',
    serviceRoleKey || 'missing-key',
);

// Create Supabase client for auth operations
function getSupabaseClient(accessToken?: string) {
    if (accessToken) {
        return createClient(
            supabaseUrl || 'https://missing-url.supabase.co',
            anonKey || 'missing-key',
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

app.get("/health", (c) => {
    return c.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        check: {
            url: !!supabaseUrl,
            key: !!serviceRoleKey
        }
    });
});

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Sign up new user
app.post("/auth/signup", async (c) => {
    try {
        const body = await c.req.json().catch(() => null);
        console.log("Signup attempt:", body);

        // Explicit check inside the route
        if (!supabaseUrl || !serviceRoleKey) {
            console.error("Signup failed: Missing server secrets");
            return c.json({
                error: 'Server Misconfiguration',
                details: 'SUPABASE_URL or SERVICE_ROLE_KEY is not set in Edge Function Secrets.'
            }, 500);
        }

        if (!body) {
            return c.json({ error: 'Invalid JSON body' }, 400);
        }

        const { email, password, name, role } = body;

        if (!email || !password || !name || !role) {
            return c.json({ error: 'Missing required fields' }, 400);
        }

        if (!['dev', 'admin', 'pastor', 'elder'].includes(role)) {
            return c.json({ error: 'Invalid role' }, 400);
        }

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, role }
        });

        if (authError) {
            console.error('Auth error during signup:', authError);
            return c.json({ error: authError.message }, 400);
        }

        if (!authData.user) {
            return c.json({ error: 'Failed to create user' }, 500);
        }

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
        return c.json({ error: 'Internal server error during signup: ' + error.message }, 500);
    }
});

// ... existing routes for signin, signout, members, attendance, services, giving, visitors, permissions ...
// (Copying remaining routes to ensure file is complete and runnable)

app.post("/auth/signin", async (c) => {
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

app.post("/auth/signout", async (c) => {
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

app.get("/auth/session", async (c) => {
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

app.get("/members", async (c) => {
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

app.get("/members/:id", async (c) => {
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

app.post("/members", async (c) => {
    try {
        const user = await getUserFromToken(c.req.raw);
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const memberData = await c.req.json();
        const { familyMembers, ...memberInfo } = memberData;

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

        if (familyMembers && familyMembers.length > 0) {
            const familyMembersData = familyMembers.map((fm: any) => ({
                ...fm,
                member_id: member.id,
                id: undefined
            }));

            await supabase
                .from('family_members')
                .insert(familyMembersData);
        }

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

app.put("/members/:id", async (c) => {
    try {
        const user = await getUserFromToken(c.req.raw);
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const id = c.req.param('id');
        const memberData = await c.req.json();
        const { familyMembers, ...memberInfo } = memberData;

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

        if (familyMembers) {
            await supabase
                .from('family_members')
                .delete()
                .eq('member_id', id);

            if (familyMembers.length > 0) {
                const familyMembersData = familyMembers.map((fm: any) => ({
                    ...fm,
                    member_id: id,
                    id: undefined
                }));

                await supabase
                    .from('family_members')
                    .insert(familyMembersData);
            }
        }

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

app.delete("/members/:id", async (c) => {
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

app.get("/attendance", async (c) => {
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

app.post("/attendance", async (c) => {
    try {
        const user = await getUserFromToken(c.req.raw);
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const data = await c.req.json();
        const { attendees, ...recordInfo } = data;

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

        if (attendees && attendees.length > 0) {
            const entries = attendees.map((memberId: string) => ({
                attendance_record_id: record.id,
                member_id: memberId
            }));

            await supabase
                .from('attendance_entries')
                .insert(entries);
        }

        return c.json({ ...record, attendees }, 201);
    } catch (error) {
        console.error('Create attendance error:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

app.put("/attendance/:id", async (c) => {
    try {
        const user = await getUserFromToken(c.req.raw);
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const id = c.req.param('id');
        const data = await c.req.json();
        const { attendees, ...recordInfo } = data;

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

        if (attendees) {
            await supabase
                .from('attendance_entries')
                .delete()
                .eq('attendance_record_id', id);

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

app.delete("/attendance/:id", async (c) => {
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

app.get("/services", async (c) => {
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

app.post("/services", async (c) => {
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

app.get("/giving", async (c) => {
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

app.post("/giving", async (c) => {
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

app.get("/giving/types", async (c) => {
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

app.post("/giving/types", async (c) => {
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

app.get("/visitors", async (c) => {
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

app.post("/visitors", async (c) => {
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

app.put("/visitors/:id", async (c) => {
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

app.post("/visitors/:id/convert", async (c) => {
    try {
        const user = await getUserFromToken(c.req.raw);
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const id = c.req.param('id');
        const memberData = await c.req.json();

        const { data: visitor, error: visitorError } = await supabase
            .from('visitors')
            .select('*')
            .eq('id', id)
            .single();

        if (visitorError || !visitor) {
            return c.json({ error: 'Visitor not found' }, 404);
        }

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

app.post("/permissions/grant", async (c) => {
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

app.post("/permissions/revoke", async (c) => {
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

app.get("/stats", async (c) => {
    try {
        const user = await getUserFromToken(c.req.raw);
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        // Get total members
        const { count: totalMembers } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true });

        // Get this week's attendance (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: weekAttendance } = await supabase
            .from('attendance_records')
            .select('total_count')
            .gte('date', weekAgo.toISOString().split('T')[0])
            .order('date', { ascending: false })
            .limit(1)
            .single();

        // Get this month's giving
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const { data: monthGiving } = await supabase
            .from('giving_records')
            .select('total_amount')
            .gte('service_date', startOfMonth.toISOString().split('T')[0]);

        const givingThisMonth = monthGiving?.reduce((sum, r) => sum + parseFloat(r.total_amount), 0) || 0;

        // Get new members this month
        const { count: newMembersCount } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth.toISOString());

        return c.json({
            totalMembers: totalMembers || 0,
            attendanceThisWeek: weekAttendance?.total_count || 0,
            givingThisMonth: givingThisMonth,
            newMembersThisMonth: newMembersCount || 0
        });
    } catch (error) {
        console.error('Get stats error:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// Reports endpoint with trends and analytics
app.get("/reports", async (c) => {
    try {
        const user = await getUserFromToken(c.req.raw);
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const period = c.req.query('period') || 'year'; // month, quarter, year

        // Calculate date range
        const now = new Date();
        const startDate = new Date();
        if (period === 'month') {
            startDate.setDate(1);
        } else if (period === 'quarter') {
            startDate.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
        } else {
            startDate.setMonth(0, 1); // Start of year
        }

        // Get all attendance records for the period
        const { data: attendanceRecords } = await supabase
            .from('attendance_records')
            .select('date, total_count')
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        // Get all giving records for the period
        const { data: givingRecords } = await supabase
            .from('giving_records')
            .select('service_date, total_amount')
            .gte('service_date', startDate.toISOString().split('T')[0])
            .order('service_date', { ascending: true });

        // Get all members with creation dates
        const { data: allMembers } = await supabase
            .from('members')
            .select('created_at')
            .order('created_at', { ascending: true });

        // Aggregate data by month
        const monthlyData: any = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize monthly data structure
        for (let i = 0; i < 12; i++) {
            monthlyData[i] = {
                month: months[i],
                attendance: 0,
                attendanceCount: 0,
                giving: 0,
                members: 0,
                newMembers: 0
            };
        }

        // Aggregate attendance by month
        attendanceRecords?.forEach(record => {
            const month = new Date(record.date).getMonth();
            monthlyData[month].attendance += record.total_count;
            monthlyData[month].attendanceCount++;
        });

        // Calculate average attendance per month
        for (let i = 0; i < 12; i++) {
            if (monthlyData[i].attendanceCount > 0) {
                monthlyData[i].attendance = Math.round(monthlyData[i].attendance / monthlyData[i].attendanceCount);
            }
        }

        // Aggregate giving by month
        givingRecords?.forEach(record => {
            const month = new Date(record.service_date).getMonth();
            monthlyData[month].giving += parseFloat(record.total_amount);
        });

        // Calculate membership growth
        let cumulativeMembers = 0;
        allMembers?.forEach(member => {
            const createdDate = new Date(member.created_at);
            const month = createdDate.getMonth();
            monthlyData[month].newMembers++;
            cumulativeMembers++;
        });

        // Set cumulative member count for each month
        let runningTotal = 0;
        for (let i = 0; i < 12; i++) {
            runningTotal += monthlyData[i].newMembers;
            monthlyData[i].members = runningTotal;
        }

        // Convert to arrays for charts
        const attendanceData = Object.values(monthlyData).map((m: any) => ({
            month: m.month,
            attendance: m.attendance
        }));

        const givingData = Object.values(monthlyData).map((m: any) => ({
            month: m.month,
            amount: m.giving
        }));

        const membershipData = Object.values(monthlyData).map((m: any) => ({
            month: m.month,
            members: m.members,
            newMembers: m.newMembers
        }));

        // Calculate summary statistics
        const totalMembers = allMembers?.length || 0;
        const totalAttendanceRecords = attendanceRecords?.length || 0;
        const avgAttendance = totalAttendanceRecords > 0
            ? Math.round(attendanceRecords.reduce((sum, r) => sum + r.total_count, 0) / totalAttendanceRecords)
            : 0;
        const totalGiving = givingRecords?.reduce((sum, r) => sum + parseFloat(r.total_amount), 0) || 0;

        // Calculate growth rate
        const firstMonthMembers = membershipData.find(m => m.members > 0)?.members || 1;
        const lastMonthMembers = membershipData[membershipData.length - 1]?.members || 0;
        const growthRate = firstMonthMembers > 0
            ? ((lastMonthMembers - firstMonthMembers) / firstMonthMembers * 100)
            : 0;

        // Calculate attendance rate (avg attendance / total members)
        const attendanceRate = totalMembers > 0 ? (avgAttendance / totalMembers * 100) : 0;

        // Calculate giving participation (members who gave / total members)
        const { data: uniqueGivers } = await supabase
            .from('giving_records')
            .select('member_id')
            .gte('service_date', startDate.toISOString().split('T')[0]);

        const uniqueGiversCount = new Set(uniqueGivers?.map(g => g.member_id)).size;
        const givingParticipation = totalMembers > 0 ? (uniqueGiversCount / totalMembers * 100) : 0;

        return c.json({
            attendanceData,
            givingData,
            membershipData,
            summary: {
                totalMembers,
                avgAttendance,
                totalGiving,
                growthRate,
                attendanceRate,
                givingParticipation,
                servicesHeld: totalAttendanceRecords,
                newMembersThisMonth: monthlyData[now.getMonth()]?.newMembers || 0,
                monthlyGiving: monthlyData[now.getMonth()]?.giving || 0,
                monthlyAvgAttendance: monthlyData[now.getMonth()]?.attendance || 0
            }
        });
    } catch (error) {
        console.error('Get reports error:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// DEBUG: Global 404 Handler
app.notFound((c) => {
    return c.json({
        message: 'DEBUG: Route Not Found',
        ok: false,
        debug: {
            userAgent: c.req.header('User-Agent'),
            url: c.req.url,
            path: c.req.path,
            method: c.req.method,
            matchedRoute: c.req.routePath,
        }
    }, 404);
});

Deno.serve(app.fetch);