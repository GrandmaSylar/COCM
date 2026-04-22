export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const APP_VERSION = "0.3.0";

export const CHANGELOG: ChangelogEntry[] = [
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
