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
router.post("/cloudinary/sign", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const uploadPreset = Deno.env.get('CLOUDINARY_UPLOAD_PRESET');

    if (!apiKey || !apiSecret || !cloudName) {
      return c.json({ 
        error: 'Cloudinary credentials missing',
        details: 'API credentials or cloud name not set'
      }, 500);
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'member-photos';
    
    // Sort parameters alphabetically per Cloudinary docs
    let sortedParams = `folder=${folder}&timestamp=${timestamp}`;
    if (uploadPreset) {
      sortedParams += `&upload_preset=${uploadPreset}`;
    }
    const stringToSign = `${sortedParams}${apiSecret}`;

    // Generate SHA-256 hash for the signature (Cloudinary signature version 2)
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return c.json({
      apiKey,
      timestamp,
      signature,
      folder,
      cloudName,
      uploadPreset
    });
  } catch (error: any) {
    console.error('Cloudinary sign error:', error);
    return c.json({ error: error.message || 'Failed to sign request' }, 500);
  }
});

// ============================================================================

export default router;
