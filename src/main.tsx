import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { registerSW } from "virtual:pwa-register";
import { getDb } from "./services/offlineStore";
import { 
  setUpdateSW, 
  setNeedsRefresh, 
  setBeforeInstallPromptEvent, 
  type BeforeInstallPromptEvent 
} from "./services/pwa";
import { initSyncEngine } from "./services/syncEngine";

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setBeforeInstallPromptEvent(e as BeforeInstallPromptEvent);
});

// Initialise IndexedDB schema early (fire-and-forget)
getDb();

Sentry.init({
  dsn: "https://0044e132ab7f5e2b11574ad9dad321e9@o4510925241057280.ingest.de.sentry.io/4510925290078288", // Replace __SENTRY_DSN__ with your actual Sentry DSN
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0, 
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
});

// Register PWA service worker
const updateSWFn = registerSW({
  immediate: false,
  onNeedRefresh() {
    setNeedsRefresh(true);
    // Dispatch a custom event so Layout can react
    window.dispatchEvent(new CustomEvent("sw-update-available"));
  },
  onOfflineReady() {
    console.log("[PWA] App is ready for offline use.");
  },
});
setUpdateSW(updateSWFn);

import App from "./App.tsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./styles/globals.css";
import "./index.css";
import "./styles/animations.css";

initSyncEngine();

createRoot(document.getElementById("root")!).render(<App />);
  