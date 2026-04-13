/**
 * constants.js — App-wide constants: priorities, work types, default data.
 *
 * These stay on the client. In full-stack mode, default project/team data
 * should come from the database instead of DEF_TEAM_DATA, but the shape
 * of the objects must remain identical.
 *
 * PostgreSQL column types that match these shapes:
 *   projects   → TABLE projects (id TEXT, name TEXT, members TEXT[], color TEXT, team_id TEXT)
 *   timelines  → TABLE timelines (id TEXT, team_id TEXT, name TEXT, plot_start DATE, finished_date DATE)
 *   tasks      → TABLE tasks (timeline_id TEXT, project_id TEXT, priority_hours JSONB, plot_start DATE)
 *   notes      → TABLE notes (id TEXT, task_id TEXT, start_date DATE, end_date DATE, text TEXT)
 */

/**
 * Timeline grouping structure — max 2 groups.
 * Colors and icons live on individual options. buildSlots() uses a fallback
 * chain to find color (group1 → group2) and icon (group2 → group1 → null).
 * Slots use format: opt_high__opt_bug, opt_high__opt_nf, etc.
 */
export const DEFAULT_TIMELINE_STRUCTURE = [
  {
    id: "group_priority",
    label: "Priority",
    options: [
      { id: "opt_high", label: "High", color: "#ef4444", order: 0 },
      { id: "opt_medium", label: "Medium", color: "#f97316", order: 1 },
      { id: "opt_low", label: "Low", color: "#3b82f6", order: 2 },
    ],
  },
  {
    id: "group_worktype",
    label: "Work Type",
    options: [
      { id: "opt_bug", label: "Bug", icon: "bug", order: 0 },
      { id: "opt_nf", label: "New Feature", icon: "sparkles", order: 1 },
      { id: "opt_enh", label: "Enhancement", icon: "wrench", order: 2 },
    ],
  },
];

/**
 * Default calendar settings.
 * In full-stack mode, store per-team in:
 *   TABLE team_settings (team_id TEXT PRIMARY KEY, exclude_days INT[], holidays DATE[])
 */
export const DEF_SETTINGS = {
  excludeDays: [],
  holidays: [],
  timelineStructure: DEFAULT_TIMELINE_STRUCTURE,
  membersEnabled: true,
};

/**
 * Default seed projects for a new team.
 * In full-stack mode, INSERT these on team creation instead of using this constant.
 */
export const DEF_TEAM_DATA = {
  projects: [],
  currentTimeline: null,
  archives: [],
};
