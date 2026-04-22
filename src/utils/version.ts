export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const APP_VERSION = "0.4.0";

export const CHANGELOG: ChangelogEntry[] = [
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
