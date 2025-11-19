# Quick Deployment Guide

Follow these steps to deploy your Church Management System backend.

## Prerequisites

✅ Database setup completed (all 6 SQL scripts from `/database-setup/`)  
✅ Storage bucket created (`member-photos`)  
✅ Supabase account with project created

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

Or with Homebrew (macOS):
```bash
brew install supabase/tap/supabase
```

## Step 2: Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate.

## Step 3: Link Your Project

```bash
supabase link --project-ref szligatlxwpcknwkhdyp
```

When prompted for the database password, enter your Supabase database password (found in your Supabase Dashboard → Settings → Database).

## Step 4: Deploy the Server

```bash
supabase functions deploy server
```

You should see:
```
Deploying function (project: szligatlxwpcknwkhdyp)...
Function URL: https://szligatlxwpcknwkhdyp.supabase.co/functions/v1/server
Deployed successfully!
```

## Step 5: Verify Deployment

Test the health endpoint:

```bash
curl https://szligatlxwpcknwkhdyp.supabase.co/functions/v1/make-server-cac55325/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2025-10-27T..."
}
```

## Step 6: Create Your First User

You can create users in two ways:

### Option A: Via Supabase Dashboard

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User**
3. Enter email and password
4. Click **Create User**
5. Then run this SQL to create their profile:

```sql
INSERT INTO profiles (id, name, email, role, is_active)
VALUES (
  'USER_ID_FROM_AUTH_USERS_TABLE',
  'Dev Administrator',
  'dev@cocm.com',
  'dev',
  true
);
```

### Option B: Via API (After First User Exists)

Once you have one user, you can use the signup endpoint:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cocm.com",
    "password": "secure_password_here",
    "name": "Admin User",
    "role": "admin"
  }' \
  https://szligatlxwpcknwkhdyp.supabase.co/functions/v1/make-server-cac55325/auth/signup
```

## Step 7: Test Authentication

### Sign In

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@cocm.com",
    "password": "your_password"
  }' \
  https://szligatlxwpcknwkhdyp.supabase.co/functions/v1/make-server-cac55325/auth/signin
```

Save the `access_token` from the response.

### Test Authenticated Endpoint

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://szligatlxwpcknwkhdyp.supabase.co/functions/v1/make-server-cac55325/members
```

## Step 8: Update Frontend

Your frontend is already configured to use the correct project ID in `/utils/supabase/info.tsx`.

No changes needed! The API service in `/services/api.ts` will automatically use:
- Project ID: `szligatlxwpcknwkhdyp`
- Base URL: `https://szligatlxwpcknwkhdyp.supabase.co/functions/v1/make-server-cac55325`

## Troubleshooting

### "Function not found" Error

Make sure you deployed with the correct function name:
```bash
supabase functions deploy server
```

### "Unauthorized" Error

1. Check that RLS policies are created
2. Verify user is logged in
3. Check that access token is valid

### "Profile not found" Error

Make sure the user has a profile in the `profiles` table. Every auth user needs a corresponding profile record.

### View Server Logs

```bash
supabase functions logs server
```

Or view in Supabase Dashboard → Edge Functions → server → Logs

## Environment Check

Verify your environment variables are set in Supabase:

1. Go to **Edge Functions** → **server** → **Settings**
2. Ensure these are set automatically:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`

These are set automatically by Supabase and don't need manual configuration.

## Next Steps

1. ✅ **Backend deployed** - Server is live
2. ⏭️ **Update AuthContext** - Replace mock auth with real auth
3. ⏭️ **Update Components** - Replace mock data with API calls
4. ⏭️ **Test in Browser** - Verify everything works
5. ⏭️ **Deploy Frontend** - Deploy to Vercel/Netlify

## Quick Commands Reference

```bash
# Login
supabase login

# Link project
supabase link --project-ref szligatlxwpcknwkhdyp

# Deploy function
supabase functions deploy server

# View logs
supabase functions logs server --tail

# Test locally (optional)
supabase functions serve server

# Update function after changes
supabase functions deploy server
```

## Production URL

Your API is now live at:
```
https://szligatlxwpcknwkhdyp.supabase.co/functions/v1/make-server-cac55325
```

All endpoints are prefixed with this base URL.

## Success! 🎉

Your backend is now deployed and ready to use. You can start updating your frontend components to use the real API instead of mock data.
