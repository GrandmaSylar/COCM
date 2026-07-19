import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format amount in Ghana Cedis currency
 * @param amount - The amount to format
 * @returns Formatted currency string with ₵ symbol
 */
export function formatGhanaCedis(amount: number): string {
  return `₵${amount.toLocaleString('en-GH', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

/**
 * Generate a uniform key for mapping expenses to a specific service
 * @param date - The service date (YYYY-MM-DD or similar)
 * @param type - The service type (e.g. sunday_morning)
 */
export function getExpenseKey(date: string, type: string): string {
  if (!date || !type) return '';
  // Ensure we just use the date part if it's an ISO string
  const dateStr = date.includes('T') ? date.split('T')[0] : date;
  return `${dateStr}_${type}`;
}
