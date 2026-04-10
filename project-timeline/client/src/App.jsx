/**
 * App.jsx — Root React component and all UI components.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FULL-STACK MIGRATION NOTES FOR GITHUB COPILOT:
 *
 * This file is self-contained and works as-is. To convert to full-stack:
 *
 * 1. Move this file to: client/src/App.jsx (Vite + React project)
 * 2. The api.js service layer already has fetch() stubs — just swap method bodies.
 * 3. All component logic, prop shapes, and state structure stay IDENTICAL.
 * 4. No component in this file needs to change for the Express migration.
 *
 * DATA FLOW:
 *   PostgreSQL ──► Express GET /api/state ──► api.loadState() ──► bootstrapState()
 *                                                                        │
 *                                                                     setSt()
 *                                                                        │
 *                                                                     App renders
 *                                                                        │
 *   PostgreSQL ◄── Express PUT /api/state ◄── api.saveState(st) ◄── useEffect([st])
 *
 * COMPONENT TREE (for Copilot reference):
 *   App
 *   ├── DashboardScreen
 *   │   └── [timeline cards, team switcher, trash view]
 *   ├── Header
 *   │   └── HBtn (reusable header button)
 *   ├── TimelineGrid
 *   │   └── [Gantt rows, day columns, note overlays, Legend]
 *   ├── PlotModal       (plot hours per project)
 *   │   └── NoteList
 *   ├── CompareModal    (A/B timeline comparison)
 *   ├── SettingsModal   (holidays, exclude days, priority colors)
 *   ├── EditProjectModal
 *   ├── AddProjectModal
 *   ├── AddTeamModal
 *   └── EditTeamModal
 *
 * UI PRIMITIVES (defined at bottom of this file):
 *   Modal, Fld, Inp, Sel, Actions, B, Chip, Alert, Tabs, MembersInput
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useMemo, useRef, Fragment } from "react";
import api from "./services/api";
import TopBar from "./components/TopBar";
import {
  bootstrapState,
  mkInitialState,
  mkTL,
  mkTeamData,
  uid,
} from "./utils/stateManager";
import { plotPartialDays } from "./utils/plotUtils";
import {
  fmt,
  fmtF,
  fd,
  pd,
  addD,
  diffD,
  s2,
  toArr,
  dRange,
  today,
  dayType,
  workDates,
  cd8,
  MON_S,
  MON_F,
  DOW_S,
} from "./utils/dateUtils";
import {
  PRIORITIES,
  WT_BASE,
  ALL_SLOTS,
  DEF_SETTINGS,
  DEF_TEAM_DATA,
} from "./constants";

/* ─── Helper Functions ────────────────────────────────────────────────────── */
/**
 * Round hours to days with standard decimal rounding
 * @param {number} hours - Total hours
 * @returns {number} Days (rounds up if decimal >= 0.5, else rounds down)
 * Examples: 8.3h→1d, 8.5h→2d, 16.4h→2d, 16.5h→3d
 */
const roundDays = (hours) => {
  const decimalPart = hours % 1;
  if (decimalPart >= 0.5) {
    return Math.ceil(hours / 8);
  } else {
    return Math.floor(hours / 8);
  }
};

/* ─── Error Boundary Component ─────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "#f1f5f9",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#991b1b",
              marginBottom: "10px",
            }}
          >
            Oops! An error occurred
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              maxWidth: "400px",
              textAlign: "center",
              fontFamily: "monospace",
            }}
          >
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ─── Spinner keyframe (injected once) ───────────────────────────────────── */
if (
  typeof document !== "undefined" &&
  !document.getElementById("__spin_style")
) {
  const s = document.createElement("style");
  s.id = "__spin_style";
  s.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}

/* ── WtIcon — work type icon component ───────────────────────────────────── */
function WtIcon({ wtId, size = 9 }) {
  if (wtId === "nf" || wtId === "wt_nf")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1l1.8 5.5H16l-4.7 3.4 1.8 5.5L8 12l-5.1 3.4 1.8-5.5L0 6.5h6.2L8 1z" />
      </svg>
    );
  if (wtId === "bug" || wtId === "wt_bug")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
        <ellipse cx="8" cy="9.5" rx="4" ry="5" />
        <path
          d="M5.5 5a2.5 2 0 015 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <line
          x1="1"
          y1="8"
          x2="4"
          y2="9"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <line
          x1="15"
          y1="8"
          x2="12"
          y2="9"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2l4 6H4l4-6z" />
      <rect x="6" y="8" width="4" height="5" rx="1" />
    </svg>
  );
}

function App({ user, onLogout }) {
  // ── State bootstrap from API ─────────────────────────────────────────
  // MIGRATION NOTE: bootstrapState() calls api.loadState() which in
  // full-stack mode becomes GET /api/state (Express + PostgreSQL).
  // mkInitialState() is the optimistic fallback rendered while loading.
  const [st, setSt] = useState(mkInitialState);
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    bootstrapState().then((loaded) => {
      setSt(loaded);
      setAppLoading(false);
    });
  }, []);

  // ── Persist state on every change ────────────────────────────────────
  // MIGRATION NOTE: api.saveState(st) becomes PUT /api/state.
  // Consider debouncing (500ms) in production to avoid hammering the DB.
  useEffect(() => {
    if (!appLoading) api.saveState(st);
  }, [st, appLoading]);
  const [modal, setModal] = useState(null);
  const [mdata, setMdata] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const histRef = useRef([]);
  const futRef = useRef([]); // redo stack
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // When viewing an archived timeline
  const [viewingArchiveId, setViewingArchiveId] = useState(null);

  const { settings, teams, activeTeamId, teamData } = st;
  const td = teamData[activeTeamId] || mkTeamData();
  const { projects, currentTimeline, archives } = td;
  // If viewing an archive, use that timeline instead of current
  const viewingArchive = viewingArchiveId
    ? archives.find((a) => a.id === viewingArchiveId)
    : null;
  const tl = viewingArchive || currentTimeline || mkTL();
  const isViewingArchive = !!viewingArchive;

  function upd(fn) {
    setSt((p) => {
      histRef.current = [...histRef.current.slice(-29), p];
      futRef.current = []; // clear redo on new action
      setCanUndo(true);
      setCanRedo(false);
      return fn(p);
    });
  }
  function undo() {
    if (!histRef.current.length) return;
    const prev = histRef.current[histRef.current.length - 1];
    setSt((cur) => {
      futRef.current = [...futRef.current.slice(-29), cur];
      setCanRedo(true);
      return prev;
    });
    histRef.current = histRef.current.slice(0, -1);
    if (!histRef.current.length) setCanUndo(false);
  }
  function redo() {
    if (!futRef.current.length) return;
    const next = futRef.current[futRef.current.length - 1];
    setSt((cur) => {
      histRef.current = [...histRef.current.slice(-29), cur];
      setCanUndo(true);
      return next;
    });
    futRef.current = futRef.current.slice(0, -1);
    if (!futRef.current.length) setCanRedo(false);
  }
  useEffect(() => {
    function hk(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", hk);
    return () => window.removeEventListener("keydown", hk);
  }, []);

  const [cellZoom, setCellZoom] = useState(34);
  const [screen, setScreen] = useState("dashboard"); // start on dashboard

  useEffect(() => {
    console.log("[App] Screen changed to:", screen);
  }, [screen]);

  useEffect(() => {
    function onWheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setCellZoom((z) =>
        Math.min(60, Math.max(12, z + (e.deltaY < 0 ? 3 : -3))),
      );
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  function updTD(fn) {
    upd((p) => ({
      ...p,
      teamData: {
        ...p.teamData,
        [p.activeTeamId]: fn(p.teamData[p.activeTeamId] || mkTeamData()),
      },
    }));
  }
  function updTL(fn) {
    if (isViewingArchive) return; // don't mutate while viewing archive
    updTD((td) => ({
      ...td,
      currentTimeline: fn(td.currentTimeline || mkTL()),
    }));
  }

  function doClearCurrentTimeline() {
    if (
      !confirm(
        "Clear all plotted hours for the current timeline? This cannot be undone.",
      )
    )
      return;
    updTD((td) => ({
      ...td,
      currentTimeline: { ...td.currentTimeline, tasks: {} },
    }));
  }

  function doViewArchive(id) {
    setViewingArchiveId(id);
    setModal(null);
    setScreen("timeline");
  }
  function doExitArchiveView() {
    setViewingArchiveId(null);
  }
  function doRestoreArchiveForEdit(a) {
    updTD((td) => {
      const cur = { ...td.currentTimeline, finishedDate: today() };
      return {
        ...td,
        currentTimeline: { ...a, finishedDate: null },
        archives: [cur, ...td.archives.filter((x) => x.id !== a.id)],
      };
    });
    setViewingArchiveId(null);
    setModal(null);
  }

  const { displayDates, byMonth } = useMemo(() => {
    const tlStart = tl.plotStart;
    const pColors = settings.priorityColors || {
      hp: "#ef4444",
      mp: "#f97316",
      lp: "#3b82f6",
    };
    const dynSlots = PRIORITIES.flatMap((p) =>
      WT_BASE.map((wt) => ({
        id: `${p.id}_${wt.id}`,
        color: pColors[p.id] || p.color,
        order: p.order * 3 + wt.order,
      })),
    );
    // Find earliest date across all project plotStarts
    let minStart = tlStart;
    let maxEnd = addD(tlStart, 41);
    projects.forEach((p) => {
      const pt = tl.tasks[p.id] || {};
      const ps = pt.plotStart || tlStart;
      if (ps < minStart) minStart = ps;
      const ph = pt.priorityHours || {};
      const slots = dynSlots
        .filter((s) => ph[s.id] > 0)
        .map((s) => ({ ...s, hours: ph[s.id] }));
      const segMap = plotPartialDays(slots, ps, settings);
      if (segMap.size) {
        const last = [...segMap.keys()].sort().pop();
        const w = addD(last, 10);
        if (w > maxEnd) maxEnd = w;
      }
      (pt.notes || []).forEach((n) => {
        if (addD(n.endDate, 5) > maxEnd) maxEnd = addD(n.endDate, 5);
      });
    });
    const dates = dRange(minStart, maxEnd);
    const bm = [];
    let cm = null,
      cg = null;
    dates.forEach((d) => {
      const mo = d.slice(0, 7);
      if (mo !== cm) {
        cm = mo;
        cg = { month: mo, dates: [] };
        bm.push(cg);
      }
      cg.dates.push(d);
    });
    return { displayDates: dates, byMonth: bm };
  }, [tl, settings, projects]);

  /* ── project plots ── */
  const plots = useMemo(() => {
    const res = {};
    const pColors = settings.priorityColors || {
      hp: "#ef4444",
      mp: "#f97316",
      lp: "#3b82f6",
    };
    const dynPriorities = PRIORITIES.map((p) => ({
      ...p,
      color: pColors[p.id] || p.color,
    }));
    const dynSlots = dynPriorities.flatMap((p) =>
      WT_BASE.map((wt) => ({
        id: `${p.id}_${wt.id}`,
        pId: p.id,
        wtId: wt.id,
        name: `${p.name} – ${wt.name}`,
        pName: p.name,
        wtName: wt.name,
        color: p.color,
        order: p.order * 3 + wt.order,
      })),
    );
    projects.forEach((p) => {
      const pt = tl.tasks[p.id] || {};
      const ps = pt.plotStart || tl.plotStart;
      const ph = pt.priorityHours || {};
      const slots = dynSlots
        .filter((s) => ph[s.id] > 0)
        .map((s) => ({ ...s, hours: ph[s.id] }));
      const segMap = plotPartialDays(slots, ps, settings);
      const noteDateMap = {};
      (pt.notes || []).forEach((n) => {
        dRange(n.startDate, n.endDate).forEach((d) => {
          if (!noteDateMap[d]) noteDateMap[d] = [];
          noteDateMap[d].push(n);
        });
      });
      const totalH = slots.reduce((acc, s) => acc + s.hours, 0);
      const totalD =
        segMap.size > 0
          ? [...segMap.keys()].filter((d) => dayType(d, settings) === "work")
              .length
          : 0;
      const priSummary = dynPriorities
        .map((pr) => {
          const prTotalH = WT_BASE.reduce(
            (acc, wt) => acc + (ph[`${pr.id}_${wt.id}`] || 0),
            0,
          );
          const prTotalD =
            totalD > 0 && totalH > 0
              ? Math.round((prTotalH / totalH) * totalD)
              : 0;
          return { ...pr, totalH: prTotalH, totalD: prTotalD };
        })
        .filter((x) => x.totalH > 0);
      res[p.id] = {
        segMap,
        noteDateMap,
        plotStart: ps,
        priSummary,
        totalH,
        totalD,
      };
    });
    return res;
  }, [projects, tl, settings]);

  const [isDirty, setIsDirty] = useState(false);

  // Override upd to track dirty state (but not for settings/team changes)
  function updTLDirty(fn) {
    if (isViewingArchive) return;
    setIsDirty(true);
    updTD((td) => ({
      ...td,
      currentTimeline: fn(td.currentTimeline || mkTL()),
    }));
  }

  function doSaveTimeline() {
    // Already persisted to localStorage by useEffect - just mark clean
    setIsDirty(false);
  }

  function doSaveTask(pid, priorityHours, plotStart) {
    if (isViewingArchive) return;
    setIsDirty(true);
    updTD((td) => {
      const prev = td.currentTimeline?.tasks?.[pid] || {};
      return {
        ...td,
        currentTimeline: {
          ...td.currentTimeline,
          tasks: {
            ...td.currentTimeline.tasks,
            [pid]: {
              ...prev,
              priorityHours: priorityHours || {},
              plotStart: plotStart || null,
            },
          },
        },
      };
    });
    setModal(null);
  }
  function doAddProject(proj) {
    updTD((td) => ({
      ...td,
      projects: [
        ...td.projects,
        { ...proj, id: uid(), members: toArr(proj.members) },
      ],
    }));
    setModal(null);
  }
  function doEditProject(proj) {
    updTD((td) => ({
      ...td,
      projects: td.projects.map((p) =>
        p.id === proj.id ? { ...proj, members: toArr(proj.members) } : p,
      ),
    }));
    setModal(null);
  }
  function doDelProject(id) {
    updTD((td) => {
      const tasks = { ...td.currentTimeline.tasks };
      delete tasks[id];
      return {
        ...td,
        projects: td.projects.filter((p) => p.id !== id),
        currentTimeline: { ...td.currentTimeline, tasks },
      };
    });
    setModal(null);
  }
  function doAddNote(pid, note) {
    if (isViewingArchive) return;
    setIsDirty(true);
    updTD((td) => {
      const prev = td.currentTimeline?.tasks?.[pid] || {};
      return {
        ...td,
        currentTimeline: {
          ...td.currentTimeline,
          tasks: {
            ...td.currentTimeline.tasks,
            [pid]: {
              ...prev,
              notes: [...(prev.notes || []), { ...note, id: uid() }],
            },
          },
        },
      };
    });
  }
  function doDelNote(pid, nid) {
    if (isViewingArchive) return;
    setIsDirty(true);
    updTD((td) => {
      const prev = td.currentTimeline?.tasks?.[pid] || {};
      return {
        ...td,
        currentTimeline: {
          ...td.currentTimeline,
          tasks: {
            ...td.currentTimeline.tasks,
            [pid]: {
              ...prev,
              notes: (prev.notes || []).filter((n) => n.id !== nid),
            },
          },
        },
      };
    });
  }
  function doEditNote(pid, note) {
    if (isViewingArchive) return;
    setIsDirty(true);
    updTD((td) => {
      const prev = td.currentTimeline?.tasks?.[pid] || {};
      return {
        ...td,
        currentTimeline: {
          ...td.currentTimeline,
          tasks: {
            ...td.currentTimeline.tasks,
            [pid]: {
              ...prev,
              notes: (prev.notes || []).map((n) =>
                n.id === note.id ? note : n,
              ),
            },
          },
        },
      };
    });
  }
  function doRestoreArchive(a) {
    if (
      !confirm(
        `Restore timeline from ${fmtF(a.finishedDate)}? This replaces the current active timeline.`,
      )
    )
      return;
    updTD((td) => ({
      ...td,
      currentTimeline: { ...a, finishedDate: null },
      archives: td.archives.filter((x) => x.id !== a.id),
    }));
    setModal(null);
  }
  function doDelArchive(id) {
    if (!confirm("Delete this archived timeline? Cannot be undone.")) return;
    updTD((td) => ({
      ...td,
      archives: td.archives.filter((a) => a.id !== id),
    }));
  }
  function doAddTeam(name) {
    const id = uid();
    upd((p) => ({
      ...p,
      teams: [...p.teams, { id, name }],
      teamData: { ...p.teamData, [id]: mkTeamData() },
      activeTeamId: id,
    }));
    setModal(null);
  }
  function doEditTeam(id, name) {
    upd((p) => ({
      ...p,
      teams: p.teams.map((t) => (t.id === id ? { ...t, name } : t)),
    }));
    setModal(null);
  }
  function doDelTeam(id) {
    if (teams.length <= 1) {
      alert("Cannot delete the only team.");
      return;
    }
    if (!confirm("Delete this team and all its data?")) return;
    upd((p) => {
      const t = { ...p.teamData };
      delete t[id];
      return {
        ...p,
        teams: p.teams.filter((t) => t.id !== id),
        teamData: t,
        activeTeamId: p.teams.find((t) => t.id !== id)?.id || p.teams[0]?.id,
      };
    });
    setModal(null);
  }
  function doSaveSettings(ns) {
    upd((p) => ({ ...p, settings: ns }));
    setModal(null);
  }

  function doNewTimeline(startDate, name) {
    console.log(
      "[doNewTimeline] Creating new timeline with date:",
      startDate,
      "name:",
      name,
    );
    const d = startDate || today();
    updTD((td) => {
      const saved = {
        ...(td.currentTimeline || mkTL()),
        finishedDate: d,
      };
      const freshTL = { ...mkTL(d), name: name || fmt(d) };
      return {
        ...td,
        currentTimeline: freshTL,
        archives: [saved, ...td.archives],
      };
    });
    setIsDirty(false);
    setModal(null);
    setViewingArchiveId(null);
    console.log("[doNewTimeline] Setting screen to 'timeline'");
    setScreen("timeline");
  }

  function doRenameTimeline(id, name) {
    if (id === "__current__" || !id) {
      updTD((td) => ({
        ...td,
        currentTimeline: { ...td.currentTimeline, name },
      }));
    } else {
      updTD((td) => ({
        ...td,
        archives: td.archives.map((a) => (a.id === id ? { ...a, name } : a)),
      }));
    }
  }

  // Trash: move to trash instead of permanent delete
  function doRemoveTimeline(id) {
    updTD((td) => {
      // Build set of existing trash IDs for O(1) lookup
      const trashIds = new Set((td.trash || []).map((t) => t.id));

      if (id === "__current__") {
        // Removing current timeline
        const currentId = td.currentTimeline?.id;
        let newTrash = td.trash || [];

        // Step 1: Add current timeline to trash (only once, never duplicated)
        if (currentId && !trashIds.has(currentId)) {
          newTrash = [
            ...newTrash,
            { ...(td.currentTimeline || mkTL()), trashedAt: today() },
          ];
        }

        // Step 2: Remove current from dashboard state by promoting archive or creating fresh
        if (td.archives.length > 0) {
          const [first, ...rest] = td.archives;
          return {
            ...td,
            currentTimeline: { ...first, finishedDate: null },
            archives: rest,
            trash: newTrash,
          };
        }

        // No archives: create fresh empty timeline (ensures removed timeline doesn't stay on dashboard)
        return {
          ...td,
          currentTimeline: mkTL(),
          trash: newTrash,
        };
      } else {
        // Removing archived timeline from dashboard
        const target = (td.archives || []).find((a) => a.id === id);

        if (!target) {
          console.log("[doRemoveTimeline] Timeline not found in archives", id);
          return td;
        }

        // Add to trash only if not already there (no duplicate IDs in trash)
        let newTrash = td.trash || [];
        if (!trashIds.has(id)) {
          newTrash = [...newTrash, { ...target, trashedAt: today() }];
        }

        // Remove from archives (dashboard source of truth)
        const updatedArchives = td.archives.filter((a) => a.id !== id);

        return {
          ...td,
          archives: updatedArchives,
          trash: newTrash,
        };
      }
    });
  }
  function doRestoreTrash(id) {
    updTD((td) => {
      const target = (td.trash || []).find((a) => a.id === id);
      if (!target) return td;
      const { trashedAt, ...restored } = target;
      return {
        ...td,
        archives: [restored, ...(td.archives || [])],
        trash: (td.trash || []).filter((a) => a.id !== id),
      };
    });
  }
  function doDeleteForever(id) {
    if (!confirm("Permanently delete this timeline? Cannot be undone.")) return;
    updTD((td) => ({
      ...td,
      trash: (td.trash || []).filter((a) => a.id !== id),
    }));
  }

  function doDeleteAllTrash() {
    const trashCount = td?.trash?.length || 0;

    if (
      !window.confirm(
        `Permanently delete all ${trashCount} item${trashCount !== 1 ? "s" : ""} in trash? Cannot be undone.`,
      )
    ) {
      return;
    }

    updTD((prev) => ({
      ...prev,
      trash: [],
    }));
  }

  function doClearCurrentTimeline() {
    if (!confirm("Clear all plotted hours? This cannot be undone.")) return;
    setIsDirty(true);
    updTD((td) => ({
      ...td,
      currentTimeline: { ...td.currentTimeline, tasks: {} },
    }));
  }

  const allTimelines = useMemo(
    () => [
      {
        ...(currentTimeline || mkTL()),
        name:
          currentTimeline?.name ||
          fmt(currentTimeline?.plotStart) ||
          "Untitled",
        isCurrent: true,
      },
      ...(archives || []).map((a) => ({
        ...a,
        name: a.name || fmt(a.plotStart) || "Untitled",
      })),
    ],
    [currentTimeline, archives],
  );

  function openEdit(pid) {
    setMdata({ pid });
    setModal("task");
  }
  function openEditProj(pid) {
    setMdata({ pid });
    setModal("editProj");
  }

  // Loading guard — show loading message
  if (appLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "var(--text-3)",
          fontSize: 13,
          gap: 10,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ animation: "spin 1s linear infinite" }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Loading…
      </div>
    );
  }

  // Dashboard screen with TopBar
  if (screen === "dashboard") {
    const trash = (teamData[activeTeamId] || mkTeamData()).trash || [];
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          overflow: "hidden",
        }}
      >
        <TopBar
          user={user}
          onLogout={onLogout}
          onNavigateDashboard={() => setScreen("dashboard")}
        />
        <div style={{ flex: 1, overflow: "auto" }}>
          <DashboardScreen
            teams={teams}
            teamData={teamData}
            activeTeamId={activeTeamId}
            projects={projects}
            currentTimeline={currentTimeline}
            archives={archives}
            trash={trash}
            settings={settings}
            onOpen={(id) => {
              if (!id || id === "__current__") {
                setViewingArchiveId(null);
              } else {
                setViewingArchiveId(id);
              }
              setScreen("timeline");
            }}
            onRemove={doRemoveTimeline}
            onRename={(id, name) => doRenameTimeline(id, name)}
            onRestoreTrash={doRestoreTrash}
            onDeleteForever={doDeleteForever}
            onDeleteAllTrash={doDeleteAllTrash}
            onSwitchTeam={(id) => upd((p) => ({ ...p, activeTeamId: id }))}
            onNewTimeline={() => setModal("newTimeline")}
            onAddTeam={() => setModal("addTeam")}
            onCompare={() => setModal("compare")}
            modal={modal}
            setModal={setModal}
            onConfirmNewTimeline={doNewTimeline}
          />
          {modal === "compare" && (
            <CompareModal
              allTimelines={allTimelines}
              projects={projects}
              settings={settings}
              onClose={() => setModal(null)}
            />
          )}
        </div>
      </div>
    );
  }

  // Timeline screen with TopBar

  // Timeline screen with TopBar
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <TopBar
        user={user}
        onLogout={onLogout}
        onNavigateDashboard={() => setScreen("dashboard")}
      />
      <Header
        teams={teams}
        activeTeamId={activeTeamId}
        onSwitchTeam={(id) => upd((p) => ({ ...p, activeTeamId: id }))}
        onAddTeam={() => setModal("addTeam")}
        onEditTeam={(id) => {
          setMdata({ teamId: id });
          setModal("editTeam");
        }}
        onSave={isViewingArchive ? null : doSaveTimeline}
        isDirty={isDirty && !isViewingArchive}
        onCompare={() => setModal("compare")}
        onSettings={() => setModal("settings")}
        plotStart={tl.plotStart}
        canUndo={canUndo && !isViewingArchive}
        onUndo={undo}
        canRedo={canRedo && !isViewingArchive}
        onRedo={redo}
        isViewingArchive={isViewingArchive}
        onClearTimeline={isViewingArchive ? null : doClearCurrentTimeline}
        onGoHome={() => setScreen("dashboard")}
      />
      {/* Archive view banner */}
      {isViewingArchive && (
        <div
          style={{
            background: "#1d4ed8",
            padding: "7px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: "#bfdbfe" }}>
            Viewing — {fmt(viewingArchive.plotStart)}
          </span>
          <span style={{ fontSize: 11, color: "rgba(191,219,254,0.7)" }}>
            Read-only
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => doRestoreArchiveForEdit(viewingArchive)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#1e40af",
              background: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "4px 14px",
              cursor: "pointer",
            }}
          >
            Edit this Timeline
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <TimelineGrid
          projects={projects}
          displayDates={displayDates}
          byMonth={byMonth}
          plots={plots}
          settings={settings}
          cellZoom={cellZoom}
          onEditProject={isViewingArchive ? () => {} : openEdit}
          onEditProjectInfo={
            isViewingArchive ? () => {} : (pid) => openEditProj(pid)
          }
          onAddProject={isViewingArchive ? null : () => setModal("addProject")}
          onDelNote={isViewingArchive ? () => {} : doDelNote}
          onNoteClick={
            isViewingArchive
              ? null
              : (pid, note) => {
                  setMdata({ pid, note });
                  setModal("editNote");
                }
          }
          setTooltip={setTooltip}
        />
        <Legend settings={settings} />
      </div>

      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 16,
            top: tooltip.y - 8,
            background: "#0f172a",
            borderRadius: 9,
            padding: "10px 14px",
            fontSize: 11,
            zIndex: 9999,
            pointerEvents: "none",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            lineHeight: 1.9,
            maxWidth: 230,
            color: "#f8fafc",
          }}
        >
          {tooltip.lines.map((l, i) => (
            <div
              key={i}
              style={{
                color: i === 0 ? "#7dd3fc" : i === 1 ? "#f8fafc" : "#94a3b8",
                fontWeight: i === 0 ? 700 : 400,
              }}
            >
              {l}
            </div>
          ))}
        </div>
      )}

      {modal === "task" && mdata && !isViewingArchive && (
        <PlotModal
          project={projects.find((p) => p.id === mdata.pid)}
          task={tl.tasks[mdata.pid] || {}}
          globalStart={tl.plotStart}
          settings={settings}
          onClose={() => setModal(null)}
          onSave={(ph, ps) => doSaveTask(mdata.pid, ph, ps)}
          onAddNote={(n) => doAddNote(mdata.pid, n)}
          onDelNote={(nid) => doDelNote(mdata.pid, nid)}
          onEditNote={(n) => doEditNote(mdata.pid, n)}
        />
      )}
      {modal === "editNote" && mdata && !isViewingArchive && (
        <EditNoteModal
          note={mdata.note}
          onClose={() => setModal(null)}
          onSave={(n) => {
            doEditNote(mdata.pid, n);
            setModal(null);
          }}
          onDelete={() => {
            doDelNote(mdata.pid, mdata.note.id);
            setModal(null);
          }}
        />
      )}
      {modal === "editProj" && mdata && !isViewingArchive && (
        <EditProjectModal
          project={projects.find((p) => p.id === mdata.pid)}
          onClose={() => setModal(null)}
          onEditProject={doEditProject}
          onDelProject={() => doDelProject(mdata.pid)}
        />
      )}
      {modal === "addProject" && !isViewingArchive && (
        <AddProjectModal onClose={() => setModal(null)} onSave={doAddProject} />
      )}
      {modal === "compare" && (
        <CompareModal
          allTimelines={allTimelines}
          projects={projects}
          settings={settings}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "settings" && (
        <SettingsModal
          settings={settings}
          onClose={() => setModal(null)}
          onSave={doSaveSettings}
        />
      )}

      {modal === "addTeam" && (
        <AddTeamModal onClose={() => setModal(null)} onSave={doAddTeam} />
      )}
      {modal === "editTeam" && mdata && (
        <EditTeamModal
          team={teams.find((t) => t.id === mdata.teamId)}
          onClose={() => setModal(null)}
          onSave={(name) => doEditTeam(mdata.teamId, name)}
          onDelete={() => doDelTeam(mdata.teamId)}
          canDelete={teams.length > 1}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD SCREEN
══════════════════════════════════════════════════════════ */
function DashboardScreen({
  teams,
  teamData,
  activeTeamId,
  projects,
  currentTimeline,
  archives,
  trash,
  settings,
  onOpen,
  onRemove,
  onRename,
  onRestoreTrash,
  onDeleteForever,
  onDeleteAllTrash,
  onSwitchTeam,
  onNewTimeline,
  onAddTeam,
  onCompare,
  modal,
  setModal,
  onConfirmNewTimeline,
}) {
  const [teamOpen, setTeamOpen] = useState(false);
  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];
  const [newDate, setNewDate] = useState(today());
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [showTrash, setShowTrash] = useState(false);

  // Build cards list: only show __current__ if it has tasks or if no archives exist
  const currentHasData = Object.keys(currentTimeline?.tasks || {}).some((pid) =>
    Object.values(currentTimeline?.tasks?.[pid]?.priorityHours || {}).some(
      (h) => Number(h) > 0,
    ),
  );
  const shouldShowCurrent = currentHasData;

  const cards = [
    ...(shouldShowCurrent
      ? [
          {
            id: "__current__",
            label:
              currentTimeline?.name ||
              fmt(currentTimeline?.plotStart) ||
              "Untitled",
            date: currentTimeline?.plotStart,
            tasks: currentTimeline?.tasks || {},
          },
        ]
      : []),
    ...(archives || []).map((a) => ({
      id: a.id,
      label: a.name || fmt(a.plotStart) || "Untitled",
      date: a.plotStart,
      tasks: a.tasks || {},
    })),
  ];
  const pColors = settings?.priorityColors || {
    hp: "#ef4444",
    mp: "#f97316",
    lp: "#3b82f6",
  };
  const trashItems = trash || [];

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      {/* New Timeline modal */}
      {modal === "newTimeline" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: 420,
              padding: "24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              New Timeline
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-3)",
                marginBottom: 18,
              }}
            >
              Start a fresh reporting period
            </div>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-2)",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Starting Date
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  if (!newName) setNewName("");
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1.5px solid var(--blue)",
                  borderRadius: 7,
                  fontSize: 13,
                  fontFamily: "Plus Jakarta Sans,sans-serif",
                  marginBottom: 10,
                }}
              />
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-2)",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Timeline Name{" "}
                <span style={{ color: "var(--text-3)", fontWeight: 400 }}>
                  (optional — defaults to starting date)
                </span>
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={fmt(newDate) || "e.g. Sprint 14"}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1.5px solid var(--border)",
                  borderRadius: 7,
                  fontSize: 13,
                  fontFamily: "Plus Jakarta Sans,sans-serif",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 18,
              }}
            >
              <button
                onClick={() => {
                  setModal(null);
                  setNewName("");
                  setNewDate(today());
                }}
                style={{
                  padding: "7px 14px",
                  background: "transparent",
                  border: "1.5px solid var(--border)",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--text-2)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirmNewTimeline(newDate, newName.trim() || null);
                  setNewName("");
                  setNewDate(today());
                }}
                style={{
                  padding: "7px 16px",
                  background: "var(--blue)",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: "white",
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar / Dashboard controls */}
      <div
        style={{
          background: "#fff",
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 24px",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }} />
        {/* Compare button */}
        <button
          onClick={onCompare}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 16px",
            background: "var(--green)",
            border: "none",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            color: "white",
            cursor: "pointer",
            transition: "all .15s",
            boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--green-hover)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(22,163,74,0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--green)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(22,163,74,0.3)";
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M5 8H2m0 0l2-2M2 8l2 2M11 8h3m0 0l-2-2m2 2l-2 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Compare
        </button>
        {/* Trash button */}
        <button
          onClick={() => setShowTrash((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            background: showTrash ? "#fff1f2" : "var(--bg)",
            border: `1.5px solid ${showTrash ? "#fecdd3" : "var(--border)"}`,
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            color: showTrash ? "#be123c" : "var(--text-2)",
            cursor: "pointer",
            transition: "all .15s",
            position: "relative",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Trash
          {trashItems.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "#ef4444",
                color: "white",
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 10,
                padding: "1px 5px",
                lineHeight: 1.4,
              }}
            >
              {trashItems.length}
            </span>
          )}
        </button>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setTeamOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              background: "var(--bg)",
              border: "1.5px solid var(--border)",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--blue)",
                display: "inline-block",
              }}
            />
            {activeTeam?.name}
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 4.5L6 8L9.5 4.5"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          {teamOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "#fff",
                border: "1.5px solid var(--border)",
                borderRadius: 9,
                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                zIndex: 200,
                minWidth: 180,
                padding: 6,
              }}
            >
              {teams.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    onSwitchTeam(t.id);
                    setTeamOpen(false);
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: t.id === activeTeamId ? 700 : 500,
                    color:
                      t.id === activeTeamId ? "var(--blue)" : "var(--text)",
                    background:
                      t.id === activeTeamId
                        ? "var(--blue-light)"
                        : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (t.id !== activeTeamId)
                      e.currentTarget.style.background = "var(--bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      t.id === activeTeamId
                        ? "var(--blue-light)"
                        : "transparent";
                  }}
                >
                  {t.id === activeTeamId ? "✓ " : ""}
                  {t.name}
                </div>
              ))}
              <div
                style={{
                  height: 1,
                  background: "var(--border)",
                  margin: "5px 0",
                }}
              />
              <button
                onClick={() => {
                  onAddTeam();
                  setTeamOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  background: "transparent",
                  border: "none",
                  color: "var(--blue)",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "background .1s",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--blue-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                + Add Team
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px 40px" }}>
        {showTrash ? (
          <>
            <div
              style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={() => setShowTrash(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-3)",
                    cursor: "pointer",
                    fontSize: 13,
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M10 3L5 8l5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Back
                </button>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "var(--text)",
                  }}
                >
                  Removed
                </h2>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {trashItems.length} item
                  {trashItems.length !== 1 ? "s" : ""}
                </span>
              </div>
              {trashItems.length > 0 && (
                <button
                  onClick={onDeleteAllTrash}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#be123c",
                    background: "#fff1f2",
                    border: "1.5px solid #fecdd3",
                    borderRadius: 7,
                    cursor: "pointer",
                  }}
                >
                  Delete All
                </button>
              )}
            </div>
            {trashItems.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 0",
                  color: "var(--text-3)",
                  fontSize: 13,
                }}
              >
                Trash is empty
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
                  gap: 14,
                }}
              >
                {trashItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "#fff",
                      borderRadius: 10,
                      border: "1.5px solid #fecdd3",
                      overflow: "hidden",
                      opacity: 0.85,
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 16px 10px",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text)",
                          marginBottom: 2,
                        }}
                      >
                        {item.name || fmt(item.plotStart) || "Untitled"}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-3)",
                          fontFamily: "DM Mono,monospace",
                        }}
                      >
                        Removed {fmt(item.trashedAt || today())}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "10px 16px 14px",
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <button
                        onClick={() => onRestoreTrash(item.id)}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--green)",
                          background: "var(--green-light)",
                          border: "1.5px solid var(--green-mid)",
                          borderRadius: 7,
                          cursor: "pointer",
                        }}
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => onDeleteForever(item.id)}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#be123c",
                          background: "#fff1f2",
                          border: "1.5px solid #fecdd3",
                          borderRadius: 7,
                          cursor: "pointer",
                        }}
                      >
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div
              style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "var(--text)",
                  flex: 1,
                }}
              >
                Your Timelines
              </h2>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                {cards.length} timeline{cards.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
                gap: 16,
              }}
            >
              {/* + New Timeline card */}
              <div
                onClick={onNewTimeline}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: "2px dashed #cbd5e1",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 220,
                  gap: 10,
                  transition: "border-color .15s,background .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--blue)";
                  e.currentTarget.style.background = "var(--blue-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.background = "#fff";
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 3v10M3 8h10"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text-2)",
                    }}
                  >
                    New Timeline
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      marginTop: 2,
                    }}
                  >
                    Start a new reporting period
                  </div>
                </div>
              </div>

              {cards.map((card) => {
                const totalProjects = Object.keys(card.tasks).filter((pid) =>
                  Object.values(card.tasks[pid]?.priorityHours || {}).some(
                    (h) => Number(h) > 0,
                  ),
                ).length;
                const isRenaming = renamingId === card.id;
                return (
                  <div
                    key={card.id}
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      border: "1.5px solid var(--border)",
                      overflow: "hidden",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      display: "flex",
                      flexDirection: "column",
                      transition: "box-shadow .15s,transform .15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow =
                        "0 4px 20px rgba(0,0,0,0.10)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow =
                        "0 1px 4px rgba(0,0,0,0.04)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* Clickable body */}
                    <div
                      style={{ flex: 1, cursor: "pointer" }}
                      onClick={() => !isRenaming && onOpen(card.id)}
                    >
                      <div
                        style={{
                          padding: "14px 16px 10px",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        {isRenaming ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            <input
                              autoFocus
                              value={renameVal}
                              onChange={(e) => setRenameVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  onRename(
                                    card.id,
                                    renameVal.trim() || card.label,
                                  );
                                  setRenamingId(null);
                                }
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              style={{
                                flex: 1,
                                padding: "4px 8px",
                                border: "1.5px solid var(--blue)",
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                fontFamily: "Plus Jakarta Sans,sans-serif",
                              }}
                            />
                            <button
                              onClick={() => {
                                onRename(
                                  card.id,
                                  renameVal.trim() || card.label,
                                );
                                setRenamingId(null);
                              }}
                              style={{
                                padding: "4px 10px",
                                background: "var(--blue)",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setRenamingId(null)}
                              style={{
                                padding: "4px 8px",
                                background: "transparent",
                                color: "var(--text-3)",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "var(--text)",
                              marginBottom: 2,
                            }}
                          >
                            {card.label}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-3)",
                            fontFamily: "DM Mono,monospace",
                            marginTop: isRenaming ? 8 : 0,
                          }}
                        >
                          Started {fmt(card.date)} · {totalProjects} project
                          {totalProjects !== 1 ? "s" : ""} with hours
                        </div>
                      </div>
                      <div style={{ padding: "10px 16px", minHeight: 58 }}>
                        {totalProjects > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 5,
                            }}
                          >
                            {projects
                              .slice(0, 4)
                              .map((p) => {
                                const t = card.tasks[p.id];
                                const totalH = Object.values(
                                  t?.priorityHours || {},
                                ).reduce((a, h) => a + Number(h), 0);
                                if (!totalH) return null;
                                return (
                                  <div
                                    key={p.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: "50%",
                                        background: p.color,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: "var(--text)",
                                        minWidth: 68,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {p.name}
                                    </span>
                                    <div
                                      style={{
                                        flex: 1,
                                        height: 5,
                                        background: "#f1f5f9",
                                        borderRadius: 3,
                                        overflow: "hidden",
                                        display: "flex",
                                      }}
                                    >
                                      {PRIORITIES.map((pr) => {
                                        const h = WT_BASE.reduce(
                                          (a, wt) =>
                                            a +
                                            (Number(
                                              t?.priorityHours?.[
                                                `${pr.id}_${wt.id}`
                                              ],
                                            ) || 0),
                                          0,
                                        );
                                        if (!h) return null;
                                        return (
                                          <div
                                            key={pr.id}
                                            style={{
                                              height: "100%",
                                              background:
                                                pColors[pr.id] || pr.color,
                                              flex: h,
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 9,
                                        color: "var(--text-3)",
                                        fontFamily: "DM Mono,monospace",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {roundDays(totalH)}d
                                    </span>
                                  </div>
                                );
                              })
                              .filter(Boolean)}
                            {totalProjects > 4 && (
                              <div
                                style={{
                                  fontSize: 9,
                                  color: "var(--text-3)",
                                  paddingLeft: 15,
                                }}
                              >
                                +{totalProjects - 4} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-3)",
                              textAlign: "center",
                              paddingTop: 8,
                            }}
                          >
                            No hours plotted yet
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons — always at bottom */}
                    <div
                      style={{
                        padding: "10px 16px 14px",
                        display: "flex",
                        gap: 7,
                        borderTop: "1px solid #f1f5f9",
                        flexShrink: 0,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setRenamingId(card.id);
                          setRenameVal(card.label);
                        }}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-2)",
                          background: "#f8fafc",
                          border: "1.5px solid var(--border)",
                          borderRadius: 7,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f1f5f9")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "#f8fafc")
                        }
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => onRemove(card.id)}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#be123c",
                          background: "#fff1f2",
                          border: "1.5px solid #fecdd3",
                          borderRadius: 7,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#ffe4e6")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "#fff1f2")
                        }
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Header({
  teams,
  activeTeamId,
  onSwitchTeam,
  onAddTeam,
  onEditTeam,
  onSave,
  isDirty,
  onCompare,
  onSettings,
  plotStart,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  isViewingArchive,
  onClearTimeline,
  onGoHome,
}) {
  const [teamOpen, setTeamOpen] = useState(false);
  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];
  const ref = useRef(null);
  useEffect(() => {
    function hd(e) {
      if (ref.current && !ref.current.contains(e.target)) setTeamOpen(false);
    }
    document.addEventListener("mousedown", hd);
    return () => document.removeEventListener("mousedown", hd);
  }, []);
  return (
    <div
      style={{
        background: "#ffffff",
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 18px",
        flexShrink: 0,
      }}
    >
      {/* Team selector */}
      <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setTeamOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: teamOpen ? "var(--blue-light)" : "var(--bg)",
            border: "1.5px solid",
            borderColor: teamOpen ? "#93c5fd" : "var(--border)",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            color: teamOpen ? "var(--blue)" : "var(--text)",
            transition: "all .15s",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--blue)",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          {activeTeam?.name}
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              transform: teamOpen ? "rotate(180deg)" : "rotate(0)",
              transition: "transform .15s",
              color: "#94a3b8",
            }}
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {teamOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              background: "#fff",
              border: "1.5px solid var(--border)",
              borderRadius: 9,
              boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
              zIndex: 200,
              minWidth: 210,
              padding: 6,
            }}
          >
            {teams.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background:
                    t.id === activeTeamId ? "var(--blue-light)" : "transparent",
                  transition: "background .1s",
                }}
                onMouseEnter={(e) => {
                  if (t.id !== activeTeamId)
                    e.currentTarget.style.background = "var(--bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    t.id === activeTeamId ? "var(--blue-light)" : "transparent";
                }}
              >
                <span
                  onClick={() => {
                    onSwitchTeam(t.id);
                    setTeamOpen(false);
                  }}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: t.id === activeTeamId ? 700 : 500,
                    color:
                      t.id === activeTeamId ? "var(--blue)" : "var(--text)",
                  }}
                >
                  {t.id === activeTeamId && (
                    <span style={{ marginRight: 4 }}>✓</span>
                  )}
                  {t.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTeam(t.id);
                    setTeamOpen(false);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-3)",
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 600,
                    transition: "all .1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f1f5f9";
                    e.currentTarget.style.color = "var(--text)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-3)";
                  }}
                >
                  Edit
                </button>
              </div>
            ))}
            <div
              style={{
                height: 1,
                background: "var(--border)",
                margin: "5px 0",
              }}
            />
            <button
              onClick={() => {
                onAddTeam();
                setTeamOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                padding: "7px 10px",
                background: "transparent",
                border: "none",
                color: "var(--blue)",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                cursor: "pointer",
                transition: "background .1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--blue-light)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              + Add New Team
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Timeline controls: Undo / Redo */}
      <HBtn onClick={onUndo} ghost disabled={!canUndo} title="Undo (Ctrl+Z)">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path
            d="M3.5 5.5H9a4 4 0 010 8H5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M3.5 2.5L1 5.5l2.5 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Undo
      </HBtn>
      <HBtn onClick={onRedo} ghost disabled={!canRedo} title="Redo (Ctrl+Y)">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path
            d="M12.5 5.5H7a4 4 0 000 8h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M12.5 2.5L15 5.5l-2.5 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Redo
      </HBtn>

      <div
        style={{
          width: 1,
          height: 22,
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      <HBtn onClick={onCompare} ghost>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path
            d="M5 8H2m0 0l2-2M2 8l2 2M11 8h3m0 0l-2-2m2 2l-2 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Compare
      </HBtn>
      <HBtn onClick={onSettings} ghost icon title="Settings">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          />
        </svg>
      </HBtn>

      <div
        style={{
          width: 1,
          height: 22,
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      {!isViewingArchive && onClearTimeline && (
        <HBtn
          onClick={onClearTimeline}
          ghost
          title="Clear all plotted hours for current timeline"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Clear all
        </HBtn>
      )}

      {!isViewingArchive && onSave && (
        <HBtn
          onClick={onSave}
          green={isDirty}
          ghost={!isDirty}
          disabled={!isDirty}
          title={isDirty ? "Save timeline" : "No unsaved changes"}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 2h9l3 3v9H2V2z"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path d="M5 2v4h6V2" stroke="currentColor" strokeWidth="1.4" />
            <rect
              x="4"
              y="9"
              width="8"
              height="5"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
          Save
        </HBtn>
      )}
    </div>
  );
}

function HBtn({
  children,
  onClick,
  ghost,
  blue,
  green,
  amber,
  icon,
  disabled,
  title,
}) {
  const [h, setH] = useState(false);
  let bg = "var(--bg)",
    tc = "var(--text-2)",
    border = "var(--border)";
  if (ghost) {
    bg = h ? "#f1f5f9" : "transparent";
    border = "transparent";
    tc = h ? "var(--text)" : "var(--text-2)";
  }
  if (icon) {
    bg = h ? "#f1f5f9" : "transparent";
    border = "transparent";
    tc = h ? "var(--text)" : "var(--text-3)";
  }
  if (blue) {
    bg = h ? "var(--blue-hover)" : "var(--blue)";
    tc = "white";
    border = "transparent";
  }
  if (green) {
    bg = h ? "var(--green-hover)" : "var(--green)";
    tc = "white";
    border = "transparent";
  }
  if (amber) {
    bg = h ? "#b45309" : "#d97706";
    tc = "white";
    border = "transparent";
  }
  if (disabled) {
    bg = "transparent";
    tc = "#cbd5e1";
    border = "transparent";
  }
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      onMouseEnter={() => !disabled && setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: icon ? "6px" : "5px 11px",
        background: bg,
        color: tc,
        border: `1.5px solid ${border}`,
        borderRadius: 7,
        fontSize: 11.5,
        fontWeight: 600,
        flexShrink: 0,
        transition: "all .15s",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   TIMELINE GRID
══════════════════════════════════════════════════════════ */
function TimelineGrid({
  projects,
  displayDates,
  byMonth,
  plots,
  settings,
  onEditProject,
  onEditProjectInfo,
  onAddProject,
  onDelNote,
  onNoteClick,
  setTooltip,
  cellZoom = 34,
}) {
  const CW = cellZoom,
    PW = 178,
    MW = 128,
    RH = 38;

  function specialBg(d) {
    const t = dayType(d, settings);
    if (t === "weekend") return "var(--wknd-bg)";
    if (t === "alignment") return "var(--align-bg)";
    if (t === "holiday") return "var(--holiday-bg)";
    return null;
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: PW, minWidth: PW }} />
          <col style={{ width: MW, minWidth: MW }} />
          {displayDates.map((d) => (
            <col key={d} style={{ width: CW, minWidth: CW }} />
          ))}
        </colgroup>
        <thead>
          {/* Month row */}
          <tr style={{ height: 20 }}>
            <th
              style={{
                ...sTH(0, 0),
                background: "#fff",
                borderBottom: "1px solid var(--border)",
                borderRight: "1px solid var(--border)",
                zIndex: 21,
                padding: "0 14px",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                Project
              </span>
            </th>
            <th
              style={{
                ...sTH(PW, 0),
                background: "#fff",
                borderBottom: "1px solid var(--border)",
                borderRight: "1px solid var(--border)",
                zIndex: 20,
                padding: "0 10px",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                Members
              </span>
            </th>
            {byMonth.map((g) => (
              <th
                key={g.month}
                colSpan={g.dates.length}
                style={{
                  background: "#fff",
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                  padding: "0",
                  borderBottom: "1px solid var(--border)",
                  borderRight: "1px solid var(--border)",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--text-2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontFamily: "DM Mono,monospace",
                  }}
                >
                  {MON_S[parseInt(g.month.split("-")[1]) - 1]}{" "}
                  {g.month.split("-")[0]}
                </span>
              </th>
            ))}
          </tr>
          {/* Day row */}
          <tr style={{ height: 24 }}>
            <th
              style={{
                ...sTH(0, 20),
                background: "#f8fafc",
                borderBottom: "2px solid var(--border)",
                borderRight: "1px solid var(--border)",
                zIndex: 21,
              }}
            />
            <th
              style={{
                ...sTH(PW, 20),
                background: "#f8fafc",
                borderBottom: "2px solid var(--border)",
                borderRight: "1px solid var(--border)",
                zIndex: 20,
              }}
            />
            {displayDates.map((d) => {
              const t = dayType(d, settings);
              const dn = parseInt(d.split("-")[2]);
              const dow = pd(d).getDay();
              const isToday = d === today();
              const isSpecial = t !== "work";
              return (
                <th
                  key={d}
                  style={{
                    background: "#f8fafc",
                    position: "sticky",
                    top: 20,
                    zIndex: 5,
                    borderBottom: "2px solid var(--border)",
                    borderRight: "1px solid #edf2f7",
                    textAlign: "center",
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      gap: 1,
                    }}
                  >
                    {CW >= 20 && (
                      <span
                        style={{
                          fontSize: 7,
                          fontFamily: "DM Mono,monospace",
                          color: isSpecial ? "#94a3b8" : "#b0bec5",
                          lineHeight: 1,
                        }}
                      >
                        {DOW_S[dow][0]}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: CW < 20 ? 8 : 10,
                        fontWeight: isToday ? 800 : 400,
                        color: isToday ? "var(--blue)" : "#64748b",
                        fontFamily: "DM Mono,monospace",
                        position: "relative",
                        lineHeight: 1,
                      }}
                    >
                      {dn}
                      {isToday && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: -2,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 3,
                            height: 2,
                            background: "var(--blue)",
                            borderRadius: 1,
                          }}
                        />
                      )}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td
                colSpan={2 + displayDates.length}
                style={{ padding: "3rem", textAlign: "center", color: "#999" }}
              >
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 500,
                    marginBottom: "0.5rem",
                  }}
                >
                  No projects yet
                </div>
                <div style={{ fontSize: "0.95rem", color: "#aaa" }}>
                  Click "+ Add Project" above to get started
                </div>
              </td>
            </tr>
          ) : (
            projects.map((p) => {
              const plot = plots[p.id];
              const mems = toArr(p.members);
              const activeWts = plot.priSummary || [];

              return (
                <Fragment key={p.id}>
                  {/* Separator */}
                  <tr style={{ height: 4 }}>
                    <td
                      style={{
                        ...sTD(0),
                        background: "#fff",
                        border: "none",
                        borderRight: "1px solid var(--border)",
                      }}
                    />
                    <td
                      style={{
                        ...sTD(PW),
                        background: "#fff",
                        border: "none",
                        borderRight: "1px solid var(--border)",
                      }}
                    />
                    {displayDates.map((d) => (
                      <td
                        key={d}
                        style={{
                          padding: 0,
                          border: "none",
                          borderTop: "1.5px solid #c8d3e0",
                          background: "transparent",
                        }}
                      />
                    ))}
                  </tr>

                  <tr style={{ height: RH }}>
                    {/* Project name + priority summary */}
                    <td
                      style={{
                        ...sTD(0),
                        background: "#fff",
                        borderRight: "1px solid var(--border)",
                        borderBottom: "none",
                        padding: "0 8px 0 10px",
                        verticalAlign: "middle",
                        zIndex: 11,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            width: 3,
                            height: 22,
                            borderRadius: 2,
                            background: p.color,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--text)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: 1.3,
                            }}
                          >
                            {p.name}
                          </div>
                          {activeWts.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                                marginTop: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "var(--text-2)",
                                  fontFamily: "DM Mono,monospace",
                                }}
                              >
                                {plot.totalD}d total
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 4,
                                }}
                              >
                                {activeWts.map((pr, i) => (
                                  <span
                                    key={pr.id}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 2,
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      color: pr.color,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: "50%",
                                        background: pr.color,
                                        flexShrink: 0,
                                        display: "inline-block",
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontFamily: "DM Mono,monospace",
                                      }}
                                    >
                                      {pr.totalD}d
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProject(p.id);
                            }}
                            title="Plot hours"
                            style={{
                              width: 19,
                              height: 19,
                              borderRadius: 5,
                              background: "var(--blue)",
                              border: "none",
                              color: "white",
                              fontSize: 14,
                              fontWeight: 700,
                              lineHeight: "18px",
                              textAlign: "center",
                              cursor: "pointer",
                              opacity: 0.8,
                              transition: "all .15s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.opacity = "1")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.opacity = ".8")
                            }
                          >
                            +
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProjectInfo(p.id);
                            }}
                            title="Edit project"
                            style={{
                              width: 19,
                              height: 19,
                              borderRadius: 5,
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              color: "var(--text-2)",
                              cursor: "pointer",
                              opacity: 0.8,
                              transition: "all .15s",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = "1";
                              e.currentTarget.style.background = "#e2e8f0";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = ".8";
                              e.currentTarget.style.background = "#f1f5f9";
                            }}
                          >
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Members */}
                    <td
                      style={{
                        ...sTD(PW),
                        background: "#fff",
                        borderRight: "1px solid var(--border)",
                        borderBottom: "none",
                        padding: "5px 9px",
                        verticalAlign: "top",
                        zIndex: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 2,
                          paddingTop: 1,
                        }}
                      >
                        {mems.map((m, i) => (
                          <span
                            key={i}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              background: "#f1f5f9",
                              borderRadius: 4,
                              padding: "1px 6px",
                              fontSize: 9,
                              fontWeight: 600,
                              color: "#64748b",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Calendar cells — partial-day segments */}
                    {displayDates.map((d) => {
                      const sb = specialBg(d);
                      const segments = plot.segMap.get(d) || [];
                      const dayNotes = plot.noteDateMap[d] || [];
                      const isNoteStart = dayNotes.some(
                        (n) => n.startDate === d,
                      );
                      const anyPlotted = segments.length > 0;
                      const isPlotStart = d === plot.plotStart && anyPlotted;

                      return (
                        <td
                          key={d}
                          style={{
                            height: RH,
                            padding: 0,
                            background: sb || "transparent",
                            borderRight: "1px solid #edf2f7",
                            borderBottom: "none",
                            position: "relative",
                            overflow: isNoteStart ? "visible" : "hidden",
                          }}
                        >
                          {isPlotStart && (
                            <div
                              style={{
                                position: "absolute",
                                top: 2,
                                left: 0,
                                width: 2,
                                bottom: 2,
                                background: "rgba(0,0,0,0.22)",
                                borderRadius: 1,
                                zIndex: 6,
                              }}
                            />
                          )}

                          {/* Partial-day segments */}
                          {segments.map((seg, si) => {
                            const lPct = seg.startFrac * 100;
                            const wPct = (seg.endFrac - seg.startFrac) * 100;
                            const isSegFirst = si === 0 && seg.startFrac < 0.01;
                            return (
                              <div
                                key={si}
                                style={{
                                  position: "absolute",
                                  left: `${lPct}%`,
                                  width: `${wPct}%`,
                                  top: 3,
                                  bottom: 3,
                                  background: seg.color,
                                  zIndex: 2,
                                  cursor: "pointer",
                                  borderRadius:
                                    seg.startFrac < 0.01 && seg.endFrac > 0.99
                                      ? 3
                                      : seg.startFrac < 0.01
                                        ? "3px 0 0 3px"
                                        : seg.endFrac > 0.99
                                          ? "0 3px 3px 0"
                                          : 0,
                                }}
                                onMouseEnter={(e) => {
                                  const r =
                                    e.currentTarget.getBoundingClientRect();
                                  setTooltip({
                                    x: r.left,
                                    y: r.top,
                                    lines: [
                                      p.name,
                                      seg.slotName,
                                      `${seg.segHours}h this day`,
                                      fmt(d),
                                    ],
                                  });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                onClick={() => onEditProject(p.id)}
                              >
                                {isSegFirst && CW >= 16 && (
                                  <span
                                    style={{
                                      position: "absolute",
                                      top: "50%",
                                      transform: "translateY(-50%)",
                                      left: 2,
                                      color: "rgba(255,255,255,0.95)",
                                      display: "flex",
                                      alignItems: "center",
                                      pointerEvents: "none",
                                    }}
                                  >
                                    <WtIcon
                                      wtId={seg.wtId}
                                      size={Math.min(RH - 8, 14)}
                                    />
                                  </span>
                                )}
                              </div>
                            );
                          })}

                          {/* Note-only placeholder */}
                          {dayNotes.length > 0 && !anyPlotted && (
                            <div
                              style={{
                                position: "absolute",
                                left: 1,
                                right: 1,
                                top: 3,
                                bottom: 3,
                                borderRadius: 3,
                                background: "rgba(99,102,241,0.13)",
                                border: "1px dashed rgba(99,102,241,0.4)",
                                zIndex: 1,
                              }}
                            />
                          )}

                          {/* Note label */}
                          {isNoteStart &&
                            dayNotes.map(
                              (n) =>
                                n.startDate === d && (
                                  <div
                                    key={n.id}
                                    style={{
                                      position: "absolute",
                                      top: 4,
                                      left: 3,
                                      zIndex: 10,
                                      whiteSpace: "nowrap",
                                      pointerEvents: "none",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 8.5,
                                        fontWeight: 700,
                                        color: anyPlotted ? "#fff" : "#4338ca",
                                        background: anyPlotted
                                          ? "rgba(0,0,0,0.32)"
                                          : "rgba(238,242,255,0.94)",
                                        padding: "1px 5px",
                                        borderRadius: 3,
                                        cursor: "pointer",
                                        pointerEvents: "all",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onNoteClick && onNoteClick(p.id, n);
                                      }}
                                    >
                                      📝 {n.text}
                                    </span>
                                  </div>
                                ),
                            )}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })
          )}

          {/* Bottom separator — calendar columns only */}
          <tr style={{ height: 3 }}>
            <td
              style={{
                ...sTD(0),
                background: "#fff",
                border: "none",
                borderRight: "1px solid var(--border)",
              }}
            />
            <td
              style={{
                ...sTD(PW),
                background: "#fff",
                border: "none",
                borderRight: "1px solid var(--border)",
              }}
            />
            {displayDates.map((d) => (
              <td
                key={d}
                style={{
                  padding: 0,
                  border: "none",
                  borderTop: "1.5px solid #c8d3e0",
                  background: "transparent",
                }}
              />
            ))}
          </tr>

          {/* Add Project row */}
          {onAddProject && (
            <tr>
              <td
                colSpan={2}
                style={{
                  ...sTD(0),
                  padding: "9px 12px",
                  background: "#fff",
                  borderRight: "1px solid var(--border)",
                  zIndex: 10,
                }}
              >
                <button
                  onClick={onAddProject}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    border: "1.5px dashed #cbd5e1",
                    borderRadius: 7,
                    padding: "6px 14px",
                    color: "#94a3b8",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    width: "100%",
                    justifyContent: "center",
                    transition: "all .15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--blue)";
                    e.currentTarget.style.color = "var(--blue)";
                    e.currentTarget.style.background = "var(--blue-light)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.color = "#94a3b8";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 3v10M3 8h10"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Add Project
                </button>
              </td>
              {displayDates.map((d) => (
                <td key={d} style={{ background: "transparent" }} />
              ))}
            </tr>
          )}
          <tr style={{ height: 32 }}>
            <td colSpan={displayDates.length + 2} style={{ border: "none" }} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function sTH(l, t) {
  return { position: "sticky", left: l, top: t, zIndex: 5 };
}
function sTD(l) {
  return { position: "sticky", left: l };
}

/* ══════════════════════════════════════════════════════════
   MODAL SHELL + FORM PRIMITIVES
══════════════════════════════════════════════════════════ */
function Modal({ title, sub, onClose, children, width = 460 }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width,
          maxWidth: "95vw",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            padding: "20px 22px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "var(--text)",
                lineHeight: 1.3,
              }}
            >
              {title}
            </h2>
            {sub && (
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  marginTop: 3,
                }}
              >
                {sub}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-3)",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              marginTop: -1,
              padding: "0 3px",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "20px 22px 22px" }}>{children}</div>
      </div>
    </div>
  );
}
function Fld({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
function Inp({
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  step,
  style = {},
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      step={step}
      style={{
        width: "100%",
        background: "#fff",
        border: "1.5px solid var(--border)",
        borderRadius: 7,
        padding: "8px 11px",
        color: "var(--text)",
        fontSize: 12,
        outline: "none",
        transition: "border-color .15s",
        ...style,
      }}
      onFocus={(e) => (e.target.style.borderColor = "var(--blue)")}
      onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
    />
  );
}
function Sel({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        background: "#fff",
        border: "1.5px solid var(--border)",
        borderRadius: 7,
        padding: "8px 11px",
        color: "var(--text)",
        fontSize: 12,
        outline: "none",
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
function Actions({ children, left }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        justifyContent: "flex-end",
        marginTop: 20,
        alignItems: "center",
      }}
    >
      {left && (
        <>
          <div>{left}</div>
          <div style={{ flex: 1 }} />
        </>
      )}
      {children}
    </div>
  );
}
function B({ children, onClick, v = "ghost", style = {}, disabled }) {
  const [h, setH] = useState(false);
  const V = {
    ghost: {
      bg: h ? "var(--bg)" : "transparent",
      tc: "var(--text-2)",
      bc: "var(--border)",
    },
    primary: {
      bg: h ? "var(--blue-hover)" : "var(--blue)",
      tc: "#fff",
      bc: "transparent",
    },
    success: {
      bg: h ? "var(--green-hover)" : "var(--green)",
      tc: "#fff",
      bc: "transparent",
    },
    danger: {
      bg: h ? "#9f1239" : "var(--red-text)",
      tc: "#fff",
      bc: "transparent",
    },
    amber: {
      bg: h ? "#b45309" : "#d97706",
      tc: "#fff",
      bc: "transparent",
    },
    subtle: {
      bg: h ? "var(--bg)" : "var(--surface2)",
      tc: "var(--text-2)",
      bc: "var(--border)",
    },
  };
  const s = V[v] || V.ghost;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        padding: "7px 14px",
        background: s.bg,
        color: s.tc,
        border: `1.5px solid ${s.bc}`,
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        transition: "all .15s",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
function Chip({ color, children, onRemove }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: color || "#f1f5f9",
        border: "1.5px solid var(--border)",
        color: "var(--text-2)",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        marginRight: 4,
        marginBottom: 4,
      }}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-3)",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
            padding: 0,
            marginLeft: 1,
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
function Alert({ children, type = "info" }) {
  const C = {
    info: { bg: "#eff6ff", bc: "#bfdbfe", ic: "ℹ️", tc: "#1e40af" },
    warn: { bg: "#fffbeb", bc: "#fde68a", ic: "⚠️", tc: "#92400e" },
    green: { bg: "#f0fdf4", bc: "#bbf7d0", ic: "✅", tc: "#15803d" },
  };
  const c = C[type] || C.info;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        background: c.bg,
        border: `1.5px solid ${c.bc}`,
        borderRadius: 8,
        padding: "10px 13px",
        fontSize: 11.5,
        color: c.tc,
        lineHeight: 1.6,
        marginBottom: 16,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>{c.ic}</span>
      <span>{children}</span>
    </div>
  );
}
function Tabs({ tabs, active, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "2px solid var(--border)",
        marginBottom: 18,
      }}
    >
      {tabs.map(([k, l]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          style={{
            padding: "8px 14px",
            background: "transparent",
            border: "none",
            borderBottom:
              active === k ? "2px solid var(--blue)" : "2px solid transparent",
            color: active === k ? "var(--blue)" : "var(--text-2)",
            fontSize: 12,
            fontWeight: active === k ? 700 : 500,
            cursor: "pointer",
            marginBottom: -2,
            transition: "all .15s",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
function StatBox({ label, value, color }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1.5px solid var(--border)",
        borderRadius: 8,
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: color || "var(--text)",
          fontFamily: "DM Mono,monospace",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
function MembersInput({ members, onChange }) {
  const [inp, setInp] = useState("");
  const arr = toArr(members);
  function add() {
    const v = inp.trim().toUpperCase();
    if (v && !arr.includes(v)) onChange([...arr, v]);
    setInp("");
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
        <Inp
          value={inp}
          onChange={setInp}
          placeholder="Type name then click Add"
          style={{ flex: 1 }}
        />
        <B v="subtle" onClick={add}>
          Add
        </B>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", minHeight: 28 }}>
        {arr.map((m, i) => (
          <Chip
            key={i}
            onRemove={() => onChange(arr.filter((_, j) => j !== i))}
          >
            {m}
          </Chip>
        ))}
        {!arr.length && (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            No members added yet
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MODALS
══════════════════════════════════════════════════════════ */
function AddProjectModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [color, setColor] = useState("#3b82f6");
  return (
    <Modal title="Add New Project" onClose={onClose}>
      <Fld label="Project Name">
        <Inp value={name} onChange={setName} placeholder="e.g. HRIS" />
      </Fld>
      <Fld label="Members">
        <MembersInput members={members} onChange={setMembers} />
      </Fld>
      <Fld label="Timeline Color">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: 38,
              height: 34,
              border: "1.5px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              padding: 2,
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              fontFamily: "DM Mono,monospace",
            }}
          >
            {color}
          </span>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: color,
              flexShrink: 0,
              boxShadow: `0 2px 8px ${color}60`,
            }}
          />
        </div>
      </Fld>
      <Actions>
        <B onClick={onClose}>Cancel</B>
        <B
          v="primary"
          onClick={() => {
            if (name.trim()) onSave({ name: name.trim(), members, color });
          }}
        >
          Add Project
        </B>
      </Actions>
    </Modal>
  );
}

/* ── SUBTASK LIST (editable) ── */
function SubList({ subs, onChange }) {
  const [editId, setEditId] = useState(null);
  const [eTitle, setETitle] = useState("");
  const [eHours, setEHours] = useState("");
  const [eColor, setEColor] = useState("#22c55e");
  const [eDateStart, setEDateStart] = useState("");
  const [eDateEnd, setEDateEnd] = useState("");
  const [eUseDates, setEUseDates] = useState(false);

  function startEdit(s) {
    setEditId(s.id);
    setETitle(s.title);
    setEColor(s.color);
    if (s.dateStart) {
      setEUseDates(true);
      setEDateStart(s.dateStart);
      setEDateEnd(s.dateEnd);
      setEHours("");
    } else {
      setEUseDates(false);
      setEHours(s.hours || "");
      setEDateStart("");
      setEDateEnd("");
    }
  }
  function saveEdit(id) {
    onChange(
      subs.map((s) =>
        s.id !== id
          ? s
          : eUseDates
            ? {
                ...s,
                title: eTitle,
                color: eColor,
                dateStart: eDateStart,
                dateEnd: eDateEnd,
                hours: null,
              }
            : {
                ...s,
                title: eTitle,
                color: eColor,
                hours: Number(eHours) || 0,
                dateStart: null,
                dateEnd: null,
              },
      ),
    );
    setEditId(null);
  }
  return (
    <div
      style={{
        marginBottom: 14,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {subs.map((s) => (
        <div
          key={s.id}
          style={{
            background: "var(--bg)",
            borderRadius: 8,
            border: "1.5px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {editId === s.id ? (
            <div style={{ padding: "10px 12px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Fld label="Title">
                  <Inp value={eTitle} onChange={setETitle} />
                </Fld>
                <Fld label="Color">
                  <input
                    type="color"
                    value={eColor}
                    onChange={(e) => setEColor(e.target.value)}
                    style={{
                      width: 34,
                      height: 34,
                      border: "1.5px solid var(--border)",
                      borderRadius: 5,
                      cursor: "pointer",
                      padding: 2,
                    }}
                  />
                </Fld>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 8,
                  padding: "5px 8px",
                  background: "white",
                  borderRadius: 5,
                  border: "1px solid var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={eUseDates}
                  onChange={(e) => setEUseDates(e.target.checked)}
                  style={{
                    accentColor: "var(--blue)",
                    width: 12,
                    height: 12,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-2)",
                    fontWeight: 500,
                  }}
                >
                  Use date range
                </span>
              </div>
              {eUseDates ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <Fld label="Start">
                    <Inp
                      type="date"
                      value={eDateStart}
                      onChange={setEDateStart}
                    />
                  </Fld>
                  <Fld label="End">
                    <Inp type="date" value={eDateEnd} onChange={setEDateEnd} />
                  </Fld>
                </div>
              ) : (
                <Fld label="Working Hours">
                  <Inp
                    type="number"
                    value={eHours}
                    onChange={setEHours}
                    placeholder="e.g. 16"
                    min="0"
                    step="0.5"
                  />
                </Fld>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <B
                  v="primary"
                  onClick={() => saveEdit(s.id)}
                  style={{ fontSize: 11, padding: "4px 12px" }}
                >
                  Save
                </B>
                <B
                  onClick={() => setEditId(null)}
                  style={{ fontSize: 11, padding: "4px 10px" }}
                >
                  Cancel
                </B>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: s.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-3)",
                    fontFamily: "DM Mono,monospace",
                    marginTop: 1,
                  }}
                >
                  {s.dateStart
                    ? `${fmt(s.dateStart)} → ${fmt(s.dateEnd)}`
                    : `${s.hours}h → ${cd8(s.hours)}d`}
                </div>
              </div>
              <button
                onClick={() => startEdit(s)}
                title="Edit"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  padding: "2px 5px",
                  borderRadius: 4,
                  transition: "all .1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-3)";
                }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={() => onChange(subs.filter((x) => x.id !== s.id))}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: "0 2px",
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── NOTE LIST (editable) ── */
function NoteList({ notes, onDelete, onEdit }) {
  const [editId, setEditId] = useState(null);
  const [eText, setEText] = useState("");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  return (
    <div
      style={{
        marginBottom: 14,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {notes.map((n) => (
        <div
          key={n.id}
          style={{
            background: "#eef2ff",
            border: "1.5px solid #c7d2fe",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {editId === n.id ? (
            <div style={{ padding: "10px 12px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Fld label="Start Date">
                  <Inp type="date" value={eStart} onChange={setEStart} />
                </Fld>
                <Fld label="End Date">
                  <Inp type="date" value={eEnd} onChange={setEEnd} />
                </Fld>
              </div>
              <Fld label="Note Text">
                <Inp value={eText} onChange={setEText} />
              </Fld>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <B
                  v="primary"
                  onClick={() => {
                    onEdit &&
                      onEdit({
                        ...n,
                        text: eText,
                        startDate: eStart,
                        endDate: eEnd,
                      });
                    setEditId(null);
                  }}
                  style={{ fontSize: 11, padding: "4px 12px" }}
                >
                  Save
                </B>
                <B
                  onClick={() => setEditId(null)}
                  style={{ fontSize: 11, padding: "4px 10px" }}
                >
                  Cancel
                </B>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#4338ca",
                  }}
                >
                  {n.text}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#6366f1",
                    fontFamily: "DM Mono,monospace",
                    marginTop: 2,
                  }}
                >
                  {fmt(n.startDate)} → {fmt(n.endDate)}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditId(n.id);
                  setEText(n.text);
                  setEStart(n.startDate);
                  setEEnd(n.endDate);
                }}
                title="Edit"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#818cf8",
                  cursor: "pointer",
                  padding: "2px 5px",
                  borderRadius: 4,
                  transition: "all .1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(99,102,241,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={() => onDelete(n.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#818cf8",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── PLOT MODAL (+ button) ── */
/* ── PLOT MODAL (+ button) ── */
// Draft cache so data persists even if modal is closed and reopened
const _plotDrafts = {};

function PlotModal({
  project,
  task,
  globalStart,
  settings,
  onClose,
  onSave,
  onAddNote,
  onDelNote,
  onEditNote,
}) {
  const existing = task.priorityHours || {};
  const pColors = settings.priorityColors || {
    hp: "#ef4444",
    mp: "#f97316",
    lp: "#3b82f6",
  };
  const dynPriorities = PRIORITIES.map((p) => ({
    ...p,
    color: pColors[p.id] || p.color,
  }));
  const dynSlots = dynPriorities.flatMap((p) =>
    WT_BASE.map((wt) => ({
      id: `${p.id}_${wt.id}`,
      pId: p.id,
      wtId: wt.id,
      name: `${p.name} – ${wt.name}`,
      color: p.color,
      order: p.order * 3 + wt.order,
    })),
  );

  // Load from draft cache (persists across open/close), fallback to saved data
  const draftKey = project.id;
  const initPh = () => {
    const draft = _plotDrafts[draftKey];
    const o = {};
    dynSlots.forEach((s) => {
      o[s.id] = draft ? (draft.ph[s.id] ?? "") : existing[s.id] || "";
    });
    return o;
  };
  const [ph, setPh] = useState(initPh);
  const [plotStart, setPlotStart] = useState(
    () => _plotDrafts[draftKey]?.plotStart || task.plotStart || globalStart,
  );
  const [tab, setTab] = useState("plot");
  const [nS, setNS] = useState(plotStart);
  const [nE, setNE] = useState(addD(plotStart, 4));
  const [nT, setNT] = useState("");
  const notes = task.notes || [];

  // Keep draft cache in sync
  useEffect(() => {
    _plotDrafts[draftKey] = { ph, plotStart };
  }, [ph, plotStart]);

  function addNote() {
    if (!nT.trim()) return;
    onAddNote({ startDate: nS, endDate: nE, text: nT.trim() });
    setNT("");
  }
  const activeSlots = dynSlots
    .filter((s) => Number(ph[s.id]) > 0)
    .map((s) => ({ ...s, hours: Number(ph[s.id]) }));
  const totalH = activeSlots.reduce((acc, s) => acc + s.hours, 0);
  const previewMap =
    activeSlots.length > 0
      ? plotPartialDays(activeSlots, plotStart, settings)
      : new Map();
  const totalD =
    previewMap.size > 0
      ? [...previewMap.keys()].filter((d) => dayType(d, settings) === "work")
          .length
      : 0;
  const endDate = previewMap.size ? [...previewMap.keys()].sort().pop() : null;

  return (
    <Modal
      title={project.name}
      sub="Plot hours by priority and work type"
      onClose={onClose}
      width={560}
    >
      <Tabs
        tabs={[
          ["plot", "📊 Hours by Priority"],
          ["notes", "📝 Notes"],
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "plot" && (
        <>
          <Fld label="Plot Start Date">
            <Inp
              type="date"
              value={plotStart}
              onChange={(v) => {
                setPlotStart(v);
                setNS(v);
                setNE(addD(v, 4));
              }}
            />
          </Fld>
          {dynPriorities.map((pri) => (
            <div
              key={pri.id}
              style={{
                marginBottom: 12,
                borderRadius: 9,
                border: `1.5px solid ${pri.color}30`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: `${pri.color}12`,
                  padding: "7px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: pri.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: pri.color,
                  }}
                >
                  {pri.name}
                </span>
                {WT_BASE.some(
                  (wt) => Number(ph[`${pri.id}_${wt.id}`]) || 0,
                ) && (
                  <span
                    style={{
                      fontSize: 9,
                      color: pri.color,
                      fontFamily: "DM Mono,monospace",
                      marginLeft: "auto",
                    }}
                  >
                    {roundDays(
                      WT_BASE.reduce(
                        (acc, wt) =>
                          acc + (Number(ph[`${pri.id}_${wt.id}`]) || 0),
                        0,
                      ),
                    )}
                    d
                  </span>
                )}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  background: "#fff",
                }}
              >
                {WT_BASE.map((wt) => {
                  const slotId = `${pri.id}_${wt.id}`;
                  return (
                    <div
                      key={slotId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          minWidth: 128,
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--text-2)",
                        }}
                      >
                        <span style={{ color: pri.color, display: "flex" }}>
                          <WtIcon wtId={wt.id} size={14} />
                        </span>
                        {wt.name}
                      </span>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          value={ph[slotId]}
                          onChange={(e) =>
                            setPh((p) => ({
                              ...p,
                              [slotId]: e.target.value,
                            }))
                          }
                          min="0"
                          step="0.5"
                          placeholder="0h"
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            border: "1.5px solid var(--border)",
                            borderRadius: 7,
                            fontSize: 13,
                            fontFamily: "DM Mono,monospace",
                            MozAppearance: "textfield",
                            WebkitAppearance: "none",
                          }}
                          onWheel={(e) => e.preventDefault()}
                        />
                      </div>
                      {Number(ph[slotId]) > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: pri.color,
                            fontFamily: "DM Mono,monospace",
                            flexShrink: 0,
                            minWidth: 32,
                          }}
                        >
                          {roundDays(Number(ph[slotId]))}d
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {totalH > 0 && (
            <div
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text)",
                    fontFamily: "DM Mono,monospace",
                  }}
                >
                  {totalH}h → {totalD}d total
                </span>
                {endDate && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-2)",
                      fontFamily: "DM Mono,monospace",
                    }}
                  >
                    ends {fmt(endDate)}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  marginTop: 4,
                }}
              >
                Queue: High-Bug → High-NF → High-Enh → Medium … → Low-Enh
              </div>
            </div>
          )}
          <Actions>
            <B onClick={onClose}>Cancel</B>
            <B
              v="primary"
              onClick={() => {
                const out = {};
                dynSlots.forEach((s) => {
                  const v = Number(ph[s.id]) || 0;
                  if (v > 0) out[s.id] = v;
                });
                onSave(out, plotStart);
              }}
            >
              Save Changes
            </B>
          </Actions>
        </>
      )}
      {tab === "notes" && (
        <>
          {notes.length > 0 && (
            <NoteList notes={notes} onDelete={onDelNote} onEdit={onEditNote} />
          )}
          {!notes.length && (
            <div
              style={{
                textAlign: "center",
                padding: "14px 0",
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              No notes yet
            </div>
          )}
          <div
            style={{
              border: "1.5px dashed var(--border-strong)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 10,
              }}
            >
              + Add Note
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <Fld label="Start Date">
                <Inp type="date" value={nS} onChange={setNS} />
              </Fld>
              <Fld label="End Date">
                <Inp type="date" value={nE} onChange={setNE} />
              </Fld>
            </div>
            <Fld label="Note Text">
              <Inp
                value={nT}
                onChange={setNT}
                placeholder="e.g. UAT review period..."
              />
            </Fld>
            <B v="subtle" onClick={addNote}>
              + Add Note
            </B>
          </div>
          <Actions>
            <B onClick={onClose}>Close</B>
          </Actions>
        </>
      )}
    </Modal>
  );
}

function EditProjectModal({ project, onClose, onEditProject, onDelProject }) {
  const [pName, setPName] = useState(project.name);
  const [pMems, setPMems] = useState(toArr(project.members));
  const [pColor, setPColor] = useState(project.color);
  return (
    <Modal
      title="Edit Project"
      sub={`Configure ${project.name}`}
      onClose={onClose}
      width={460}
    >
      <Fld label="Project Name">
        <Inp value={pName} onChange={setPName} />
      </Fld>
      <Fld label="Members">
        <MembersInput members={pMems} onChange={setPMems} />
      </Fld>
      <Fld label="Timeline Color">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="color"
            value={pColor}
            onChange={(e) => setPColor(e.target.value)}
            style={{
              width: 38,
              height: 34,
              border: "1.5px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              padding: 2,
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              fontFamily: "DM Mono,monospace",
            }}
          >
            {pColor}
          </span>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: pColor,
              boxShadow: `0 2px 8px ${pColor}50`,
            }}
          />
        </div>
      </Fld>
      <Actions
        left={
          <B
            v="danger"
            onClick={() => {
              if (
                confirm(
                  `Delete project "${project.name}"? This cannot be undone.`,
                )
              )
                onDelProject();
            }}
          >
            Delete Project
          </B>
        }
      >
        <B onClick={onClose}>Cancel</B>
        <B
          v="success"
          onClick={() =>
            onEditProject({
              ...project,
              name: pName,
              members: pMems,
              color: pColor,
            })
          }
        >
          Save Changes
        </B>
      </Actions>
    </Modal>
  );
}

function FinishModal({ onClose, onConfirm }) {
  const [next, setNext] = useState(addD(today(), 1));
  const [clear, setClear] = useState(true);
  return (
    <Modal
      title="Mark Timeline as Done"
      sub="Archive the current timeline and start a new reporting week"
      onClose={onClose}
    >
      <Alert type="green">
        This archives the current week's timeline and starts a fresh one. Past
        timelines are saved and can be compared.
      </Alert>
      <Fld
        label="New Reporting Week Starts On"
        hint="Default is the day after today"
      >
        <Inp type="date" value={next} onChange={setNext} />
      </Fld>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <input
          type="checkbox"
          id="clr"
          checked={clear}
          onChange={(e) => setClear(e.target.checked)}
          style={{ accentColor: "var(--blue)", width: 14, height: 14 }}
        />
        <label
          htmlFor="clr"
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            cursor: "pointer",
          }}
        >
          Clear all task hours in the new timeline (start fresh)
        </label>
      </div>
      <Actions>
        <B onClick={onClose}>Cancel</B>
        <B v="success" onClick={() => onConfirm(next, clear)}>
          ✓ Confirm & Archive
        </B>
      </Actions>
    </Modal>
  );
}

/* ── LOG PAST PERIOD MODAL ── */
function LogPastModal({ onClose, onSave }) {
  const [startDate, setStartDate] = useState(addD(today(), -14));
  const [finishDate, setFinishDate] = useState(addD(today(), -7));
  const valid = startDate && finishDate && startDate <= finishDate;
  return (
    <Modal
      title="Log Past Reporting Period"
      sub="Record a past period that wasn't tracked at the time"
      onClose={onClose}
      width={460}
    >
      <Alert type="info">
        Use this to backfill a past reporting week into your archives. Enter the
        period's start date and its reporting (finish) date. It will be saved as
        an archived timeline that you can later compare against other periods.
      </Alert>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <Fld label="Period Start" hint="First working day of that week">
          <Inp type="date" value={startDate} onChange={setStartDate} />
        </Fld>
        <Fld
          label="Reporting Date"
          hint="The day this period was reported / ended"
        >
          <Inp type="date" value={finishDate} onChange={setFinishDate} />
        </Fld>
      </div>
      {startDate && finishDate && (
        <div
          style={{
            background: "var(--bg)",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            padding: "11px 14px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 5,
            }}
          >
            Summary
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "DM Mono,monospace",
            }}
          >
            {fmt(startDate)}{" "}
            <span
              style={{
                color: "var(--text-3)",
                fontWeight: 400,
                fontSize: 11,
              }}
            >
              →
            </span>{" "}
            {fmt(finishDate)}
          </div>
          {!valid && startDate > finishDate && (
            <div style={{ fontSize: 11, color: "#dc2626", marginTop: 5 }}>
              ⚠ Reporting date must be on or after the start date.
            </div>
          )}
        </div>
      )}
      <Actions>
        <B onClick={onClose}>Cancel</B>
        <B
          v="primary"
          disabled={!valid}
          onClick={() => onSave({ startDate, finishDate })}
        >
          Save to Archives
        </B>
      </Actions>
    </Modal>
  );
}

/* ── COMPARE MODAL ── */
function CompareModal({ allTimelines, projects, settings, onClose }) {
  const [idA, setIdA] = useState(
    allTimelines[1]?.id || allTimelines[0]?.id || "",
  );
  const [idB, setIdB] = useState(allTimelines[0]?.id || "");
  const opts = allTimelines.map((t) => ({ value: t.id, label: t.name }));
  const tlA = allTimelines.find((t) => t.id === idA);
  const tlB = allTimelines.find((t) => t.id === idB);
  const too_few = allTimelines.length < 2;

  function getPlottedSet(tl, pid) {
    if (!tl) return new Set();
    const pt = tl.tasks?.[pid] || {};
    const ps = pt.plotStart || tl.plotStart;
    const ph = pt.priorityHours || {};
    const slots = ALL_SLOTS.filter((s) => ph[s.id] > 0).map((s) => ({
      ...s,
      hours: ph[s.id],
    }));
    if (!slots.length) return new Set();
    const segMap = plotPartialDays(slots, ps, settings);
    return new Set(segMap.keys());
  }

  // Count only working days
  function workingDaysInSet(s) {
    return [...s].filter((d) => dayType(d, settings) === "work").length;
  }

  const { dates, bm } = useMemo(() => {
    if (!tlA || !tlB) return { dates: [], bm: [] };
    const starts = [tlA.plotStart, tlB.plotStart].filter(Boolean);
    const start = starts.reduce((a, b) => (a < b ? a : b));
    let end = addD(start, 55);
    [tlA, tlB].forEach((tl) => {
      projects.forEach((p) => {
        const s = getPlottedSet(tl, p.id);
        if (s.size) {
          const last = [...s].sort().pop();
          const w = addD(last, 7);
          if (w > end) end = w;
        }
      });
    });
    const dates = dRange(start, end);
    const bm = [];
    let cm = null,
      cg = null;
    dates.forEach((d) => {
      const mo = d.slice(0, 7);
      if (mo !== cm) {
        cm = mo;
        cg = { month: mo, dates: [] };
        bm.push(cg);
      }
      cg.dates.push(d);
    });
    return { dates, bm };
  }, [tlA, tlB, projects, settings]);

  const pdata = useMemo(() => {
    return projects
      .map((p) => {
        const sA = getPlottedSet(tlA, p.id);
        const sB = getPlottedSet(tlB, p.id);
        const endA = sA.size ? [...sA].sort().pop() : null;
        const endB = sB.size ? [...sB].sort().pop() : null;
        // diff in working days only
        const wdA = workingDaysInSet(sA);
        const wdB = workingDaysInSet(sB);
        const diff = endA && endB ? diffD(endA, endB) : null;
        const wdDiff = wdA > 0 || wdB > 0 ? wdB - wdA : null;
        return { p, sA, sB, endA, endB, diff, wdA, wdB, wdDiff };
      })
      .filter((x) => x.sA.size > 0 || x.sB.size > 0);
  }, [projects, tlA, tlB, settings]);

  const CW = 36; // wider day columns
  const ROW_A = 22; // taller rows for A
  const ROW_B = 22; // taller rows for B
  const GAP = 8; // gap row between projects

  return (
    <Modal
      title="Timeline Comparison"
      sub="Compare project timelines across reporting periods"
      onClose={onClose}
      width={Math.min(1100, window.innerWidth * 0.96)}
    >
      {too_few && (
        <Alert type="info">
          You need at least 2 saved timelines to compare. Save the current
          timeline first, then create a new one.
        </Alert>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Fld label="Past / Previous (A)">
          <Sel value={idA} onChange={setIdA} options={opts} />
        </Fld>
        <Fld label="Present (B)">
          <Sel value={idB} onChange={setIdB} options={opts} />
        </Fld>
      </div>

      {!too_few && tlA && tlB && pdata.length > 0 && dates.length > 0 && (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                background: "#eff6ff",
                border: "1.5px solid #bfdbfe",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#1e40af",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 5,
                }}
              >
                Past / Previous (A)
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {tlA.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#3b82f6",
                  marginTop: 3,
                  fontFamily: "DM Mono,monospace",
                }}
              >
                Start: {fmt(tlA.plotStart)}
              </div>
            </div>
            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #bbf7d0",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#15803d",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 5,
                }}
              >
                Present (B)
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {tlB.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#16a34a",
                  marginTop: 3,
                  fontFamily: "DM Mono,monospace",
                }}
              >
                Start: {fmt(tlB.plotStart)}
              </div>
            </div>
            <div
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                Legend
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--text-2)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 14,
                      borderRadius: 3,
                      background: "#3b82f6",
                      flexShrink: 0,
                    }}
                  />{" "}
                  Past (A)
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--text-2)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 14,
                      borderRadius: 3,
                      background: "#22c55e",
                      flexShrink: 0,
                    }}
                  />{" "}
                  Present (B)
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-3)",
                    marginTop: 2,
                  }}
                >
                  Days = working days only (no weekends/holidays)
                </div>
              </div>
            </div>
          </div>

          {/* Visual Gantt — big & readable */}
          <div
            style={{
              border: "1.5px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            <div style={{ overflowX: "auto", maxHeight: 520 }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                }}
              >
                <colgroup>
                  <col style={{ width: 130, minWidth: 130 }} />
                  <col style={{ width: 22, minWidth: 22 }} />
                  {dates.map((d) => (
                    <col key={d} style={{ width: CW, minWidth: CW }} />
                  ))}
                </colgroup>
                <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
                  {/* Month row */}
                  <tr style={{ height: 20, background: "#f8fafc" }}>
                    <th
                      style={{
                        position: "sticky",
                        left: 0,
                        background: "#f8fafc",
                        borderRight: "2px solid var(--border)",
                        borderBottom: "1px solid var(--border)",
                        padding: "0 12px",
                        textAlign: "left",
                        zIndex: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--text-3)",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        Project
                      </span>
                    </th>
                    <th
                      style={{
                        background: "#f8fafc",
                        borderRight: "1px solid var(--border)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    />
                    {bm.map((g) => (
                      <th
                        key={g.month}
                        colSpan={g.dates.length}
                        style={{
                          background: "#f8fafc",
                          borderBottom: "1px solid var(--border)",
                          borderRight: "1px solid var(--border)",
                          padding: "0 4px",
                          textAlign: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "var(--text-2)",
                            fontFamily: "DM Mono,monospace",
                            textTransform: "uppercase",
                          }}
                        >
                          {MON_S[parseInt(g.month.split("-")[1]) - 1]}{" "}
                          {g.month.split("-")[0]}
                        </span>
                      </th>
                    ))}
                  </tr>
                  {/* Day numbers row */}
                  <tr style={{ height: 22, background: "#f8fafc" }}>
                    <th
                      style={{
                        position: "sticky",
                        left: 0,
                        background: "#f8fafc",
                        borderRight: "2px solid var(--border)",
                        borderBottom: "2px solid var(--border)",
                        zIndex: 6,
                      }}
                    />
                    <th
                      style={{
                        background: "#f8fafc",
                        borderRight: "1px solid var(--border)",
                        borderBottom: "2px solid var(--border)",
                      }}
                    />
                    {dates.map((d) => {
                      const dn = parseInt(d.split("-")[2]);
                      const t = dayType(d, settings);
                      const isWknd =
                        t === "weekend" || t === "holiday" || t === "alignment";
                      return (
                        <th
                          key={d}
                          style={{
                            background: isWknd ? "#f1f5f9" : "#f8fafc",
                            borderBottom: "2px solid var(--border)",
                            borderRight: "1px solid #e2e8f0",
                            textAlign: "center",
                            padding: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9,
                              fontFamily: "DM Mono,monospace",
                              color: isWknd ? "#cbd5e1" : "#94a3b8",
                              fontWeight: 500,
                            }}
                          >
                            {dn}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pdata.map(
                    ({ p, sA, sB, endA, endB, diff, wdA, wdB, wdDiff }, pi) => {
                      const bDone = sB.size === 0 && sA.size > 0;
                      const dc = bDone
                        ? "#16a34a"
                        : wdDiff === null
                          ? "var(--text-3)"
                          : wdDiff > 0
                            ? "#be123c"
                            : wdDiff < 0
                              ? "var(--green)"
                              : "#64748b";
                      const dLabel = bDone
                        ? "✓ Done"
                        : wdDiff === null
                          ? "—"
                          : wdDiff === 0
                            ? "Same end date"
                            : `${wdDiff > 0 ? "↑" : "↓"} ${Math.abs(wdDiff)} days`;
                      return (
                        <Fragment key={p.id}>
                          {/* Gap row between projects */}
                          {pi > 0 && (
                            <tr style={{ height: GAP }}>
                              <td
                                colSpan={dates.length + 2}
                                style={{
                                  background: "#f8fafc",
                                  borderBottom: "1px solid #e2e8f0",
                                }}
                              />
                            </tr>
                          )}

                          {/* A row — Past */}
                          <tr style={{ height: ROW_A }}>
                            <td
                              rowSpan={2}
                              style={{
                                position: "sticky",
                                left: 0,
                                background: "#fff",
                                borderRight: "none",
                                padding: "0 0 0 12px",
                                verticalAlign: "middle",
                                zIndex: 4,
                                minWidth: 130,
                                maxWidth: 130,
                              }}
                            >
                              <div
                                style={{
                                  paddingRight: 12,
                                  borderRight: "2px solid var(--border)",
                                  height: "100%",
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "center",
                                  paddingBottom: GAP + ROW_B,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 9,
                                      height: 9,
                                      borderRadius: "50%",
                                      background: p.color,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 800,
                                      color: "var(--text)",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      maxWidth: 88,
                                    }}
                                  >
                                    {p.name}
                                  </span>
                                </div>
                                <div style={{ marginTop: 4, marginLeft: 16 }}>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: dc,
                                    }}
                                  >
                                    {dLabel}
                                  </span>
                                </div>
                                {!bDone && (wdA > 0 || wdB > 0) && (
                                  <div
                                    style={{
                                      marginTop: 2,
                                      marginLeft: 16,
                                      fontSize: 10,
                                      color: "var(--text-3)",
                                      fontFamily: "DM Mono,monospace",
                                    }}
                                  >
                                    A:{wdA}wd · B:
                                    {wdB > 0 ? wdB + "wd" : "done"}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td
                              style={{
                                position: "sticky",
                                left: 130,
                                background: "#dbeafe",
                                borderRight: "2px solid var(--border)",
                                borderBottom: "none",
                                padding: 0,
                                textAlign: "center",
                                verticalAlign: "middle",
                                zIndex: 3,
                                minWidth: 22,
                                width: 22,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: "#1d4ed8",
                                  display: "block",
                                }}
                              >
                                A
                              </span>
                            </td>
                            {dates.map((d) => {
                              const t = dayType(d, settings);
                              const bg =
                                t === "weekend"
                                  ? "#f8fafc"
                                  : t === "alignment"
                                    ? "#fffbeb"
                                    : t === "holiday"
                                      ? "#fff1f2"
                                      : "#fff";
                              return (
                                <td
                                  key={d}
                                  style={{
                                    height: ROW_A,
                                    padding: "2px 1px",
                                    background: bg,
                                    borderRight: "1px solid #f1f5f9",
                                    position: "relative",
                                  }}
                                >
                                  {sA.has(d) && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        inset: "2px 1px",
                                        borderRadius: 3,
                                        background: "#3b82f6",
                                      }}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>

                          {/* B row — Present */}
                          <tr style={{ height: ROW_B }}>
                            <td
                              style={{
                                position: "sticky",
                                left: 130,
                                background: "#dcfce7",
                                borderRight: "2px solid var(--border)",
                                borderBottom: `${GAP + 2}px solid #f8fafc`,
                                padding: 0,
                                textAlign: "center",
                                verticalAlign: "middle",
                                zIndex: 3,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: "#15803d",
                                  display: "block",
                                }}
                              >
                                B
                              </span>
                            </td>
                            {dates.map((d) => {
                              const t = dayType(d, settings);
                              const bg =
                                t === "weekend"
                                  ? "#f8fafc"
                                  : t === "alignment"
                                    ? "#fffbeb"
                                    : t === "holiday"
                                      ? "#fff1f2"
                                      : "#fff";
                              return (
                                <td
                                  key={d}
                                  style={{
                                    height: ROW_B,
                                    padding: "2px 1px",
                                    background: bg,
                                    borderRight: "1px solid #f1f5f9",
                                    borderBottom: `${GAP + 2}px solid #f8fafc`,
                                    position: "relative",
                                  }}
                                >
                                  {sB.has(d) && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        inset: "2px 1px",
                                        borderRadius: 3,
                                        background: "#22c55e",
                                      }}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        </Fragment>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary table */}
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 10,
              }}
            >
              Working Days Summary
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {pdata.map(({ p, endA, endB, diff, wdA, wdB }) => {
                const bDone = endB === null && endA !== null;
                const dc = bDone
                  ? "#16a34a"
                  : diff === null
                    ? "var(--text-3)"
                    : diff > 0
                      ? "#be123c"
                      : diff < 0
                        ? "var(--green)"
                        : "#64748b";
                const insight = bDone
                  ? "✓ Completed — no remaining days in current timeline"
                  : wdA === 0 && wdB === 0
                    ? "No data"
                    : wdB < wdA
                      ? `↓ ${wdA - wdB} fewer working days (${wdA}d → ${wdB}d)`
                      : wdB > wdA
                        ? `↑ ${wdB - wdA} more working days (${wdA}d → ${wdB}d)`
                        : `Same working days (${wdA}d)`;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "130px 120px 120px 1fr",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#fff",
                      borderRadius: 8,
                      border: "1.5px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: p.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        {p.name}
                      </span>
                    </div>
                    <div
                      style={{
                        background: "#eff6ff",
                        border: "1.5px solid #bfdbfe",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 12,
                        color: "#1d4ed8",
                        fontFamily: "DM Mono,monospace",
                        textAlign: "center",
                      }}
                    >
                      {endA ? fmt(endA) : "—"}
                    </div>
                    <div
                      style={{
                        background: "#f0fdf4",
                        border: "1.5px solid #bbf7d0",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 12,
                        color: "var(--green)",
                        fontFamily: "DM Mono,monospace",
                        textAlign: "center",
                      }}
                    >
                      {endB ? fmt(endB) : "done ✓"}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: dc }}>
                      {insight}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {!too_few && pdata.length === 0 && (
        <Alert type="info">
          No projects have plotted hours in the selected timelines.
        </Alert>
      )}
      <Actions>
        <B onClick={onClose}>Close</B>
      </Actions>
    </Modal>
  );
}

/* ── EDIT NOTE MODAL ── */
function EditNoteModal({ note, onClose, onSave, onDelete }) {
  const [text, setText] = useState(note.text);
  const [startDate, setStartDate] = useState(note.startDate);
  const [endDate, setEndDate] = useState(note.endDate);
  return (
    <Modal title="Edit Note" onClose={onClose} width={400}>
      <Fld label="Note Text">
        <Inp value={text} onChange={setText} placeholder="Note text..." />
      </Fld>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <Fld label="Start Date">
          <Inp type="date" value={startDate} onChange={setStartDate} />
        </Fld>
        <Fld label="End Date">
          <Inp type="date" value={endDate} onChange={setEndDate} />
        </Fld>
      </div>
      <Actions
        left={
          <B
            v="danger"
            onClick={() => {
              if (confirm("Delete this note?")) onDelete();
            }}
          >
            Delete
          </B>
        }
      >
        <B onClick={onClose}>Cancel</B>
        <B
          v="primary"
          onClick={() => onSave({ ...note, text, startDate, endDate })}
        >
          Save
        </B>
      </Actions>
    </Modal>
  );
}

function SettingsModal({ settings, onClose, onSave }) {
  const [s, setS] = useState({
    ...settings,
    holidays: [...(settings.holidays || [])],
    priorityColors: {
      hp: settings.priorityColors?.hp || "#ef4444",
      mp: settings.priorityColors?.mp || "#f97316",
      lp: settings.priorityColors?.lp || "#3b82f6",
    },
  });
  const [newH, setNewH] = useState("");
  const days = [0, 1, 2, 3, 4, 5, 6].map((v) => ({
    value: v,
    label: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][v],
  }));
  return (
    <Modal
      title="Settings"
      sub="Configure global scheduling rules"
      onClose={onClose}
      width={500}
    >
      <Fld
        label="Exclude the following day(s) of the week"
        hint="These days are excluded from plotting across all projects"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
          }}
        >
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((dayName, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: "#fff",
                borderRadius: 6,
                border: "1.5px solid var(--border)",
              }}
            >
              <input
                type="checkbox"
                checked={(s.excludeDays || []).includes(idx)}
                onChange={(e) => {
                  const newExclude = e.target.checked
                    ? [...(s.excludeDays || []), idx]
                    : (s.excludeDays || []).filter((d) => d !== idx);
                  setS((p) => ({ ...p, excludeDays: newExclude }));
                }}
                style={{
                  accentColor: "var(--blue)",
                  width: 14,
                  height: 14,
                }}
              />
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                {dayName}
              </label>
            </div>
          ))}
        </div>
      </Fld>

      {/* Priority colors */}
      <div
        style={{
          background: "var(--bg)",
          border: "1.5px solid var(--border)",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-2)",
            marginBottom: 10,
          }}
        >
          Priority Block Colors
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { id: "hp", name: "High Priority" },
            { id: "mp", name: "Medium Priority" },
            { id: "lp", name: "Low Priority" },
          ].map((pr) => (
            <div
              key={pr.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: "#fff",
                borderRadius: 7,
                border: `1.5px solid ${s.priorityColors[pr.id]}40`,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: s.priorityColors[pr.id],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text)",
                  flex: 1,
                }}
              >
                {pr.name}
              </span>
              <input
                type="color"
                value={s.priorityColors[pr.id]}
                onChange={(e) =>
                  setS((p) => ({
                    ...p,
                    priorityColors: {
                      ...p.priorityColors,
                      [pr.id]: e.target.value,
                    },
                  }))
                }
                style={{
                  width: 32,
                  height: 28,
                  border: "1.5px solid var(--border)",
                  borderRadius: 5,
                  cursor: "pointer",
                  padding: 2,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  fontFamily: "DM Mono,monospace",
                  flexShrink: 0,
                }}
              >
                {s.priorityColors[pr.id]}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          background: "var(--bg)",
          border: "1.5px solid var(--border)",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-2)",
            marginBottom: 8,
          }}
        >
          Day Type Colors{" "}
          <span style={{ fontWeight: 400, color: "var(--text-3)" }}>
            (timeline body cells only)
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
          }}
        >
          {[["Weekend"], ["Weekly Alignment"], ["Holiday"]].map(([label]) => {
            const key =
              label === "Weekend"
                ? "weekendColor"
                : label === "Weekly Alignment"
                  ? "alignmentColor"
                  : "holidayColor";
            const def =
              label === "Weekend"
                ? "var(--wknd-bg)"
                : label === "Weekly Alignment"
                  ? "var(--align-bg)"
                  : "var(--holiday-bg)";
            const sample = s[key] || def;
            return (
              <div
                key={label}
                style={{
                  background: "#fff",
                  border: "1.5px solid var(--border)",
                  borderRadius: 7,
                  padding: "8px 10px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--text-3)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 20,
                    borderRadius: 5,
                    background: sample,
                    border: "1.5px solid var(--border)",
                    marginBottom: 6,
                  }}
                />
                <input
                  type="color"
                  value={s[key] || "#f8f9fa"}
                  onChange={(e) =>
                    setS((p) => ({ ...p, [key]: e.target.value }))
                  }
                  style={{
                    width: 28,
                    height: 24,
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    cursor: "pointer",
                    padding: 1,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <Fld label="Public Holidays">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Inp
            type="date"
            value={newH}
            onChange={setNewH}
            style={{ flex: 1 }}
          />
          <B
            v="subtle"
            onClick={() => {
              if (newH && !s.holidays.includes(newH)) {
                setS((p) => ({
                  ...p,
                  holidays: [...p.holidays, newH].sort(),
                }));
                setNewH("");
              }
            }}
          >
            Add
          </B>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            minHeight: 28,
          }}
        >
          {s.holidays.map((h) => (
            <Chip
              key={h}
              color="#fff1f2"
              onRemove={() =>
                setS((p) => ({
                  ...p,
                  holidays: p.holidays.filter((x) => x !== h),
                }))
              }
            >
              <span
                style={{
                  color: "#be123c",
                  fontFamily: "DM Mono,monospace",
                  fontSize: 11,
                }}
              >
                {fmt(h)}
              </span>
            </Chip>
          ))}
          {!s.holidays.length && (
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              No holidays added
            </span>
          )}
        </div>
      </Fld>
      <Actions>
        <B onClick={onClose}>Cancel</B>
        <B v="primary" onClick={() => onSave(s)}>
          Save Settings
        </B>
      </Actions>
    </Modal>
  );
}
/* ── LEGEND ── */
function Legend({ settings }) {
  const pColors = settings.priorityColors || {
    hp: "#ef4444",
    mp: "#f97316",
    lp: "#3b82f6",
  };
  const dynPriorities = PRIORITIES.map((p) => ({
    ...p,
    color: pColors[p.id] || p.color,
  }));
  return (
    <div
      style={{
        position: "sticky",
        bottom: 10,
        left: 10,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(255,255,255,0.95)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "5px 10px",
        backdropFilter: "blur(6px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        zIndex: 50,
        flexWrap: "wrap",
        maxWidth: 420,
      }}
    >
      {dynPriorities.map((pr) => (
        <span
          key={pr.id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9.5,
            fontWeight: 600,
            color: pr.color,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: pr.color,
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          {pr.name.replace(" Priority", "")}
        </span>
      ))}
      <div
        style={{
          width: 1,
          height: 12,
          background: "var(--border)",
          flexShrink: 0,
          margin: "0 2px",
        }}
      />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 9,
          color: "var(--text-3)",
        }}
      >
        <WtIcon wtId="bug" size={8} /> Bug
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 9,
          color: "var(--text-3)",
        }}
      >
        <WtIcon wtId="nf" size={8} /> New Feature
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 9,
          color: "var(--text-3)",
        }}
      >
        <WtIcon wtId="enh" size={8} /> Enhancement
      </span>
      <div
        style={{
          width: 1,
          height: 12,
          background: "var(--border)",
          flexShrink: 0,
          margin: "0 2px",
        }}
      />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 9,
          color: "var(--text-3)",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 1,
            background: "var(--wknd-bg)",
            border: "1px solid var(--border)",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        Wknd
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 9,
          color: "var(--text-3)",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 1,
            background: "var(--align-bg)",
            border: "1px solid var(--border)",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        Align
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 9,
          color: "var(--text-3)",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 1,
            background: "var(--holiday-bg)",
            border: "1px solid var(--border)",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        Holiday
      </span>
    </div>
  );
}

function AddTeamModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  return (
    <Modal
      title="Add New Team"
      sub="Create a new team with its own projects and timeline"
      onClose={onClose}
      width={400}
    >
      <Alert type="info">
        Each team has its own independent set of projects and timelines.
      </Alert>
      <Fld label="Team Name">
        <Inp
          value={name}
          onChange={setName}
          placeholder="e.g. Business Team, Dev Team"
        />
      </Fld>
      <Actions>
        <B onClick={onClose}>Cancel</B>
        <B
          v="primary"
          onClick={() => {
            if (name.trim()) onSave(name.trim());
          }}
        >
          Create Team
        </B>
      </Actions>
    </Modal>
  );
}
function EditTeamModal({ team, onClose, onSave, onDelete, canDelete }) {
  const [name, setName] = useState(team?.name || "");
  return (
    <Modal title="Edit Team" onClose={onClose} width={400}>
      <Fld label="Team Name">
        <Inp value={name} onChange={setName} />
      </Fld>
      <Actions
        left={
          canDelete && (
            <B
              v="danger"
              onClick={() => {
                if (confirm(`Delete team "${team.name}" and ALL its data?`))
                  onDelete();
              }}
            >
              Delete Team
            </B>
          )
        }
      >
        <B onClick={onClose}>Cancel</B>
        <B
          v="primary"
          onClick={() => {
            if (name.trim()) onSave(name.trim());
          }}
        >
          Save
        </B>
      </Actions>
    </Modal>
  );
}

function AppWithErrorBoundary(props) {
  return (
    <ErrorBoundary>
      <App {...props} />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
