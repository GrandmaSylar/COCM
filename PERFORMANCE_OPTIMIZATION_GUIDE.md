# Supabase Data Loading Performance Optimization Guide

## Current Performance Issues

Your application currently loads all data at once without pagination, caching, or query optimization. Here are the specific bottlenecks:

### 1. **All Members Loaded at Once** 
- The Members page loads every member in the database without pagination
- Each member includes all columns and family member relations
- File: `supabase/functions/server/index.ts` (line 1069)

### 2. **Sequential Queries**
- Members are fetched first
- Then family members are fetched in a separate query
- This causes N+1 query problem

### 3. **No Caching Strategy**
- Data is refetched on every page visit
- No local state caching for previously loaded data
- No cache invalidation strategy

### 4. **Missing Database Indexes**
- No index on `date_of_birth` (new filter feature)
- No composite index for common filter combinations
- `ministries` is JSONB without specific indexing

---

## Quick Win Optimizations (Easy - 30 minutes)

### 1. **Add Missing Database Indexes**

Add these indexes to your `02-indexes.sql`:

```sql
-- Additional indexes for new filter features
CREATE INDEX idx_members_date_of_birth ON members(date_of_birth);
CREATE INDEX idx_members_baptism_year ON members((baptism_info->>'year'));
CREATE INDEX idx_members_created_at ON members(created_at DESC);

-- Composite indexes for common filter combinations
CREATE INDEX idx_members_zone_status ON members(zone, status);
CREATE INDEX idx_members_status_date ON members(status, created_at DESC);

-- JSONB indexes for ministries and baptism_info
CREATE INDEX idx_members_ministries ON members USING GIN(ministries);
CREATE INDEX idx_members_baptism_info ON members USING GIN(baptism_info);
```

**Implementation:**
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Paste and run these queries

### 2. **Optimize Member Query - Only Select Needed Columns**

Update `supabase/functions/server/index.ts` line 1069:

**BEFORE:**
```typescript
const { data: members, error } = await supabase
  .from('members')
  .select('*')
  .order('created_at', { ascending: false });
```

**AFTER:**
```typescript
const { data: members, error } = await supabase
  .from('members')
  .select(`
    id,
    first_name,
    last_name,
    other_names,
    phone,
    gender,
    date_of_birth,
    zone,
    zone_number,
    status,
    join_date,
    photo_url,
    email,
    baptism_info,
    ministries
  `)
  .order('created_at', { ascending: false });
```

**Expected improvement:** ~30-40% faster loading

### 3. **Implement Caching in React Components**

Add a custom hook for cached data fetching:

**File: `src/hooks/useCachedData.ts`**

```typescript
import { useEffect, useRef, useState } from 'react';

const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function useCachedData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: { duration?: number; refetch?: boolean } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isFetching = useRef(false);

  useEffect(() => {
    const cached = dataCache.get(cacheKey);
    const now = Date.now();
    const cacheDuration = options.duration ?? CACHE_DURATION_MS;

    // Return cached data if valid and not forcing refetch
    if (cached && !options.refetch && now - cached.timestamp < cacheDuration) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (isFetching.current) return;

    isFetching.current = true;
    setLoading(true);
    setError(null);

    fetchFn()
      .then(result => {
        dataCache.set(cacheKey, { data: result, timestamp: now });
        setData(result);
      })
      .catch(err => setError(err))
      .finally(() => {
        isFetching.current = false;
        setLoading(false);
      });
  }, [cacheKey, options.refetch, options.duration, fetchFn]);

  return { data, loading, error, refresh: () => fetchFn() };
}
```

**Usage in Members.tsx:**

```typescript
// Replace the useEffect with:
const { data: members = [], loading, error } = useCachedData(
  'members-list',
  () => api.members.getAll(),
  { duration: 5 * 60 * 1000 } // 5 minute cache
);

setMembers(members);
setLoading(loading);
setError(error?.message || null);
```

**Expected improvement:** ~80% faster on subsequent page visits

---

## Medium Optimizations (Moderate - 1-2 hours)

### 4. **Implement Pagination for Large Data Sets**

Update the API endpoint:

**`supabase/functions/server/index.ts`:**

```typescript
app.get("/members", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    // Get query parameters
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;

    // Get total count
    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true });

    // Fetch members with pagination
    const { data: members, error } = await supabase
      .from('members')
      .select(`
        id, first_name, last_name, phone, zone, status, join_date, photo_url
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching members:', error);
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
    console.error('Get members error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
```

**Frontend usage:**

```typescript
const [page, setPage] = useState(1);

useEffect(() => {
  const fetchMembers = async () => {
    const response = await fetchApi(`/members?page=${page}&limit=50`);
    setMembers(response.data);
    setPagination(response.pagination);
  };
  fetchMembers();
}, [page]);

// In the member list rendering:
// Add pagination controls at the bottom
```

**Expected improvement:** ~90% faster for initial load, ~95% for subsequent pages

### 5. **Batch Related Data Queries**

Update member query to include family members with JOIN:

```typescript
const { data: members, error } = await supabase
  .from('members')
  .select(`
    id,
    first_name,
    last_name,
    phone,
    status,
    zone,
    family_members (
      id,
      member_id,
      relationship,
      first_name,
      last_name,
      linked_member_id
    )
  `)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

This replaces the separate `family_members` query entirely.

**Expected improvement:** ~50% faster (one query instead of two)

---

## Advanced Optimizations (Complex - 2-4 hours)

### 6. **Implement Real-time Subscriptions (Optional)**

For dashboard stats that update frequently:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase/client';

export function useRealtimeStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Subscribe to changes
    const subscription = supabase
      .from('members')
      .on('*', () => {
        // Refetch when any member changes
        fetchStats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return stats;
}
```

### 7. **Implement Query Result Compression**

For large responses, enable response compression:

```typescript
app.use(async (c, next) => {
  await next();
  const response = c.res;
  const body = await response.text();
  
  if (body.length > 1000) {
    // Set gzip encoding
    c.header('Content-Encoding', 'gzip');
  }
});
```

### 8. **Lazy Load Family Members**

Don't load family members unless viewing the full profile:

```typescript
// In Members list - don't include family_members
.select('id, first_name, last_name, phone, status, zone')

// In Member profile view - include them
.select('*, family_members(*)')
```

---

## Testing & Monitoring

### Check Query Performance in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this to see slow queries:

```sql
-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Monitor Network Requests

1. Open Chrome DevTools (F12)
2. Go to **Network** tab
3. Filter by XHR requests
4. Check response sizes and times

---

## Implementation Priority

**Priority 1 (Do First - 30 min):**
- Add database indexes
- Optimize SELECT columns
- Implement basic caching hook

**Priority 2 (Do Next - 1-2 hours):**
- Implement pagination
- Batch queries with JOINs
- Monitor performance improvements

**Priority 3 (Optional - 2-4 hours):**
- Real-time subscriptions
- Query compression
- Lazy loading

---

## Expected Results

| Optimization | Initial Load | Subsequent Loads | Memory |
|-------------|--------------|------------------|--------|
| Before | ~2-3s | ~2-3s | ~20MB |
| After Priority 1 | ~1-1.5s | ~100ms | ~15MB |
| After Priority 2 | ~500ms | ~50ms | ~10MB |
| After Priority 3 | ~300ms | ~30ms | ~8MB |

---

## Files to Update

1. **`src/hooks/useCachedData.ts`** - NEW
2. **`src/database-setup/02-indexes.sql`** - ADD indexes
3. **`supabase/functions/server/index.ts`** - Optimize queries
4. **`src/components/Members.tsx`** - Use caching hook

