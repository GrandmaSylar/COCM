import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";

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

import App from "./App.tsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./styles/globals.css";
import "./index.css";
import "./styles/animations.css";

createRoot(document.getElementById("root")!).render(<App />);
  