# Conversation Log — CoC.M Monorepo (web + mobile)

Working log of the session that analysed the monorepo, fixed the mobile
app's sync and access issues, redesigned the Expo app, and set up mobile distribution.
Branch: `expo`. Latest date: 2026-10-03.

Repo layout referenced throughout:

| Path | What it is |
|---|---|
| `apps/cocm` | Web app (React + Vite, deployed on Vercel) |
| `apps/mobile` | Expo app (SDK 57, expo-router, Tamagui, Reanimated, expo-sqlite) |
| `apps/new-church` | Second web app (not touched) |
| `packages/shared` | `@cms/shared`: `fetchApi`, `ApiError`, theme presets |
| `supabase/cocm` | Supabase project config, migrations, Edge Function `server` (Hono) |

---

## 1. Analysis: mirroring the web app in the mobile app

**Request:** analyse the project; the goal is for the Expo app to mirror the web app's features.

Findings that became the fix list (items 1, 2, 3, 5, 6 were chosen):

1. Offline sync queue was unreliable (mixed legacy item formats, no retry tracking, items stuck in `syncing`).
2. "Promote child to member" did not work end to end.
3. Several mobile API methods called endpoints that don't exist (dead API surface).
5. Role / tab-access rules from the web were not enforced on mobile.
6. Members, visitors and children were not pulled from the server at startup.

## 2. Fixes for items 1, 2, 3, 5, 6

- **Sync queue (1)** — `apps/mobile/src/lib/syncEngine.ts` rewritten:
  - `pushOrQueue(method, endpoint, data)` tries the API first and only queues retryable failures (network, 401/408/429/5xx); other 4xx errors are thrown; "duplicate key" counts as already applied.
  - `flushSyncQueue` replays oldest-first with `attempts` / `last_error` columns (max 5 automatic attempts), stops on network loss, resets stuck `syncing` rows.
  - `migrateLegacyQueueItems` converts old queue formats (member/child/attendance/visitor/giving).
  - New `src/lib/syncPayloads.ts` builds server payloads.
- **Promote child (2)** — backend routes accept client-generated ids so local and server records match:
  `supabase/cocm/functions/server/routes/children-members.ts`, `children-visitors.ts`, `children-giving.ts`, `services.ts` (POST `/visitors`). The Edge Function was deployed by the user (project `szligatlxwpcknwkhdyp`).
- **Dead API methods (3)** — `src/lib/api.ts`: removed `promoteToMember`, `getLiveState`, `checkIn/checkOut`, children-visitor convert/delete; fixed `/users/:id/approve|reject`; `updateTabAccess` now sends `{ tabs }`; added `users.getTabAccess` and theme get/save.
- **Access control (5)** — new `src/lib/access.ts` (web tab ids, dev sees all, dashboard/settings/help always allowed, custom roles via `tab_access`, cached profile, `useAccess()` with `can` / `canRoute`), plus a route guard in `app/_layout.tsx`.
- **Startup sync (6)** — `syncMembers` / `syncVisitors` / `syncChildren` added; `syncEverything` = flush queue, then pull. `pruneLocalTable` never deletes rows still referenced by the queue.

## 3. Mobile UI/UX overhaul (phases 1–7)

**Request:** redesign every screen, animation, button and card for usability without changing features, the database or backend code; spec plan first.

**Decisions:** match the web brand (red `#dc2626`); bring over the web theme editor (per-user theme synced through `/theme`); leave the members list pager as is; the user tests on a real device; fonts and haptics chosen by recommendation (Inter + Plus Jakarta Sans, expo-haptics).

Built:

- **Theme engine** — `context/ThemeContext.tsx` (light/dark/system, custom colours, live preview, server sync, refresh on foreground); `theme/tokens.ts` (type scale, spacing, radius, motion, `buildAppColors`), `theme/neutrals.ts`, `theme/animations.ts`, `theme/haptics.ts`, `theme/status.ts`; theme presets in `packages/shared/src/theme.ts`.
- **UI kit** — `components/ui/`: AppText, PressableScale, Button, IconButton, QuickAction, Badge, Surface/Section/ListRow/DetailRow, AmountRow, PersonRow, SegmentedControl, Chips, SearchField/TextField, EmptyState/StatTile/ProgressBar, Sheet, Toast, Screen, Avatar, OtpInput, FormSection/SaveBar/ChoiceChips/FieldGroup/PhotoPicker. Also HubScreen, GroupRoster, forms/MemberForm, forms/ChildForm, restyled NativeDatePicker, Skeleton.
- **Phases:** 1 foundation (fonts, tokens, kit, config) → System tab and all its sub-pages → 2+3 People (members, visitors, children) → 4 Operations (attendance, ministries, zones) → 5 Finances (giving, expenses) → 6 entry flow (login/2FA, onboarding, profile) → 7 polish.
- **Follow-up requests:**
  - Users & Access page showed everyone as "pending" and no tab access — fixed (status derived from approval status and active flag, correct tab ids and API routes).
  - Toasts and similar animations bounced to the middle of the screen — now short, eased, top-anchored, with no overshoot.

Bugs found and fixed during the redesign:
- giving, expense and giving-type saves silently lost data when offline (now `pushOrQueue`);
- ministries read the wrong dropdown category;
- the child profile showed fake attendance (3/4, 75%);
- the expense voucher showed the wrong church name and made-up sign-off names;
- live check-in search text was invisible in light mode;
- zones were hard-coded.

## 4. Device errors reported by the user

- **"Uncaught (in promise) … fetch failed … Internet connection appears to be offline"** — the `.finally()` copy of in-flight GET requests in `packages/shared/src/services/apiClient.ts` was unhandled; now `.catch(() => {})`.
- **"NOT NULL constraint failed: giving_records.amount"** — older builds left legacy columns on the device's SQLite tables. `upsertLocalGivingRecord` fills legacy `amount`/`date`; `getLocalStats` uses `total_amount`/`service_date`.

## 5. Local database: "update all the tables"

`apps/mobile/src/lib/db.ts` now holds the schema as data (`SCHEMA`, 21 tables). `reconcileSchema()` runs at every launch:
- compares each table with `PRAGMA table_info`;
- rebuilds any that drifted (legacy, missing or changed columns) inside a transaction, copying rows and mapping legacy columns (`amount → total_amount`, `date → service_date`, …);
- recreates indexes; keeps queued sync items.

`getLocalDb()` is a shared promise, so screens wait for the migration. Verified against a simulated legacy database: rows preserved, the failing insert succeeds, and a second run is a no-op.

## 6. Expenses: sign-off names and requisition form

**Request:** sign-off names should come from the member list while typing; the mobile app lacked the web's expense requisition form.

- `components/MemberNameField.tsx` — the three sign-off fields suggest matching members as you type (links `requestedById` etc.; free text still allowed).
- `components/ExpenseRequisition.tsx` — native copy of the web's PDF requisition form (letterhead, banner, ruled details, amount/date, signatures, Acts 2:38 footer) plus A4 PDF **Share** (expo-print + expo-sharing) and **Print**.
- `app/expenses/record.tsx` — Preview requisition → Edit / Save requisition (same flow as the web); after saving, the requisition opens.
- `app/expenses/receipt.tsx` — shows the requisition form with Share PDF / Print.
- New dependencies: `expo-print`, `expo-sharing`, `expo-asset`; new asset `assets/requisition-logo.png`.

## 7. Installing on iPhone (from Windows)

Options explained: Expo Go, EAS Build (needs a $99/yr Apple Developer account), a borrowed or cloud Mac with 7-day sideloading, or the web app as a home-screen shortcut. **Chosen: Expo Go + EAS Update.**

## 8. Splash screen redesign, EAS setup, Android APK

- **Animated splash** — `components/AnimatedSplash.tsx`:
  - starts as an exact copy of the native splash, then the seal eases upward with a faint red halo;
  - the "Church of Christ / MATAHEKO" wordmark fades in, with a thin loading bar and the Acts 2:38 line;
  - fades out once the local database is ready (at least 1.5 s, at most 6 s); no bounce, and only a fade with Reduce Motion.
  - `app/index.tsx` no longer flashes a skeleton login form while checking the session. New asset `assets/splash-logo.png`.
- **EAS:**
  - Project `@grandmaa/cocm-mobile` (ID `dcfcebc8-b0d0-4cf4-a66f-5ba02aaf4dbf`).
  - `expo-updates` installed; `runtimeVersion.policy = "sdkVersion"` (needed for Expo Go → `exposdk:57.0.0`).
  - `apps/mobile/eas.json`: `preview` is an internal APK on channel `preview`; Supabase env vars stored in EAS for preview/production/development.
- **app.json:**
  - name "CoC Mataheko", package and bundle ID `com.cocmataheko.mobile`, `scheme: "cocm"`;
  - square icons `assets/app-icon.png` and `assets/adaptive-icon-foreground.png`;
  - removed the deprecated `splash` and `newArchEnabled` keys.
  - Updated expo / expo-router / expo-linking patch versions.
- **First APK build failed** at "Install dependencies": the default npm on EAS rejected `package-lock.json` (root React `overrides` out of sync with workspace `package.json`s). Fixed by adding `"node": "24.12.0"` (npm 11) to the `base` profile in `eas.json`.
- **Expo Go crash** "Cannot make a deep link into a standalone app with no custom scheme defined" → added `scheme: "cocm"`, republished the update, rebuilt the APK (`531e950f-0909-4658-9cb6-d9525de51768`, finished successfully):
  https://expo.dev/artifacts/eas/sb0qsd_68OEqy5Muo_HUUtueymkd4DIpEkgAj6G2Ua0.apk

**Publishing JS changes** (reaches both the APK and Expo Go):
```bash
cd apps/mobile
npx eas update --channel preview --environment preview --message "what changed"
```
**New APK:** `npx eas build --platform android --profile preview` (from `apps/mobile`).

## 9. CI/CD plan review

The user shared a GitHub Actions plan. Review points:
- `eas update --auto` targets the git branch, not the `preview` channel;
- iOS builds need an Apple account;
- `supabase functions serve --dry-run` doesn't exist (use `deno check`), and Supabase commands need `--workdir supabase/cocm`;
- there is no ESLint config and no test files yet;
- auto `db push` should be gated by an approval;
- OTA updates need a native-change guard;
- Vercel Git integration probably already deploys the web app;
- branch protection, `new-church` and rollback were missing.

Proposed order: CI gate → mobile OTA → Edge Functions → gated migrations. Not implemented.

---

## Open items / notes

- **Stray files at the repo root:** `app.json` (links to a second Expo project `1b145e6b-59a9-48ec-bd1d-b03f483de039`) and `eas.json` (staged) were created by an `eas` command run from the repo root instead of `apps/mobile`. They are probably safe to delete, along with that extra Expo project; not removed yet.
- `package-lock.json` doesn't contain the React 18.3.1 the root `overrides` promise for `cocm-app` (the web app likely runs React 19.1.0). Should be fixed as part of the CI work.
- The mobile app pins React 19.1.0 through the root overrides while SDK 57 expects 19.2.3; left as is (app runs).
- `apps/mobile/.expo/` is tracked in git (expo-doctor warning).
- Adding a native module requires a new APK build before publishing an update (the `sdkVersion` policy doesn't block incompatible updates).
- Not done: the offline banner (needs NetInfo); committing the work (nothing has been committed on `expo` in this session).
- Needs device testing:
  - the splash animation;
  - offline giving and expense saves after the schema migration;
  - the sign-off member search;
  - requisition PDF sharing;
  - the Expo Go launch after the scheme fix.
