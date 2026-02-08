 Complete Backup System Design                                                 
  ┌─────────────────────────────────────────────────────────────────┐
  │                    BACKUP & RESTORE SYSTEM                      │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  BACKUP TYPES                                                   │
  │  ┌──────────────────────┐  ┌──────────────────────┐            │
  │  │   📦 FULL BACKUP     │  │   📄 DIFFERENTIAL    │            │
  │  │   Complete snapshot  │  │   Changes only       │            │
  │  └──────────────────────┘  └──────────────────────┘            │
  │                                                                 │
  │  STORAGE DESTINATIONS                                           │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │                                                          │  │
  │  │  💾 OFFLINE (Device)                                     │  │
  │  │  • Download directly to computer/phone                   │  │
  │  │  • User manages storage                                  │  │
  │  │  • No cloud dependency                                   │  │
  │  │                                                          │  │
  │  │  ☁️ SUPABASE STORAGE                                     │  │
  │  │  • Built-in cloud storage                                │  │
  │  │  • Automatic with scheduled backups                      │  │
  │  │  • Easy restore from app                                 │  │
  │  │                                                          │  │
  │  │  🌐 EXTERNAL CLOUD                                       │  │
  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │  │
  │  │  │Google  │ │Dropbox │ │OneDrive│ │  Box   │            │  │
  │  │  │Drive   │ │        │ │        │ │        │            │  │
  │  │  └────────┘ └────────┘ └────────┘ └────────┘            │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

  Updated UI Design

  ┌─────────────────────────────────────────────────────────────────┐
  │  BACKUP & RESTORE                                               │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  ┌─── CONNECTED STORAGE ────────────────────────────────────┐  │
  │  │                                                          │  │
  │  │  ☁️ Supabase Storage    ✅ Connected (default)           │  │
  │  │                                                          │  │
  │  │  🔗 External Cloud Accounts:                             │  │
  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │  │
  │  │  │ Google Drive │ │   Dropbox    │ │   OneDrive   │     │  │
  │  │  │ ✅ Connected │ │ [Connect]    │ │ [Connect]    │     │  │
  │  │  │ [Disconnect] │ │              │ │              │     │  │
  │  │  └──────────────┘ └──────────────┘ └──────────────┘     │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  ┌─── CREATE BACKUP ────────────────────────────────────────┐  │
  │  │                                                          │  │
  │  │  Backup Type:                                            │  │
  │  │  ┌─────────────────────┐  ┌─────────────────────┐       │  │
  │  │  │ 📦 Full Backup      │  │ 📄 Differential     │       │  │
  │  │  │ ○                   │  │ ○                   │       │  │
  │  │  └─────────────────────┘  └─────────────────────┘       │  │
  │  │                                                          │  │
  │  │  Save To:                                                │  │
  │  │  ☑ 💾 Download to Device                                │  │
  │  │  ☑ ☁️ Supabase Storage                                  │  │
  │  │  ☐ 📁 Google Drive                                      │  │
  │  │  ☐ 📁 Dropbox (not connected)                           │  │
  │  │                                                          │  │
  │  │  [Create Backup]                                         │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  ┌─── BACKUP HISTORY ───────────────────────────────────────┐  │
  │  │                                                          │  │
  │  │  Filter: [All Locations ▼] [All Types ▼]                │  │
  │  │                                                          │  │
  │  │  ┌───────────────────────────────────────────────────┐  │  │
  │  │  │ 📦 Full Backup                     Feb 8, 2026    │  │  │
  │  │  │ 💾 Device  ☁️ Supabase  📁 Google Drive          │  │  │
  │  │  │ Size: 2.4 MB  •  Records: 870                     │  │  │
  │  │  │ [⬇️ Download] [🔄 Restore] [🗑️ Delete]            │  │  │
  │  │  └───────────────────────────────────────────────────┘  │  │
  │  │                                                          │  │
  │  │  ┌───────────────────────────────────────────────────┐  │  │
  │  │  │ 📄 Differential                    Feb 7, 2026    │  │  │
  │  │  │ ☁️ Supabase                                       │  │  │
  │  │  │ Size: 156 KB  •  Changes: 45  •  Base: Feb 1      │  │  │
  │  │  │ [⬇️ Download] [🔄 Restore] [🗑️ Delete]            │  │  │
  │  │  └───────────────────────────────────────────────────┘  │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  ┌─── RESTORE ──────────────────────────────────────────────┐  │
  │  │                                                          │  │
  │  │  Source:                                                 │  │
  │  │  ○ 📁 Upload from Device                                │  │
  │  │  ○ ☁️ Select from Supabase Storage                      │  │
  │  │  ○ 📁 Select from Google Drive                          │  │
  │  │                                                          │  │
  │  │  [Select Backup File...]                                 │  │
  │  │                                                          │  │
  │  │  ┌─ Selected: full_backup_2026-02-08.json ────────────┐ │  │
  │  │  │ Type: Full Backup                                   │ │  │
  │  │  │ Created: Feb 8, 2026 at 10:30 AM                   │ │  │
  │  │  │ Records: 150 members, 520 attendance, 200 giving   │ │  │
  │  │  └────────────────────────────────────────────────────┘ │  │
  │  │                                                          │  │
  │  │  Restore Mode:                                           │  │
  │  │  ○ Replace All (⚠️ clears existing data first)          │  │
  │  │  ○ Merge (skip duplicates, add new only)                │  │
  │  │  ○ Update (update existing + add new)                   │  │
  │  │                                                          │  │
  │  │  [Preview Changes]  [🔄 Restore Now]                     │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  ┌─── AUTO-BACKUP SCHEDULE ─────────────────────────────────┐  │
  │  │                                                          │  │
  │  │  ☑ Enable automatic backups                             │  │
  │  │                                                          │  │
  │  │  Full Backup:                                            │  │
  │  │  Every [Sunday ▼] at [2:00 AM ▼]                        │  │
  │  │  Save to: ☑ Supabase  ☑ Google Drive                    │  │
  │  │                                                          │  │
  │  │  Differential Backup:                                    │  │
  │  │  Every [Day ▼] at [3:00 AM ▼]                           │  │
  │  │  Save to: ☑ Supabase                                    │  │
  │  │                                                          │  │
  │  │  Retention: Keep last [4 ▼] full backups                │  │
  │  │             Keep last [7 ▼] differential backups        │  │
  │  │                                                          │  │
  │  │  [Save Schedule]                                         │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

  Implementation Architecture

  ┌─────────────────────────────────────────────────────────────────┐
  │                     BACKUP FLOW                                 │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  [Create Backup Button]                                         │
  │          │                                                      │
  │          ▼                                                      │
  │  ┌─────────────────┐                                           │
  │  │ Generate Backup │ ← Collect data from all tables            │
  │  │ (Server-side)   │ ← Apply type (full/differential)          │
  │  └────────┬────────┘                                           │
  │           │                                                     │
  │           ▼                                                     │
  │  ┌─────────────────┐                                           │
  │  │ Backup Package  │ ← JSON with metadata                      │
  │  │ (.zip or .json) │ ← Compressed if large                     │
  │  └────────┬────────┘                                           │
  │           │                                                     │
  │           ├──────────────┬──────────────┬──────────────┐       │
  │           ▼              ▼              ▼              ▼       │
  │  ┌──────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │
  │  │ 💾 Download  │ │ ☁️ Supabase│ │📁 Google   │ │📁 Dropbox│  │
  │  │ to Device    │ │ Storage    │ │ Drive API  │ │ API      │  │
  │  └──────────────┘ └────────────┘ └────────────┘ └──────────┘  │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │                     RESTORE FLOW                                │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  ┌──────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │
  │  │ 💾 Upload    │ │ ☁️ Supabase│ │📁 Google   │ │📁 Dropbox│  │
  │  │ from Device  │ │ Storage    │ │ Drive      │ │          │  │
  │  └──────┬───────┘ └─────┬──────┘ └─────┬──────┘ └────┬─────┘  │
  │         │               │              │              │        │
  │         └───────────────┴──────────────┴──────────────┘        │
  │                         │                                       │
  │                         ▼                                       │
  │                ┌─────────────────┐                             │
  │                │ Parse & Validate│                             │
  │                │ Backup File     │                             │
  │                └────────┬────────┘                             │
  │                         │                                       │
  │                         ▼                                       │
  │                ┌─────────────────┐                             │
  │                │ Preview Changes │ ← Show what will change     │
  │                │ (Optional)      │                             │
  │                └────────┬────────┘                             │
  │                         │                                       │
  │                         ▼                                       │
  │                ┌─────────────────┐                             │
  │                │ Apply Restore   │ ← Transaction-based         │
  │                │ (Server-side)   │ ← Ordered by dependencies   │
  │                └─────────────────┘                             │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
