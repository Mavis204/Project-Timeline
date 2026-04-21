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

import api from "../services/api";
import {
  DEF_SETTINGS,
  DEF_TEAM_DATA,
  DEFAULT_TIMELINE_STRUCTURE,
  TRACKING_MODES,
} from "../constants";
import { today, fmt, toArr } from "../utils/dateUtils";

function normalizeTaskEntry(task = {}) {
  return {
    priorityHours: task.priorityHours || {},
    simpleHours: Number(task.simpleHours || 0),
    taskItems: Array.isArray(task.taskItems) ? task.taskItems : [],
    plotStart: task.plotStart || null,
    notes: Array.isArray(task.notes) ? task.notes : [],
  };
}

let _uid = Date.now();
/** Generate a short unique ID. */
export function uid() {
  return (++_uid).toString(36);
}

/** Factory: create a new empty timeline object. */
export function mkTL(start) {
  return {
    id: uid(),
    finishedDate: null,
    plotStart: start || today(),
    name: fmt(start || today()),
    tasks: {},
  };
}

/** Factory: create fresh team data (projects + empty timeline + per-workspace settings). */
export function mkTeamData(customSettings) {
  return {
    ...DEF_TEAM_DATA,
    projects: DEF_TEAM_DATA.projects.map((p) => ({ ...p })),
    currentTimeline: mkTL(),
    archives: [],
    trash: [],
    settings: customSettings || {
      ...DEF_SETTINGS,
      timelineStructure: DEFAULT_TIMELINE_STRUCTURE,
    },
  };
}

/** Factory: create default workspace settings. */
export function mkDefaultWorkspaceSettings() {
  return {
    ...DEF_SETTINGS,
    timelineStructure: DEFAULT_TIMELINE_STRUCTURE,
    trackingMode: DEF_SETTINGS.trackingMode || TRACKING_MODES.GROUPED,
  };
}

/** Factory: create workspace data with optional custom settings. */
export function mkWorkspaceData(customSettings) {
  return {
    ...mkTeamData(),
    settings: customSettings || mkDefaultWorkspaceSettings(),
  };
}

/** Factory: create the full initial app state (used when no saved state exists). */
export function mkInitialState() {
  return {
    settings: DEF_SETTINGS,
    teams: [],
    activeTeamId: null,
    teamData: {},
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

  // Inject timelineStructure if missing (users upgrading from old version)
  if (!s.settings.timelineStructure) {
    s.settings.timelineStructure = DEFAULT_TIMELINE_STRUCTURE;
  }

  // Ensure trackingMode is set
  if (!s.settings.trackingMode) {
    s.settings.trackingMode = TRACKING_MODES.GROUPED;
  }

  // Rename old slot keys: "hp_bug" → "opt_high__opt_bug"
  const KEY_MAP = {
    hp_bug: "opt_high__opt_bug",
    hp_nf: "opt_high__opt_nf",
    hp_enh: "opt_high__opt_enh",
    mp_bug: "opt_medium__opt_bug",
    mp_nf: "opt_medium__opt_nf",
    mp_enh: "opt_medium__opt_enh",
    lp_bug: "opt_low__opt_bug",
    lp_nf: "opt_low__opt_nf",
    lp_enh: "opt_low__opt_enh",
  };

  function remapPriorityHours(ph) {
    if (!ph) return ph;
    const out = {};
    for (const [oldKey, val] of Object.entries(ph)) {
      out[KEY_MAP[oldKey] ?? oldKey] = val; // unknown keys pass through unchanged
    }
    return out;
  }

  // Re-map old default project colors to new palette
  const COLOR_MAP = {
    p1: "#0ea5e9",
    p2: "#10b981",
    p3: "#f59e0b",
    p4: "#6366f1",
    p5: "#ec4899",
    p6: "#14b8a6",
  };
  const OLD_COLORS = new Set([
    "#f59e0b",
    "#f97316",
    "#22c55e",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ]);

  Object.keys(s.teamData).forEach((tid) => {
    const td = s.teamData[tid];

    // Fix project colors
    if (td.projects) {
      td.projects = td.projects.map((p) =>
        COLOR_MAP[p.id] && OLD_COLORS.has(p.color)
          ? { ...p, color: COLOR_MAP[p.id] }
          : p,
      );
    }

    // Migrate old workTypeHours → new priorityHours
    function migrateTasks(tasks) {
      if (!tasks) return tasks;
      const out = {};
      Object.keys(tasks).forEach((pid) => {
        const t = tasks[pid];
        if (t.workTypeHours && !t.priorityHours) {
          const ph = {};
          if (t.workTypeHours.wt_nf > 0) ph.hp_nf = t.workTypeHours.wt_nf;
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

    function remapTasks(tasks) {
      if (!tasks) return tasks;
      return Object.fromEntries(
        Object.entries(tasks).map(([pid, t]) => [
          pid,
          normalizeTaskEntry({
            ...t,
            priorityHours: remapPriorityHours(t.priorityHours),
          }),
        ]),
      );
    }

    if (td.currentTimeline)
      td.currentTimeline.tasks = remapTasks(
        migrateTasks(td.currentTimeline.tasks),
      );
    if (td.archives)
      td.archives = td.archives.map((a) => ({
        ...a,
        tasks: remapTasks(migrateTasks(a.tasks)),
      }));
  });

  return s;
}

/**
 * Migrate a legacy (pre-multi-team) state object to the current shape.
 * @param {object} o - Legacy raw state.
 * @returns {object} Migrated state in current format.
 */
function migrateLegacyState(o) {
  const projects = (o.projects || []).map((p) => ({
    ...p,
    members: toArr(p.members),
  }));
  const tl = o.currentTimeline || mkTL();
  const td = {
    projects,
    currentTimeline: {
      ...tl,
      plotStart: tl.plotStartDate || tl.plotStart || today(),
      tasks: Object.fromEntries(
        Object.entries(tl.projectTasks || tl.tasks || {}).map(([pid, task]) => [
          pid,
          normalizeTaskEntry(task),
        ]),
      ),
    },
    archives: (o.archives || []).map((a) => ({
      ...a,
      plotStart: a.plotStartDate || a.plotStart || today(),
      tasks: Object.fromEntries(
        Object.entries(a.projectTasks || a.tasks || {}).map(([pid, task]) => [
          pid,
          normalizeTaskEntry(task),
        ]),
      ),
    })),
  };
  return migrateState({
    settings: DEF_SETTINGS,
    teams: [],
    activeTeamId: null,
    teamData: { [uid()]: td },
  });
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
      const migrated = migrateLegacyState(legacy);
      if (migrated) return migrated;
    }
  } catch (err) {
    console.error("[bootstrapState] Failed to load state:", err);
  }

  // 3. First-run: return fresh initial state
  return mkInitialState();
}
