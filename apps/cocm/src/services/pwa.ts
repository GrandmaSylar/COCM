/**
 * PWA state module — keeps service-worker and install-prompt references
 * decoupled from any single React component.
 */

/** The function returned by `registerSW` from vite-plugin-pwa. */
export let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

/** Called from main.tsx after `registerSW` returns. */
export function setUpdateSW(fn: (reloadPage?: boolean) => Promise<void>) {
  updateSW = fn;
}

/** Becomes `true` when the service worker detects a new version waiting. */
export let needsRefresh = false;

export function setNeedsRefresh(value: boolean) {
  needsRefresh = value;
}

/** Stored `beforeinstallprompt` event so any component can trigger the install flow. */
export let beforeInstallPromptEvent: BeforeInstallPromptEvent | null = null;

export function setBeforeInstallPromptEvent(event: BeforeInstallPromptEvent | null) {
  beforeInstallPromptEvent = event;
}

/**
 * `BeforeInstallPromptEvent` is not yet in the standard lib types, so we
 * declare it here for type-safety.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}
