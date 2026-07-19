/**
 * Utility to convert technical error messages or codes into user-friendly ones.
 */

export function getFriendlyMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  // If it's a string, try to map it
  if (typeof error === 'string') {
    return mapErrorMessage(error);
  }

  // If it's an object with a message property (standard Error or ApiError)
  if (error.message && typeof error.message === 'string') {
    // Check for network errors
    if (error.message.toLowerCase().includes('failed to fetch') || 
        error.message.toLowerCase().includes('networkerror')) {
      return 'Connection lost. Please check your internet and try again.';
    }

    // Try to map the specific message
    const mapped = mapErrorMessage(error.message);
    if (mapped !== error.message) return mapped;
  }

  // Check for status codes if it's an ApiError or similar
  if (error.status) {
    switch (error.status) {
      case 400: return 'The request was invalid. Please check your input.';
      case 401: return 'Your session has expired. Please log in again.';
      case 403: return 'You do not have permission to perform this action.';
      case 404: return 'The requested information could not be found.';
      case 429: return 'Too many requests. Please wait a moment and try again.';
      case 500: return 'Our server is having trouble. Please try again later.';
    }
  }

  // Postgres/Supabase error codes
  if (error.code) {
    switch (error.code) {
      case '23505': return 'A record with this information already exists.';
      case '23503': return 'This operation cannot be completed because it depends on other records.';
      case 'PGRST116': return 'No record found with the provided details.';
    }
  }

  return error.message || 'An unexpected error occurred. Please try again.';
}

function mapErrorMessage(msg: string): string {
  const lowercaseMsg = msg.toLowerCase();

  // Auth related
  if (lowercaseMsg.includes('invalid-credential') || lowercaseMsg.includes('invalid login credentials')) {
    return 'Invalid email/phone or password. Please check and try again.';
  }
  if (lowercaseMsg.includes('email not confirmed')) {
    return 'Please confirm your email address before logging in.';
  }
  if (lowercaseMsg.includes('user not found')) {
    return 'No account found with this email or phone number.';
  }
  if (lowercaseMsg.includes('user already exists') || lowercaseMsg.includes('user_already_exists')) {
    return 'An account with this email already exists.';
  }
  if (lowercaseMsg.includes('password is too short')) {
    return 'Password must be at least 8 characters long.';
  }

  // Generic patterns
  if (lowercaseMsg.includes('permission denied')) {
    return 'You do not have permission to perform this action.';
  }
  if (lowercaseMsg.includes('timeout') || lowercaseMsg.includes('timed out')) {
    return 'The request took too long. Please check your connection and try again.';
  }

  return msg;
}
