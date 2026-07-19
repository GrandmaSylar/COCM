export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

// Injected by Vite at build time (see vite.config.ts `define`)
declare const __BUILD_DATE__: string;
declare const __GIT_HASH__: string;

export const APP_VERSION = "0.7.2";
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString();
export const GIT_HASH = typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : 'dev';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.7.2",
    date: "2026-07-19",
    changes: [
      "Added Executive DB Analytics Report generation with configurable date parameters and scopes in Reports tab",
      "Added print-optimized PDF export layout for executive database analytics using actual church logo",
      "Fixed TypeScript compilation errors in Attendance.tsx",
      "Fixed backend scope and variable errors in Reports endpoint"
    ],
  },
  {
    version: "0.7.1",
    date: "2026-05-03",
    changes: [
      "Fixed browser HTTP cache persistently showing stale live sessions",
      "Fixed 'Join Session' button not passing correct date/service causing new session creation on join",
      "Disabled browser cache for all GET requests to ensure proper realtime cache syncing"
    ],
  },
  {
    version: "0.7.0",
    date: "2026-04-26",
    changes: [
      "Removed donation field from Record Giving form, added redirect to profile after member/child registration, and fixed TypeScript compilation errors",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-04-25",
    changes: [
      "Security updates, Vercel SPA routing fallback, Edge Function auth guard, and responsive UI improvements",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-04-25",
    changes: [
      "Redesigned Settings navigation for mobile — full-page menu with icons and descriptions",
      "Reverted desktop Settings to horizontal tab bar layout",
      "Added 'Check for Update' button in About System to force-refresh cached assets",
      "Fixed member deletion failing due to missing foreign key cleanup for expenses and requisitions",
      "Fixed custom role permissions not working for Children's Ministry (members, attendance, giving)",
      "Fixed React warnings for Sheet/Dialog ref forwarding and controlled/uncontrolled Tabs",
      "Fixed clear-data script not finding .env when run from scripts directory",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-04-22",
    changes: [
      "Converted visitors now remain visible in visitors list with greyed-out styling and 'Converted to Member' badge",
      "Added 'Convert' button for all non-converted visitors (adults and children)",
      "Children's ministry visitor registration now requires only first and last name",
      "Replaced 'Visitor Follow-up Status' pie chart with 'Visitor Conversion' chart in Reports",
      "Fixed visitor conversion not persisting in the database",
      "Migrated deployment from Vercel to Netlify",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-04-21",
    changes: [
      "Added 'Service Setup' module to automate service programs and officiators",
      "Integrated Service Setup directly into Service Details view based on date",
      "Added automatic clearing of child members when promoted to Main Member",
      "Added automatic removal of visitors upon successful conversion to members",
      "Added 'Church/Congregation' field for visitors that auto-fills during member conversion",
      "Added PDF export functionality for Service Setups",
      "Redesigned the Expense Requisition PDF for better branding and layout",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-04-19",
    changes: [
      "Added version number display in sidebar footer (desktop & mobile)",
      "Added About tab in Settings with app info and changelog",
      "Introduced changelog section to track release history",
    ],
  },
];
