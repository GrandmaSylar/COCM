/**
 * Security utilities for input sanitization and validation.
 */

/**
 * Sanitizes user input to prevent XSS attacks.
 * Removes HTML tags and Dangerous characters.
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove control characters (except common whitespace)
  // eslint-disable-next-line
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Prevent javascript: protocol
  if (sanitized.toLowerCase().includes('javascript:')) {
    sanitized = sanitized.replace(/javascript:/gi, '');
  }

  // Encode special characters that might be used in XSS
  // (Note: React does this by default for rendering, but good to have for raw data)
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;',
  };
  
  // We don't necessarily want to encode everything if we are sending to API, 
  // as it might double-encode. Supabase handles storage safely.
  // The most important part is stripping tags and scripts.
  // For now, we will just strip tags and trim.
  
  return sanitized.trim();
}

/**
 * Validates email format using a strict regex.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength.
 * Requires at least 8 characters, one number, one uppercase, one lowercase.
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' };
  }
  return { valid: true };
}
