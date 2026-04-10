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

/** Priority levels. Order determines plotting sequence. */
export const PRIORITIES = [
  { id: 'hp', name: 'High Priority',   color: '#ef4444', order: 0 },
  { id: 'mp', name: 'Medium Priority', color: '#f97316', order: 1 },
  { id: 'lp', name: 'Low Priority',    color: '#3b82f6', order: 2 },
];

/** Work types per priority. */
export const WT_BASE = [
  { id: 'bug', name: 'Bug',         order: 0 },
  { id: 'nf',  name: 'New Feature', order: 1 },
  { id: 'enh', name: 'Enhancement', order: 2 },
];

/**
 * All 9 priority×worktype slots (hp_bug, hp_nf, hp_enh, mp_bug, ..., lp_enh).
 * Used as keys in the `priorityHours` JSONB object.
 */
export const ALL_SLOTS = PRIORITIES.flatMap(p =>
  WT_BASE.map(wt => ({
    id:     `${p.id}_${wt.id}`,
    pId:    p.id,
    wtId:   wt.id,
    name:   `${p.name} – ${wt.name}`,
    pName:  p.name,
    wtName: wt.name,
    color:  p.color,
    order:  p.order * 3 + wt.order,
  }))
);

/**
 * Default calendar settings.
 * In full-stack mode, store per-team in:
 *   TABLE team_settings (team_id TEXT PRIMARY KEY, exclude_days INT[], holidays DATE[])
 */
export const DEF_SETTINGS = {
  excludeDays: [5],  // Friday is an alignment day by default
  holidays: ['2026-04-09', '2026-04-10', '2026-05-01'],
};

/**
 * Default seed projects for a new team.
 * In full-stack mode, INSERT these on team creation instead of using this constant.
 */
export const DEF_TEAM_DATA = {
  projects: [
    { id: 'p1', name: 'HRIS',       members: ['JASMINE'],                           color: '#0ea5e9' },
    { id: 'p2', name: 'CONCORD',    members: ['GERARD', 'DAVE'],                    color: '#10b981' },
    { id: 'p3', name: 'SUNTECH',    members: ['CHES'],                              color: '#f59e0b' },
    { id: 'p4', name: 'SBF',        members: ['CHESTER', 'MOLL', 'MARK', 'HARVEY'],color: '#6366f1' },
    { id: 'p5', name: 'MUANA HRIS', members: ['JOSEPH'],                            color: '#ec4899' },
    { id: 'p6', name: 'AXS WEBSITE',members: ['LOVELY'],                            color: '#14b8a6' },
  ],
  currentTimeline: null,
  archives: [],
};
