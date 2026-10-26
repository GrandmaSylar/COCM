import { supabase } from './supabase';
import { api } from './api';
import { getLocalDb, LocalMember, upsertLocalMember } from './db';

export interface FamilyMember {
  id: string;
  relationship: 'mother' | 'father' | 'spouse' | 'child' | 'sibling';
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  occupation?: string;
  hometown?: string;
  isLinked?: boolean;
  linkedMemberId?: string;
  childMemberId?: string;
  linkedChildMemberId?: string;
  photo?: string;
}

export function calculateInverseRelationship(
  rel: string,
  otherGender?: string | null
): 'mother' | 'father' | 'spouse' | 'child' | 'sibling' {
  const r = (rel || '').toLowerCase().trim();

  // If other member registered this person as their child -> other person is their parent
  if (r === 'child' || r === 'son' || r === 'daughter') {
    if (otherGender === 'male') return 'father';
    if (otherGender === 'female') return 'mother';
    return 'father';
  }

  // If other member registered this person as their parent -> other person is their child
  if (r === 'father' || r === 'mother' || r === 'parent') {
    return 'child';
  }

  if (r === 'spouse' || r === 'husband' || r === 'wife') {
    return 'spouse';
  }

  if (r === 'sibling' || r === 'brother' || r === 'sister') {
    return 'sibling';
  }

  return 'sibling';
}

/**
 * Resolves the complete multi-tier bidirectional family tree for any member.
 * Combines direct records, reciprocal inverse links, linked children, and local SQLite caching.
 */
export async function resolveMemberFamily(memberId: string): Promise<FamilyMember[]> {
  const familyMap = new Map<string, FamilyMember>();

  // 1. Try fetching from Backend API Server (which has Edge Function bidirectional resolution)
  try {
    const apiRes = await api.members.getById(memberId);
    if (apiRes && Array.isArray(apiRes.familyMembers) && apiRes.familyMembers.length > 0) {
      for (const fm of apiRes.familyMembers) {
        const key = fm.linkedMemberId || fm.childMemberId || fm.id;
        familyMap.set(key, {
          id: fm.id,
          relationship: fm.relationship,
          firstName: fm.firstName || '',
          lastName: fm.lastName || '',
          otherNames: fm.otherNames,
          phone: fm.phone,
          occupation: fm.occupation,
          hometown: fm.hometown,
          isLinked: !!fm.isLinked,
          linkedMemberId: fm.linkedMemberId,
          childMemberId: fm.childMemberId || fm.linkedChildMemberId,
          photo: fm.photo || fm.photoUrl
        });
      }
      return Array.from(familyMap.values());
    }
  } catch (apiErr) {
    // API server fallback to direct database & SQLite joins
  }

  // 2. Direct Supabase Query: Direct family members (owned by this member)
  try {
    const { data: directRecords } = await supabase
      .from('family_members')
      .select('*')
      .eq('member_id', memberId);

    if (directRecords) {
      for (const d of directRecords) {
        const key = d.linked_member_id || d.id;
        familyMap.set(key, {
          id: d.id,
          relationship: d.relationship,
          firstName: d.first_name || '',
          lastName: d.last_name || '',
          otherNames: d.other_names || undefined,
          phone: d.phone || undefined,
          occupation: d.occupation || undefined,
          hometown: d.hometown || undefined,
          isLinked: !!d.is_linked,
          linkedMemberId: d.linked_member_id || undefined
        });
      }
    }
  } catch (e) {
    console.warn('Direct family_members query warning:', e);
  }

  // 3. Inverse Supabase Query: Other members who added this member as their relative
  try {
    const { data: inverseRecords } = await supabase
      .from('family_members')
      .select(`
        id,
        relationship,
        member_id,
        members!family_members_member_id_fkey (
          id,
          first_name,
          last_name,
          other_names,
          phone,
          gender,
          photo_url,
          occupation,
          hometown
        )
      `)
      .eq('linked_member_id', memberId);

    if (inverseRecords && inverseRecords.length > 0) {
      const missingMemberIds: string[] = [];
      for (const inv of inverseRecords) {
        if (!(inv as any).members && inv.member_id) {
          missingMemberIds.push(inv.member_id);
        }
      }

      let memberLookup: Record<string, any> = {};
      if (missingMemberIds.length > 0) {
        const { data: lookedUp } = await supabase
          .from('members')
          .select('id, first_name, last_name, other_names, phone, gender, photo_url, occupation, hometown')
          .in('id', missingMemberIds);
        if (lookedUp) {
          for (const m of lookedUp) memberLookup[m.id] = m;
        }
      }

      for (const inv of inverseRecords) {
        const other = (inv as any).members || memberLookup[inv.member_id];
        if (!other) continue;
        const key = other.id;
        if (!familyMap.has(key)) {
          const invRelationship = calculateInverseRelationship(inv.relationship, other.gender);
          familyMap.set(key, {
            id: `inv-${inv.id}`,
            relationship: invRelationship,
            firstName: other.first_name || '',
            lastName: other.last_name || '',
            otherNames: other.other_names || undefined,
            phone: other.phone || undefined,
            isLinked: true,
            linkedMemberId: other.id,
            photo: other.photo_url || undefined,
            occupation: other.occupation || undefined,
            hometown: other.hometown || undefined
          });
        }
      }
    }
  } catch (e) {
    console.warn('Inverse family_members query warning:', e);
  }

  // 4. Children Supabase Query: Linked children in children_member_parents
  try {
    const { data: childRecords } = await supabase
      .from('children_member_parents')
      .select(`
        child_member_id,
        relationship,
        children_members!children_member_parents_child_member_id_fkey (
          id,
          first_name,
          last_name,
          other_names
        )
      `)
      .eq('linked_member_id', memberId);

    if (childRecords && childRecords.length > 0) {
      const missingChildIds: string[] = [];
      for (const ch of childRecords) {
        if (!(ch as any).children_members && ch.child_member_id) {
          missingChildIds.push(ch.child_member_id);
        }
      }

      let childLookup: Record<string, any> = {};
      if (missingChildIds.length > 0) {
        const { data: lookedUp } = await supabase
          .from('children_members')
          .select('id, first_name, last_name, other_names')
          .in('id', missingChildIds);
        if (lookedUp) {
          for (const c of lookedUp) childLookup[c.id] = c;
        }
      }

      for (const ch of childRecords) {
        const child = (ch as any).children_members || childLookup[ch.child_member_id];
        if (!child) continue;
        const key = child.id;
        if (!familyMap.has(key)) {
          familyMap.set(key, {
            id: `child-${child.id}`,
            relationship: 'child',
            firstName: child.first_name || '',
            lastName: child.last_name || '',
            otherNames: child.other_names || undefined,
            isLinked: true,
            childMemberId: child.id,
            linkedChildMemberId: child.id
          });
        }
      }
    }
  } catch (e) {
    console.warn('Children parent query warning:', e);
  }

  // 5. Fallback from local SQLite if network is completely unreachable
  if (familyMap.size === 0) {
    try {
      const db = await getLocalDb();
      const row = await db.getFirstAsync<LocalMember>('SELECT raw_json FROM members WHERE id = ?', [memberId]);
      if (row && row.raw_json) {
        const parsed = JSON.parse(row.raw_json);
        if (Array.isArray(parsed.familyMembers) && parsed.familyMembers.length > 0) {
          return parsed.familyMembers;
        }
      }
    } catch (e) {}
  }

  return Array.from(familyMap.values());
}
