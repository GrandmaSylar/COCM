import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken, checkPermission } from "../lib/auth-helpers.ts";
import { toCamelCase, toSnakeCase } from "../lib/transform.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";
// Additional helpers
import { logActivity, getProfileForLog } from "../lib/activity-helpers.ts";
import { recalculateMemberStatuses, applyInverseLinks } from "../lib/member-helpers.ts";
import { createNotification, notifyTabUsers } from "../lib/notification-helpers.ts";
import { normalizePhone, generateOtp, maskEmail, maskPhone, sendOtpEmail, sendOtpSms } from "../lib/two-factor-helpers.ts";

const router = new Hono();

// ============================================================================

router.get("/services", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: services, error } = await supabase.from('custom_services').select('*').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching services:', error);
      return c.json({
        error: 'Failed to fetch services'
      }, 500);
    }
    return c.json(toCamelCase(services));
  } catch (error) {
    console.error('Get services error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.post("/services", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const serviceData = await c.req.json();
    const { data: service, error } = await supabase.from('custom_services').insert({
      ...serviceData,
      created_by: user.id
    }).select().single();
    if (error) {
      console.error('Error creating service:', error);
      return c.json({
        error: 'Failed to create service'
      }, 500);
    }
    return c.json(service, 201);
  } catch (error) {
    console.error('Create service error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Update a service
router.put("/services/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const serviceId = c.req.param('id');
    const updateData = await c.req.json();

    const { data: service, error } = await supabase
      .from('custom_services')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating service:', error);
      return c.json({ error: 'Failed to update service' }, 500);
    }

    return c.json(toCamelCase(service));
  } catch (error) {
    console.error('Update service error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete a service
router.delete("/services/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const serviceId = c.req.param('id');

    const { error } = await supabase
      .from('custom_services')
      .delete()
      .eq('id', serviceId);

    if (error) {
      console.error('Error deleting service:', error);
      return c.json({ error: 'Failed to delete service' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete service error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.get("/giving", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: records, error } = await supabase.from('giving_records').select('*').order('service_date', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching giving records:', error);
      return c.json({
        error: 'Failed to fetch giving records'
      }, 500);
    }

    // Fetch profile info for all creators and editors
    const allUserIds = [...new Set([
      ...records.filter(r => r.created_by).map(r => r.created_by),
      ...records.filter(r => r.edited_by).map(r => r.edited_by)
    ])];
    let profilesMap: Record<string, { name: string; email: string }> = {};

    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', allUserIds);

      if (profiles) {
        for (const profile of profiles) {
          profilesMap[profile.id] = { name: profile.name, email: profile.email };
        }
      }
    }

    const transformed = records.map((record)=>{
        const creator = record.created_by ? profilesMap[record.created_by] : null;
        const editor = record.edited_by ? profilesMap[record.edited_by] : null;
        return {
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
          createdBy: creator ? creator.name : null,
          createdByEmail: creator ? creator.email : null,
          createdAt: record.created_at,
          editedBy: editor ? editor.name : null,
          editedByEmail: editor ? editor.email : null,
          editedAt: record.edited_at
        };
      });
    return c.json(transformed);
  } catch (error) {
    console.error('Get giving error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.post("/giving", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const data = await c.req.json();
    const { data: record, error } = await supabase.from('giving_records').insert({
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
    }).select().single();
    if (error) {
      console.error('Error creating giving record:', error);
      return c.json({
        error: 'Failed to create giving record: ' + error.message
      }, 500);
    }
    // Auto-create/update service_record for giving
    try {
      const { data: existingSR } = await supabase.from('service_records')
        .select('id, giving_record_id').eq('service_date', data.serviceDate).eq('service_type', data.serviceType).single();
      if (existingSR) {
        await supabase.from('service_records').update({
          giving_record_id: record.id, updated_at: new Date().toISOString()
        }).eq('id', existingSR.id);
      } else {
        await supabase.from('service_records').insert({
          service_date: data.serviceDate, service_type: data.serviceType,
          giving_record_id: record.id, created_by: user.id
        });
      }
    } catch (srErr) { console.error('Service record auto-create error:', srErr); }

    // Log activity
    const logPG = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logPG.name, userRole: logPG.role,
      action: 'create', entityType: 'giving', entityId: record.id,
      description: `Recorded giving for ${data.serviceName || data.serviceType} on ${data.serviceDate} — GH₵${data.totalAmount}`
    });

    // Check for new high giving and notify
    try {
      const { data: maxGiving } = await supabase.from('giving_records')
        .select('total_amount').order('total_amount', { ascending: false }).limit(1).neq('id', record.id).single();
      if (maxGiving && parseFloat(record.total_amount) > parseFloat(maxGiving.total_amount)) {
        notifyTabUsers('giving', {
          type: 'giving_record', title: 'New Giving Record!',
          message: `${data.serviceName || data.serviceType} on ${data.serviceDate} raised GH₵${data.totalAmount} — a new high!`,
          entityType: 'giving', entityId: record.id, excludeUserId: user.id
        });
      }
    } catch (nErr) { console.error('Notification check error:', nErr); }

    return c.json(record, 201);
  } catch (error) {
    console.error('Create giving error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.get("/giving/types", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: types, error } = await supabase.from('custom_giving_types').select('*').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching giving types:', error);
      return c.json({
        error: 'Failed to fetch giving types'
      }, 500);
    }

    // Fetch profile info for all creators
    const creatorIds = [...new Set(types.filter(t => t.created_by).map(t => t.created_by))];
    let profilesMap: Record<string, { name: string; email: string }> = {};

    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', creatorIds);

      if (profiles) {
        for (const profile of profiles) {
          profilesMap[profile.id] = { name: profile.name, email: profile.email };
        }
      }
    }

    // Transform with creator name
    const transformed = types.map(type => {
      const creator = type.created_by ? profilesMap[type.created_by] : null;
      return {
        ...(toCamelCase(type) as Record<string, unknown>),
        createdBy: creator ? creator.name : null,
        createdByEmail: creator ? creator.email : null
      };
    });

    return c.json(transformed);
  } catch (error) {
    console.error('Get giving types error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.post("/giving/types", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const typeData = await c.req.json();
    const { data: type, error } = await supabase.from('custom_giving_types').insert({
      ...typeData,
      created_by: user.id
    }).select().single();
    if (error) {
      console.error('Error creating giving type:', error);
      return c.json({
        error: 'Failed to create giving type'
      }, 500);
    }
    return c.json(type, 201);
  } catch (error) {
    console.error('Create giving type error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Update giving type
router.patch("/giving/types/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = await checkPermission(user.id, 'manage_giving_types');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const typeId = c.req.param('id');
    const typeData = await c.req.json();

    const { data: type, error } = await supabase
      .from('custom_giving_types')
      .update(typeData)
      .eq('id', typeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating giving type:', error);
      return c.json({ error: 'Failed to update giving type' }, 500);
    }

    return c.json(type);
  } catch (error) {
    console.error('Update giving type error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete giving type
router.delete("/giving/types/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = await checkPermission(user.id, 'manage_giving_types');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const typeId = c.req.param('id');

    const { error } = await supabase
      .from('custom_giving_types')
      .delete()
      .eq('id', typeId);

    if (error) {
      console.error('Error deleting giving type:', error);
      return c.json({ error: 'Failed to delete giving type' }, 500);
    }

    return c.json({ message: 'Giving type deleted successfully' });
  } catch (error) {
    console.error('Delete giving type error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Toggle giving type active status
router.patch("/giving/types/:id/toggle", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = await checkPermission(user.id, 'manage_giving_types');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const typeId = c.req.param('id');

    // Get current status
    const { data: currentType } = await supabase
      .from('custom_giving_types')
      .select('is_active')
      .eq('id', typeId)
      .single();

    if (!currentType) {
      return c.json({ error: 'Giving type not found' }, 404);
    }

    // Toggle the status
    const { data: type, error } = await supabase
      .from('custom_giving_types')
      .update({ is_active: !currentType.is_active })
      .eq('id', typeId)
      .select()
      .single();

    if (error) {
      console.error('Error toggling giving type:', error);
      return c.json({ error: 'Failed to toggle giving type' }, 500);
    }

    return c.json(toCamelCase(type));
  } catch (error) {
    console.error('Toggle giving type error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET single giving record
router.get("/giving/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record, error } = await supabase.from('giving_records').select('*').eq('id', id).single();
    if (error) {
      console.error('Error fetching giving record:', error);
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Giving record not found' }, 404);
      }
      return c.json({ error: 'Failed to fetch giving record' }, 500);
    }
    // Get creator and editor info
    let creatorName = null;
    let creatorEmail = null;
    let editorName = null;
    let editorEmail = null;

    const profileIds = [record.created_by, record.edited_by].filter(Boolean);
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', profileIds);
      if (profiles) {
        for (const p of profiles) {
          if (p.id === record.created_by) { creatorName = p.name; creatorEmail = p.email; }
          if (p.id === record.edited_by) { editorName = p.name; editorEmail = p.email; }
        }
      }
    }

    return c.json({
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
      createdBy: creatorName,
      createdByEmail: creatorEmail,
      createdAt: record.created_at,
      editedBy: editorName,
      editedByEmail: editorEmail,
      editedAt: record.edited_at
    });
  } catch (error) {
    console.error('Get giving by id error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PUT update giving record with 3-hour edit window
router.put("/giving/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');

    // Check 3-hour edit window
    const { data: existingRecord } = await supabase
      .from('giving_records')
      .select('created_at')
      .eq('id', id)
      .single();

    if (existingRecord) {
      const createdAt = new Date(existingRecord.created_at).getTime();
      const now = Date.now();
      const threeHours = 3 * 60 * 60 * 1000;
      if (now - createdAt > threeHours) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!profile || profile.role !== 'dev') {
          return c.json({
            error: 'Edit window has expired (3 hours). Only Dev users can edit after this period.'
          }, 403);
        }
      }
    }

    const data = await c.req.json();
    const { data: record, error } = await supabase.from('giving_records').update({
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
      edited_by: user.id,
      edited_at: new Date().toISOString()
    }).eq('id', id).select().single();

    if (error) {
      console.error('Error updating giving record:', error);
      return c.json({ error: 'Failed to update giving record: ' + error.message }, 500);
    }
    return c.json(record);
  } catch (error) {
    console.error('Update giving error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET giving edit status (3-hour window)
router.get("/giving/:id/edit-status", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record } = await supabase
      .from('giving_records')
      .select('created_at')
      .eq('id', id)
      .single();

    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }

    const createdAt = new Date(record.created_at).getTime();
    const now = Date.now();
    const threeHours = 3 * 60 * 60 * 1000;
    const timeRemaining = Math.max(0, threeHours - (now - createdAt));

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const isDev = profile?.role === 'dev';

    return c.json({
      canEdit: isDev || timeRemaining > 0,
      timeRemaining: timeRemaining > 0 ? timeRemaining : null,
      lockedAt: new Date(createdAt + threeHours).toISOString(),
      isDev
    });
  } catch (error) {
    console.error('Get giving edit status error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.get("/visitors", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: visitors, error } = await supabase.from('visitors').select('*').order('visit_date', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching visitors:', error);
      return c.json({
        error: 'Failed to fetch visitors'
      }, 500);
    }
    const transformed = visitors.map((v)=>({
        id: v.id,
        firstName: v.first_name,
        lastName: v.last_name,
        otherNames: v.other_names,
        email: v.email,
        phone: v.phone,
        secondPhone: v.second_phone,
        gender: v.gender,
        residenceLocation: v.residence_location,
        visitDate: v.visit_date,
        serviceType: v.service_type,
        referredBy: v.referred_by,
        interestedInMembership: v.interested_in_membership,
        notes: v.notes,
        followUpStatus: v.follow_up_status,
        potentialZone: v.potential_zone,
        convertedToMember: v.converted_to_member,
        convertedMemberId: v.converted_member_id,
        church: v.church,
        createdAt: v.created_at,
        updatedAt: v.updated_at,
        createdBy: v.created_by
      }));
    return c.json(transformed);
  } catch (error) {
    console.error('Get visitors error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.post("/visitors", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const data = await c.req.json();
    let createPayload: any = {
      first_name: data.firstName,
      last_name: data.lastName,
      other_names: data.otherNames,
      email: data.email,
      phone: data.phone,
      second_phone: data.secondPhone,
      gender: data.gender,
      residence_location: data.residenceLocation,
      visit_date: data.visitDate,
      service_type: data.serviceType,
      referred_by: data.referredBy,
      interested_in_membership: data.interestedInMembership,
      notes: data.notes,
      follow_up_status: data.followUpStatus,
      potential_zone: data.potentialZone,
      church: data.church || null,
      created_by: user.id
    };

    let { data: visitor, error } = await supabase.from('visitors').insert(createPayload).select().single();
    
    // Fallback if 'church' column doesn't exist yet
    if (error && error.message && error.message.includes('column "church" of relation "visitors" does not exist')) {
      delete createPayload.church;
      const retry = await supabase.from('visitors').insert(createPayload).select().single();
      visitor = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error creating visitor:', error);
      return c.json({
        error: 'Failed to create visitor: ' + error.message
      }, 500);
    }
    // Log activity
    const logPV = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logPV.name, userRole: logPV.role,
      action: 'create', entityType: 'visitor', entityId: visitor.id,
      description: `Registered visitor: ${data.firstName} ${data.lastName}`
    });

    // Auto-update service_record visitor count
    try {
      if (data.visitDate && data.serviceType) {
        const { data: sr } = await supabase.from('service_records')
          .select('id, visitors_count').eq('service_date', data.visitDate).eq('service_type', data.serviceType).single();
        if (sr) {
          await supabase.from('service_records').update({
            visitors_count: (sr.visitors_count || 0) + 1, updated_at: new Date().toISOString()
          }).eq('id', sr.id);
        }
      }
    } catch (srErr) { console.error('Service record visitor update error:', srErr); }

    return c.json(visitor, 201);
  } catch (error) {
    console.error('Create visitor error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.put("/visitors/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const data = await c.req.json();
    let updatePayload: any = {
      first_name: data.firstName,
      last_name: data.lastName,
      other_names: data.otherNames,
      email: data.email,
      phone: data.phone,
      second_phone: data.secondPhone,
      gender: data.gender,
      residence_location: data.residenceLocation,
      visit_date: data.visitDate,
      service_type: data.serviceType,
      referred_by: data.referredBy,
      interested_in_membership: data.interestedInMembership,
      notes: data.notes,
      follow_up_status: data.followUpStatus,
      potential_zone: data.potentialZone,
      church: data.church || null,
      converted_to_member: data.convertedToMember ?? false,
      converted_member_id: data.convertedMemberId || null
    };

    let { data: visitor, error } = await supabase.from('visitors').update(updatePayload).eq('id', id).select().single();
    
    // Fallback if 'church' column doesn't exist yet
    if (error && error.message && error.message.includes('column "church" of relation "visitors" does not exist')) {
      delete updatePayload.church;
      const retry = await supabase.from('visitors').update(updatePayload).eq('id', id).select().single();
      visitor = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error updating visitor:', error);
      return c.json({
        error: 'Failed to update visitor: ' + error.message
      }, 500);
    }
    return c.json(visitor);
  } catch (error) {
    console.error('Update visitor error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.post("/visitors/:id/convert", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const memberData = await c.req.json();
    const { data: visitor, error: visitorError } = await supabase.from('visitors').select('*').eq('id', id).single();
    if (visitorError || !visitor) {
      return c.json({
        error: 'Visitor not found'
      }, 404);
    }
    const { data: member, error: memberError } = await supabase.from('members').insert({
      ...memberData,
      created_by: user.id
    }).select().single();
    if (memberError) {
      console.error('Error converting visitor to member:', memberError);
      return c.json({
        error: 'Failed to convert visitor'
      }, 500);
    }
    await supabase.from('visitors').update({
      converted_to_member: true,
      converted_member_id: member.id,
      follow_up_status: 'completed'
    }).eq('id', id);
    return c.json(member, 201);
  } catch (error) {
    console.error('Convert visitor error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.post("/permissions/grant", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { userId, permission, durationHours } = await c.req.json();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);
    const { data, error } = await supabase.from('temporary_permissions').insert({
      user_id: userId,
      permission,
      expires_at: expiresAt.toISOString(),
      granted_by: user.id
    }).select().single();
    if (error) {
      console.error('Error granting permission:', error);
      return c.json({
        error: 'Failed to grant permission'
      }, 500);
    }
    return c.json(data, 201);
  } catch (error) {
    console.error('Grant permission error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.post("/permissions/revoke", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { userId, permission } = await c.req.json();
    const { error } = await supabase.from('temporary_permissions').delete().eq('user_id', userId).eq('permission', permission);
    if (error) {
      console.error('Error revoking permission:', error);
      return c.json({
        error: 'Failed to revoke permission'
      }, 500);
    }
    return c.json({
      message: 'Permission revoked successfully'
    });
  } catch (error) {
    console.error('Revoke permission error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.get("/stats", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    // Get total members
    const { count: totalMembers } = await supabase.from('members').select('*', {
      count: 'exact',
      head: true
    });
    // Get this week's attendance (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    // Prefer general (head count) records for dashboard stats, fall back to any
    let { data: weekAttendance } = await supabase.from('attendance_records').select('total_count').eq('attendance_type', 'general').gte('date', weekAgo.toISOString().split('T')[0]).order('date', {
      ascending: false
    }).limit(1).single();
    if (!weekAttendance) {
      const { data: fallback } = await supabase.from('attendance_records').select('total_count').gte('date', weekAgo.toISOString().split('T')[0]).order('date', {
        ascending: false
      }).limit(1).single();
      weekAttendance = fallback;
    }
    // Get this month's giving
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { data: monthGiving } = await supabase.from('giving_records').select('total_amount').gte('service_date', startOfMonth.toISOString().split('T')[0]);
    const givingThisMonth = monthGiving?.reduce((sum, r)=>sum + parseFloat(r.total_amount), 0) || 0;
    // Get new members this month
    const { count: newMembersCount } = await supabase.from('members').select('*', {
      count: 'exact',
      head: true
    }).gte('created_at', startOfMonth.toISOString());
    return c.json({
      totalMembers: totalMembers || 0,
      attendanceThisWeek: weekAttendance?.total_count || 0,
      givingThisMonth: givingThisMonth,
      newMembersThisMonth: newMembersCount || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.get("/reports", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const period = c.req.query('period') || 'year';
    const scope = c.req.query('scope') || 'all'; // 'main', 'children', 'all'
    const paramStartDate = c.req.query('startDate');
    const paramEndDate = c.req.query('endDate');
    const now = new Date();

    let startDateStr = '';
    let endDateStr = '';

    if (paramStartDate) {
      startDateStr = paramStartDate;
    } else if (period === 'all') {
      startDateStr = '1970-01-01';
    } else {
      const startDate = new Date();
      if (period === 'month') {
        startDate.setDate(1);
      } else if (period === 'quarter') {
        startDate.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
      } else if (period === '6months') {
        startDate.setMonth(now.getMonth() - 5, 1);
      } else if (period === '2years') {
        startDate.setFullYear(now.getFullYear() - 1, 0, 1);
      } else {
        startDate.setMonth(0, 1);
      }
      startDateStr = startDate.toISOString().split('T')[0];
    }

    if (paramEndDate) {
      endDateStr = paramEndDate;
    }

    // ── Prepare queries based on scope ──
    const mainPromises: PromiseLike<any>[] = [];
    const childrenPromises: PromiseLike<any>[] = [];

    if (scope === 'main' || scope === 'all') {
      let q1 = supabase.from('attendance_records').select('date, total_count, attendance_type').eq('attendance_type', 'general').order('date', { ascending: true });
      let q2 = supabase.from('attendance_records').select('date, total_count, attendance_type, men_count, women_count, children_count, visitors_count').order('date', { ascending: true });
      let q3 = supabase.from('attendance_records').select('date, total_count').eq('attendance_type', 'individual').order('date', { ascending: true });
      let q4 = supabase.from('giving_records').select('service_date, total_amount, offering_amount, donation_amount, thanksgiving_amount, custom_types, cash_amount, mobile_money_amount, card_amount, bank_transfer_amount').order('service_date', { ascending: true });
      let q5 = supabase.from('members').select('created_at, status, zone, gender, marital_status, ministries, date_of_birth').order('created_at', { ascending: true });
      let q6 = supabase.from('visitors').select('visit_date, follow_up_status, converted_to_member');

      if (startDateStr) {
        q1 = q1.gte('date', startDateStr);
        q2 = q2.gte('date', startDateStr);
        q3 = q3.gte('date', startDateStr);
        q4 = q4.gte('service_date', startDateStr);
        q6 = q6.gte('visit_date', startDateStr);
      }
      if (endDateStr) {
        q1 = q1.lte('date', endDateStr);
        q2 = q2.lte('date', endDateStr);
        q3 = q3.lte('date', endDateStr);
        q4 = q4.lte('service_date', endDateStr);
        q5 = q5.lte('created_at', endDateStr + 'T23:59:59.999Z');
        q6 = q6.lte('visit_date', endDateStr);
      }

      mainPromises.push(q1, q2, q3, q4, q5, q6);
    }

    if (scope === 'children' || scope === 'all') {
      let qc1 = supabase.from('children_attendance_records').select('date, total_count, visitors_count').order('date', { ascending: true });
      let qc2 = supabase.from('children_giving_records').select('service_date, total_amount, offering_amount, cash_amount, mobile_money_amount').order('service_date', { ascending: true });
      let qc3 = supabase.from('children_members').select('created_at, status, gender, date_of_birth').order('created_at', { ascending: true });
      let qc4 = supabase.from('children_visitors').select('visit_date, converted_to_member');

      if (startDateStr) {
        qc1 = qc1.gte('date', startDateStr);
        qc2 = qc2.gte('service_date', startDateStr);
        qc4 = qc4.gte('visit_date', startDateStr);
      }
      if (endDateStr) {
        qc1 = qc1.lte('date', endDateStr);
        qc2 = qc2.lte('service_date', endDateStr);
        qc3 = qc3.lte('created_at', endDateStr + 'T23:59:59.999Z');
        qc4 = qc4.lte('visit_date', endDateStr);
      }

      childrenPromises.push(qc1, qc2, qc3, qc4);
    }

    const mainResults = mainPromises.length ? await Promise.all(mainPromises) : [{}, {}, {}, {}, {}, {}];
    const childrenResults = childrenPromises.length ? await Promise.all(childrenPromises) : [{}, {}, {}, {}];

    // ── Merge data sources ──
    let generalAttendance = mainResults[0]?.data || [];
    let allAttendance = mainResults[1]?.data || [];
    let _individualAttendance = mainResults[2]?.data || [];
    let givingRecordsFull = mainResults[3]?.data || [];
    let allMembers = mainResults[4]?.data || [];
    let visitors = mainResults[5]?.data || [];

    const childrenAttendance = childrenResults[0]?.data || [];
    const childrenGiving = childrenResults[1]?.data || [];
    const childrenMembers = childrenResults[2]?.data || [];
    const childrenVisitors = childrenResults[3]?.data || [];

    if (scope === 'children' || scope === 'all') {
      // Map children attendance to look like main general attendance
      const mappedChildrenAttendance = childrenAttendance.map((r: any) => ({
        ...r, attendance_type: 'general', children_count: r.total_count - (r.visitors_count || 0), men_count: 0, women_count: 0
      }));
      if (scope === 'children') {
        generalAttendance = mappedChildrenAttendance;
        allAttendance = mappedChildrenAttendance;
        _individualAttendance = [];
      } else {
        generalAttendance = [...generalAttendance, ...mappedChildrenAttendance];
        allAttendance = [...allAttendance, ...mappedChildrenAttendance];
      }
      
      givingRecordsFull = [...givingRecordsFull, ...childrenGiving];
      
      const mappedChildrenMembers = childrenMembers.map((m: any) => ({
        ...m, is_child: true, zone: 'Children', marital_status: 'single', ministries: [] // defaults for children
      }));
      allMembers = [...allMembers, ...mappedChildrenMembers];
      
      visitors = [...visitors, ...childrenVisitors];
    }

    // Use general attendance for trends, fallback to all
    let attendanceRecords = generalAttendance && generalAttendance.length > 0 ? generalAttendance : allAttendance;

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // ── Monthly aggregation ──
    const monthlyData: Record<number, any> = {};
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = {
        month: months[i],
        attendance: 0, attendanceCount: 0,
        individualAttendance: 0, individualCount: 0,
        generalAttendance: 0, generalCount: 0,
        giving: 0, offering: 0, donation: 0, thanksgiving: 0, customGiving: 0,
        cash: 0, mobileMoney: 0, card: 0, bankTransfer: 0,
        members: 0, newMembers: 0,
        // split tracking if scope === 'all'
        mainAttendance: 0, mainAttendanceCount: 0,
        childrenAttendance: 0, childrenAttendanceCount: 0,
        mainGiving: 0, childrenGiving: 0,
        mainNewMembers: 0, childrenNewMembers: 0,
        mainMembers: 0, childrenMembers: 0,
      };
    }

    attendanceRecords?.forEach((r: any) => {
      const m = new Date(r.date).getMonth();
      monthlyData[m].attendance += r.total_count;
      monthlyData[m].attendanceCount++;
    });

    // Individual vs General by month
    allAttendance?.forEach((r: any) => {
      const m = new Date(r.date).getMonth();
      if (r.attendance_type === 'individual') {
        monthlyData[m].individualAttendance += r.total_count;
        monthlyData[m].individualCount++;
      } else {
        monthlyData[m].generalAttendance += r.total_count;
        monthlyData[m].generalCount++;
      }
    });

    // Split breakdowns
    if (scope === 'all') {
      const mainGeneral = mainResults[0]?.data || [];
      const mainAll = mainResults[1]?.data || [];
      const mainGiving = mainResults[3]?.data || [];
      const mainMembersArray = mainResults[4]?.data || [];

      // attendance
      const mainAttSource = mainGeneral.length > 0 ? mainGeneral : mainAll;
      mainAttSource.forEach((r: any) => {
        const m = new Date(r.date).getMonth();
        monthlyData[m].mainAttendance += r.total_count;
        monthlyData[m].mainAttendanceCount++;
      });
      childrenAttendance.forEach((r: any) => {
        const m = new Date(r.date).getMonth();
        monthlyData[m].childrenAttendance += r.total_count;
        monthlyData[m].childrenAttendanceCount++;
      });
      
      // giving
      mainGiving.forEach((r: any) => {
        const m = new Date(r.service_date).getMonth();
        monthlyData[m].mainGiving += parseFloat(r.total_amount) || 0;
      });
      childrenGiving.forEach((r: any) => {
        const m = new Date(r.service_date).getMonth();
        monthlyData[m].childrenGiving += parseFloat(r.total_amount) || 0;
      });

      // members
      mainMembersArray.forEach((r: any) => {
        const m = new Date(r.created_at).getMonth();
        monthlyData[m].mainNewMembers++;
      });
      childrenMembers.forEach((r: any) => {
        const m = new Date(r.created_at).getMonth();
        monthlyData[m].childrenNewMembers++;
      });
    }

    for (let i = 0; i < 12; i++) {
      if (monthlyData[i].attendanceCount > 0) monthlyData[i].attendance = Math.round(monthlyData[i].attendance / monthlyData[i].attendanceCount);
      if (monthlyData[i].individualCount > 0) monthlyData[i].individualAttendance = Math.round(monthlyData[i].individualAttendance / monthlyData[i].individualCount);
      if (monthlyData[i].generalCount > 0) monthlyData[i].generalAttendance = Math.round(monthlyData[i].generalAttendance / monthlyData[i].generalCount);

      if (scope === 'all') {
        if (monthlyData[i].mainAttendanceCount > 0) monthlyData[i].mainAttendance = Math.round(monthlyData[i].mainAttendance / monthlyData[i].mainAttendanceCount);
        if (monthlyData[i].childrenAttendanceCount > 0) monthlyData[i].childrenAttendance = Math.round(monthlyData[i].childrenAttendance / monthlyData[i].childrenAttendanceCount);
      }
    }

    // Giving by month + breakdown
    givingRecordsFull?.forEach((r: any) => {
      const m = new Date(r.service_date).getMonth();
      monthlyData[m].giving += parseFloat(r.total_amount) || 0;
      monthlyData[m].offering += parseFloat(r.offering_amount) || 0;
      monthlyData[m].donation += parseFloat(r.donation_amount) || 0;
      monthlyData[m].thanksgiving += parseFloat(r.thanksgiving_amount) || 0;
      const ct = r.custom_types || {};
      monthlyData[m].customGiving += Object.values(ct).reduce((s: number, v: any) => s + (parseFloat(v) || 0), 0);
      monthlyData[m].cash += parseFloat(r.cash_amount) || 0;
      monthlyData[m].mobileMoney += parseFloat(r.mobile_money_amount) || 0;
      monthlyData[m].card += parseFloat(r.card_amount) || 0;
      monthlyData[m].bankTransfer += parseFloat(r.bank_transfer_amount) || 0;
    });

    // Membership growth
    allMembers?.forEach((member: any) => {
      const m = new Date(member.created_at).getMonth();
      monthlyData[m].newMembers++;
    });
    let runningTotal = 0;
    let mainRunningTotal = 0;
    let childrenRunningTotal = 0;
    for (let i = 0; i < 12; i++) {
      runningTotal += monthlyData[i].newMembers;
      monthlyData[i].members = runningTotal;
      if (scope === 'all') {
        mainRunningTotal += monthlyData[i].mainNewMembers;
        childrenRunningTotal += monthlyData[i].childrenNewMembers;
        monthlyData[i].mainMembers = mainRunningTotal;
        monthlyData[i].childrenMembers = childrenRunningTotal;
      }
    }

    // ── Chart data arrays ──
    const attendanceData = Object.values(monthlyData).map((m: any) => {
      const entry: any = {
        month: m.month, attendance: m.attendance,
        individual: m.individualAttendance, general: m.generalAttendance
      };
      if (scope === 'all') {
        entry.mainAttendance = m.mainAttendance;
        entry.childrenAttendance = m.childrenAttendance;
      }
      return entry;
    });

    const givingData = Object.values(monthlyData).map((m: any) => {
      const entry: any = {
        month: m.month, amount: Math.round(m.giving * 100) / 100,
        offering: Math.round(m.offering * 100) / 100,
        donation: Math.round(m.donation * 100) / 100,
        thanksgiving: Math.round(m.thanksgiving * 100) / 100,
        custom: Math.round(m.customGiving * 100) / 100
      };
      if (scope === 'all') {
        entry.mainAmount = Math.round(m.mainGiving * 100) / 100;
        entry.childrenAmount = Math.round(m.childrenGiving * 100) / 100;
      }
      return entry;
    });

    const membershipData = Object.values(monthlyData).map((m: any) => {
      const entry: any = {
        month: m.month, members: m.members, newMembers: m.newMembers
      };
      if (scope === 'all') {
        entry.mainMembers = m.mainMembers;
        entry.childrenMembers = m.childrenMembers;
      }
      return entry;
    });

    // ── Members by status ──
    const statusCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      const s = m.status || 'unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const membersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // ── Members by zone ──
    const zoneCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      if (m.is_child) return; // Skip children for zone charts
      const z = m.zone || 'Unknown';
      zoneCounts[z] = (zoneCounts[z] || 0) + 1;
    });
    const membersByZone = Object.entries(zoneCounts).map(([zone, count]) => ({ zone, count })).sort((a, b) => a.zone.localeCompare(b.zone));

    // ── Giving by type (totals for period) ──
    let totalOffering = 0, totalDonation = 0, totalThanksgiving = 0, totalCustom = 0;
    givingRecordsFull?.forEach((r: any) => {
      totalOffering += parseFloat(r.offering_amount) || 0;
      totalDonation += parseFloat(r.donation_amount) || 0;
      totalThanksgiving += parseFloat(r.thanksgiving_amount) || 0;
      const ct = r.custom_types || {};
      totalCustom += Object.values(ct).reduce((s: number, v: any) => s + (parseFloat(v) || 0), 0);
    });
    const givingByType = [
      { type: 'Offering', amount: Math.round(totalOffering * 100) / 100 },
      { type: 'Donation', amount: Math.round(totalDonation * 100) / 100 },
      { type: 'Thanksgiving', amount: Math.round(totalThanksgiving * 100) / 100 },
      { type: 'Custom', amount: Math.round(totalCustom * 100) / 100 },
    ].filter(g => g.amount > 0);

    // ── Attendance denominations (totals for period) ──
    let totalMenAtt = 0, totalWomenAtt = 0, totalChildrenAtt = 0, totalVisitorsAtt = 0;
    allAttendance?.forEach((r: any) => {
      // Only include denominations if they are from general/headcount records
      // to avoid double counting if individual records also have these fields (though unlikely based on schema)
      if (r.attendance_type === 'general') {
        totalMenAtt += r.men_count || 0;
        totalWomenAtt += r.women_count || 0;
        totalChildrenAtt += r.children_count || 0;
        totalVisitorsAtt += r.visitors_count || 0;
      }
    });
    const attendanceDenominations = [
      { name: 'Men', count: totalMenAtt },
      { name: 'Women', count: totalWomenAtt },
      { name: 'Children', count: totalChildrenAtt },
      { name: 'Visitors', count: totalVisitorsAtt },
    ].filter(d => d.count > 0);

    // ── Member Gender Distribution ──
    const genderCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      const g = (m.gender || 'unknown').toLowerCase();
      genderCounts[g] = (genderCounts[g] || 0) + 1;
    });
    const membersByGender = Object.entries(genderCounts).map(([gender, count]) => ({ gender, count }));

    // ── Member Marital Status Distribution ──
    const maritalCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      if (m.is_child) return; // Skip children for marital status
      const ms = (m.marital_status || 'unknown').toLowerCase();
      maritalCounts[ms] = (maritalCounts[ms] || 0) + 1;
    });
    const membersByMaritalStatus = Object.entries(maritalCounts).map(([status, count]) => ({ status, count }));

    // ── Ministry Participation ──
    const ministryCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      const minList = m.ministries || [];
      minList.forEach((min: string) => {
        ministryCounts[min] = (ministryCounts[min] || 0) + 1;
      });
    });
    const membersByMinistry = Object.entries(ministryCounts).map(([ministry, count]) => ({ ministry, count })).sort((a, b) => b.count - a.count);

    // ── Age Distribution ──
    const ageGroups: Record<string, number> = {
      '0-3 yrs': 0,
      '4-6 yrs': 0,
      '7-9 yrs': 0,
      '10-12 yrs': 0,
      '13-17 yrs': 0,
      '18-35 yrs': 0,
      '36-50 yrs': 0,
      '50+ yrs': 0,
      'Unknown': 0
    };
    allMembers?.forEach((m: any) => {
      if (!m.date_of_birth) {
        ageGroups['Unknown']++;
        return;
      }
      const age = now.getFullYear() - new Date(m.date_of_birth).getFullYear();
      if (age <= 3) ageGroups['0-3 yrs']++;
      else if (age <= 6) ageGroups['4-6 yrs']++;
      else if (age <= 9) ageGroups['7-9 yrs']++;
      else if (age <= 12) ageGroups['10-12 yrs']++;
      else if (age <= 17) ageGroups['13-17 yrs']++;
      else if (age <= 35) ageGroups['18-35 yrs']++;
      else if (age <= 50) ageGroups['36-50 yrs']++;
      else ageGroups['50+ yrs']++;
    });
    const membersByAge = Object.entries(ageGroups).map(([group, count]) => ({ group, count })).filter(g => g.count > 0);

    // ── Visitor Analytics ──
    const visitorStatusCounts: Record<string, number> = {};
    let mainTotalVisitors = 0, childrenTotalVisitors = 0;
    let mainConvertedVisitors = 0, childrenConvertedVisitors = 0;

    if (scope === 'main' || scope === 'all') {
      const mainVisits = mainResults[5]?.data || [];
      mainVisits.forEach((v: any) => {
        mainTotalVisitors++;
        if (v.converted_to_member) mainConvertedVisitors++;
        const s = v.follow_up_status || 'unknown';
        visitorStatusCounts[s] = (visitorStatusCounts[s] || 0) + 1;
      });
    }

    if (scope === 'children' || scope === 'all') {
      const childVisits = childrenResults[3]?.data || [];
      childVisits.forEach((v: any) => {
        childrenTotalVisitors++;
        if (v.converted_to_member) childrenConvertedVisitors++;
        const s = v.follow_up_status || 'untracked'; // Children might lack follow_up_status
        visitorStatusCounts[s] = (visitorStatusCounts[s] || 0) + 1;
      });
    }

    const visitorsByStatus = Object.entries(visitorStatusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const totalVisitors = (scope === 'main' ? mainTotalVisitors : (scope === 'children' ? childrenTotalVisitors : mainTotalVisitors + childrenTotalVisitors));
    const totalConvertedVisitors = (scope === 'main' ? mainConvertedVisitors : (scope === 'children' ? childrenConvertedVisitors : mainConvertedVisitors + childrenConvertedVisitors));

    const visitorConversionRate = totalVisitors > 0 ? (totalConvertedVisitors / totalVisitors) * 100 : 0;

    // ── Member retention ──
    const activeStatuses = new Set(['active', 'semi-active']);
    const activeMembers = allMembers?.filter((m: any) => activeStatuses.has(m.status)).length || 0;
    const totalMembers = allMembers?.length || 0;
    const memberRetention = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 1000) / 10 : 0;

    // ── Summary stats ──
    const totalAttendanceRecords = attendanceRecords?.length || 0;
    const avgAttendance = totalAttendanceRecords > 0 ? Math.round(attendanceRecords!.reduce((sum: number, r: any) => sum + r.total_count, 0) / totalAttendanceRecords) : 0;
    const totalGiving = givingRecordsFull?.reduce((sum: number, r: any) => sum + (parseFloat(r.total_amount) || 0), 0) || 0;
    const firstMonthMembers = membershipData.find((m) => m.members > 0)?.members || 1;
    const lastMonthMembers = membershipData[membershipData.length - 1]?.members || 0;
    const growthRate = firstMonthMembers > 0 ? (lastMonthMembers - firstMonthMembers) / firstMonthMembers * 100 : 0;
    const attendanceRate = totalMembers > 0 ? avgAttendance / totalMembers * 100 : 0;
    const givingServicesCount = givingRecordsFull?.length || 0;
    const avgGivingPerService = givingServicesCount > 0 ? Math.round(totalGiving / givingServicesCount * 100) / 100 : 0;

    // Most active zone
    const mostActiveZone = membersByZone.length > 0 ? membersByZone.reduce((a, b) => a.count > b.count ? a : b).zone : 'N/A';

    let mainTotalMembers = null, childrenTotalMembers = null;
    let mainAvgAttendance = null, childrenAvgAttendance = null;
    let mainTotalGiving = null, childrenTotalGiving = null;

    if (scope === 'all') {
      const mainMembersArray = mainResults[4]?.data || [];
      const mainGivingArray = mainResults[3]?.data || [];
      const mainGeneral = mainResults[0]?.data || [];
      const mainAll = mainResults[1]?.data || [];
      const mainAttSource = mainGeneral.length > 0 ? mainGeneral : mainAll;

      mainTotalMembers = mainMembersArray.length;
      childrenTotalMembers = childrenMembers.length;

      mainTotalGiving = Math.round(mainGivingArray.reduce((sum: number, r: any) => sum + (parseFloat(r.total_amount) || 0), 0) * 100) / 100;
      childrenTotalGiving = Math.round(childrenGiving.reduce((sum: number, r: any) => sum + (parseFloat(r.total_amount) || 0), 0) * 100) / 100;

      const mainAttRecs = mainAttSource;
      mainAvgAttendance = mainAttRecs.length > 0 ? Math.round(mainAttRecs.reduce((sum: number, r: any) => sum + r.total_count, 0) / mainAttRecs.length) : 0;
      childrenAvgAttendance = childrenAttendance.length > 0 ? Math.round(childrenAttendance.reduce((sum: number, r: any) => sum + r.total_count, 0) / childrenAttendance.length) : 0;
    }

    return c.json({
      attendanceData,
      givingData,
      membershipData,
      membersByStatus,
      membersByZone,
      givingByType,
      givingByPaymentMethod: [], // Keep for backward compatibility if needed, or remove if safe
      attendanceDenominations,
      membersByGender,
      membersByMaritalStatus,
      membersByMinistry,
      membersByAge,
      visitorConversion: [
        { status: 'Converted', count: totalConvertedVisitors },
        { status: 'Not Converted', count: totalVisitors - totalConvertedVisitors }
      ].filter(d => d.count > 0),
      visitorsByStatus,
      visitorConversionRate: Math.round(visitorConversionRate * 10) / 10,
      summary: {
        totalMembers,
        avgAttendance,
        totalGiving,
        growthRate: Math.round(growthRate * 10) / 10,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        memberRetention,
        givingParticipation: 0, // giving_records has no member_id, so skip
        servicesHeld: totalAttendanceRecords,
        newMembersThisMonth: monthlyData[now.getMonth()]?.newMembers || 0,
        monthlyGiving: Math.round((monthlyData[now.getMonth()]?.giving || 0) * 100) / 100,
        monthlyAvgAttendance: monthlyData[now.getMonth()]?.attendance || 0,
        avgGivingPerService,
        mostActiveZone,
        activeMembers,
        totalVisitors, // Add total visitors to summary top level
        ...(scope === 'all' ? {
          mainTotalMembers,
          childrenTotalMembers,
          mainAvgAttendance,
          childrenAvgAttendance,
          mainTotalGiving,
          childrenTotalGiving,
          mainTotalVisitors,
          childrenTotalVisitors
        } : {})
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
// ============================================================================

export default router;
