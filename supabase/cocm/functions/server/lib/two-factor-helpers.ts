import { supabase } from "../lib/supabase.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";

// ============================================================================

export function normalizePhone(phone: string): string {
  const stripped = phone.replace(/[\s\-()]/g, '');
  if (/^0\d{9}$/.test(stripped)) return '+233' + stripped.slice(1);
  if (/^233\d{9}$/.test(stripped)) return '+' + stripped;
  if (/^\+233\d{9}$/.test(stripped)) return stripped;
  return stripped;
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (user.length <= 2) return user[0] + '***@' + domain;
  return user[0] + '***' + user[user.length - 1] + '@' + domain;
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '***' + phone;
  return '***' + phone.slice(-4);
}

export async function sendOtpEmail(email: string, code: string, name: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.error('RESEND_API_KEY not set — OTP email not sent. Code:', code);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('OTP_FROM_EMAIL') || 'CoC.M <onboarding@resend.dev>',
        to: [email],
        subject: 'Your CoC.M verification code',
        html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
          <h2 style="color:#333;">Verification Code</h2>
          <p>Hello ${name},</p>
          <p>Your verification code is:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f4f4f5;border-radius:8px;margin:16px 0;">${code}</div>
          <p style="color:#666;font-size:14px;">This code expires in 5 minutes. If you did not request this, please ignore this email.</p>
          <p style="color:#999;font-size:12px;">Church of Christ, Mataheko Congregation</p>
        </div>`,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Resend API error:', err);
    }
  } catch (err) {
    console.error('Failed to send OTP email:', err);
  }
}

export async function sendOtpSms(phone: string, code: string) {
  // Temporary console log to simulate SMS sending testing
  console.log(`[SIMULATED SMS OTP] To: ${phone} | Code: ${code}`);

  const clientId = Deno.env.get('HUBTEL_CLIENT_ID');
  const clientSecret = Deno.env.get('HUBTEL_CLIENT_SECRET');
  const senderId = Deno.env.get('HUBTEL_SENDER_ID') || 'COCM';

  if (!clientId || !clientSecret) {
    console.error('Hubtel API credentials not set — OTP SMS not sent. Code:', code);
    return;
  }

  try {
    const res = await fetch(`https://smsc.hubtel.com/v1/messages/send?clientid=${clientId}&clientsecret=${clientSecret}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: senderId,
        To: phone,
        Content: `Your CoC.M verification code is: ${code}. This code expires in 5 minutes.`,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Hubtel API error:', errText);
    } else {
      const result = await res.json();
      console.log('Hubtel SMS Sent:', result);
    }
  } catch (err) {
    console.error('Failed to send OTP SMS via Hubtel:', err);
  }
}


