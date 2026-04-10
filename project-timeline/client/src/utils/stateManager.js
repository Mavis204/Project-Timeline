/**
 * stateManager.js — App state bootstrap, migration, and factory functions.
 *
 * This is the ONLY file that touches `api.js`. All other files that need
 * data receive it as props or from React context.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW THE App COMPONENT USES THIS (see App.jsx):
 *
 *   const [st, setSt]       = useState(mkInitialState);   // optimistic default
 *   const [loading, setLoading] = useState(true);
 *
 *   // Load from API once on mount
 *   useEffect(() => {
 *     bootstrapState().then(loaded => { setSt(loaded); setLoading(false); });
 *   }, []);
 *
 *   // Persist every time state changes (debounce recommended in production)
 *   useEffect(() => {
 *     if (!loading) api.saveState(st);
 *   }, [st, loading]);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FULL-STACK NOTE:
 * In full-stack mode, `bootstrapState` calls api.loadState() which becomes
 * GET /api/state. `api.saveState()` becomes PUT /api/state.
 * migrateState() and mkInitialState() stay client-side as-is.
 */

import api from '../services/api';
import { DEF_SETTINGS, DEF_TEAM_DATA } from '../constants';
import { today, fmt, toArr } from '../utils/dateUtils';

let _uid = Date.now();
/** Generate a short unique ID. */
export function uid() { return (++_uid).toString(36); }

/** Factory: create a new empty timeline object. */
export function mkTL(start) {
  return {
    id:           uid(),
    finishedDate: null,
    plotStart:    start || today(),
    name:         fmt(start || today()),
    tasks:        {},
  };
}

/** Factory: create fresh team data (projects + empty timeline). */
export function mkTeamData() {
  return {
    ...DEF_TEAM_DATA,
    projects:        DEF_TEAM_DATA.projects.map(p => ({ ...p })),
    currentTimeline: mkTL(),
    archives:        [],
  };
}

/** Factory: create the full initial app state (used when no saved state exists). */
export function mkInitialState() {
  return {
    settings:     DEF_SETTINGS,
    teams:        [{ id: 't1', name: 'Technical Team' }],
    activeTeamId: 't1',
    teamData:     { t1: mkTeamData() },
  };
}

/**
 * Migrate saved state from older versions of the app.
 * Safe to run on any version; returns null if state is unusable.
 *
 * @param {object} s - Raw parsed state from storage.
 * @returns {object|null} Migrated state, or null if irreparably broken.
 */
export function migrateState(s) {
  if (!s.teamData) return null;
  if (!s.settings) s.settings = DEF_SETTINGS;
  delete s.settings.workTypes; // removed in current version

  // Re-map old default project colors to new palette
  const COLOR_MAP = {
    p1: '#0ea5e9', p2: '#10b981', p3: '#f59e0b',
    p4: '#6366f1', p5: '#ec4899', p6: '#14b8a6',
  };
  const OLD_COLORS = new Set(['#f59e0b','#f97316','#22c55e','#3b82f6','#8b5cf6','#ec4899']);

  Object.keys(s.teamData).forEach(tid => {
    const td = s.teamData[tid];

    // Fix project colors
    if (td.projects) {
      td.projects = td.projects.map(p =>
        COLOR_MAP[p.id] && OLD_COLORS.has(p.color)
          ? { ...p, color: COLOR_MAP[p.id] }
          : p
      );
    }

    // Migrate old workTypeHours → new priorityHours
    function migrateTasks(tasks) {
      if (!tasks) return tasks;
      const out = {};
      Object.keys(tasks).forEach(pid => {
        const t = tasks[pid];
        if (t.workTypeHours && !t.priorityHours) {
          const ph = {};
          if (t.workTypeHours.wt_nf  > 0) ph.hp_nf  = t.workTypeHours.wt_nf;
          if (t.workTypeHours.wt_bug > 0) ph.hp_bug = t.workTypeHours.wt_bug;
          if (t.workTypeHours.wt_enh > 0) ph.hp_enh = t.workTypeHours.wt_enh;
          out[pid] = { ...t, priorityHours: ph };
        } else if (t.mainHours > 0 && !t.priorityHours) {
          out[pid] = { ...t, priorityHours: { hp_nf: t.mainHours } };
        } else {
          out[pid] = t;
        }
      });
      return out;
    }

    if (td.currentTimeline)
      td.currentTimeline.tasks = migrateTasks(td.currentTimeline.tasks);
    if (td.archives)
      td.archives = td.archives.map(a => ({ ...a, tasks: migrateTasks(a.tasks) }));
  });

  return s;
}

/**
 * Migrate a legacy (pre-multi-team) state object to the current shape.
 * @param {object} o - Legacy raw state.
 * @returns {object} Migrated state in current format.
 */
function migrateLegacyState(o) {
  const projects = (o.projects || []).map(p => ({ ...p, members: toArr(p.members) }));
  const tl = o.currentTimeline || mkTL();
  const td = {
    projects,
    currentTimeline: {
      ...tl,
      plotStart: tl.plotStartDate || tl.plotStart || today(),
      tasks:     tl.projectTasks  || tl.tasks     || {},
    },
    archives: (o.archives || []).map(a => ({
      ...a,
      plotStart: a.plotStartDate || a.plotStart || today(),
      tasks:     a.projectTasks  || a.tasks     || {},
    })),
  };
  return {
    settings:     DEF_SETTINGS,
    teams:        [{ id: 't1', name: 'Technical Team' }],
    activeTeamId: 't1',
    teamData:     { t1: td },
  };
}

/**
 * Load state from the API (or localStorage), run migrations, and return
 * a guaranteed-valid state object. Falls back to mkInitialState() on error.
 *
 * @returns {Promise<object>} Valid app state.
 */
export async function bootstrapState() {
  try {
    // 1. Try loading current state
    const saved = await api.loadState();
    if (saved) {
      const migrated = migrateState(saved);
      if (migrated) return migrated;
    }

    // 2. Try migrating from legacy localStorage keys
    const legacy = await api.loadLegacy();
    if (legacy) {
      const migrated = migrateState(migrateLegacyState(legacy));
      if (migrated) return migrated;
    }
  } catch (err) {
    console.error('[bootstrapState] Failed to load state:', err);
  }

  // 3. First-run: return fresh initial state
  return mkInitialState();
}
