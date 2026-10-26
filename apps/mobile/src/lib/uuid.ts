import * as Crypto from 'expo-crypto';

/**
 * Universal RFC4122 compliant UUID v4 generator for React Native Hermes and Expo.
 * Never throws "Property 'crypto' doesn't exist".
 */
export function generateUUID(): string {
  try {
    if (Crypto && typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch (e) {
    // Fall through to math fallback
  }

  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.randomUUID) {
      return (globalThis as any).crypto.randomUUID();
    }
  } catch (e) {}

  // RFC4122 version 4 compliant fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Polyfill global crypto.randomUUID if missing
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).crypto) {
    (globalThis as any).crypto = {};
  }
  if (!(globalThis as any).crypto.randomUUID) {
    (globalThis as any).crypto.randomUUID = generateUUID;
  }
}
if (typeof global !== 'undefined') {
  if (!(global as any).crypto) {
    (global as any).crypto = (typeof globalThis !== 'undefined' && (globalThis as any).crypto) || {};
  }
  if (!(global as any).crypto.randomUUID) {
    (global as any).crypto.randomUUID = generateUUID;
  }
}
