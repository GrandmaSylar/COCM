# React Native Architecture & State Guidelines for AI Coding Agents

As an AI coding agent, you must adhere to these specific architectural principles when writing or modifying code in `apps/mobile`. This project uses a lightweight, highly decoupled, **Offline-First Local SQLite + React Hooks Architecture** instead of heavy external state libraries. Do not introduce new global state packages unless explicitly instructed.

---

## 1. Single Local Source of Truth (SQLite Layer)
* **Constraint:** The app must work fully offline with 0ms reads/writes. Domain data must not live in memory.
* **Agent Execution:**
  * Treat **`expo-sqlite`** (`cocm_local.db`) as the absolute single source of truth for all domain entities.
  * Never invent arbitrary global memory stores or context objects to share business data across screens.
  * Execute all database orchestration strictly through the established repository layer in `apps/mobile/src/lib/db.ts`.
  * Ensure all manual mutations (creates, updates, deletes) are also pushed to the outbox mutation queue in `apps/mobile/src/lib/syncEngine.ts` for eventual cloud synchronization.

## 2. Component Isolation & UI State Management
* **Constraint:** React components should only track active, local, visual configurations.
* **Agent Execution:**
  * Use built-in React hooks (`useState`, `useReducer`) exclusively for localized UI states, such as form inputs, modal visibility toggles, active filter buttons, and pagination thresholds.
  * Optimize rendering paths by wrapping heavy calculations in `useMemo` and event handlers in `useCallback` to avoid accidental React Native frame-rate drops.

## 3. URL-Driven Route & Screen Navigation
* **Constraint:** Screen routing must rely on deep-linkable, parameter-driven states rather than shared global objects.
* **Agent Execution:**
  * Utilize **Expo Router** APIs (`useLocalSearchParams`, `useRouter`) to pass identifiers and criteria across screens.
  * For example, fetch a member profile by grabbing the unique `id` directly from `useLocalSearchParams` and querying the SQLite db file natively within that specific screen. Do not pass entire entity objects through navigation parameters.

## 4. Secure Authentication & Credential Storage
* **Constraint:** Security tokens must be encrypted natively in device hardware keychains.
* **Agent Execution:**
  * Exclusively rely on the pairing of **`expo-secure-store`** and **Supabase Auth** for session tokens.
  * Always read or validate sessions dynamically using `supabase.auth.getSession()`.
  * Never mirror or store raw JWT tokens or user passwords inside plaintext local caches or standard async storage.

## 5. Instant Visual Rendering & Transient Caching
* **Constraint:** Users expect instant visual feedback on app boot before heavy SQLite queries finish executing.
* **Agent Execution:**
  * Use **`@react-native-async-storage/async-storage`** only for light, non-secure transient caches, such as home dashboard metrics snapshots.
  * Render the Async Storage snapshot instantly on mount, then silently swap it with fresh data once the main SQLite query resolves.

## 6. Realtime Sync & Event Streams
* **Constraint:** Incoming database mutations must flow seamlessly from the cloud down to the device without freezing the UI thread.
* **Agent Execution:**
  * Maintain the **Supabase Realtime (WebSockets)** listener architecture.
  * When a sync event occurs over a channel, write the update directly into the local SQLite database first, then broadcast a local trigger or update the local React component state to refresh the visible layout.
