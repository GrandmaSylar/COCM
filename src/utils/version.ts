export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const APP_VERSION = "0.2.0";

export const CHANGELOG: ChangelogEntry[] = [
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
