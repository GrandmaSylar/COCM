// ============================================================================
// OPTIMIZED MEMBERS ENDPOINT
// Add this to supabase/functions/server/index.ts around line 1069
// ============================================================================

// Get all members with optional pagination and optimized query
app.get("/members", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }

    // Get query parameters for pagination (optional)
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '100'); // Default 100, max 500
    const offset = (page - 1) * limit;

    // OPTIMIZATION 1: Only select needed columns (removes photo_url and JSON fields for list view)
    const { data: members, error } = await supabase
      .from('members')
      .select(`
        id,
        first_name,
        last_name,
        other_names,
        email,
        phone,
        second_phone,
        gender,
        marital_status,
        date_of_birth,
        occupation,
        hometown,
        residence_location,
        digital_address,
        zone,
        zone_number,
        notes,
        status,
        join_date,
        photo_url,
        baptism_info,
        legalInfo:legal_info,
        ministries,
        sabbatical_start_date,
        sabbatical_end_date,
        sabbatical_reason,
        created_at,
        updated_at,
        created_by,
        family_members (
          id,
          member_id,
          relationship,
          first_name,
          last_name,
          other_names,
          phone,
          occupation,
          hometown,
          is_linked,
          linked_member_id
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching members:', error);
      return c.json({ error: 'Failed to fetch members' }, 500);
    }

    // OPTIMIZATION 2: Get total count for pagination
    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true });

    // Transform to camelCase
    const transformedMembers = toCamelCase(members || []);

    return c.json({
      data: transformedMembers,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0)
      }
    });

  } catch (error) {
    console.error('Get members error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// ============================================================================
// QUICK STATS ENDPOINT (for dashboard - lightweight version)
// ============================================================================

app.get("/members/stats/quick", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get only what we need for stats
    const { data: members } = await supabase
      .from('members')
      .select('id, status, join_date', { head: false, count: 'exact' });

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    const stats = {
      total: members?.length || 0,
      active: members?.filter((m: any) => m.status === 'active').length || 0,
      semiActive: members?.filter((m: any) => m.status === 'semi-active').length || 0,
      inactive: members?.filter((m: any) => m.status === 'inactive').length || 0,
      newThisMonth: members?.filter((m: any) => m.join_date.startsWith(thisMonth)).length || 0
    };

    return c.json(stats);

  } catch (error) {
    console.error('Get members stats error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// FILTERED MEMBERS ENDPOINT (for list with filters)
// ============================================================================

app.get("/members/search", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const zone = c.req.query('zone');
    const status = c.req.query('status');
    const gender = c.req.query('gender');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('members')
      .select('id, first_name, last_name, phone, zone, status, join_date, photo_url', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (zone && zone !== 'all') query = query.eq('zone', zone);
    if (status && status !== 'all') query = query.eq('status', status);
    if (gender && gender !== 'all') query = query.eq('gender', gender);

    const { data: members, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching filtered members:', error);
      return c.json({ error: 'Failed to fetch members' }, 500);
    }

    return c.json({
      data: toCamelCase(members || []),
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Search members error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
