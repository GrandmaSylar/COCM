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
