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
 *   ├── AddWorkspaceModal
 *   └── EditTeamModal
 *
 * UI PRIMITIVES (defined at bottom of this file):
 *   Modal, Fld, Inp, Sel, Actions, B, Chip, Alert, Tabs, MembersInput
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useMemo, useRef, Fragment } from "react";
import {
  Bug,
  Sparkles,
  Wrench,
  Zap,
  Star,
  Circle,
  Check,
  Pencil,
  Plus,
  Save,
  Trash2,
  Settings,
  SlidersHorizontal,
  GitCompare,
  Loader2,
  LogOut,
  Undo2,
  Redo2,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CalendarClock,
  X,
} from "lucide-react";
import api from "./services/api";
import { deleteAccount } from "./services/auth";
// import TopBar from "./components/TopBar"; // Replaced with inline TopBar function
import {
  bootstrapState,
  mkInitialState,
  mkTL,
  mkTeamData,
  uid,
} from "./utils/stateManager";
import { plotPartialDays } from "./utils/plotUtils";
import { buildSlots, getGroup1Options, getGroup2Options } from "./utils/slots";
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
  DEF_SETTINGS,
  DEF_TEAM_DATA,
  DEFAULT_TIMELINE_STRUCTURE,
  DEFAULT_WORK_HOURS_PER_DAY,
  PLOT_UNITS,
  TRACKING_MODES,
  REPRESENTATION_TYPES,
} from "./constants";

/* ─── DESIGN TOKENS & HELPER STYLES ───────────────────────────────────────── */
const UI = {
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  shadow: {
    soft: "0 6px 20px rgba(15,23,42,0.06)",
    mid: "0 10px 30px rgba(15,23,42,0.10)",
    strong: "0 18px 50px rgba(15,23,42,0.14)",
  },
  color: {
    bg: "#f8fafc",
    panel: "#ffffff",
    border: "#e5e7eb",
    borderSoft: "#eef2f7",
    text: "#0f172a",
    text2: "#334155",
    text3: "#94a3b8",
    blue: "#4f46e5",
    blueSoft: "#eef2ff",
    green: "#16a34a",
    greenSoft: "#f0fdf4",
    red: "#ef4444",
    redSoft: "#fff1f2",
    amberSoft: "#fff7ed",
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 28,
    xxl: 36,
  },
};

const BRAND = {
  primary: "#4f46e5",
  primaryHover: "#4338ca",
  primarySoft: "#eef2ff",
};

/* ─── APP STRINGS ──────────────────────────────────────────────────────── */
const APP_STRINGS = {
  actions: {
    signOut: "Sign out",
    save: "Save",
    cancel: "Cancel",
    remove: "Remove",
    delete: "Delete",
    addOption: "+ Add Option",
    addWorkspace: "Add Workspace",
    compare: "Compare",
    settings: "Settings",
    editTimeline: "Edit this Timeline",
    reloadPage: "Reload Page",
  },
};

const sectionTitle = {
  fontSize: 15,
  fontWeight: 800,
  color: UI.color.text,
  letterSpacing: "-0.02em",
};

const sectionSub = {
  fontSize: 12,
  color: UI.color.text3,
  lineHeight: 1.5,
};

const surfaceCard = {
  background: UI.color.panel,
  border: `1px solid ${UI.color.border}`,
  borderRadius: UI.radius.lg,
  boxShadow: UI.shadow.soft,
};

const subtlePanel = {
  background: "#fbfdff",
  border: `1px solid ${UI.color.borderSoft}`,
  borderRadius: UI.radius.lg,
};

const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 40,
  padding: "0 14px",
  borderRadius: UI.radius.md,
  border: "none",
  background: BRAND.primary,
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all .18s cubic-bezier(.4,0,.2,1)",
  boxShadow: "0 6px 18px rgba(79,70,229,0.18)",
};

const secondaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 40,
  padding: "0 14px",
  borderRadius: UI.radius.md,
  border: `1px solid ${UI.color.border}`,
  background: "#fff",
  color: UI.color.text2,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all .18s cubic-bezier(.4,0,.2,1)",
};

const dangerBtn = {
  ...primaryBtn,
  background: UI.color.red,
  boxShadow: "0 6px 18px rgba(239,68,68,0.18)",
};

const softDangerBtn = {
  ...secondaryBtn,
  background: UI.color.redSoft,
  border: "1px solid #fecdd3",
  color: "#be123c",
};

const iconBtn = {
  width: 38,
  height: 38,
  borderRadius: UI.radius.md,
  border: `1px solid ${UI.color.border}`,
  background: "#fff",
  color: UI.color.text2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all .18s cubic-bezier(.4,0,.2,1)",
};

/* ─── BUTTON DESIGN SYSTEM ────────────────────────────────────────────── */
const BUTTON_TOKENS = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
    padding: "0 14px",
    borderRadius: UI.radius.md,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all .18s cubic-bezier(.4,0,.2,1)",
    userSelect: "none",
    border: "1px solid transparent",
  },

  variants: {
    primary: {
      default: {
        background: BRAND.primary,
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 6px 18px rgba(79,70,229,0.18)",
      },
      hover: {
        background: BRAND.primaryHover,
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 8px 24px rgba(79,70,229,0.22)",
        transform: "translateY(-1px)",
      },
      active: {
        background: BRAND.primaryHover,
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 2px 6px rgba(79,70,229,0.18)",
        transform: "translateY(1px) scale(0.98)",
      },
      disabled: {
        background: "#cbd5e1",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "none",
        cursor: "not-allowed",
        opacity: 0.75,
      },
    },

    secondary: {
      default: {
        background: "#fff",
        color: UI.color.text2,
        border: `1px solid ${UI.color.border}`,
        boxShadow: "none",
      },
      hover: {
        background: "#f8fafc",
        color: UI.color.text,
        border: `1px solid ${BRAND.primary}`,
        boxShadow: "none",
        transform: "translateY(-1px)",
      },
      active: {
        background: "#eef2ff",
        color: UI.color.text,
        border: `1px solid ${BRAND.primary}`,
        boxShadow: "none",
        transform: "translateY(1px) scale(0.98)",
      },
      disabled: {
        background: "#fff",
        color: UI.color.text3,
        border: `1px solid ${UI.color.border}`,
        boxShadow: "none",
        cursor: "not-allowed",
        opacity: 0.5,
      },
    },

    danger: {
      default: {
        background: UI.color.red,
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 6px 18px rgba(239,68,68,0.18)",
      },
      hover: {
        background: "#dc2626",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 8px 24px rgba(239,68,68,0.22)",
        transform: "translateY(-1px)",
      },
      active: {
        background: "#b91c1c",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 2px 6px rgba(239,68,68,0.18)",
        transform: "translateY(1px) scale(0.98)",
      },
      disabled: {
        background: "#fecaca",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "none",
        cursor: "not-allowed",
        opacity: 0.7,
      },
    },

    softDanger: {
      default: {
        background: UI.color.redSoft,
        color: "#be123c",
        border: "1px solid #fecdd3",
        boxShadow: "none",
      },
      hover: {
        background: "#ffe4e6",
        color: "#9f1239",
        border: "1px solid #fda4af",
        boxShadow: "none",
        transform: "translateY(-1px)",
      },
      active: {
        background: "#fecdd3",
        color: "#881337",
        border: "1px solid #fb7185",
        boxShadow: "none",
        transform: "translateY(1px) scale(0.98)",
      },
      disabled: {
        background: "#fff1f2",
        color: "#fda4af",
        border: "1px solid #fecdd3",
        boxShadow: "none",
        cursor: "not-allowed",
        opacity: 0.65,
      },
    },

    ghost: {
      default: {
        background: "#fff",
        color: UI.color.text2,
        border: "1px solid #dbe3f0",
        boxShadow: "none",
      },
      hover: {
        background: "#f8fafc",
        color: UI.color.text,
        border: "1px solid #cbd5e1",
        boxShadow: "none",
        transform: "translateY(-1px)",
      },
      active: {
        background: "#eef2f7",
        color: UI.color.text,
        border: "1px solid #cbd5e1",
        boxShadow: "none",
        transform: "translateY(1px) scale(0.98)",
      },
      disabled: {
        background: "#fff",
        color: UI.color.text3,
        border: "1px solid #e5e7eb",
        boxShadow: "none",
        cursor: "not-allowed",
        opacity: 0.45,
      },
    },

    success: {
      default: {
        background: UI.color.green,
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 6px 18px rgba(22,163,74,0.18)",
      },
      hover: {
        background: "#15803d",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 8px 24px rgba(22,163,74,0.22)",
        transform: "translateY(-1px)",
      },
      active: {
        background: "#166534",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 2px 6px rgba(22,163,74,0.18)",
        transform: "translateY(1px) scale(0.98)",
      },
      disabled: {
        background: "#bbf7d0",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "none",
        cursor: "not-allowed",
        opacity: 0.7,
      },
    },

    icon: {
      default: {
        width: 38,
        minWidth: 38,
        padding: 0,
        background: "#fff",
        color: UI.color.text2,
        border: `1px solid ${UI.color.border}`,
        boxShadow: "none",
      },
      hover: {
        width: 38,
        minWidth: 38,
        padding: 0,
        background: "#f8fafc",
        color: UI.color.text,
        border: "1px solid #cbd5e1",
        boxShadow: "none",
        transform: "translateY(-1px)",
      },
      active: {
        width: 38,
        minWidth: 38,
        padding: 0,
        background: "#eef2ff",
        color: UI.color.text,
        border: "1px solid #cbd5e1",
        boxShadow: "none",
        transform: "translateY(1px) scale(0.98)",
      },
      disabled: {
        width: 38,
        minWidth: 38,
        padding: 0,
        background: "#fff",
        color: UI.color.text3,
        border: `1px solid ${UI.color.border}`,
        boxShadow: "none",
        cursor: "not-allowed",
        opacity: 0.38,
      },
    },
  },
};

function getButtonStyle(variant = "primary", state = "default", extra = {}) {
  const v = BUTTON_TOKENS.variants[variant] || BUTTON_TOKENS.variants.primary;
  const s = v[state] || v.default;

  return {
    ...BUTTON_TOKENS.base,
    ...s,
    ...extra,
  };
}

function bindButtonStates(variant = "primary", disabled = false) {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => {
      Object.assign(e.currentTarget.style, getButtonStyle(variant, "hover"));
    },
    onMouseLeave: (e) => {
      Object.assign(e.currentTarget.style, getButtonStyle(variant, "default"));
    },
    onMouseDown: (e) => {
      Object.assign(e.currentTarget.style, getButtonStyle(variant, "active"));
    },
    onMouseUp: (e) => {
      Object.assign(e.currentTarget.style, getButtonStyle(variant, "hover"));
    },
  };
}

/* ─── BUTTON HOVER & ACTIVE HELPERS ───────────────────────────────────────── */
function btnHoverOn(e, type = "primary") {
  if (type === "primary") {
    e.currentTarget.style.background = BRAND.primaryHover;
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 8px 24px rgba(79,70,229,0.22)";
  } else if (type === "secondary") {
    e.currentTarget.style.background = "#f1f5fd";
    e.currentTarget.style.borderColor = BRAND.primary;
    e.currentTarget.style.transform = "translateY(-1px)";
  } else if (type === "danger") {
    e.currentTarget.style.background = "#dc2626";
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 8px 24px rgba(239,68,68,0.22)";
  } else if (type === "icon") {
    e.currentTarget.style.background = "#f8fafc";
    e.currentTarget.style.borderColor = "#cbd5e1";
    e.currentTarget.style.transform = "translateY(-1px)";
  } else if (type === "compare") {
    e.currentTarget.style.background = "#15803d";
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 8px 24px rgba(22,163,74,0.22)";
  }
}

function btnHoverOff(e, type = "primary") {
  if (type === "primary") {
    e.currentTarget.style.background = BRAND.primary;
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 6px 18px rgba(79,70,229,0.18)";
  } else if (type === "secondary") {
    e.currentTarget.style.background = "#fff";
    e.currentTarget.style.borderColor = UI.color.border;
    e.currentTarget.style.transform = "translateY(0)";
  } else if (type === "danger") {
    e.currentTarget.style.background = UI.color.red;
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 6px 18px rgba(239,68,68,0.18)";
  } else if (type === "icon") {
    e.currentTarget.style.background = "#fff";
    e.currentTarget.style.borderColor = UI.color.border;
    e.currentTarget.style.transform = "translateY(0)";
  } else if (type === "compare") {
    e.currentTarget.style.background = "#16a34a";
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 6px 18px rgba(22,163,74,0.18)";
  }
}

function btnActive(e, type = "primary") {
  if (type === "primary") {
    e.currentTarget.style.background = BRAND.primaryHover;
    e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
    e.currentTarget.style.boxShadow = "0 2px 6px rgba(79,70,229,0.18)";
  } else if (type === "secondary") {
    e.currentTarget.style.background = "#e0e7ff";
    e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
  } else if (type === "danger") {
    e.currentTarget.style.background = "#b91c1c";
    e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
    e.currentTarget.style.boxShadow = "0 2px 6px rgba(239,68,68,0.18)";
  } else if (type === "icon") {
    e.currentTarget.style.background = "#e0e7ff";
    e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
  } else if (type === "compare") {
    e.currentTarget.style.background = "#166534";
    e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
    e.currentTarget.style.boxShadow = "0 2px 6px rgba(22,163,74,0.18)";
  }
}

function btnInactive(e, type = "primary") {
  btnHoverOff(e, type);
}

/* ─── Helper Functions ────────────────────────────────────────────────────── */
/**
 * Round hours to days with standard decimal rounding
 * @param {number} hours — Total hours to round
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

/**
 * Parse slot ID into group1Id and group2Id components
 * @param {string} slotId — Slot ID in format "group1Id__group2Id"
 * @returns {Object} { group1Id, group2Id } or { null, null } if invalid
 */
function parseSlotId(slotId) {
  if (!slotId || typeof slotId !== "string") {
    return { group1Id: null, group2Id: null };
  }

  const [group1Id, group2Id] = slotId.split("__");
  return {
    group1Id: group1Id || null,
    group2Id: group2Id || null,
  };
}

function getTrackingMode(settings) {
  return settings?.trackingMode || TRACKING_MODES.GROUPED;
}

function getEmptyTask() {
  return {
    priorityHours: {},
    simpleHours: 0,
    taskItems: [],
    plotStart: null,
    notes: [],
  };
}

function normalizeTask(task = {}) {
  return {
    priorityHours: task.priorityHours || {},
    simpleHours: Number(task.simpleHours || 0),
    taskItems: Array.isArray(task.taskItems) ? task.taskItems : [],
    plotStart: task.plotStart || null,
    notes: Array.isArray(task.notes) ? task.notes : [],
  };
}

function isBlank(v) {
  return !String(v || "").trim();
}

function getSettingsValidation(draft) {
  const mode = getTrackingMode(draft);
  const structure = draft.timelineStructure || [];

  const group1 = structure[0] || { label: "", options: [] };
  const group2 = structure[1] || { label: "", options: [] };

  const group2HasRows =
    Array.isArray(group2.options) && group2.options.length > 0;

  const errors = {
    trackingMode: false,
    plotUnit: false,
    group1Label: false,
    group2Label: false,
    group1OptionsMissing: false,
    group1Options: [],
    group2Options: [],
  };

  errors.trackingMode = isBlank(draft.trackingMode);
  errors.plotUnit = isBlank(draft.plotUnit);

  if (mode !== TRACKING_MODES.SIMPLE) {
    errors.group1Label = isBlank(group1.label);

    if (!Array.isArray(group1.options) || group1.options.length === 0) {
      errors.group1OptionsMissing = true;
    } else {
      errors.group1Options = group1.options.map((opt) => isBlank(opt.label));
    }

    if (group2HasRows) {
      errors.group2Label = isBlank(group2.label);
      errors.group2Options = group2.options.map((opt) => isBlank(opt.label));
    }
  }

  const hasErrors =
    errors.trackingMode ||
    errors.plotUnit ||
    errors.group1Label ||
    errors.group2Label ||
    errors.group1OptionsMissing ||
    errors.group1Options.includes(true) ||
    errors.group2Options.includes(true);

  return { errors, hasErrors };
}

function hasSecondGroup(structure = []) {
  return (
    Array.isArray(structure?.[1]?.options) && structure[1].options.length > 0
  );
}

function createEmptyOption(groupIndex, optionIndex, representation = "color") {
  return {
    id: `opt_${groupIndex}_${Date.now()}_${optionIndex}`,
    label: "",
    order: optionIndex,
    ...(representation === REPRESENTATION_TYPES.COLOR
      ? { color: "#94a3b8", texture: "solid" }
      : representation === REPRESENTATION_TYPES.ICON
        ? { icon: "circle", color: "#94a3b8", texture: "solid" }
        : { texture: "solid", color: "#94a3b8" }),
  };
}

function getTextureBackground(texture = "solid", color = "#94a3b8") {
  const pattern = "rgba(255,255,255,0.45)";

  switch (texture) {
    case "dots":
      return {
        backgroundColor: color,
        backgroundImage: `radial-gradient(${pattern} 18%, transparent 19%)`,
        backgroundSize: "8px 8px",
      };

    case "diagonal":
      return {
        backgroundColor: color,
        backgroundImage: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 4px,
          ${pattern} 4px,
          ${pattern} 6px
        )`,
      };

    case "crosshatch":
      return {
        backgroundColor: color,
        backgroundImage: `
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            ${pattern} 4px,
            ${pattern} 6px
          ),
          repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 4px,
            ${pattern} 4px,
            ${pattern} 6px
          )
        `,
      };

    case "horizontal":
      return {
        backgroundColor: color,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 4px,
          ${pattern} 4px,
          ${pattern} 6px
        )`,
      };

    case "vertical":
      return {
        backgroundColor: color,
        backgroundImage: `repeating-linear-gradient(
          90deg,
          transparent,
          transparent 4px,
          ${pattern} 4px,
          ${pattern} 6px
        )`,
      };

    case "checker":
      return {
        backgroundColor: color,
        backgroundImage: `
          linear-gradient(45deg, ${pattern} 25%, transparent 25%),
          linear-gradient(-45deg, ${pattern} 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, ${pattern} 75%),
          linear-gradient(-45deg, transparent 75%, ${pattern} 75%)
        `,
        backgroundSize: "10px 10px",
        backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
      };

    case "solid":
    default:
      return {
        backgroundColor: color,
      };
  }
}

/**
 * TimelineCell - Layered visual rendering for slots
 * Combines: base color + texture layer + icon overlay
 */
function TimelineCell({ slot }) {
  const color = slot.color || "#94a3b8";
  const texture = slot.texture || "solid";
  const icon = slot.icon || null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",

        // 🔥 THIS IS THE FIX
        ...getTextureBackground(texture, color),
      }}
    >
      {/* ICON LAYER */}
      {icon && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            color: "#fff",
            pointerEvents: "none",
          }}
        >
          <WtIcon icon={icon} size={12} />
        </div>
      )}
    </div>
  );
}

function TextureSwatch({ texture = "solid", color = "#94a3b8" }) {
  return (
    <div
      style={{
        width: "100%",
        height: 100,
        borderRadius: 8,
        border: "1px solid rgba(15,23,42,0.10)",
        ...getTextureBackground(texture, color),
      }}
    />
  );
}

function getProjectTotalHours(task = {}, settings) {
  const mode = getTrackingMode(settings);

  if (mode === TRACKING_MODES.SIMPLE) {
    return Number(task?.simpleHours || 0);
  }

  if (mode === TRACKING_MODES.TASK) {
    return (task?.taskItems || []).reduce(
      (sum, item) => sum + (Number(item?.hours) || 0),
      0,
    );
  }

  return Object.values(task?.priorityHours || {}).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
}

function getTimelineSummary(tasks = {}, settings) {
  let totalHours = 0;
  let projectCountWithHours = 0;

  Object.values(tasks || {}).forEach((task) => {
    const total = getProjectTotalHours(task, settings);
    totalHours += total;
    if (total > 0) projectCountWithHours += 1;
  });

  return {
    totalHours,
    projectCountWithHours,
    hasHours: totalHours > 0,
  };
}

function buildPrimaryColorMap(settings) {
  const slots = buildSlots(
    settings?.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
  );
  const map = {};

  slots.forEach((slot) => {
    const primaryId = slot.g1Id;
    if (primaryId && !map[primaryId]) {
      map[primaryId] = slot.color || "#94a3b8";
    }
  });

  return map;
}

function getGroupedBreakdown(priorityHours = {}, settings) {
  const slots = buildSlots(
    settings?.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
  );
  const slotToPrimary = {};
  const colorMap = buildPrimaryColorMap(settings);

  slots.forEach((slot) => {
    slotToPrimary[slot.id] = slot.g1Id;
  });

  const grouped = {};
  Object.entries(priorityHours || {}).forEach(([slotId, rawValue]) => {
    const hours = Number(rawValue) || 0;
    if (hours <= 0) return;
    const primaryId = slotToPrimary[slotId];
    if (!primaryId) return;
    grouped[primaryId] = (grouped[primaryId] || 0) + hours;
  });

  return Object.entries(grouped).map(([primaryId, value]) => ({
    primaryId,
    value,
    color: colorMap[primaryId] || "#94a3b8",
  }));
}

function toHours(value, settings) {
  const unit = settings.plotUnit || PLOT_UNITS.HOURS;
  const hpd = settings.workHoursPerDay || DEFAULT_WORK_HOURS_PER_DAY;

  if (unit === PLOT_UNITS.DAYS) return Number(value) * hpd;
  if (unit === PLOT_UNITS.WEEKS) return Number(value) * hpd * 5;

  return Number(value);
}

function fromHours(value, settings) {
  const unit = settings.plotUnit || PLOT_UNITS.HOURS;
  const hpd = settings.workHoursPerDay || DEFAULT_WORK_HOURS_PER_DAY;

  if (unit === PLOT_UNITS.DAYS) return value / hpd;
  if (unit === PLOT_UNITS.WEEKS) return value / (hpd * 5);

  return value;
}

function hasCategory1Options(settings) {
  return (
    settings?.timelineStructure?.[0]?.options &&
    settings.timelineStructure[0].options.length > 0
  );
}

function handleCategoryGuard(settings, openModal) {
  if (!hasCategory1Options(settings)) {
    openModal();
    return false;
  }
  return true;
}

function clearTaskEntries(task = {}) {
  const normalized = normalizeTask(task);
  return {
    ...normalized,
    priorityHours: {},
    simpleHours: 0,
    taskItems: [],
    notes: [],
  };
}

/* ─── Reusable AppButton Component ──────────────────────────────────────── */
function AppButton({
  children,
  variant = "primary",
  disabled = false,
  style = {},
  ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={getButtonStyle(variant, disabled ? "disabled" : "default", style)}
      {...bindButtonStates(variant, disabled)}
    >
      {children}
    </button>
  );
}

/* ─── Account Dropdown Component ───────────────────────────────────────── */
function AccountDropdown({ user, onLogout, onDelete }) {
  const [open, setOpen] = React.useState(false);

  const rawEmail = user?.email || "account@example.com";
  const emailName = rawEmail.split("@")[0] || "User";
  const displayName =
    emailName
      .split(/[._-]/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ") || "User";

  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div style={{ position: "relative", zIndex: 2000 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          height: 40,
          padding: "0 14px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "#6366f1",
          }}
        />
        {displayName}
        <span style={{ marginLeft: 4 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 220,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            boxShadow: "0 18px 40px rgba(15,23,42,0.14)",
            padding: 8,
            zIndex: 3000,
          }}
        >
          {/* SIGN OUT */}
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            style={getDropdownItemStyle("default", "default")}
            {...bindDropdownItemStates("default")}
          >
            <LogOut size={15} />
            Sign out
          </button>

          <div
            style={{
              height: 1,
              background: "#f1f5f9",
              margin: "6px 0",
            }}
          />

          {/* DELETE */}
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            style={getDropdownItemStyle("danger", "default")}
            {...bindDropdownItemStates("danger")}
          >
            <Trash2 size={15} />
            Delete Account
          </button>
        </div>
      )}
    </div>
  );
}

const dropdownItemBase = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  transition: "all .16s cubic-bezier(.4,0,.2,1)",
};

function getDropdownItemStyle(kind = "default", state = "default") {
  const map = {
    default: {
      default: {
        color: "#0f172a",
        background: "transparent",
        borderColor: "transparent",
      },
      hover: {
        color: "#0f172a",
        background: "#f8fafc",
        borderColor: "#e2e8f0",
      },
      active: {
        color: "#0f172a",
        background: "#eef2f7",
        borderColor: "#cbd5e1",
        transform: "scale(0.985)",
      },
    },
    danger: {
      default: {
        color: "#dc2626",
        background: "transparent",
        borderColor: "transparent",
      },
      hover: {
        color: "#b91c1c",
        background: "#fef2f2",
        borderColor: "#fecaca",
      },
      active: {
        color: "#991b1b",
        background: "#fee2e2",
        borderColor: "#fca5a5",
        transform: "scale(0.985)",
      },
    },
  };

  return {
    ...dropdownItemBase,
    ...(map[kind]?.[state] || map.default.default),
  };
}

function bindDropdownItemStates(kind = "default", disabled = false) {
  if (disabled) return {};

  return {
    onMouseEnter: (e) => {
      Object.assign(e.currentTarget.style, getDropdownItemStyle(kind, "hover"));
    },
    onMouseLeave: (e) => {
      Object.assign(
        e.currentTarget.style,
        getDropdownItemStyle(kind, "default"),
      );
    },
    onMouseDown: (e) => {
      Object.assign(
        e.currentTarget.style,
        getDropdownItemStyle(kind, "active"),
      );
    },
    onMouseUp: (e) => {
      Object.assign(e.currentTarget.style, getDropdownItemStyle(kind, "hover"));
    },
  };
}

/* ─── Delete Account Modal Component ───────────────────────────────────── */
function DeleteAccountModal({ onClose, onConfirm }) {
  const [text, setText] = React.useState("");

  const isValid = text === "DELETE";

  return (
    <Modal title="Delete Account" onClose={onClose}>
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            color: "#991b1b",
          }}
        >
          Deleting your account will remove all timelines permanently.
        </div>

        <div style={{ fontSize: 14, color: "#475569" }}>
          This action is permanent and cannot be undone.
        </div>

        <div style={{ fontSize: 13, color: "#64748b" }}>
          Type <b>DELETE</b> to confirm.
        </div>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type DELETE"
          style={{
            height: 42,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            padding: "0 12px",
            fontSize: 14,
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <AppButton variant="secondary" onClick={onClose}>
            Cancel
          </AppButton>

          <AppButton variant="danger" disabled={!isValid} onClick={onConfirm}>
            Delete Account
          </AppButton>
        </div>
      </div>
    </Modal>
  );
}

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
          <AppButton
            variant="primary"
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, height: 42, padding: "0 20px" }}
          >
            {APP_STRINGS.actions.reloadPage}
          </AppButton>
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

/* ── Icon map and WtIcon component ──────────────────────────────────────── */
// Map icon string (stored in option.icon) → Lucide component
// Add new entries here as users define custom options — no logic changes needed
const ICON_MAP = {
  bug: Bug,
  sparkles: Sparkles,
  wrench: Wrench,
  zap: Zap,
  star: Star,
  circle: Circle,
  check: Check,
  pencil: Pencil,
  plus: Plus,
  save: Save,
  trash: Trash2,
  settings: Settings,
  compare: GitCompare,
  loader: Loader2,
  logout: LogOut,
  undo: Undo2,
  redo: Redo2,
};

const ICON_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "sparkles", label: "Sparkles" },
  { value: "wrench", label: "Wrench" },
  { value: "zap", label: "Zap" },
  { value: "star", label: "Star" },
  { value: "circle", label: "Circle" },
  { value: "check", label: "Check" },
  { value: "pencil", label: "Pencil" },
  { value: "plus", label: "Plus" },
  { value: "save", label: "Save" },
  { value: "trash", label: "Trash" },
  { value: "settings", label: "Settings" },
  { value: "compare", label: "Compare" },
  { value: "loader", label: "Loader" },
  { value: "logout", label: "Logout" },
  { value: "undo", label: "Undo" },
  { value: "redo", label: "Redo" },
];

const REPRESENTATION_OPTIONS = [
  { value: REPRESENTATION_TYPES.COLOR, label: "Color" },
  { value: REPRESENTATION_TYPES.ICON, label: "Icon" },
  { value: REPRESENTATION_TYPES.TEXTURE, label: "Texture" },
];

const TEXTURE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dots", label: "Dots" },
  { value: "diagonal", label: "Diagonal" },
  { value: "crosshatch", label: "Crosshatch" },
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
  { value: "checker", label: "Checker" },
];

function WtIcon({ icon, size = 12 }) {
  if (!icon) return null;
  const Icon = ICON_MAP[icon];
  if (!Icon) return null;
  return <Icon size={size} />;
}

/* ─── REUSABLE BUTTON STYLES ──────────────────────────────────────────────── */
const baseBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 42,
  padding: "0 14px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  transition: "all .18s ease",
  cursor: "pointer",
  userSelect: "none",
};

const compareBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 40,
  padding: "0 16px",
  borderRadius: 12,
  border: "none",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(22,163,74,0.18)",
  transition: "all .18s ease",
};

const btnPrimary = {
  ...baseBtn,
  background: BRAND.primary,
  color: "#fff",
  border: "none",
  boxShadow: "0 4px 12px rgba(79,70,229,0.18)",
};

const btnPrimaryIdle = {
  ...baseBtn,
  background: BRAND.primarySoft,
  color: BRAND.primary,
  border: "1px solid #c7d2fe",
  boxShadow: "none",
};

const btnDanger = {
  ...baseBtn,
  background: "#ef4444",
  color: "#fff",
  border: "none",
  boxShadow: "0 4px 12px rgba(239,68,68,0.18)",
};

const btnGhost = {
  ...baseBtn,
  background: "#fff",
  color: "#334155",
  border: "1px solid #dbe3f0",
  boxShadow: "none",
  padding: "0 12px",
};

const btnGhostDisabled = {
  ...btnGhost,
  opacity: 0.4,
  cursor: "not-allowed",
};

const btnIcon = {
  width: 38,
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  border: "1px solid #dbe3f0",
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  transition: "all .18s ease",
};

const btnIconDisabled = {
  ...btnIcon,
  opacity: 0.38,
  cursor: "not-allowed",
};

const rowActionBtn = {
  width: 38,
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid #dbe3f0",
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  transition: "all .18s ease",
};

/* ─── SETTINGS BUTTON STYLES ──────────────────────────────────────────────── */
const ghostBtn = {
  padding: "0 14px",
  height: 40,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const GROUP_GRID_COLOR = "minmax(0, 1fr) 220px 160px";
const GROUP_GRID_ICON = "minmax(0, 1fr) 220px 160px";
const GROUP_GRID_TEXTURE = "minmax(0, 1fr) 260px 160px";

const settingsLabelStyle = {
  fontSize: 11,
  fontWeight: 800,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const settingsHeaderRow = (gridTemplateColumns) => ({
  display: "grid",
  gridTemplateColumns,
  gap: 10,
  marginBottom: 8,
  alignItems: "center",
});

const settingsInputStyle = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "0 14px",
  fontSize: 14,
  fontFamily: "Plus Jakarta Sans, sans-serif",
  color: "#0f172a",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

const settingsSelectStyle = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "0 38px 0 38px",
  background: "#fff",
  fontSize: 14,
  fontFamily: "Plus Jakarta Sans, sans-serif",
  color: "#0f172a",
  cursor: "pointer",
  outline: "none",
  boxSizing: "border-box",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const inputStyle = {
  height: 42,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "0 12px",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#fff",
};

const settingsSelectWrap = {
  position: "relative",
  width: "100%",
};

const settingsSelectIconPreview = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "#64748b",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const settingsSelectArrow = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "#64748b",
  display: "flex",
  alignItems: "center",
};

const settingsRemoveBtn = {
  width: "100%",
  height: 46,
  borderRadius: 14,
  border: "1px solid #fecdd3",
  background: "#fff1f2",
  color: "#be123c",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const settingsColorWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  height: 46,
};

const settingsColorInput = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: 4,
  cursor: "pointer",
  boxSizing: "border-box",
};

const settingsColorField = {
  position: "relative",
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  overflow: "hidden",
  boxSizing: "border-box",
};

const settingsColorSwatch = {
  position: "absolute",
  inset: 6,
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.10)",
  pointerEvents: "none",
};

const settingsColorNativeInput = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
};

const requiredAsterisk = {
  color: "#dc2626",
  marginLeft: 4,
  fontWeight: 800,
};

const settingsInputErrorStyle = {
  border: "1px solid #fca5a5",
  background: "#fffafa",
};

const settingsFieldErrorText = {
  fontSize: 12,
  color: "#b91c1c",
  marginTop: 6,
  lineHeight: 1.5,
};

const settingsTextureField = {
  display: "grid",
  gridTemplateRows: "46px",
  alignItems: "center",
  width: "100%",
};

const settingsTexturePreviewInline = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  boxSizing: "border-box",
  padding: 6,
  overflow: "hidden",
};

const settingsTexturePreviewInner = {
  width: "100%",
  height: "100%",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.10)",
  boxSizing: "border-box",
};

const settingsTextureSelectCompact = {
  ...settingsSelectStyle,
  padding: "0 38px 0 12px",
};

/* ─── REUSABLE DASHBOARD STYLES ──────────────────────────────────────────── */
const dashBtnBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  transition: "all .18s ease",
  cursor: "pointer",
};

const dashBtnPrimary = {
  ...dashBtnBase,
  background: "#16a34a",
  color: "#fff",
  border: "none",
  boxShadow: "0 4px 12px rgba(22,163,74,0.16)",
};

const dashBtnSecondary = {
  ...dashBtnBase,
  background: "#fff",
  color: "#334155",
  border: "1px solid #dbe3f0",
};

const dashBtnDangerSoft = {
  ...dashBtnBase,
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
};

const dashCard = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  overflow: "hidden",
  boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
  transition: "all .18s ease",
};

const dashMetaText = {
  fontSize: 11,
  color: "#94a3b8",
  fontFamily: "DM Mono, monospace",
  lineHeight: 1.6,
};

/* ─── TIMELINE CARD CONSTANTS ──────────────────────────────────────────── */
const TIMELINE_CARD_WIDTH = 360;
const TIMELINE_CARD_MIN_HEIGHT = 290;

const timelineCardShell = {
  width: "100%",
  maxWidth: TIMELINE_CARD_WIDTH,
  minHeight: TIMELINE_CARD_MIN_HEIGHT,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  transition: "all 0.2s ease",
  cursor: "pointer",
};

const timelineBody = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
};

/* ─── NEW TIMELINE CARD STYLES ──────────────────────────────────────────── */
const newTimelineCardBody = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "28px 24px",
  textAlign: "center",
};

const newTimelineIconWrap = {
  width: 72,
  height: 72,
  borderRadius: 20,
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#4f46e5",
  marginBottom: 18,
};

const newTimelineTitle = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 8,
};

const newTimelineSub = {
  fontSize: 13,
  color: "#94a3b8",
  lineHeight: 1.6,
  maxWidth: 220,
};

/* ─── EXISTING TIMELINE CARD STYLES ──────────────────────────────────────── */
const timelineTop = {
  padding: "16px 18px 12px",
  borderBottom: "1px solid #eef2f7",
};

const timelineTitle = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1.3,
  marginBottom: 6,
};

const timelineTopRow = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) auto auto",
  gap: 10,
  alignItems: "center",
  marginBottom: 6,
};

const timelineNameInput = {
  width: "100%",
  height: 42,
  borderRadius: 12,
  border: "1px solid #dbe3f0",
  padding: "0 14px",
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

const timelineSaveBtnCompact = {
  minWidth: 84,
  height: 42,
  padding: "0 16px",
};

const timelineIconBtnCompact = {
  width: 42,
  height: 42,
  minWidth: 42,
  padding: 0,
};

const timelineMeta = {
  fontSize: 12.5,
  color: "#64748b",
  lineHeight: 1.5,
};

const timelineEmpty = {
  flex: 1,
  minHeight: 120,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "22px 18px",
};

const timelineEmptyIcon = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#94a3b8",
  marginBottom: 12,
};

const timelineEmptyTitle = {
  fontSize: 14,
  fontWeight: 800,
  color: "#334155",
  marginBottom: 6,
};

const timelineEmptySub = {
  fontSize: 12.5,
  color: "#94a3b8",
  lineHeight: 1.6,
  maxWidth: 220,
};

const timelineFooter = {
  marginTop: "auto",
  padding: "12px 18px 16px",
  borderTop: "1px solid #eef2f7",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const timelineGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 360px))",
  gap: 24,
  alignItems: "start",
};

function App({ user, loading, onLogout }) {
  // ── State bootstrap from API ─────────────────────────────────────────
  // MIGRATION NOTE: bootstrapState() calls api.loadState() which in
  // full-stack mode becomes GET /api/state (Express + PostgreSQL).
  // mkInitialState() is the optimistic fallback rendered while loading.
  const [st, setSt] = useState(mkInitialState);
  const [appLoading, setAppLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [hoverDate, setHoverDate] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    bootstrapState().then((loaded) => {
      setSt(loaded);
      setAppLoading(false);
    });
  }, []);

  useEffect(() => {
    if (appLoading) return;

    api.saveState(st);
  }, [st, appLoading]);

  // ── Detect first-time users for onboarding ───────────────────────────
  // Show onboarding only on first login when user has NO teams
  useEffect(() => {
    if (appLoading || !user || hasCheckedOnboarding) return;

    const teamIds = st.teamData ? Object.keys(st.teamData) : [];
    const hasTeams = Array.isArray(st.teams) && st.teams.length > 0;
    const hasTeamData = teamIds.length > 0;

    const hasWorkspace = hasTeams || hasTeamData;

    setShowOnboarding(!hasWorkspace);
    setHasCheckedOnboarding(true);
  }, [appLoading, user, st, hasCheckedOnboarding]);

  // ── Auto-repair old accounts with empty teams but populated teamData ────
  useEffect(() => {
    if (appLoading) return;

    const teamIds = st.teamData ? Object.keys(st.teamData) : [];
    const hasTeams = Array.isArray(st.teams) && st.teams.length > 0;

    if (!hasTeams && teamIds.length > 0) {
      const firstId = teamIds[0];

      setSt((prev) => ({
        ...prev,
        teams: teamIds.map((id, idx) => ({
          id,
          name:
            prev.teams?.find((t) => t.id === id)?.name ||
            prev.teamData?.[id]?.settings?.workspaceName ||
            (idx === 0 ? "My Workspace" : `Workspace ${idx + 1}`),
        })),
        activeTeamId: prev.activeTeamId || firstId,
      }));
    }
  }, [appLoading]);

  const [modal, setModal] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [mdata, setMdata] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const histRef = useRef([]);
  const futRef = useRef([]); // redo stack
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // When viewing an archived timeline
  const [viewingArchiveId, setViewingArchiveId] = useState(null);

  const { settings: globalSettings, teams, activeTeamId, teamData } = st;
  const td =
    activeTeamId && teamData[activeTeamId]
      ? teamData[activeTeamId]
      : {
          projects: [],
          currentTimeline: mkTL(),
          archives: [],
          trash: [],
        };

  const settings = td.settings || globalSettings;
  const projects = td.projects || [];
  const currentTimeline = td.currentTimeline || mkTL();
  const archives = td.archives || [];
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
        [p.activeTeamId]: fn(p.teamData[p.activeTeamId] || {}),
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
    if (!confirm("Clear all hours? This cannot be undone.")) return;
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
      lp: "#4f46e5",
    };
    const dynSlots = buildSlots(
      settings.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
    );
    // Find earliest date across all project plotStarts
    let minStart = tlStart;
    let maxEnd = addD(tlStart, 41);
    (projects || []).forEach((p) => {
      const pt = tl.tasks[p.id] || {};
      const ps = pt.plotStart || tlStart;
      if (ps < minStart) minStart = ps;
      const mode = getTrackingMode(settings);
      const ph = mode === TRACKING_MODES.GROUPED ? pt.priorityHours || {} : {};
      const slots = dynSlots
        .filter((s) => Number(ph[s.id]) > 0)
        .map((s) => ({ ...s, hours: Number(ph[s.id]) || 0 }));
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
      lp: "#4f46e5",
    };
    const dynSlots = buildSlots(
      settings.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
    );
    const dynPriorities = Object.values(
      dynSlots.reduce((acc, slot) => {
        const { group1Id } = parseSlotId(slot.id);
        const pId = slot.pId || group1Id || slot.g1Id;

        if (!acc[pId]) {
          acc[pId] = {
            id: pId,
            name: slot.g1Label || "Group 1",
            color: slot.color || "#94a3b8",
            order: slot.order ?? 0,
          };
        }

        return acc;
      }, {}),
    ).sort((a, b) => a.order - b.order);
    projects.forEach((p) => {
      const pt = tl.tasks[p.id] || {};
      const ps = pt.plotStart || tl.plotStart;
      const mode = getTrackingMode(settings);
      const ph = mode === TRACKING_MODES.GROUPED ? pt.priorityHours || {} : {};
      const slots = dynSlots
        .filter((s) => Number(ph[s.id]) > 0)
        .map((s) => ({ ...s, hours: Number(ph[s.id]) || 0 }));
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
      const priSummary = dynSlots
        .filter(
          (slot, idx, arr) => arr.findIndex((s) => s.pId === slot.pId) === idx,
        )
        .map((slot) => {
          const { group1Id } = parseSlotId(slot.id);
          const pId = slot.pId || group1Id;
          const prTotalH = dynSlots
            .filter((s) => s.pId === pId)
            .reduce((acc, s) => acc + (ph[s.id] || 0), 0);
          const prTotalD =
            totalD > 0 && totalH > 0
              ? Math.round((prTotalH / totalH) * totalD)
              : 0;
          return {
            id: pId,
            name: slot.pName,
            color: slot.color,
            order: slot.order,
            totalH: prTotalH,
            totalD: prTotalD,
          };
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

  async function doSaveTimeline() {
    try {
      setIsSaving(true);
      await api.saveState(st);
      setIsDirty(false);
      setJustSaved(true);

      setTimeout(() => {
        setJustSaved(false);
      }, 1500);
    } catch (err) {
      console.error("[doSaveTimeline]", err);
      alert("Failed to save timeline.");
    } finally {
      setIsSaving(false);
    }
  }

  function doSaveTask(pid, payload, plotStart) {
    if (isViewingArchive) return;
    setIsDirty(true);

    updTD((td) => {
      const prev = normalizeTask(
        td.currentTimeline?.tasks?.[pid] || getEmptyTask(),
      );

      return {
        ...td,
        currentTimeline: {
          ...td.currentTimeline,
          tasks: {
            ...td.currentTimeline.tasks,
            [pid]: {
              ...prev,
              priorityHours: payload.priorityHours || {},
              simpleHours: Number(payload.simpleHours || 0),
              taskItems: payload.taskItems || [],
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
  function doAddWorkspace({ name, setupMode, customSettings, initialProject }) {
    // When user creates their first team, permanently dismiss onboarding
    // This ensures onboarding is NEVER shown again for this user
    const id = uid();

    const workspaceSettings =
      setupMode === "custom"
        ? {
            ...DEF_SETTINGS,
            ...customSettings,
            timelineStructure:
              customSettings?.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
          }
        : {
            ...DEF_SETTINGS,
            timelineStructure: DEFAULT_TIMELINE_STRUCTURE,
          };

    const workspaceData = {
      ...mkTeamData(),
      settings: workspaceSettings,
    };

    if (initialProject?.trim()) {
      workspaceData.projects.push({
        id: uid(),
        name: initialProject,
        members: [],
        color: "#0ea5e9",
      });
    }

    upd((p) => ({
      ...p,
      teams: [...(p.teams || []), { id, name: name.trim() }],
      teamData: {
        ...(p.teamData || {}),
        [id]: workspaceData,
      },
      activeTeamId: id,
    }));

    setModal(null);
    setShowOnboarding(false);
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
  function doSaveSettings(ns, opts = {}) {
    const clearTrackingData = Boolean(opts.clearTrackingData);

    upd((p) => {
      const activeId = p.activeTeamId;
      const currentTD = p.teamData[activeId] || {};

      const clearTimeline = (timeline) => ({
        ...timeline,
        tasks: Object.fromEntries(
          Object.entries(timeline?.tasks || {}).map(([pid, task]) => [
            pid,
            clearTaskEntries(task),
          ]),
        ),
      });

      return {
        ...p,
        teamData: {
          ...p.teamData,
          [activeId]: {
            ...currentTD,
            settings: ns,
            currentTimeline: clearTrackingData
              ? clearTimeline(currentTD.currentTimeline || mkTL())
              : currentTD.currentTimeline,
            archives: clearTrackingData
              ? (currentTD.archives || []).map(clearTimeline)
              : currentTD.archives,
            trash: clearTrackingData
              ? (currentTD.trash || []).map(clearTimeline)
              : currentTD.trash,
          },
        },
      };
    });

    Object.keys(_plotDrafts).forEach((k) => delete _plotDrafts[k]);
    setModal(null);
  }

  function doSaveTimelineStructure(newStructure) {
    upd((p) => ({
      ...p,
      settings: {
        ...p.settings,
        timelineStructure: newStructure,
      },
    }));
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
    const hasCategory1 = settings.timelineStructure?.[0]?.options?.length > 0;

    if (!hasCategory1) {
      setShowCategoryModal(true);
      return;
    }

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

  // Onboarding modal for first-time users
  if (showOnboarding) {
    return (
      <OnboardingModal
        onFinish={(workspaceData) => {
          doAddWorkspace(workspaceData);
        }}
        onLogout={onLogout}
      />
    );
  }

  // Dashboard screen with TopBar
  if (screen === "dashboard") {
    const trash = teamData[activeTeamId]?.trash || [];
    return (
      <>
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
            onDelete={() => setShowDeleteModal(true)}
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

            {modal === "settings" && (
              <SettingsModal
                settings={settings}
                onClose={() => setModal(null)}
                onSave={doSaveSettings}
              />
            )}

            {modal === "addTeam" && (
              <AddWorkspaceModal
                onClose={() => setModal(null)}
                onSave={doAddWorkspace}
              />
            )}
          </div>
        </div>
        {showDeleteModal && (
          <DeleteAccountModal
            onClose={() => setShowDeleteModal(false)}
            onConfirm={async () => {
              try {
                await deleteAccount();
                setShowDeleteModal(false);
                window.location.reload();
              } catch (err) {
                alert(err.message || "Failed to delete account");
              }
            }}
          />
        )}
      </>
    );
  }

  // Timeline screen with TopBar

  // Timeline screen with TopBar
  return (
    <>
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
          onDelete={() => setShowDeleteModal(true)}
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
          isSaving={isSaving}
          justSaved={justSaved}
          onCompare={() => setModal("compare")}
          onSettings={null}
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
              flexShrink: 0,
              padding: "10px 18px",
              background: "#eef2ff",
              borderBottom: "1px solid #c7d2fe",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: "#eef2ff",
                  color: "#1d4ed8",
                  flexShrink: 0,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3.5v4l2.5 1.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="8"
                    cy="8"
                    r="5.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </span>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#1e3a8a",
                    lineHeight: 1.2,
                  }}
                >
                  Viewing archived timeline
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {fmt(viewingArchive.plotStart)} • Read-only
                </div>
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#1d4ed8",
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                borderRadius: 999,
                padding: "6px 10px",
              }}
            >
              Read-only
            </span>

            <AppButton
              variant="primary"
              onClick={() => doRestoreArchiveForEdit(viewingArchive)}
              style={{ height: 36, padding: "0 14px", fontSize: 13 }}
            >
              {APP_STRINGS.actions.editTimeline}
            </AppButton>
          </div>
        )}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            position: "relative",
            background:
              "linear-gradient(to bottom, #f8fafc 0px, #f1f5f9 180px, #f8fafc 100%)",
          }}
        >
          {projects.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: 120,
                left: 220,
                zIndex: 3,
                color: "var(--text-3)",
                fontSize: 14,
                fontWeight: 600,
                pointerEvents: "none",
              }}
            >
              No projects yet
            </div>
          )}

          <TimelineGrid
            projects={projects}
            displayDates={displayDates}
            byMonth={byMonth}
            plots={plots}
            settings={settings}
            cellZoom={cellZoom}
            hoverDate={hoverDate}
            setHoverDate={setHoverDate}
            onEditProject={isViewingArchive ? () => {} : openEdit}
            onEditProjectInfo={
              isViewingArchive ? () => {} : (pid) => openEditProj(pid)
            }
            onAddProject={
              isViewingArchive ? null : () => setModal("addProject")
            }
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

          {projects.length > 0 && plots.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: 140,
                left: 300,
                color: "#94a3b8",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              No timeline data yet
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Click the + button beside a project to start plotting
              </div>
            </div>
          )}

          <Legend settings={settings} />
        </div>

        {tooltip && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x + 16,
              top: tooltip.y - 8,
              background: "#0f172a",
              borderRadius: 12,
              padding: "12px 14px",
              fontSize: 11,
              zIndex: 9999,
              pointerEvents: "none",
              boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
              lineHeight: 1.7,
              minWidth: 180,
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {tooltip.title && (
              <div
                style={{ color: "#7dd3fc", fontWeight: 800, marginBottom: 4 }}
              >
                {tooltip.title}
              </div>
            )}

            {tooltip.project && (
              <div>
                <span style={{ color: "#94a3b8" }}>Project:</span>{" "}
                <span style={{ color: "#f8fafc" }}>{tooltip.project}</span>
              </div>
            )}

            {tooltip.priority && (
              <div>
                <span style={{ color: "#94a3b8" }}>Priority:</span>{" "}
                <span style={{ color: "#f8fafc" }}>{tooltip.priority}</span>
              </div>
            )}

            {tooltip.type && (
              <div>
                <span style={{ color: "#94a3b8" }}>Type:</span>{" "}
                <span style={{ color: "#f8fafc" }}>{tooltip.type}</span>
              </div>
            )}

            {tooltip.hours && (
              <div>
                <span style={{ color: "#94a3b8" }}>Hours:</span>{" "}
                <span style={{ color: "#f8fafc" }}>{tooltip.hours}</span>
              </div>
            )}

            {tooltip.range && (
              <div>
                <span style={{ color: "#94a3b8" }}>Dates:</span>{" "}
                <span style={{ color: "#f8fafc" }}>{tooltip.range}</span>
              </div>
            )}
          </div>
        )}

        {modal === "task" && mdata && !isViewingArchive && (
          <PlotModal
            project={projects.find((p) => p.id === mdata.pid)}
            task={tl.tasks[mdata.pid] || {}}
            globalStart={tl.plotStart}
            settings={settings}
            onClose={() => setModal(null)}
            onSave={(payload, ps) => doSaveTask(mdata.pid, payload, ps)}
            onAddNote={(n) => doAddNote(mdata.pid, n)}
            onDelNote={(nid) => doDelNote(mdata.pid, nid)}
            onEditNote={(n) => doEditNote(mdata.pid, n)}
            onShowCategoryModal={() => setShowCategoryModal(true)}
          />
        )}
        {showCategoryModal && (
          <CategoryRequiredModal onClose={() => setShowCategoryModal(false)} />
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
            settings={settings}
          />
        )}
        {modal === "addProject" && !isViewingArchive && (
          <AddProjectModal
            onClose={() => setModal(null)}
            onSave={doAddProject}
            settings={settings}
          />
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
      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            try {
              await deleteAccount();
              setShowDeleteModal(false);
              window.location.reload();
            } catch (err) {
              alert(err.message || "Failed to delete account");
            }
          }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   TOP HEADER
══════════════════════════════════════════════════════════ */
function TopBar({ user, onLogout, onDelete, onNavigateDashboard }) {
  return (
    <div
      style={{
        height: 86,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${UI.color.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 22px 0 22px",
        position: "relative",
        zIndex: 10,
      }}
    >
      <button
        onClick={onNavigateDashboard}
        style={{
          display: "flex",
          alignItems: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <img
          src="/timeline_logo_final.svg"
          alt="Timeline"
          style={{
            height: 64,
            width: "auto",
            display: "block",
            objectFit: "contain",
          }}
        />
      </button>

      <AccountDropdown user={user} onLogout={onLogout} onDelete={onDelete} />
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
  /* ─── HELPER: Calculate timeline summary ─────────────────────────────────── */
  function getTotal(task, settings) {
    const mode = settings?.trackingMode;

    if (mode === "simple") return task?.simpleHours || 0;

    if (mode === "task")
      return (task?.taskItems || []).reduce((s, t) => s + (t.hours || 0), 0);

    return Object.values(task?.priorityHours || {}).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );
  }

  function getTimelineSummary(tasks = {}, settings) {
    const projectIds = Object.keys(tasks || {});
    let totalHours = 0;
    let projectCountWithHours = 0;

    projectIds.forEach((pid) => {
      const projectHours = getTotal(tasks?.[pid], settings);

      totalHours += projectHours;

      if (projectHours > 0) {
        projectCountWithHours += 1;
      }
    });

    return {
      totalHours,
      projectCountWithHours,
      hasHours: totalHours > 0,
    };
  }

  function buildSlotColorMap(settings) {
    const slots = buildSlots(
      settings?.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
    );

    const map = {};
    slots.forEach((slot) => {
      map[slot.id] = slot.color || "#94a3b8";
    });

    return map;
  }

  function buildProjectColorMap(projects = []) {
    const map = {};
    projects.forEach((p) => {
      map[p.id] = p.color || "#94a3b8";
    });
    return map;
  }

  function buildPrimaryColorMap(settings) {
    const slots = buildSlots(
      settings?.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
    );

    const colorMap = {};

    slots.forEach((slot) => {
      const primaryId = slot.pId || parseSlotId(slot.id).group1Id;
      const color = slot.color || "#94a3b8";

      if (primaryId && !colorMap[primaryId]) {
        colorMap[primaryId] = color;
      }
    });

    return colorMap;
  }

  function getProjectPrimaryBreakdown(priorityHours = {}, settings) {
    const slots = buildSlots(
      settings?.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
    );

    const primaryColorMap = buildPrimaryColorMap(settings);
    const slotToPrimaryMap = {};

    slots.forEach((slot) => {
      const { group1Id } = parseSlotId(slot.id);
      const primaryId = slot.pId || group1Id;
      if (primaryId) {
        slotToPrimaryMap[slot.id] = primaryId;
      }
    });

    const grouped = {};

    Object.entries(priorityHours || {}).forEach(([slotId, rawVal]) => {
      const hours = Number(rawVal) || 0;
      if (hours <= 0) return;

      const primaryId = slotToPrimaryMap[slotId];
      if (!primaryId) return;

      grouped[primaryId] = (grouped[primaryId] || 0) + hours;
    });

    return Object.entries(grouped).map(([primaryId, value]) => ({
      primaryId,
      value,
      color: primaryColorMap[primaryId] || "#94a3b8",
    }));
  }

  function TimelineProjectPreview({ tasks, projects, settings }) {
    const items = Object.entries(tasks || {})
      .map(([pid, proj]) => {
        const total = Object.values(proj?.priorityHours || {}).reduce(
          (sum, rawVal) => sum + (Number(rawVal) || 0),
          0,
        );

        if (total <= 0) return null;

        const project = projects.find((p) => p.id === pid);
        const breakdown = getProjectPrimaryBreakdown(
          proj?.priorityHours || {},
          settings,
        );

        return {
          id: pid,
          name: project?.name || "Unknown",
          total,
          breakdown,
          projectColor: project?.color || "#94a3b8",
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.total - a.total);

    if (!items.length) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "20px 18px",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
            }}
          >
            <CalendarClock size={18} />
          </div>

          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#334155",
            }}
          >
            No hours plotted yet
          </div>

          <div
            style={{
              fontSize: 12.5,
              color: "#94a3b8",
              lineHeight: 1.6,
              maxWidth: 220,
            }}
          >
            This timeline has no tracked work yet.
          </div>
        </div>
      );
    }

    const visibleItems = items.slice(0, 3);
    const hiddenCount = items.length - visibleItems.length;

    return (
      <div
        style={{
          flex: 1,
          padding: "14px 18px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {visibleItems.map((item) => (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "120px minmax(0,1fr) auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: item.projectColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#334155",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.name}
              </span>
            </div>

            <div
              style={{
                height: 10,
                borderRadius: 999,
                overflow: "hidden",
                background: "#f1f5f9",
                display: "flex",
              }}
            >
              {item.breakdown.map((seg) => (
                <div
                  key={seg.primaryId}
                  style={{
                    width: `${(seg.value / item.total) * 100}%`,
                    background: seg.color,
                  }}
                  title={`${seg.value}h`}
                />
              ))}
            </div>

            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "#64748b",
                minWidth: 44,
                textAlign: "right",
              }}
            >
              {fromHours(item.total, settings).toFixed(1)} {settings.plotUnit}
            </div>
          </div>
        ))}

        {hiddenCount > 0 && (
          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              paddingTop: 2,
            }}
          >
            +{hiddenCount} more project{hiddenCount > 1 ? "s" : ""}
          </div>
        )}
      </div>
    );
  }

  function TimelineBars({ tasks, settings, projects }) {
    const slotColorMap = buildSlotColorMap(settings);
    const projectSegments = [];

    Object.entries(tasks || {}).forEach(([pid, proj]) => {
      let total = 0;
      let dominantColor = "#94a3b8";

      const colorWeight = {};

      Object.entries(proj?.priorityHours || {}).forEach(([slotId, rawVal]) => {
        const hours = Number(rawVal) || 0;
        if (hours <= 0) return;

        total += hours;

        const color = slotColorMap[slotId] || "#94a3b8";
        colorWeight[color] = (colorWeight[color] || 0) + hours;
      });

      if (total > 0) {
        dominantColor = Object.entries(colorWeight).sort(
          (a, b) => b[1] - a[1],
        )[0][0];

        projectSegments.push({
          projectId: pid,
          value: total,
          color: dominantColor,
        });
      }
    });

    const total = projectSegments.reduce((s, p) => s + p.value, 0);
    if (!total) return null;

    return (
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          background: "#f1f5f9",
        }}
      >
        {projectSegments.map((seg) => (
          <div
            key={seg.projectId}
            style={{
              width: `${(seg.value / total) * 100}%`,
              background: seg.color,
            }}
          />
        ))}
      </div>
    );
  }

  function TimelineLegend({ tasks, settings, projects }) {
    const slotColorMap = buildSlotColorMap(settings);
    const projectMap = {};

    Object.entries(tasks || {}).forEach(([pid, proj]) => {
      let total = 0;
      let dominantColor = "#94a3b8";

      const colorWeight = {};

      Object.entries(proj?.priorityHours || {}).forEach(([slotId, rawVal]) => {
        const hours = Number(rawVal) || 0;
        if (hours <= 0) return;

        total += hours;

        const color = slotColorMap[slotId] || "#94a3b8";
        colorWeight[color] = (colorWeight[color] || 0) + hours;
      });

      if (total > 0) {
        dominantColor = Object.entries(colorWeight).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0];

        const projectName =
          projects.find((p) => p.id === pid)?.name || "Unknown";

        projectMap[pid] = {
          name: projectName,
          total,
          color: dominantColor,
        };
      }
    });

    const items = Object.values(projectMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    if (!items.length) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: item.color,
                }}
              />
              <span style={{ color: "#334155", fontWeight: 600 }}>
                {item.name}
              </span>
            </div>

            <span style={{ color: "#64748b" }}>
              {fromHours(item.total, settings).toFixed(1)} {settings.plotUnit}
            </span>
          </div>
        ))}
      </div>
    );
  }

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
    lp: "#4f46e5",
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
            zIndex: 4000,
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
                  padding: "8px 16px",
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--text-2)",
                  transition: "all .18s cubic-bezier(.4,0,.2,1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f1f5fd";
                  e.currentTarget.style.borderColor = BRAND.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.background = "#e0e7ff";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.background = "#f1f5fd";
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
                  padding: "8px 16px",
                  background: BRAND.primary,
                  border: "none",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: "white",
                  transition: "all .18s cubic-bezier(.4,0,.2,1)",
                  boxShadow: "0 4px 12px rgba(79,70,229,0.18)",
                }}
                onMouseEnter={(e) => btnHoverOn(e, "primary")}
                onMouseLeave={(e) => btnHoverOff(e, "primary")}
                onMouseDown={(e) => btnActive(e, "primary")}
                onMouseUp={(e) => btnHoverOn(e, "primary")}
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
          minHeight: 68,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 28px",
          borderBottom: "1px solid #e5e7eb",
          flexShrink: 0,
        }}
      >
        {/* LEFT: Team dropdown + Settings */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setTeamOpen((o) => !o)}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#6366f1",
                }}
              />
              {activeTeam?.name || "Workspace"}
              <span style={{ marginLeft: 4, color: "#94a3b8" }}>▾</span>
            </button>

            {teamOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  boxShadow: "0 12px 32px rgba(15,23,42,0.10)",
                  zIndex: 200,
                  minWidth: 220,
                  padding: 8,
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
                      padding: "10px 12px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: t.id === activeTeamId ? 700 : 500,
                      color: t.id === activeTeamId ? BRAND.primary : "#0f172a",
                      background:
                        t.id === activeTeamId ? "#eef2ff" : "transparent",
                    }}
                  >
                    {t.id === activeTeamId ? "✓ " : ""}
                    {t.name}
                  </div>
                ))}

                <div
                  style={{
                    height: 1,
                    background: "#e5e7eb",
                    margin: "8px 0",
                  }}
                />

                <button
                  onClick={() => {
                    onAddTeam();
                    setTeamOpen(false);
                  }}
                  style={{
                    width: "100%",
                    height: 40,
                    borderRadius: 10,
                    border: "1px solid #c7d2fe",
                    background: "#eef2ff",
                    color: BRAND.primary,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "left",
                    padding: "0 12px",
                    transition: "all .18s cubic-bezier(.4,0,.2,1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#dbeafe";
                    e.currentTarget.style.borderColor = BRAND.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#eef2ff";
                    e.currentTarget.style.borderColor = "#c7d2fe";
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.background = "#c7d2fe";
                    e.currentTarget.style.transform = "scale(0.98)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.background = "#dbeafe";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  + Add Workspace
                </button>
              </div>
            )}
          </div>

          <AppButton variant="secondary" onClick={() => setModal("settings")}>
            <SlidersHorizontal size={16} />
            Settings
          </AppButton>
        </div>

        <div style={{ flex: 1 }} />

        <AppButton variant="success" onClick={onCompare}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M5 8H2m0 0l2-2M2 8l2 2M11 8h3m0 0l-2-2m2 2l-2 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {APP_STRINGS.actions.compare}
        </AppButton>

        <AppButton
          variant="secondary"
          onClick={() => setShowTrash((v) => !v)}
          style={{ position: "relative" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 4h10M6 4V2.8c0-.44.36-.8.8-.8h2.4c.44 0 .8.36.8.8V4M5.2 4v8.2c0 .44.36.8.8.8h4c.44 0 .8-.36.8-.8V4M7 6.5v4.5M9 6.5v4.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Trash
          {trashItems.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                background: "#ef4444",
                color: "white",
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 10,
                padding: "2px 6px",
                lineHeight: 1.4,
              }}
            >
              {trashItems.length}
            </span>
          )}
        </AppButton>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "28px 32px 44px",
          background:
            "linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 220px, #f8fafc 100%)",
        }}
      >
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
                marginBottom: 24,
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ ...sectionTitle, fontSize: 18 }}>
                  Your Timelines
                </div>
                <div style={{ ...sectionSub, marginTop: 4 }}>
                  Create, review, and compare reporting periods
                </div>
              </div>

              <span
                style={{
                  fontSize: 12,
                  color: UI.color.text3,
                  fontWeight: 700,
                }}
              >
                {cards.length} timeline{cards.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={timelineGrid}>
              {/* + New Timeline card */}
              <div
                style={timelineCardShell}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow =
                    "0 14px 32px rgba(15,23,42,0.10), 0 0 0 1px rgba(99,102,241,0.05)";
                  e.currentTarget.style.borderColor = "#dbeafe";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 18px rgba(15,23,42,0.05)";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform =
                    "translateY(-1px) scale(0.98)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
              >
                <button
                  onClick={onNewTimeline}
                  style={{
                    ...newTimelineCardBody,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={newTimelineIconWrap}>
                    <Plus size={32} />
                  </div>

                  <div style={newTimelineTitle}>New Timeline</div>

                  <div style={newTimelineSub}>Start a new reporting period</div>
                </button>
              </div>

              {cards.map((card) => {
                const totalProjects = Object.keys(card.tasks).filter((pid) =>
                  Object.values(card.tasks[pid]?.priorityHours || {}).some(
                    (h) => Number(h) > 0,
                  ),
                ).length;
                const isEditing = renamingId === card.id;
                const summary = getTimelineSummary(card.tasks, settings);

                return (
                  <div
                    key={card.id}
                    style={timelineCardShell}
                    onClick={() => !isEditing && onOpen(card.id)}
                    onMouseEnter={(e) => {
                      if (!isEditing) {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow =
                          "0 14px 32px rgba(15,23,42,0.10), 0 0 0 1px rgba(99,102,241,0.05)";
                        e.currentTarget.style.borderColor = "#dbeafe";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 6px 18px rgba(15,23,42,0.05)";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                    onMouseDown={(e) => {
                      if (!isEditing) {
                        e.currentTarget.style.transform =
                          "translateY(-1px) scale(0.98)";
                      }
                    }}
                    onMouseUp={(e) => {
                      if (!isEditing) {
                        e.currentTarget.style.transform = "translateY(-4px)";
                      }
                    }}
                  >
                    {/* Top Section */}
                    <div style={timelineTop}>
                      {!isEditing ? (
                        <div
                          onDoubleClick={() => {
                            setRenamingId(card.id);
                            setRenameVal(card.label);
                          }}
                          style={{
                            ...timelineTitle,
                            cursor: "pointer",
                          }}
                        >
                          {card.label}
                        </div>
                      ) : (
                        <div style={timelineTopRow}>
                          <input
                            value={renameVal}
                            onChange={(e) => setRenameVal(e.target.value)}
                            style={timelineNameInput}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                onRename(
                                  card.id,
                                  renameVal.trim() || card.label,
                                );
                                setRenamingId(null);
                              }
                              if (e.key === "Escape") {
                                setRenameVal(card.label);
                                setRenamingId(null);
                              }
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = "#6366f1";
                              e.currentTarget.style.boxShadow =
                                "0 0 0 4px rgba(99,102,241,0.10)";
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = "#dbe3f0";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                            placeholder="Timeline name"
                            onClick={(e) => e.stopPropagation()}
                          />

                          <button
                            style={getButtonStyle(
                              "primary",
                              "default",
                              timelineSaveBtnCompact,
                            )}
                            {...bindButtonStates("primary")}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRename(card.id, renameVal.trim() || card.label);
                              setRenamingId(null);
                            }}
                          >
                            Save
                          </button>

                          <button
                            style={getButtonStyle(
                              "icon",
                              "default",
                              timelineIconBtnCompact,
                            )}
                            {...bindButtonStates("icon")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameVal(card.label);
                              setRenamingId(null);
                            }}
                            aria-label="Cancel rename"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      )}

                      <div style={timelineMeta}>
                        Started {fmt(card.date)} ·{" "}
                        {summary.projectCountWithHours} project
                        {summary.projectCountWithHours !== 1 ? "s" : ""} ·{" "}
                        {summary.totalHours} hours
                      </div>
                    </div>

                    <TimelineProjectPreview
                      tasks={card.tasks}
                      projects={projects}
                      settings={settings}
                    />

                    {/* Footer Section */}
                    <div
                      style={timelineFooter}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setRenamingId(card.id);
                          setRenameVal(card.label);
                        }}
                        style={{
                          ...getButtonStyle("secondary"),
                          flex: 1,
                        }}
                        {...bindButtonStates("secondary")}
                      >
                        Rename
                      </button>

                      <button
                        onClick={() => onRemove(card.id)}
                        style={{
                          ...getButtonStyle("softDanger"),
                          flex: 1,
                        }}
                        {...bindButtonStates("softDanger")}
                      >
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

/* ── BUTTON STYLES ── */
const toolbarBaseBtn = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const toolbarBtnPrimary = {
  ...toolbarBaseBtn,
  background: "#4f46e5",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
};

const toolbarBtnCompare = {
  ...toolbarBaseBtn,
  background: "#16a34a",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
};

const toolbarBtnDanger = {
  ...toolbarBaseBtn,
  background: "#ef4444",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
};

const toolbarBtnGhost = {
  ...toolbarBaseBtn,
  background: "#fff",
  border: "1px solid var(--border)",
  padding: "8px 10px",
};

const toolbarBtnIcon = {
  ...toolbarBaseBtn,
  background: "#fff",
  border: "1px solid var(--border)",
  padding: "6px",
};

const toolbarGroup = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const toolbarDivider = {
  width: 1,
  height: 22,
  background: "#e5e7eb",
  margin: "0 4px",
};

function Header({
  teams,
  activeTeamId,
  onSwitchTeam,
  onAddTeam,
  onEditTeam,
  onSave,
  isDirty,
  isSaving,
  justSaved,
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
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 18px",
        background: "#fff",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* LEFT: Comparison & Settings */}
      <div style={toolbarGroup}>
        <AppButton
          variant="success"
          onClick={onCompare}
          title="Compare timelines"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M5 8H2m0 0l2-2M2 8l2 2M11 8h3m0 0l-2-2m2 2l-2 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {APP_STRINGS.actions.compare}
        </AppButton>
        {onSettings && (
          <>
            <div style={toolbarDivider} />
            <button
              onClick={onSettings}
              style={iconBtn}
              title="Settings"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.borderColor = "#cbd5e1";
                e.currentTarget.style.color = "var(--text)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.borderColor = UI.color.border;
                e.currentTarget.style.color = UI.color.text2;
                e.currentTarget.style.transform = "translateY(0)";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.background = "#e0e7ff";
                e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
            >
              <Settings size={16} />
            </button>
          </>
        )}
      </div>

      {/* RIGHT: Undo/Redo, Clear, Save */}
      <div style={toolbarGroup}>
        <button
          onClick={canUndo ? onUndo : undefined}
          style={{ ...iconBtn, opacity: canUndo ? 1 : 0.4 }}
          title="Undo"
          onMouseEnter={(e) => {
            if (canUndo) {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.color = "var(--text)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (canUndo) {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.borderColor = UI.color.border;
              e.currentTarget.style.color = UI.color.text2;
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
          onMouseDown={(e) => {
            if (canUndo) {
              e.currentTarget.style.background = "#e0e7ff";
              e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
            }
          }}
          onMouseUp={(e) => {
            if (canUndo) {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={canRedo ? onRedo : undefined}
          style={{ ...iconBtn, opacity: canRedo ? 1 : 0.4 }}
          title="Redo"
          onMouseEnter={(e) => {
            if (canRedo) {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.color = "var(--text)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (canRedo) {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.borderColor = UI.color.border;
              e.currentTarget.style.color = UI.color.text2;
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
          onMouseDown={(e) => {
            if (canRedo) {
              e.currentTarget.style.background = "#e0e7ff";
              e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
            }
          }}
          onMouseUp={(e) => {
            if (canRedo) {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
        >
          <Redo2 size={16} />
        </button>

        {!isViewingArchive && onClearTimeline && (
          <>
            <div style={toolbarDivider} />
            <button
              onClick={onClearTimeline}
              style={softDangerBtn}
              title="Clear all plotted hours"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fecdd3";
                e.currentTarget.style.borderColor = "#f87171";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 6px 16px rgba(239,68,68,0.24)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = UI.color.redSoft;
                e.currentTarget.style.borderColor = "#fecdd3";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.background = "#fbcfe8";
                e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.background = "#fecdd3";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
            >
              <Trash2 size={16} />
              Clear
            </button>
          </>
        )}

        {!isViewingArchive && onSave && (
          <>
            <div style={toolbarDivider} />
            <button
              onClick={onSave}
              disabled={isSaving || (!isDirty && !justSaved)}
              style={{
                ...(isSaving
                  ? { ...primaryBtn, opacity: 0.6 }
                  : justSaved
                    ? { ...primaryBtn, background: "#16a34a" }
                    : isDirty
                      ? primaryBtn
                      : { ...primaryBtn, opacity: 0.5 }),
              }}
              title={isDirty ? "Save changes" : "No changes to save"}
              onMouseEnter={(e) => {
                if (!isSaving && isDirty) {
                  e.currentTarget.style.background = BRAND.primaryHover;
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 24px rgba(79,70,229,0.22)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaving && isDirty) {
                  e.currentTarget.style.background = primaryBtn.background;
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 18px rgba(79,70,229,0.18)";
                }
              }}
              onMouseDown={(e) => {
                if (!isSaving && isDirty) {
                  e.currentTarget.style.background = BRAND.primaryHover;
                  e.currentTarget.style.transform =
                    "translateY(1px) scale(0.98)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 6px rgba(79,70,229,0.18)";
                }
              }}
              onMouseUp={(e) => {
                if (!isSaving && isDirty) {
                  e.currentTarget.style.background = BRAND.primaryHover;
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 24px rgba(79,70,229,0.22)";
                }
              }}
            >
              {isSaving ? (
                <>
                  <Loader2
                    size={16}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  Saving...
                </>
              ) : justSaved ? (
                <>
                  <Check size={16} />
                  Saved
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save
                </>
              )}
            </button>
          </>
        )}
      </div>
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
  const [a, setA] = useState(false);
  let bg = "var(--bg)",
    tc = "var(--text-2)",
    border = "var(--border)",
    shadowStyle = "none";
  if (ghost) {
    bg = a ? "#e0e7ff" : h ? "#f1f5f9" : "transparent";
    border = "transparent";
    tc = h || a ? "var(--text)" : "var(--text-2)";
  }
  if (icon) {
    bg = a ? "#e0e7ff" : h ? "#f1f5f9" : "transparent";
    border = "transparent";
    tc = h || a ? "var(--text)" : "var(--text-3)";
  }
  if (blue) {
    bg = a ? "#387ccf" : h ? "#1d63d8" : BRAND.primary;
    tc = "white";
    border = "transparent";
    shadowStyle = a
      ? "0 2px 6px rgba(79,70,229,0.12)"
      : h
        ? "0 6px 16px rgba(79,70,229,0.24)"
        : "0 4px 12px rgba(79,70,229,0.18)";
  }
  if (green) {
    bg = a ? "#15803d" : h ? "#22c55e" : "#16a34a";
    tc = "white";
    border = "transparent";
    shadowStyle = a
      ? "0 2px 6px rgba(22,163,74,0.12)"
      : h
        ? "0 6px 16px rgba(22,163,74,0.24)"
        : "0 4px 12px rgba(22,163,74,0.18)";
  }
  if (amber) {
    bg = a ? "#92400e" : h ? "#d97706" : "#b8860b";
    tc = "white";
    border = "transparent";
    shadowStyle = a
      ? "0 2px 6px rgba(217,119,6,0.12)"
      : h
        ? "0 6px 16px rgba(217,119,6,0.24)"
        : "0 4px 12px rgba(217,119,6,0.18)";
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
      onMouseLeave={() => {
        setH(false);
        setA(false);
      }}
      onMouseDown={() => !disabled && setA(true)}
      onMouseUp={() => setA(false)}
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
        transition: "all .18s cubic-bezier(.4,0,.2,1)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: a ? "scale(0.96)" : h ? "translateY(-1px)" : "translateY(0)",
        boxShadow: shadowStyle,
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
  hoverDate,
  setHoverDate,
  onEditProject,
  onEditProjectInfo,
  onAddProject,
  onDelNote,
  onNoteClick,
  setTooltip,
  cellZoom = 34,
}) {
  const membersEnabled = settings?.membersEnabled !== false;
  const leftCols = membersEnabled ? 2 : 1;
  const CW = cellZoom,
    PW = 178,
    MW = membersEnabled ? 128 : 0,
    RH = 48;

  function specialBg(d) {
    const t = dayType(d, settings);
    if (t === "weekend") return "var(--wknd-bg)";
    if (t === "alignment") return "var(--align-bg)";
    if (t === "holiday") return "var(--holiday-bg)";
    return null;
  }

  return (
    <div
      style={{
        paddingBottom: 200,
        minHeight: "100%",
        display: "block",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: "100%",
          height: "auto",
        }}
      >
        <colgroup>
          <col style={{ width: PW, minWidth: PW }} />
          {membersEnabled && <col style={{ width: MW, minWidth: MW }} />}
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
            {membersEnabled && (
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
            )}
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
            {membersEnabled && (
              <th
                style={{
                  ...sTH(PW, 20),
                  background: "#f8fafc",
                  borderBottom: "2px solid var(--border)",
                  borderRight: "1px solid var(--border)",
                  zIndex: 20,
                }}
              />
            )}
            {displayDates.map((d) => {
              const t = dayType(d, settings);
              const dn = parseInt(d.split("-")[2]);
              const dow = pd(d).getDay();
              const isToday = d === today();
              const isHovered = hoverDate === d;
              const isWeekend = t !== "work";
              const isSpecial = t !== "work";
              return (
                <th
                  key={d}
                  style={{
                    minWidth: CW,
                    width: CW,
                    textAlign: "center",
                    background: isHovered
                      ? "#eef2ff"
                      : isToday
                        ? "#eef2ff"
                        : isWeekend
                          ? "#fafafa"
                          : "#fff",
                    borderRight: "1px solid var(--border)",
                    borderBottom: "2px solid var(--border)",
                    position: "sticky",
                    top: 20,
                    zIndex: 5,
                    padding: 0,
                    transition: "background .15s ease",
                  }}
                  onMouseEnter={() => setHoverDate?.(d)}
                  onMouseLeave={() => setHoverDate?.(null)}
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
                        fontWeight: isToday ? 800 : 600,
                        color: isToday ? BRAND.primary : "var(--text-2)",
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
              {/* Project column */}
              <td
                style={{
                  position: "sticky",
                  left: 0,
                  background: "#fff",
                  borderRight: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  height: RH,
                  padding: "8px 16px",
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                }}
              >
                {onAddProject && (
                  <button
                    onClick={onAddProject}
                    style={{
                      width: "fit-content",
                      height: 32,
                      borderRadius: 8,
                      border: "2px dashed #c7d2fe",
                      background: "#f8fbff",
                      color: BRAND.primary,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "0 12px",
                      transition: "all .15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#eef2ff";
                      e.currentTarget.style.borderColor = "#60a5fa";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f8fbff";
                      e.currentTarget.style.borderColor = "#c7d2fe";
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                    Add Project
                  </button>
                )}
              </td>

              {/* Members column */}
              {membersEnabled && (
                <td
                  style={{
                    position: "sticky",
                    left: PW,
                    background: "#fff",
                    borderRight: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                    height: RH,
                    zIndex: 1,
                  }}
                />
              )}

              {/* Date cells */}
              {displayDates.map((d) => (
                <td
                  key={d}
                  style={{
                    height: RH,
                    minWidth: CW,
                    background: specialBg(d) || "#fff",
                    borderRight: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                  }}
                />
              ))}
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
                    {membersEnabled && (
                      <td
                        style={{
                          ...sTD(PW),
                          background: "#fff",
                          border: "none",
                          borderRight: "1px solid var(--border)",
                        }}
                      />
                    )}
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
                        padding: "0 12px 0 10px",
                        verticalAlign: "middle",
                        zIndex: 11,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 4,
                            height: 28,
                            borderRadius: 999,
                            background: p.color || BRAND.primary,
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: UI.color.text,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              letterSpacing: "-0.01em",
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
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProject(p.id);
                            }}
                            style={iconBtn}
                            title="Plot hours"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#eef2ff";
                              e.currentTarget.style.borderColor = "#c7d2fe";
                              e.currentTarget.style.color = "#4f46e5";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#fff";
                              e.currentTarget.style.borderColor =
                                UI.color.border;
                              e.currentTarget.style.color = UI.color.text2;
                            }}
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProjectInfo(p.id);
                            }}
                            style={iconBtn}
                            title="Edit project"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#eef2ff";
                              e.currentTarget.style.borderColor = "#c7d2fe";
                              e.currentTarget.style.color = "#4f46e5";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#fff";
                              e.currentTarget.style.borderColor =
                                UI.color.border;
                              e.currentTarget.style.color = UI.color.text2;
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Members */}
                    {membersEnabled && (
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
                    )}

                    {/* Calendar cells — partial-day segments */}
                    {displayDates.map((d, i) => {
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
                            background:
                              sb || (i % 2 === 0 ? "#ffffff" : "#f8fafc"),
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
                                    title: p.name,
                                    type: seg.g2Label,
                                    hours: `${seg.segHours}h`,
                                    range: fmt(d),
                                  });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                onClick={() => onEditProject(p.id)}
                              >
                                <TimelineCell slot={seg} />
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
            {membersEnabled && (
              <td
                style={{
                  ...sTD(PW),
                  background: "#fff",
                  border: "none",
                  borderRight: "1px solid var(--border)",
                }}
              />
            )}
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
          {onAddProject && projects.length > 0 && (
            <tr>
              <td
                colSpan={leftCols}
                style={{
                  ...sTD(0),
                  padding: "12px",
                  background: "#fff",
                  borderRight: "1px solid var(--border)",
                  zIndex: 10,
                }}
              >
                <button
                  onClick={onAddProject}
                  style={{
                    marginTop: 10,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px dashed #cbd5f5",
                    background: "#f8fbff",
                    color: "#4f46e5",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add Project
                </button>
              </td>
              {displayDates.map((d) => (
                <td key={d} style={{ background: "transparent" }} />
              ))}
            </tr>
          )}
          <tr style={{ height: 32 }}>
            <td
              colSpan={displayDates.length + leftCols}
              style={{ border: "none" }}
            />
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
   ONBOARDING SHARED STYLES & HANDLERS
══════════════════════════════════════════════════════════ */

/* INPUT STYLES */
const onboardingInput = {
  width: "100%",
  height: 52,
  borderRadius: 14,
  border: "1px solid #dbe3f0",
  background: "#ffffff",
  padding: "0 16px",
  fontSize: 15,
  color: "#0f172a",
  outline: "none",
  transition: "all .18s ease",
  boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
  fontFamily: "inherit",
};

function onboardingInputFocus(e) {
  e.currentTarget.style.borderColor = "#4f46e5";
  e.currentTarget.style.boxShadow = "0 0 0 4px #eef2ff";
}

function onboardingInputBlur(e) {
  e.currentTarget.style.borderColor = "#dbe3f0";
  e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,0.03)";
}

/* PRIMARY BUTTON */
const onboardingPrimaryBtn = {
  height: 48,
  minWidth: 190,
  padding: "0 20px",
  borderRadius: 14,
  border: "none",
  background: "#4f46e5",
  color: "#fff",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  transition: "all .18s ease",
  boxShadow: "0 8px 20px rgba(79,70,229,0.18)",
};

function primaryBtnHoverOn(e) {
  e.currentTarget.style.background = "#4338ca";
  e.currentTarget.style.transform = "translateY(-1px)";
  e.currentTarget.style.boxShadow = "0 12px 24px rgba(79,70,229,0.22)";
}

function primaryBtnHoverOff(e) {
  e.currentTarget.style.background = "#4f46e5";
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 8px 20px rgba(79,70,229,0.18)";
}

/* SECONDARY BUTTON */
const onboardingSecondaryBtn = {
  height: 48,
  minWidth: 150,
  padding: "0 20px",
  borderRadius: 14,
  border: "1px solid #dbe3f0",
  background: "#fff",
  color: "#334155",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  transition: "all .18s ease",
};

function secondaryBtnHoverOn(e) {
  e.currentTarget.style.background = "#f8fafc";
  e.currentTarget.style.borderColor = "#cbd5e1";
}

function secondaryBtnHoverOff(e) {
  e.currentTarget.style.background = "#fff";
  e.currentTarget.style.borderColor = "#dbe3f0";
}

/* GHOST BUTTON */
const onboardingGhostBtn = {
  height: 48,
  minWidth: 150,
  padding: "0 20px",
  borderRadius: 14,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#4f46e5",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  transition: "all .18s ease",
};

function ghostBtnHoverOn(e) {
  e.currentTarget.style.background = "#e0e7ff";
  e.currentTarget.style.borderColor = "#a5b4fc";
}

function ghostBtnHoverOff(e) {
  e.currentTarget.style.background = "#eef2ff";
  e.currentTarget.style.borderColor = "#c7d2fe";
}

/* ══════════════════════════════════════════════════════════
   ONBOARDING SHELL (Reusable wrapper for onboarding screens)
══════════════════════════════════════════════════════════ */
function OnboardingShell({
  step = 1,
  totalSteps = 2,
  title,
  subtitle,
  children,
  onLogout,
  footer,
}) {
  return (
    <div className="app-shell">
      {/* TOP APP BAR */}
      <div
        className="app-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 10px 24px rgba(79,70,229,0.18)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16M4 12h10M4 17h7M18 10v8M14 14h8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <img
              src="/timeline_logo_final.svg"
              alt="Timeline"
              style={{
                height: 40,
                width: "auto",
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "#94a3b8",
                }}
              >
                Workspace onboarding
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          style={secondaryBtn}
          onMouseEnter={(e) => btnHoverOn(e, "secondary")}
          onMouseLeave={(e) => btnHoverOff(e, "secondary")}
          onMouseDown={(e) => btnActive(e, "secondary")}
          onMouseUp={(e) => btnHoverOn(e, "secondary")}
        >
          Logout
        </button>
      </div>

      {/* ONBOARDING CONTAINER */}
      <div className="onboarding">
        {/* STICKY TITLE + PROGRESS */}
        <div className="onboarding-sticky">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {Array.from({ length: totalSteps }).map((_, i) => {
                const current = i + 1;
                const active = current === step;
                const done = current < step;

                return (
                  <div
                    key={current}
                    style={{
                      width: active ? 28 : 10,
                      height: 10,
                      borderRadius: 999,
                      background: done
                        ? "#22c55e"
                        : active
                          ? "#4f46e5"
                          : "#cbd5e1",
                      transition: "all .2s ease",
                    }}
                  />
                );
              })}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>
              Step {step} of {totalSteps}
            </div>
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>

          <div style={{ marginTop: 6, fontSize: 14, color: "#94a3b8" }}>
            {subtitle}
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="onboarding-content">{children}</div>

        {/* STICKY FOOTER */}
        {footer ? <div className="onboarding-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL SHELL + FORM PRIMITIVES
══════════════════════════════════════════════════════════ */
function Modal({
  title,
  sub,
  onClose,
  children,
  wide = false,
  ultraWide = false,
}) {
  const width = ultraWide
    ? "min(1440px, 96vw)"
    : wide
      ? "min(1240px, 94vw)"
      : "min(760px, 92vw)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4000,
        padding: 24,
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width,
          maxHeight: "92vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 18,
          border: "1px solid var(--border)",
          boxShadow: "0 24px 80px rgba(15,23,42,0.20)",
        }}
      >
        <div
          style={{
            padding: "22px 28px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text)",
                marginBottom: sub ? 4 : 0,
              }}
            >
              {title}
            </div>

            {sub ? (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-3)",
                  lineHeight: 1.5,
                }}
              >
                {sub}
              </div>
            ) : null}
          </div>

          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid transparent",
              background: "transparent",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 26,
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.color = "#475569";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "20px 28px 28px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── SETTINGS SECTION ─────────────────────────────────────────────────── */
function SettingsSection({ title, sub, children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${UI.color.border}`,
        borderRadius: UI.radius.lg,
        padding: 18,
        marginBottom: 18,
        boxShadow: "0 1px 0 rgba(15,23,42,0.02)",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...sectionTitle }}>{title}</div>
        {sub ? <div style={{ ...sectionSub, marginTop: 3 }}>{sub}</div> : null}
      </div>
      {children}
    </div>
  );
}

/* ─── OPTION ROW ───────────────────────────────────────────────────────── */
function OptionRow({
  value,
  onChange,
  right,
  onRemove,
  gridTemplateColumns = GROUP_GRID_COLOR,
  removeLabel = "Remove",
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns,
        gap: 10,
        alignItems: "center",
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Option name"
        style={settingsInputStyle}
      />

      {right}

      <button onClick={onRemove} style={settingsRemoveBtn}>
        {removeLabel}
      </button>
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
  const [a, setA] = useState(false);
  const V = {
    ghost: {
      bg: a ? "var(--bg)" : h ? "#f1f5f9" : "transparent",
      tc: "var(--text-2)",
      bc: "var(--border)",
      transform: a ? "scale(0.96)" : h ? "translateY(-1px)" : "translateY(0)",
      shadow: a ? "0 0 0" : h ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
    },
    primary: {
      bg: a ? "#387ccf" : h ? "#1d63d8" : BRAND.primary,
      tc: "#fff",
      bc: "transparent",
      transform: a ? "scale(0.96)" : h ? "translateY(-1px)" : "translateY(0)",
      shadow: a
        ? "0 2px 6px rgba(79,70,229,0.12)"
        : h
          ? "0 6px 16px rgba(79,70,229,0.24)"
          : "0 4px 12px rgba(79,70,229,0.18)",
    },
    success: {
      bg: a ? "#15803d" : h ? "#22c55e" : "#16a34a",
      tc: "#fff",
      bc: "transparent",
      transform: a ? "scale(0.96)" : h ? "translateY(-1px)" : "translateY(0)",
      shadow: a
        ? "0 2px 6px rgba(22,163,74,0.12)"
        : h
          ? "0 6px 16px rgba(22,163,74,0.24)"
          : "0 4px 12px rgba(22,163,74,0.18)",
    },
    danger: {
      bg: a ? "#7f1d1d" : h ? "#dc2626" : "#ef4444",
      tc: "#fff",
      bc: "transparent",
      transform: a ? "scale(0.96)" : h ? "translateY(-1px)" : "translateY(0)",
      shadow: a
        ? "0 2px 6px rgba(239,68,68,0.12)"
        : h
          ? "0 6px 16px rgba(239,68,68,0.24)"
          : "0 4px 12px rgba(239,68,68,0.18)",
    },
    amber: {
      bg: a ? "#92400e" : h ? "#d97706" : "#b8860b",
      tc: "#fff",
      bc: "transparent",
      transform: a ? "scale(0.96)" : h ? "translateY(-1px)" : "translateY(0)",
      shadow: a
        ? "0 2px 6px rgba(217,119,6,0.12)"
        : h
          ? "0 6px 16px rgba(217,119,6,0.24)"
          : "0 4px 12px rgba(217,119,6,0.18)",
    },
    subtle: {
      bg: a ? "#e0e7ff" : h ? "#f1f5f9" : "#f8fafc",
      tc: "var(--text-2)",
      bc: "var(--border)",
      transform: a ? "scale(0.96)" : h ? "translateY(-1px)" : "translateY(0)",
      shadow: a ? "0 0 0" : h ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
    },
  };
  const s = V[v] || V.ghost;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => {
        setH(false);
        setA(false);
      }}
      onMouseDown={() => !disabled && setA(true)}
      onMouseUp={() => setA(false)}
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
        transition: "all .18s cubic-bezier(.4,0,.2,1)",
        opacity: disabled ? 0.5 : 1,
        transform: s.transform,
        boxShadow: s.shadow,
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
            transition: "all .18s cubic-bezier(.4,0,.2,1)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-2)";
            e.currentTarget.style.transform = "scale(1.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-3)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1.2)";
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
function Alert({ children, type = "info", title, action = null, style = {} }) {
  const tones = {
    info: {
      bg: "#ffffff",
      border: "#e5e7eb",
      iconBg: "#f8fafc",
      iconColor: "#475569",
      titleColor: "#0f172a",
      textColor: "#475569",
      Icon: Info,
    },
    success: {
      bg: "#ffffff",
      border: "#dcfce7",
      iconBg: "#f0fdf4",
      iconColor: "#16a34a",
      titleColor: "#14532d",
      textColor: "#475569",
      Icon: CheckCircle2,
    },
    warning: {
      bg: "#ffffff",
      border: "#fde68a",
      iconBg: "#fffbeb",
      iconColor: "#d97706",
      titleColor: "#78350f",
      textColor: "#475569",
      Icon: AlertTriangle,
    },
    danger: {
      bg: "#ffffff",
      border: "#fecaca",
      iconBg: "#fef2f2",
      iconColor: "#dc2626",
      titleColor: "#7f1d1d",
      textColor: "#475569",
      Icon: XCircle,
    },
  };

  const t = tones[type] || tones.info;
  const Icon = t.Icon;
  const hasBody =
    children !== undefined && children !== null && children !== "";

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid ${t.border}`,
        background: t.bg,
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
        ...style,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: t.iconBg,
          color: t.iconColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon size={16} strokeWidth={2.1} />
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        {title && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: t.titleColor,
              lineHeight: 1.35,
              marginBottom: hasBody ? 3 : 0,
            }}
          >
            {title}
          </div>
        )}

        {hasBody && (
          <div
            style={{
              fontSize: 13,
              color: t.textColor,
              lineHeight: 1.55,
            }}
          >
            {children}
          </div>
        )}
      </div>

      {action ? (
        <div style={{ flexShrink: 0, marginLeft: 8 }}>{action}</div>
      ) : null}
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
function AddProjectModal({ onClose, onSave, settings }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [color, setColor] = useState("#4f46e5");
  const membersEnabled = settings?.membersEnabled !== false;
  return (
    <Modal title="Add New Project" onClose={onClose}>
      <Fld label="Project Name">
        <Inp value={name} onChange={setName} placeholder="e.g. HRIS" />
      </Fld>
      {membersEnabled && (
        <Fld label="Members">
          <MembersInput members={members} onChange={setMembers} />
        </Fld>
      )}
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
            if (name.trim())
              onSave({
                name: name.trim(),
                members: membersEnabled ? members : [],
                color,
              });
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

// Simple mode editor
function SimpleEditor({ value, onChange }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 700 }}>Total Hours</div>

      <input
        type="number"
        min="0"
        step="0.5"
        value={value || 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{
          height: 44,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: "0 14px",
        }}
      />
    </div>
  );
}

// Task mode editor
function TaskEditor({ items = [], onChange }) {
  function update(i, patch) {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    onChange(next);
  }

  function add() {
    onChange([...items, { id: Date.now(), name: "", hours: 0 }]);
  }

  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 100px 80px",
            gap: 10,
          }}
        >
          <input
            value={item.name}
            placeholder="Task name"
            onChange={(e) => update(i, { name: e.target.value })}
            style={{
              height: 40,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "0 12px",
            }}
          />

          <input
            type="number"
            value={item.hours}
            onChange={(e) => update(i, { hours: Number(e.target.value) || 0 })}
            style={{
              height: 40,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "0 12px",
            }}
          />

          <button
            onClick={() => remove(i)}
            style={{
              height: 40,
              borderRadius: 12,
              border: "1px solid #fca5a5",
              background: "#ffe4e4",
              color: "#991b1b",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <button
        onClick={add}
        style={{
          height: 40,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#f8fafc",
          color: "#64748b",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        + Add Task
      </button>
    </div>
  );
}

function TrackingModeBadge({ mode }) {
  const labels = {
    [TRACKING_MODES.SIMPLE]: "Simple",
    [TRACKING_MODES.GROUPED]: "Grouped",
    [TRACKING_MODES.TASK]: "Task",
  };

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#475569",
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 999,
        padding: "6px 10px",
      }}
    >
      {labels[mode] || "Grouped"}
    </span>
  );
}

function CategoryRequiredModal({ onClose }) {
  return (
    <Modal title="Setup Required" onClose={onClose} width={420}>
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            color: "#9a3412",
          }}
        >
          Please create at least one option in Category 1 before plotting hours.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <AppButton variant="primary" onClick={onClose}>
            Got it
          </AppButton>
        </div>
      </div>
    </Modal>
  );
}

function ModeChangeWarningModal({ nextMode, onCancel, onConfirm }) {
  const labelMap = {
    [TRACKING_MODES.SIMPLE]: "Simple",
    [TRACKING_MODES.GROUPED]: "Grouped",
    [TRACKING_MODES.TASK]: "Task",
  };

  return (
    <Modal title="Change Tracking Mode" onClose={onCancel} width={460}>
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            color: "#9a3412",
            lineHeight: 1.6,
          }}
        >
          Switching to <b>{labelMap[nextMode]}</b> will clear all existing
          timeline entries in this workspace because the input structure will no
          longer match.
        </div>

        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          Project names, timeline names, and dates stay. Logged hours, grouped
          entries, and task-item rows will be reset.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <AppButton variant="secondary" onClick={onCancel}>
            Cancel
          </AppButton>
          <AppButton variant="danger" onClick={onConfirm}>
            Change Mode and Clear Data
          </AppButton>
        </div>
      </div>
    </Modal>
  );
}

function SimpleHoursEditor({
  value,
  onChange,
  onBlockInput,
  settings,
  setShowCategoryModal,
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
        Total ({settings?.plotUnit || PLOT_UNITS.HOURS})
      </div>
      <input
        type="number"
        min="0"
        step="0.5"
        value={fromHours(value ?? 0, settings) || ""}
        onFocus={(e) => {
          if (
            !handleCategoryGuard(settings, () => setShowCategoryModal(true))
          ) {
            e.target.blur();
          }
        }}
        onChange={(e) => {
          if (!hasCategory1Options(settings)) return;

          onChange(toHours(e.target.value, settings));
        }}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: "0 14px",
          fontSize: 14,
          color: "#0f172a",
          background: "#fff",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function GroupedHoursEditor({
  settings,
  value,
  onChange,
  onBlockInput,
  setShowCategoryModal,
}) {
  const structure = settings.timelineStructure || DEFAULT_TIMELINE_STRUCTURE;
  const group1 = getGroup1Options(structure);
  const group2 = getGroup2Options(structure);
  const slots = buildSlots(structure);

  const hasSubgroup = group2.length > 0;

  function setCell(slotId, raw) {
    onChange({
      ...value,
      [slotId]: raw,
    });
  }

  if (!hasSubgroup) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {group1.map((g1) => (
          <div
            key={g1.id}
            style={{
              display: "grid",
              gridTemplateColumns: "140px minmax(0,1fr)",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: g1.color,
                }}
              />
              <span
                style={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}
              >
                {g1.label}
              </span>
            </div>

            <input
              type="number"
              min="0"
              step="0.5"
              value={fromHours(value[g1.id] ?? 0, settings) || ""}
              onFocus={(e) => {
                if (
                  !handleCategoryGuard(settings, () =>
                    setShowCategoryModal(true),
                  )
                ) {
                  e.target.blur();
                }
              }}
              onChange={(e) => {
                if (!hasCategory1Options(settings)) return;

                setCell(g1.id, toHours(e.target.value, settings));
              }}
              style={{
                height: 42,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "0 14px",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `140px repeat(${group2.length}, minmax(0,1fr))`,
          gap: 8,
          alignItems: "end",
        }}
      >
        <div />
        {group2.map((g2) => (
          <div
            key={g2.id}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748b",
              textAlign: "center",
            }}
          >
            {g2.label}
          </div>
        ))}
      </div>

      {group1.map((g1) => (
        <div
          key={g1.id}
          style={{
            display: "grid",
            gridTemplateColumns: `140px repeat(${group2.length}, minmax(0,1fr))`,
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: g1.color,
              }}
            />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
              {g1.label}
            </span>
          </div>

          {group2.map((g2) => {
            const slotId = `${g1.id}__${g2.id}`;
            return (
              <input
                key={slotId}
                type="number"
                min="0"
                step="0.5"
                value={fromHours(value[slotId] ?? 0, settings) || ""}
                onFocus={(e) => {
                  if (
                    !handleCategoryGuard(settings, () =>
                      setShowCategoryModal(true),
                    )
                  ) {
                    e.target.blur();
                  }
                }}
                onChange={(e) => {
                  if (!hasCategory1Options(settings)) return;

                  setCell(slotId, toHours(e.target.value, settings));
                }}
                style={{
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "0 12px",
                  fontSize: 14,
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TaskItemsEditor({
  items = [],
  settings,
  onChange,
  onBlockInput,
  setShowCategoryModal,
}) {
  const structure = settings.timelineStructure || [];
  const group1 = getGroup1Options(structure);
  const group2 = getGroup2Options(structure);

  const hasGroup1 = group1.length > 0;
  const hasGroup2 = group2.length > 0;

  function updateItem(index, patch) {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    onChange(next);
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([
      ...items,
      {
        id: `task_${Date.now()}`,
        name: "",
        group1Id: "",
        group2Id: "",
        hours: "",
      },
    ]);
  }

  // 🔥 AUTO EMPTY ROW (important UX)
  const rows = [...items];

  const last = rows[rows.length - 1];
  const needsEmptyRow =
    !last || last.name || last.hours || last.group1Id || last.group2Id;

  if (needsEmptyRow) {
    rows.push({
      id: "__empty__",
      name: "",
      group1Id: "",
      group2Id: "",
      hours: "",
    });
  }

  function handleRowChange(index, patch) {
    if (index >= items.length) {
      // this is the empty row → convert to real row
      onChange([
        ...items,
        {
          id: `task_${Date.now()}`,
          name: patch.name || "",
          group1Id: patch.group1Id || "",
          group2Id: patch.group2Id || "",
          hours: patch.hours || "",
        },
      ]);
      return;
    }

    updateItem(index, patch);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* 🔥 HEADER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `
            minmax(0,1.5fr)
            ${hasGroup1 ? "140px" : ""}
            ${hasGroup2 ? "140px" : ""}
            100px
            ${items.length ? "80px" : ""}
          `,
          gap: 10,
          fontSize: 12,
          fontWeight: 700,
          color: "#64748b",
        }}
      >
        <div>Task Name</div>
        {hasGroup1 && <div>Category 1</div>}
        {hasGroup2 && <div>Category 2</div>}
        <div>Hours</div>
        {items.length > 0 && <div />}
      </div>

      {/* 🔥 ROWS */}
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((item, index) => {
          const isEmptyRow = index >= items.length;

          return (
            <div
              key={item.id || index}
              style={{
                display: "grid",
                gridTemplateColumns: `
                  minmax(0,1.5fr)
                  ${hasGroup1 ? "140px" : ""}
                  ${hasGroup2 ? "140px" : ""}
                  100px
                  ${!isEmptyRow ? "80px" : ""}
                `,
                gap: 10,
                alignItems: "center",
              }}
            >
              {/* TASK NAME */}
              <input
                value={item.name || ""}
                onChange={(e) =>
                  handleRowChange(index, { name: e.target.value })
                }
                placeholder="Task name"
                style={inputStyle}
              />

              {/* CATEGORY 1 */}
              {hasGroup1 && (
                <select
                  value={item.group1Id || ""}
                  onChange={(e) =>
                    handleRowChange(index, { group1Id: e.target.value })
                  }
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {group1.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* CATEGORY 2 */}
              {hasGroup2 && (
                <select
                  value={item.group2Id || ""}
                  onChange={(e) =>
                    handleRowChange(index, { group2Id: e.target.value })
                  }
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {group2.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* HOURS */}
              <input
                type="number"
                min="0"
                step="0.5"
                value={fromHours(item.hours || 0, settings) || ""}
                onFocus={(e) => {
                  if (
                    !handleCategoryGuard(settings, () =>
                      setShowCategoryModal(true),
                    )
                  ) {
                    e.target.blur();
                  }
                }}
                onChange={(e) => {
                  if (!hasCategory1Options(settings)) return;

                  handleRowChange(index, {
                    hours: toHours(e.target.value, settings),
                  });
                }}
                placeholder="0"
                style={inputStyle}
              />

              {/* REMOVE BUTTON */}
              {!isEmptyRow && (
                <AppButton
                  variant="softDanger"
                  onClick={() => removeItem(index)}
                >
                  ✕
                </AppButton>
              )}
            </div>
          );
        })}
      </div>

      {/* ADD BUTTON */}
      <AppButton
        variant="ghost"
        onClick={addItem}
        style={{ width: "100%", height: 44 }}
      >
        + Add New Task
      </AppButton>
    </div>
  );
}

function buildProjectColorMap(projects = []) {
  const map = {};
  projects.forEach((p) => {
    map[p.id] = p.color || "#94a3b8";
  });
  return map;
}

function ProjectGroupedMiniBar({ priorityHours = {}, settings }) {
  const breakdown = getGroupedBreakdown(priorityHours, settings);
  const total = breakdown.reduce((sum, seg) => sum + seg.value, 0);

  if (!total) {
    return (
      <div style={{ height: 10, borderRadius: 999, background: "#f1f5f9" }} />
    );
  }

  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        overflow: "hidden",
        background: "#f1f5f9",
        display: "flex",
      }}
    >
      {breakdown.map((seg) => (
        <div
          key={seg.primaryId}
          style={{
            width: `${(seg.value / total) * 100}%`,
            background: seg.color,
          }}
        />
      ))}
    </div>
  );
}

function ProjectTaskMiniBar({
  taskItems = [],
  settings,
  fallbackColor = "#94a3b8",
}) {
  const structure = settings.timelineStructure || DEFAULT_TIMELINE_STRUCTURE;
  const group1 = getGroup1Options(structure);
  const colorByGroup1 = Object.fromEntries(group1.map((g) => [g.id, g.color]));

  const grouped = {};
  let uncategorized = 0;

  taskItems.forEach((item) => {
    const hours = Number(item?.hours) || 0;
    if (hours <= 0) return;
    if (item.group1Id)
      grouped[item.group1Id] = (grouped[item.group1Id] || 0) + hours;
    else uncategorized += hours;
  });

  const segs = [
    ...Object.entries(grouped).map(([gid, value]) => ({
      id: gid,
      value,
      color: colorByGroup1[gid] || fallbackColor,
    })),
  ];

  if (uncategorized > 0) {
    segs.push({
      id: "__uncategorized__",
      value: uncategorized,
      color: fallbackColor,
    });
  }

  const total = segs.reduce((sum, s) => sum + s.value, 0);
  if (!total) {
    return (
      <div style={{ height: 10, borderRadius: 999, background: "#f1f5f9" }} />
    );
  }

  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        overflow: "hidden",
        background: "#f1f5f9",
        display: "flex",
      }}
    >
      {segs.map((seg) => (
        <div
          key={seg.id}
          style={{
            width: `${(seg.value / total) * 100}%`,
            background: seg.color,
          }}
        />
      ))}
    </div>
  );
}

function TimelineProjectPreview({ tasks, projects, settings }) {
  const mode = getTrackingMode(settings);
  const projectColorMap = buildProjectColorMap(projects);

  const items = Object.entries(tasks || {})
    .map(([pid, rawTask]) => {
      const task = normalizeTask(rawTask);
      const total = getProjectTotalHours(task, settings);
      if (total <= 0) return null;

      const project = projects.find((p) => p.id === pid);

      return {
        id: pid,
        name: project?.name || "Unknown",
        total,
        projectColor: projectColorMap[pid] || "#94a3b8",
        priorityHours: task.priorityHours || {},
        taskItems: task.taskItems || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);

  if (!items.length) {
    return (
      <div style={timelineEmpty}>
        <div style={timelineEmptyIcon}>
          <CalendarClock size={18} />
        </div>
        <div style={timelineEmptyTitle}>No hours plotted yet</div>
        <div style={timelineEmptySub}>
          This timeline has no tracked work yet.
        </div>
      </div>
    );
  }

  const visible = items.slice(0, 3);
  const hiddenCount = items.length - visible.length;

  return (
    <div
      style={{
        flex: 1,
        padding: "14px 18px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {visible.map((item) => (
        <div
          key={item.id}
          style={{
            display: "grid",
            gridTemplateColumns: "120px minmax(0,1fr) auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: item.projectColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "#334155",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.name}
            </span>
          </div>

          {mode === TRACKING_MODES.SIMPLE && (
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: item.projectColor,
              }}
            />
          )}

          {mode === TRACKING_MODES.GROUPED && (
            <ProjectGroupedMiniBar
              priorityHours={item.priorityHours}
              settings={settings}
            />
          )}

          {mode === TRACKING_MODES.TASK && (
            <ProjectTaskMiniBar
              taskItems={item.taskItems}
              settings={settings}
              fallbackColor={item.projectColor}
            />
          )}

          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "#64748b",
              minWidth: 44,
              textAlign: "right",
            }}
          >
            {fromHours(item.total, settings).toFixed(1)} {settings.plotUnit}
          </div>
        </div>
      ))}

      {hiddenCount > 0 && (
        <div
          style={{
            fontSize: 12,
            color: "#94a3b8",
            paddingTop: 2,
          }}
        >
          +{hiddenCount} more project{hiddenCount > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

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
  onShowCategoryModal,
}) {
  const mode = getTrackingMode(settings);
  const normalizedTask = normalizeTask(task);
  const structure = settings.timelineStructure || DEFAULT_TIMELINE_STRUCTURE;
  const hasPrimaryOptions =
    structure?.[0]?.options && structure[0].options.length > 0;

  const draftKey = project.id;
  const existingDraft = _plotDrafts[draftKey];

  const [draft, setDraft] = useState(() => ({
    priorityHours:
      existingDraft?.priorityHours || normalizedTask.priorityHours || {},
    simpleHours: existingDraft?.simpleHours ?? normalizedTask.simpleHours ?? 0,
    taskItems: existingDraft?.taskItems || normalizedTask.taskItems || [],
    plotStart:
      existingDraft?.plotStart || normalizedTask.plotStart || globalStart,
  }));

  const [tab, setTab] = useState("plot");
  const [nS, setNS] = useState(draft.plotStart);
  const [nE, setNE] = useState(addD(draft.plotStart, 4));
  const [nT, setNT] = useState("");
  const notes = normalizedTask.notes || [];

  function convertToHours(value) {
    const unit = settings.plotUnit || PLOT_UNITS.HOURS;

    if (unit === PLOT_UNITS.DAYS) return Number(value) * 8;
    if (unit === PLOT_UNITS.WEEKS) return Number(value) * 40;

    return Number(value);
  }

  useEffect(() => {
    _plotDrafts[draftKey] = draft;
  }, [draftKey, draft]);

  function addNote() {
    if (!nT.trim()) return;
    onAddNote({ startDate: nS, endDate: nE, text: nT.trim() });
    setNT("");
  }

  const totalHours =
    mode === TRACKING_MODES.SIMPLE
      ? Number(draft.simpleHours || 0)
      : mode === TRACKING_MODES.TASK
        ? (draft.taskItems || []).reduce(
            (sum, item) => sum + (Number(item?.hours) || 0),
            0,
          )
        : Object.values(draft.priorityHours || {}).reduce(
            (sum, value) => sum + (Number(value) || 0),
            0,
          );

  const displayTotal = fromHours(totalHours, settings);

  return (
    <Modal
      title={`Plot Hours — ${project.name}`}
      onClose={onClose}
      width={mode === TRACKING_MODES.TASK ? 980 : 760}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <TrackingModeBadge mode={mode} />

          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>
            Total: {displayTotal.toFixed(1)} {settings.plotUnit}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 4,
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            width: "fit-content",
          }}
        >
          <AppButton
            variant={tab === "plot" ? "primary" : "ghost"}
            onClick={() => setTab("plot")}
            style={{ height: 36 }}
          >
            Hours
          </AppButton>
          <AppButton
            variant={tab === "notes" ? "primary" : "ghost"}
            onClick={() => setTab("notes")}
            style={{ height: 36 }}
          >
            Notes
          </AppButton>
        </div>

        {tab === "plot" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                Plot Start
              </div>
              <input
                type="date"
                value={draft.plotStart}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, plotStart: e.target.value }))
                }
                style={{
                  width: 220,
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "0 12px",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {mode === TRACKING_MODES.SIMPLE &&
              (hasPrimaryOptions ? (
                <SimpleHoursEditor
                  value={draft.simpleHours}
                  onChange={(value) =>
                    setDraft((prev) => ({ ...prev, simpleHours: value }))
                  }
                  settings={settings}
                  setShowCategoryModal={() => setShowCategoryModal(true)}
                />
              ) : (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#9a3412",
                    fontSize: 13,
                  }}
                >
                  Please create at least one Category 1 option in Settings
                  before adding hours.
                </div>
              ))}

            {mode === TRACKING_MODES.GROUPED && (
              <GroupedHoursEditor
                settings={settings}
                value={draft.priorityHours}
                onChange={(nextPriorityHours) =>
                  setDraft((prev) => ({
                    ...prev,
                    priorityHours: nextPriorityHours,
                  }))
                }
                setShowCategoryModal={() => setShowCategoryModal(true)}
              />
            )}

            {mode === TRACKING_MODES.TASK && (
              <TaskItemsEditor
                items={draft.taskItems}
                settings={settings}
                onChange={(nextItems) =>
                  setDraft((prev) => ({
                    ...prev,
                    taskItems: nextItems,
                  }))
                }
                setShowCategoryModal={() => setShowCategoryModal(true)}
              />
            )}
          </div>
        )}

        {tab === "notes" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 140px minmax(0,1fr) auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <input
                type="date"
                value={nS}
                onChange={(e) => setNS(e.target.value)}
                style={{
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "0 12px",
                }}
              />

              <input
                type="date"
                value={nE}
                onChange={(e) => setNE(e.target.value)}
                style={{
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "0 12px",
                }}
              />

              <input
                value={nT}
                onChange={(e) => setNT(e.target.value)}
                placeholder="Add note"
                style={{
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "0 14px",
                }}
              />

              <AppButton variant="primary" onClick={addNote}>
                Add
              </AppButton>
            </div>

            <NoteList notes={notes} onDelete={onDelNote} onEdit={onEditNote} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <AppButton variant="secondary" onClick={onClose}>
            Cancel
          </AppButton>

          <AppButton
            variant="primary"
            disabled={mode === TRACKING_MODES.SIMPLE && !hasPrimaryOptions}
            onClick={() =>
              onSave(
                {
                  priorityHours:
                    mode === TRACKING_MODES.GROUPED
                      ? Object.fromEntries(
                          Object.entries(draft.priorityHours).map(([k, v]) => [
                            k,
                            convertToHours(v),
                          ]),
                        )
                      : draft.priorityHours,
                  simpleHours:
                    mode === TRACKING_MODES.SIMPLE
                      ? convertToHours(draft.simpleHours)
                      : draft.simpleHours,
                  taskItems:
                    mode === TRACKING_MODES.TASK
                      ? draft.taskItems.map((t) => ({
                          ...t,
                          hours: convertToHours(t.hours),
                        }))
                      : draft.taskItems,
                },
                draft.plotStart,
              )
            }
          >
            Save
          </AppButton>
        </div>
      </div>
    </Modal>
  );
}

function EditProjectModal({
  project,
  onClose,
  onEditProject,
  onDelProject,
  settings,
}) {
  const [pName, setPName] = useState(project.name);
  const [pMems, setPMems] = useState(toArr(project.members));
  const [pColor, setPColor] = useState(project.color);
  const membersEnabled = settings?.membersEnabled !== false;
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
      {membersEnabled && (
        <Fld label="Members">
          <MembersInput members={pMems} onChange={setPMems} />
        </Fld>
      )}
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
              members: membersEnabled ? pMems : [],
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
      sub="Archive and start a new week"
      onClose={onClose}
    >
      <Alert type="green">
        This archives the current week and starts fresh. Past timelines are
        saved for comparison.
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
          Clear all hours (start fresh)
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
      sub="Backfill a past period"
      onClose={onClose}
      width={460}
    >
      <Alert type="info">
        Enter the period's start and finish dates. It will be saved as an
        archived timeline.
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
/* ── COMPARE MODAL HELPER COMPONENTS ── */
function CompareSummaryCard({ tone, label, title, subtitle }) {
  const isBlue = tone === "blue";

  return (
    <div
      style={{
        background: isBlue ? "#eef2ff" : "#f0fdf4",
        border: `1px solid ${isBlue ? "#c7d2fe" : "#bbf7d0"}`,
        borderRadius: 14,
        padding: "18px 22px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: isBlue ? "#1d4ed8" : "#15803d",
          marginBottom: 10,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 13,
          color: isBlue ? "#4f46e5" : "#16a34a",
          fontFamily: "DM Mono, monospace",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function CompareStat({ label, value, good, bad }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span
        style={{
          fontWeight: 800,
          color: good ? "#15803d" : bad ? "#dc2626" : "var(--text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CompareMiniBox({ tone, value }) {
  const isBlue = tone === "blue";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 48,
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        border: `1px solid ${isBlue ? "#c7d2fe" : "#bbf7d0"}`,
        background: isBlue ? "#eef2ff" : "#f0fdf4",
        color: isBlue ? "#1d4ed8" : "#15803d",
        fontFamily: "DM Mono, monospace",
      }}
    >
      {value}
    </div>
  );
}

function DeltaBadge({ delta }) {
  let text = "No change";
  let color = "#64748b";
  let bg = "#f8fafc";

  if (delta > 0) {
    text = `↑ ${delta} more working days`;
    color = "#dc2626";
    bg = "#fef2f2";
  } else if (delta < 0) {
    text = `↓ ${Math.abs(delta)} fewer working days`;
    color = "#15803d";
    bg = "#f0fdf4";
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  );
}

function DeltaInline({ delta }) {
  if (delta > 0) {
    return (
      <span style={{ color: "#dc2626", fontWeight: 700 }}>
        ↑ {delta} more working days
      </span>
    );
  }

  if (delta < 0) {
    return (
      <span style={{ color: "#15803d", fontWeight: 700 }}>
        ↓ {Math.abs(delta)} fewer working days
      </span>
    );
  }

  return <span style={{ color: "#64748b" }}>No change</span>;
}

function fmtMonth(yyyyMm) {
  const [y, m] = yyyyMm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/* ── COMPARE MODAL ── */
function CompareModal({ allTimelines, projects, settings, onClose }) {
  const [idA, setIdA] = useState(
    allTimelines[1]?.id || allTimelines[0]?.id || "",
  );
  const [idB, setIdB] = useState(allTimelines[0]?.id || "");
  const opts = allTimelines.map((t) => ({
    value: t.id,
    label: t.name || fmt(t.plotStart) || "Untitled",
  }));

  const tlA = allTimelines.find((t) => t.id === idA);
  const tlB = allTimelines.find((t) => t.id === idB);
  const tooFew = allTimelines.length < 2;

  function getPlottedSet(tl, pid) {
    if (!tl) return new Set();
    const pt = tl.tasks?.[pid] || {};
    const ps = pt.plotStart || tl.plotStart;
    const mode = getTrackingMode(settings);
    const ph = mode === TRACKING_MODES.GROUPED ? pt.priorityHours || {} : {};

    const slots = buildSlots(
      settings.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
    )
      .filter((s) => Number(ph[s.id]) > 0)
      .map((s) => ({
        ...s,
        hours: Number(ph[s.id]) || 0,
      }));

    if (!slots.length) return new Set();

    const segMap = plotPartialDays(slots, ps, settings);
    return new Set([...segMap.keys()]);
  }

  const rows = useMemo(() => {
    return projects.map((p) => {
      const setA = getPlottedSet(tlA, p.id);
      const setB = getPlottedSet(tlB, p.id);

      const daysA = setA.size;
      const daysB = setB.size;
      const delta = daysB - daysA;

      return {
        project: p,
        setA,
        setB,
        daysA,
        daysB,
        delta,
      };
    });
  }, [projects, tlA, tlB, settings]);

  const allDates = useMemo(() => {
    const dates = new Set();

    rows.forEach((r) => {
      r.setA.forEach((d) => dates.add(d));
      r.setB.forEach((d) => dates.add(d));
    });

    if (tlA?.plotStart) dates.add(tlA.plotStart);
    if (tlB?.plotStart) dates.add(tlB.plotStart);

    const arr = [...dates].sort();
    if (!arr.length) return [];

    const min = arr[0];
    const max = arr[arr.length - 1];
    return dRange(min, max);
  }, [rows, tlA, tlB]);

  const monthGroups = useMemo(() => {
    const out = [];
    let current = null;

    allDates.forEach((d) => {
      const month = d.slice(0, 7);
      if (!current || current.month !== month) {
        current = { month, dates: [] };
        out.push(current);
      }
      current.dates.push(d);
    });

    return out;
  }, [allDates]);

  const changedCount = rows.filter((r) => r.delta !== 0).length;
  const improvedCount = rows.filter((r) => r.delta < 0).length;
  const delayedCount = rows.filter((r) => r.delta > 0).length;

  function toJsDate(yyyyMmDd) {
    return new Date(`${yyyyMmDd}T00:00:00`);
  }

  return (
    <Modal
      title="Timeline Comparison"
      sub="Compare project timelines across reporting periods"
      onClose={onClose}
      ultraWide
    >
      {tooFew ? (
        <Alert
          type="info"
          title="Not enough timelines yet"
          style={{ marginTop: 2 }}
        >
          You need at least two timelines to compare. Create a new timeline
          after saving the current one, or keep one archived timeline first.
        </Alert>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {/* Top selectors */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#1d4ed8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                Past / Previous (A)
              </div>
              <Sel value={idA} onChange={setIdA} options={opts} />
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#15803d",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                Present (B)
              </div>
              <Sel value={idB} onChange={setIdB} options={opts} />
            </div>
          </div>

          {/* Summary strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(260px,1fr) minmax(260px,1fr) minmax(260px,320px)",
              gap: 14,
              alignItems: "stretch",
            }}
          >
            <CompareSummaryCard
              tone="blue"
              label="Past / Previous (A)"
              title={tlA?.name || fmt(tlA?.plotStart)}
              subtitle={`Start: ${fmt(tlA?.plotStart)}`}
            />

            <CompareSummaryCard
              tone="green"
              label="Present (B)"
              title={tlB?.name || fmt(tlB?.plotStart)}
              subtitle={`Start: ${fmt(tlB?.plotStart)}`}
            />

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 12,
                }}
              >
                Overview
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <CompareStat label="Changed Projects" value={changedCount} />
                <CompareStat label="Shorter in B" value={improvedCount} good />
                <CompareStat label="Longer in B" value={delayedCount} bad />
              </div>
            </div>
          </div>

          {/* Timeline compare table */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 16,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <div style={{ overflow: "auto" }}>
              <table
                style={{
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  minWidth: 980,
                  width: "100%",
                }}
              >
                <colgroup>
                  <col style={{ width: 230 }} />
                  <col style={{ width: 40 }} />
                  {allDates.map((d) => (
                    <col key={d} style={{ width: 54 }} />
                  ))}
                </colgroup>

                <thead>
                  <tr>
                    <th
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 3,
                        background: "#f8fafc",
                        borderBottom: "1px solid var(--border)",
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 800,
                        color: "var(--text-3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Project
                    </th>
                    <th
                      style={{
                        background: "#f8fafc",
                        borderBottom: "1px solid var(--border)",
                      }}
                    />
                    {monthGroups.map((g) => (
                      <th
                        key={g.month}
                        colSpan={g.dates.length}
                        style={{
                          background: "#f8fafc",
                          borderBottom: "1px solid var(--border)",
                          padding: "10px 0",
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: 800,
                          color: "var(--text-2)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {fmtMonth(g.month)}
                      </th>
                    ))}
                  </tr>

                  <tr>
                    <th
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 3,
                        background: "#fff",
                        borderBottom: "1px solid var(--border)",
                      }}
                    />
                    <th
                      style={{
                        background: "#fff",
                        borderBottom: "1px solid var(--border)",
                      }}
                    />
                    {allDates.map((d) => {
                      const dt = toJsDate(d);

                      return (
                        <th
                          key={d}
                          style={{
                            background:
                              dayType(d, settings) === "work"
                                ? "#fff"
                                : "#f8fafc",
                            borderBottom: "1px solid var(--border)",
                            borderRight: "1px solid #f1f5f9",
                            padding: "8px 0",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text-3)",
                              lineHeight: 1.1,
                            }}
                          >
                            {["S", "M", "T", "W", "T", "F", "S"][dt.getDay()]}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: d === today() ? 800 : 600,
                              color:
                                d === today() ? "#4f46e5" : "var(--text-2)",
                            }}
                          >
                            {dt.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r) => (
                    <Fragment key={r.project.id}>
                      <tr>
                        <td
                          rowSpan={2}
                          style={{
                            position: "sticky",
                            left: 0,
                            zIndex: 2,
                            background: "#fff",
                            borderBottom: "1px solid var(--border)",
                            borderRight: "1px solid var(--border)",
                            padding: "14px 14px",
                            verticalAlign: "top",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <span
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                background: r.project.color || "#4f46e5",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 800,
                                color: "var(--text)",
                              }}
                            >
                              {r.project.name}
                            </span>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <DeltaBadge delta={r.delta} />
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 12,
                              color: "var(--text-3)",
                              lineHeight: 1.7,
                            }}
                          >
                            <div>A: {r.daysA}wd</div>
                            <div>B: {r.daysB}wd</div>
                          </div>
                        </td>

                        <td
                          style={{
                            background: "#eef2ff",
                            color: "#1d4ed8",
                            fontWeight: 800,
                            fontSize: 13,
                            textAlign: "center",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          A
                        </td>

                        {allDates.map((d) => (
                          <td
                            key={`A-${r.project.id}-${d}`}
                            style={{
                              height: 54,
                              background:
                                dayType(d, settings) === "work"
                                  ? "#fff"
                                  : "#f8fafc",
                              borderBottom: "1px solid var(--border)",
                              borderRight: "1px solid #f1f5f9",
                              padding: 4,
                            }}
                          >
                            {r.setA.has(d) && (
                              <div
                                style={{
                                  width: "100%",
                                  height: 100,
                                  minHeight: 46,
                                  borderRadius: 8,
                                  background: "#4f46e5",
                                }}
                              />
                            )}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td
                          style={{
                            background: "#dcfce7",
                            color: "#15803d",
                            fontWeight: 800,
                            fontSize: 13,
                            textAlign: "center",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          B
                        </td>

                        {allDates.map((d) => (
                          <td
                            key={`B-${r.project.id}-${d}`}
                            style={{
                              height: 54,
                              background:
                                dayType(d, settings) === "work"
                                  ? "#fff"
                                  : "#f8fafc",
                              borderBottom: "1px solid var(--border)",
                              borderRight: "1px solid #f1f5f9",
                              padding: 4,
                            }}
                          >
                            {r.setB.has(d) && (
                              <div
                                style={{
                                  width: "100%",
                                  height: 100,
                                  minHeight: 46,
                                  borderRadius: 8,
                                  background: "#22c55e",
                                }}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Working days summary */}
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "var(--text)",
              }}
            >
              Working Days Summary
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((r) => (
                <div
                  key={`summary-${r.project.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 180px 180px 1fr",
                    gap: 16,
                    alignItems: "center",
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: r.project.color || "#4f46e5",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {r.project.name}
                    </span>
                  </div>

                  <CompareMiniBox
                    tone="blue"
                    value={r.daysA ? `${r.daysA}wd` : "—"}
                  />
                  <CompareMiniBox
                    tone="green"
                    value={r.daysB ? `${r.daysB}wd` : "—"}
                  />

                  <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                    <DeltaInline delta={r.delta} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

/* ── Timeline Structure Editor ─────────────────────────────────────────── */
function TimelineStructureEditor({ value, onChange }) {
  const structure =
    value?.length === 2
      ? value
      : [
          {
            id: "group_priority",
            label: "Priority",
            options: [
              { id: "opt_high", label: "High", color: "#ef4444", order: 0 },
              { id: "opt_medium", label: "Medium", color: "#f97316", order: 1 },
              { id: "opt_low", label: "Low", color: "#4f46e5", order: 2 },
            ],
          },
          {
            id: "group_worktype",
            label: "Work Type",
            options: [
              { id: "opt_bug", label: "Bug", icon: "bug", order: 0 },
              {
                id: "opt_nf",
                label: "New Feature",
                icon: "sparkles",
                order: 1,
              },
              { id: "opt_enh", label: "Enhancement", icon: "wrench", order: 2 },
            ],
          },
        ];

  const [mainCategory, subCategory] = structure;

  function updateGroup(groupIndex, patch) {
    const next = structure.map((g, i) =>
      i === groupIndex ? { ...g, ...patch } : g,
    );
    onChange(next);
  }

  function updateOption(groupIndex, optionIndex, patch) {
    const next = structure.map((g, i) => {
      if (i !== groupIndex) return g;
      return {
        ...g,
        options: g.options.map((opt, j) =>
          j === optionIndex ? { ...opt, ...patch } : opt,
        ),
      };
    });
    onChange(next);
  }

  function addOption(groupIndex) {
    const group = structure[groupIndex];
    const baseId = groupIndex === 0 ? "opt_g1" : "opt_g2";

    const nextOption = {
      id: `${baseId}_${Date.now()}`,
      label: "",
      order: group.options.length,
      ...(groupIndex === 0 ? { color: "#94a3b8" } : { icon: "circle" }),
    };

    const next = structure.map((g, i) =>
      i === groupIndex ? { ...g, options: [...g.options, nextOption] } : g,
    );

    onChange(next);
  }

  function removeOption(groupIndex, optionIndex) {
    const next = structure.map((g, i) => {
      if (i !== groupIndex) return g;

      const filtered = g.options
        .filter((_, j) => j !== optionIndex)
        .map((opt, idx) => ({ ...opt, order: idx }));

      return { ...g, options: filtered };
    });

    onChange(next);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 4,
          }}
        >
          How this works
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          The timeline is built by combining each <b>Primary Group</b> option
          with each <b>Secondary Group</b> option.
        </div>
      </div>

      <SettingsSection title="Primary Group" sub="Main classification">
        <div style={{ ...settingsLabelStyle, marginBottom: 8 }}>
          Group Title
        </div>

        <input
          value={mainCategory?.label || ""}
          onChange={(e) => updateGroup(0, { label: e.target.value })}
          placeholder="e.g. Priority, Department, Phase"
          style={{ ...settingsInputStyle, marginBottom: 12 }}
        />

        <div style={settingsHeaderRow(GROUP_GRID_COLOR)}>
          <div style={settingsLabelStyle}>Option Name</div>
          <div style={settingsLabelStyle}>Color</div>
          <div style={settingsLabelStyle}>Action</div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {(mainCategory?.options || []).map((opt, i) => (
            <OptionRow
              key={opt.id}
              value={opt.label}
              onChange={(v) => updateOption(0, i, { label: v })}
              gridTemplateColumns={GROUP_GRID_COLOR}
              right={
                <div style={settingsColorField}>
                  <div
                    style={{
                      ...settingsColorSwatch,
                      background: opt.color || "#94a3b8",
                    }}
                  />
                  <input
                    type="color"
                    value={opt.color || "#94a3b8"}
                    onChange={(e) =>
                      updateOption(0, i, { color: e.target.value })
                    }
                    style={settingsColorNativeInput}
                  />
                </div>
              }
              onRemove={() => removeOption(0, i)}
            />
          ))}
        </div>

        <button
          onClick={() => addOption(0)}
          style={{ ...ghostBtn, marginTop: 12 }}
        >
          + Add Option
        </button>
      </SettingsSection>

      <SettingsSection title="Secondary Group" sub="Work type or status">
        <div style={{ ...settingsLabelStyle, marginBottom: 8 }}>
          Group Title
        </div>

        <input
          value={subCategory?.label || ""}
          onChange={(e) => updateGroup(1, { label: e.target.value })}
          placeholder="e.g. Work Type, Status, Channel"
          style={{ ...settingsInputStyle, marginBottom: 12 }}
        />

        <div style={settingsHeaderRow(GROUP_GRID_ICON)}>
          <div style={settingsLabelStyle}>Option Name</div>
          <div style={settingsLabelStyle}>Icon</div>
          <div style={settingsLabelStyle}>Action</div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {(subCategory?.options || []).map((opt, i) => (
            <OptionRow
              key={opt.id}
              value={opt.label}
              onChange={(v) => updateOption(1, i, { label: v })}
              gridTemplateColumns={GROUP_GRID_ICON}
              right={
                <div style={settingsSelectWrap}>
                  <div style={settingsSelectIconPreview}>
                    <WtIcon icon={opt.icon || "circle"} size={14} />
                  </div>

                  <select
                    value={opt.icon || "circle"}
                    onChange={(e) =>
                      updateOption(1, i, { icon: e.target.value })
                    }
                    style={settingsSelectStyle}
                  >
                    {ICON_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <div style={settingsSelectArrow}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M5 7l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              }
              onRemove={() => removeOption(1, i)}
            />
          ))}
        </div>

        <button
          onClick={() => addOption(1)}
          style={{ ...ghostBtn, marginTop: 12 }}
        >
          + Add Option
        </button>
      </SettingsSection>
    </div>
  );
}

function SettingsModal({ settings, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({
    ...settings,
    trackingMode: getTrackingMode(settings),
    timelineStructure: settings.timelineStructure || DEFAULT_TIMELINE_STRUCTURE,
    excludeDays: settings.excludeDays || [],
    excludeDates: settings.excludeDates || [],
  }));

  const [showModeWarning, setShowModeWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);

  const mode = getTrackingMode(draft);
  const { errors, hasErrors } = getSettingsValidation(draft);

  useEffect(() => {
    setDraft((prev) => {
      const structure = prev.timelineStructure || [];

      const g1 = structure[0];
      if (!g1.options || g1.options.length === 0) {
        g1.options = [
          {
            id: "opt_default",
            label: "Default",
            color: "#94a3b8",
            order: 0,
          },
        ];
      }

      return {
        ...prev,
        timelineStructure: [...structure],
      };
    });
  }, []);

  useEffect(() => {
    if (getTrackingMode(draft) === TRACKING_MODES.SIMPLE) return;

    const group1 = draft.timelineStructure?.[0];
    if (!group1) return;

    if (!Array.isArray(group1.options) || group1.options.length === 0) {
      setDraft((prev) => {
        const next = [
          ...(prev.timelineStructure || DEFAULT_TIMELINE_STRUCTURE),
        ];
        next[0] = {
          ...next[0],
          options: [
            createEmptyOption(0, 0, next[0]?.representation || "color"),
          ],
        };
        return { ...prev, timelineStructure: next };
      });
    }
  }, [draft.trackingMode]);

  function setMode(nextMode) {
    if (nextMode === mode) return;
    setPendingMode(nextMode);
    setShowModeWarning(true);
  }

  function applyModeChange() {
    setDraft((prev) => ({
      ...prev,
      trackingMode: pendingMode,
      timelineStructure:
        pendingMode === TRACKING_MODES.SIMPLE
          ? [
              { id: "group_primary", label: "Category 1", options: [] },
              { id: "group_secondary", label: "Category 2", options: [] },
            ]
          : prev.timelineStructure,
    }));
    setPendingMode(null);
    setShowModeWarning(false);
  }

  function saveNow(clearTrackingData = false) {
    onSave(draft, { clearTrackingData });
  }

  function updateGroup(groupIndex, patch) {
    const next = [...draft.timelineStructure];
    next[groupIndex] = { ...next[groupIndex], ...patch };
    setDraft((prev) => ({ ...prev, timelineStructure: next }));
  }

  function updateOption(groupIndex, optionIndex, patch) {
    const next = [...draft.timelineStructure];
    next[groupIndex] = {
      ...next[groupIndex],
      options: next[groupIndex].options.map((opt, i) =>
        i === optionIndex ? { ...opt, ...patch } : opt,
      ),
    };
    setDraft((prev) => ({ ...prev, timelineStructure: next }));
  }

  function addOption(groupIndex) {
    const next = [...draft.timelineStructure];
    const rep = next[groupIndex]?.representation || "color";
    const nextIndex = next[groupIndex].options.length;

    next[groupIndex] = {
      ...next[groupIndex],
      options: [
        ...(next[groupIndex].options || []),
        createEmptyOption(groupIndex, nextIndex, rep),
      ],
    };

    setDraft((prev) => ({ ...prev, timelineStructure: next }));
  }

  function updateGroupRepresentation(groupIndex, representation) {
    const next = [...draft.timelineStructure];
    const existingOptions = next[groupIndex]?.options || [];

    next[groupIndex] = {
      ...next[groupIndex],
      representation,
      options: existingOptions.map((opt, i) => ({
        id: opt.id,
        label: opt.label,
        order: i,
        color: opt.color || "#94a3b8",
        icon: opt.icon || "circle",
        texture: opt.texture || "solid",
      })),
    };

    setDraft((prev) => ({ ...prev, timelineStructure: next }));
  }

  function removeOption(groupIndex, optionIndex) {
    const next = [...draft.timelineStructure];
    next[groupIndex] = {
      ...next[groupIndex],
      options: next[groupIndex].options
        .filter((_, i) => i !== optionIndex)
        .map((opt, i) => ({ ...opt, order: i })),
    };
    setDraft((prev) => ({ ...prev, timelineStructure: next }));
  }

  const showStructureEditor = mode !== TRACKING_MODES.SIMPLE;
  const groupedMode = mode === TRACKING_MODES.GROUPED;
  const taskMode = mode === TRACKING_MODES.TASK;

  const MAX_CATEGORY_COUNT = REPRESENTATION_OPTIONS.length;

  function createEmptyGroup(groupIndex) {
    return {
      id: `group_${groupIndex + 1}_${Date.now()}`,
      label: "",
      representation: REPRESENTATION_TYPES.COLOR,
      options: [createEmptyOption(groupIndex, 0, REPRESENTATION_TYPES.COLOR)],
    };
  }

  function addCategory() {
    setDraft((prev) => {
      const current = Array.isArray(prev.timelineStructure)
        ? [...prev.timelineStructure]
        : [];

      if (current.length >= MAX_CATEGORY_COUNT) return prev;

      return {
        ...prev,
        timelineStructure: [...current, createEmptyGroup(current.length)],
      };
    });
  }

  function removeCategory(groupIndex) {
    if (groupIndex === 0) return;

    setDraft((prev) => {
      const next = [...(prev.timelineStructure || [])];
      next.splice(groupIndex, 1);

      return {
        ...prev,
        timelineStructure: next.map((group, idx) => ({
          ...group,
          order: idx,
        })),
      };
    });
  }

  const categoryCardTitle = {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  };

  const categoryCardSub = {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
  };

  return (
    <>
      <Modal title="Settings" onClose={onClose} width={720}>
        <div style={{ display: "grid", gap: 18 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              Tracking Mode
              <span style={requiredAsterisk}>*</span>
            </div>

            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "0 12px",
                fontSize: 14,
                background: "#fff",
              }}
            >
              <option value={TRACKING_MODES.SIMPLE}>Simple</option>
              <option value={TRACKING_MODES.GROUPED}>Grouped</option>
              <option value={TRACKING_MODES.TASK}>Task</option>
            </select>

            <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6 }}>
              {mode === TRACKING_MODES.SIMPLE &&
                "Simple mode uses one total-hours input per project."}
              {mode === TRACKING_MODES.GROUPED &&
                "Grouped mode uses Category 1 and an optional Category 2."}
              {mode === TRACKING_MODES.TASK &&
                "Task mode lets each project contain task rows, with up to two optional task categories."}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                Plotting Unit
                <span style={requiredAsterisk}>*</span>
              </div>

              <select
                value={draft.plotUnit || PLOT_UNITS.HOURS}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, plotUnit: e.target.value }))
                }
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "0 12px",
                  fontSize: 14,
                }}
              >
                <option value={PLOT_UNITS.HOURS}>Hours</option>
                <option value={PLOT_UNITS.DAYS}>Days</option>
                <option value={PLOT_UNITS.WEEKS}>Weeks</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Work Hours per Day
              </div>

              <input
                type="number"
                min="1"
                value={draft.workHoursPerDay || 8}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    workHoursPerDay: Number(e.target.value) || 8,
                  }))
                }
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "0 12px",
                  fontSize: 14,
                }}
              />

              <div style={{ fontSize: 12, color: "#64748b" }}>
                Example: 8 = 1 day equals 8 working hours
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              Calendar Rules
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}
              >
                Excluded Weekdays
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (label, idx) => {
                    const checked = (draft.excludeDays || []).includes(idx);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            excludeDays: checked
                              ? (prev.excludeDays || []).filter(
                                  (d) => d !== idx,
                                )
                              : [...(prev.excludeDays || []), idx],
                          }))
                        }
                        style={getButtonStyle(
                          checked ? "primary" : "secondary",
                        )}
                        {...bindButtonStates(checked ? "primary" : "secondary")}
                      >
                        {label}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                Exclude Specific Dates
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="date"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    setDraft((prev) => ({
                      ...prev,
                      excludeDates: [...(prev.excludeDates || []), val],
                    }));
                    e.target.value = "";
                  }}
                  style={settingsInputStyle}
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(draft.excludeDates || []).map((d, i) => (
                  <span
                    key={i}
                    style={{
                      background: "#fee2e2",
                      color: "#991b1b",
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {d}
                    <button
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          excludeDates: prev.excludeDates.filter(
                            (x) => x !== d,
                          ),
                        }))
                      }
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {showStructureEditor && (
            <>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                {groupedMode && "Category Structure"}
                {taskMode && "Task Categories"}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 18,
                }}
              >
                {(draft.timelineStructure || []).map((group, groupIndex) => {
                  const representation =
                    group.representation || REPRESENTATION_TYPES.COLOR;

                  const gridTemplateColumns =
                    representation === REPRESENTATION_TYPES.ICON
                      ? GROUP_GRID_ICON
                      : representation === REPRESENTATION_TYPES.TEXTURE
                        ? GROUP_GRID_TEXTURE
                        : GROUP_GRID_COLOR;

                  return (
                    <div
                      key={group.id || groupIndex}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 20,
                        padding: 20,
                        background: "#fff",
                        display: "grid",
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={categoryCardTitle}>
                            Category {groupIndex + 1}
                            {groupIndex === 0 ? " *" : ""}
                          </div>
                          <div style={categoryCardSub}>
                            Define the label, representation, and options for
                            this category.
                          </div>
                        </div>

                        {groupIndex > 0 && (
                          <button
                            onClick={() => removeCategory(groupIndex)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              border: "1px solid #fecaca",
                              background: "#fef2f2",
                              color: "#dc2626",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition:
                                "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#fee2e2";
                              e.currentTarget.style.borderColor = "#fca5a5";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#fef2f2";
                              e.currentTarget.style.borderColor = "#fecaca";
                            }}
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>

                      <input
                        value={group.label || ""}
                        onChange={(e) =>
                          updateGroup(groupIndex, { label: e.target.value })
                        }
                        placeholder={`Enter Category ${groupIndex + 1} title`}
                        style={settingsInputStyle}
                      />

                      <div style={{ display: "grid", gap: 8 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#334155",
                          }}
                        >
                          Representation *
                        </div>

                        <div style={settingsSelectWrap}>
                          <select
                            value={representation}
                            onChange={(e) =>
                              updateGroup(groupIndex, {
                                representation: e.target.value,
                                options: (group.options || []).map(
                                  (opt, optIndex) => ({
                                    ...createEmptyOption(
                                      groupIndex,
                                      optIndex,
                                      e.target.value,
                                    ),
                                    ...opt,
                                  }),
                                ),
                              })
                            }
                            style={settingsSelectStyle}
                          >
                            {REPRESENTATION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <div style={settingsSelectArrow}>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 20 20"
                              fill="none"
                            >
                              <path
                                d="M5 7l5 5 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div style={settingsHeaderRow(gridTemplateColumns)}>
                        <div style={settingsLabelStyle}>Option Name *</div>
                        <div style={settingsLabelStyle}>
                          {representation === REPRESENTATION_TYPES.ICON
                            ? "Icon"
                            : representation === REPRESENTATION_TYPES.TEXTURE
                              ? "Texture"
                              : "Color"}
                        </div>
                        <div style={settingsLabelStyle}>Action</div>
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        {(group.options || []).map((opt, optionIndex) => (
                          <div
                            key={opt.id || optionIndex}
                            style={{
                              display: "grid",
                              gridTemplateColumns: gridTemplateColumns,
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            <input
                              value={opt.label || ""}
                              onChange={(e) =>
                                updateOption(groupIndex, optionIndex, {
                                  label: e.target.value,
                                })
                              }
                              placeholder="Option name"
                              style={settingsInputStyle}
                            />

                            {representation === REPRESENTATION_TYPES.COLOR && (
                              <div style={settingsColorField}>
                                <div
                                  style={{
                                    ...settingsColorSwatch,
                                    background: opt.color || "#94a3b8",
                                  }}
                                />
                                <input
                                  type="color"
                                  value={opt.color || "#94a3b8"}
                                  onChange={(e) =>
                                    updateOption(groupIndex, optionIndex, {
                                      color: e.target.value,
                                    })
                                  }
                                  style={settingsColorNativeInput}
                                />
                              </div>
                            )}

                            {representation === REPRESENTATION_TYPES.ICON && (
                              <div style={settingsSelectWrap}>
                                <div style={settingsSelectIconPreview}>
                                  <WtIcon
                                    icon={opt.icon || "circle"}
                                    size={18}
                                  />
                                </div>

                                <select
                                  value={opt.icon || "circle"}
                                  onChange={(e) =>
                                    updateOption(groupIndex, optionIndex, {
                                      icon: e.target.value,
                                    })
                                  }
                                  style={settingsSelectStyle}
                                >
                                  {ICON_OPTIONS.map((icon) => (
                                    <option key={icon.value} value={icon.value}>
                                      {icon.label}
                                    </option>
                                  ))}
                                </select>

                                <div style={settingsSelectArrow}>
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                  >
                                    <path
                                      d="M5 7l5 5 5-5"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}

                            {representation ===
                              REPRESENTATION_TYPES.TEXTURE && (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "minmax(0,1fr) 110px",
                                  gap: 12,
                                  alignItems: "center",
                                }}
                              >
                                <div style={settingsSelectWrap}>
                                  <select
                                    value={opt.texture || "solid"}
                                    onChange={(e) =>
                                      updateOption(groupIndex, optionIndex, {
                                        texture: e.target.value,
                                      })
                                    }
                                    style={settingsTextureSelectCompact}
                                  >
                                    {TEXTURE_OPTIONS.map((texture) => (
                                      <option
                                        key={texture.value}
                                        value={texture.value}
                                      >
                                        {texture.label}
                                      </option>
                                    ))}
                                  </select>

                                  <div style={settingsSelectArrow}>
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 20 20"
                                      fill="none"
                                    >
                                      <path
                                        d="M5 7l5 5 5-5"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </div>
                                </div>

                                <div style={settingsTexturePreviewInline}>
                                  <div
                                    style={{
                                      ...settingsTexturePreviewInner,
                                      ...getTextureBackground(
                                        opt.texture || "solid",
                                        opt.color || "#94a3b8",
                                      ),
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            <AppButton
                              variant="softDanger"
                              onClick={() =>
                                removeOption(groupIndex, optionIndex)
                              }
                            >
                              Remove
                            </AppButton>
                          </div>
                        ))}
                      </div>

                      <AppButton
                        variant="ghost"
                        onClick={() => addOption(groupIndex)}
                        style={{ width: "fit-content" }}
                      >
                        + Add Option
                      </AppButton>
                    </div>
                  );
                })}

                {(draft.timelineStructure?.length || 0) <
                  MAX_CATEGORY_COUNT && (
                  <AppButton
                    variant="secondary"
                    onClick={addCategory}
                    style={{
                      width: "100%",
                      height: 52,
                      borderRadius: 16,
                      fontSize: 15,
                      fontWeight: 800,
                      borderStyle: "dashed",
                    }}
                  >
                    + Add Category
                  </AppButton>
                )}
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <AppButton variant="secondary" onClick={onClose}>
              Cancel
            </AppButton>

            <AppButton
              variant="primary"
              disabled={hasErrors}
              onClick={() =>
                saveNow(draft.trackingMode !== settings.trackingMode)
              }
            >
              Save Settings
            </AppButton>
          </div>
        </div>
      </Modal>

      {showModeWarning && (
        <ModeChangeWarningModal
          nextMode={pendingMode}
          onCancel={() => {
            setPendingMode(null);
            setShowModeWarning(false);
          }}
          onConfirm={applyModeChange}
        />
      )}
    </>
  );
}
/* ── LEGEND ── */
function LegendGroup({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: UI.color.text3,
          minWidth: 56,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Legend({ settings }) {
  const structure = settings?.timelineStructure || DEFAULT_TIMELINE_STRUCTURE;
  const group1 = structure[0] || { label: "Main Group", options: [] };
  const group2 = structure[1] || { label: "Sub Group", options: [] };

  return (
    <div
      style={{
        position: "fixed",
        left: 18,
        bottom: 18,
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(10px)",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        boxShadow: "0 8px 28px rgba(15,23,42,0.08)",
        padding: "14px 16px",
        zIndex: 30,
        display: "grid",
        gap: 12,
        minWidth: 420,
      }}
    >
      {/* GROUP 1 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#94a3b8",
            minWidth: 88,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {group1.label}
        </span>

        {group1.options.map((opt) => (
          <span
            key={opt.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#334155",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 4,
                background: opt.color || "#94a3b8",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {opt.label}
          </span>
        ))}
      </div>

      {/* GROUP 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#94a3b8",
            minWidth: 88,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {group2.label}
        </span>

        {group2.options.map((opt) => (
          <span
            key={opt.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#334155",
            }}
          >
            <WtIcon icon={opt.icon} size={12} />
            {opt.label}
          </span>
        ))}
      </div>

      {/* CALENDAR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#94a3b8",
            minWidth: 88,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Calendar
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "#334155",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 4,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          Excluded Days
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "#334155",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 4,
              background: "#fef2f2",
              border: "1px solid #e5e7eb",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          Excluded Dates
        </span>
      </div>
    </div>
  );
}

function LegendChip({ color, label, outlined }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 999,
        border: outlined ? "1px solid #e5e7eb" : "none",
        background: outlined ? "#fff" : "transparent",
        fontSize: 12,
        color: "#334155",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color,
          border: "1px solid rgba(15,23,42,0.06)",
        }}
      />
      {label}
    </span>
  );
}

function LegendIcon({ icon, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 12,
        color: "#334155",
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function AddWorkspaceModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [setupMode, setSetupMode] = useState("default");
  const [customSettings, setCustomSettings] = useState({
    ...DEF_SETTINGS,
    timelineStructure: DEFAULT_TIMELINE_STRUCTURE,
  });

  function handleSave() {
    if (!name.trim()) {
      alert("Workspace Name is required.");
      return;
    }

    const structure = customSettings.timelineStructure || [];

    if (setupMode === "custom") {
      if (structure.length !== 2) {
        alert("Timeline structure must have exactly 2 groups.");
        return;
      }

      const [mainCategory, subCategory] = structure;

      if (!mainCategory?.label?.trim()) {
        alert("Main Category Name is required.");
        return;
      }

      if (!subCategory?.label?.trim()) {
        alert("Subcategory Name is required.");
        return;
      }

      if (!(mainCategory.options || []).length) {
        alert("Main Category must have at least 1 option.");
        return;
      }

      if (!(subCategory.options || []).length) {
        alert("Subcategory must have at least 1 option.");
        return;
      }

      const hasEmptyMain = mainCategory.options.some(
        (opt) => !opt.label?.trim(),
      );
      if (hasEmptyMain) {
        alert("All Main Category options must have a name.");
        return;
      }

      const hasEmptySub = subCategory.options.some((opt) => !opt.label?.trim());
      if (hasEmptySub) {
        alert("All Subcategory options must have a name.");
        return;
      }
    }

    onSave({
      name: name.trim(),
      setupMode,
      customSettings,
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4000,
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 760,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}
            >
              Create Workspace
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
              Set up your timeline workspace
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 22,
              color: "var(--text-3)",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 18 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              Workspace Name <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HRIS Planning"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1.5px solid var(--border)",
                borderRadius: 10,
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 8,
              }}
            >
              Setup Mode
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSetupMode("default")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border:
                    setupMode === "default"
                      ? "1.5px solid #93c5fd"
                      : "1.5px solid var(--border)",
                  background:
                    setupMode === "default" ? "var(--blue-light)" : "#fff",
                  color:
                    setupMode === "default" ? "var(--blue)" : "var(--text)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Quick Setup
              </button>

              <button
                type="button"
                onClick={() => setSetupMode("custom")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border:
                    setupMode === "custom"
                      ? "1.5px solid #93c5fd"
                      : "1.5px solid var(--border)",
                  background:
                    setupMode === "custom" ? "var(--blue-light)" : "#fff",
                  color: setupMode === "custom" ? "var(--blue)" : "var(--text)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Custom Setup
              </button>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>
              Quick Setup uses the default timeline structure. Custom Setup lets
              you configure it now.
            </div>
          </div>

          {setupMode === "custom" && (
            <>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  Timeline Structure
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-3)",
                    marginBottom: 12,
                  }}
                >
                  Define how your timeline is grouped.
                </div>

                <TimelineStructureEditor
                  value={customSettings.timelineStructure}
                  onChange={(nextStructure) =>
                    setCustomSettings((prev) => ({
                      ...prev,
                      timelineStructure: nextStructure,
                    }))
                  }
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  Exclude Days
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2,1fr)",
                    gap: 8,
                  }}
                >
                  {[
                    { id: 0, label: "Sunday" },
                    { id: 1, label: "Monday" },
                    { id: 2, label: "Tuesday" },
                    { id: 3, label: "Wednesday" },
                    { id: 4, label: "Thursday" },
                    { id: 5, label: "Friday" },
                    { id: 6, label: "Saturday" },
                  ].map((day) => {
                    const checked = (customSettings.excludeDays || []).includes(
                      day.id,
                    );
                    return (
                      <label
                        key={day.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 12px",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setCustomSettings((prev) => {
                              const set = new Set(prev.excludeDays || []);
                              if (e.target.checked) set.add(day.id);
                              else set.delete(day.id);
                              return {
                                ...prev,
                                excludeDays: Array.from(set).sort(
                                  (a, b) => a - b,
                                ),
                              };
                            });
                          }}
                        />
                        <span style={{ fontSize: 13 }}>{day.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: "16px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: "var(--blue)",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Create Workspace
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   ONBOARDING STEP 1: Welcome & Workspace Setup
────────────────────────────────────────────────────────────────────────────── */
function OnboardingStepOne({
  workspaceName,
  setWorkspaceName,
  projectName,
  setProjectName,
  onNext,
  onLogout,
}) {
  return (
    <OnboardingShell
      step={1}
      title="Welcome"
      subtitle="Set up your workspace to get started."
      onLogout={onLogout}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onNext}
            style={onboardingPrimaryBtn}
            onMouseEnter={primaryBtnHoverOn}
            onMouseLeave={primaryBtnHoverOff}
          >
            Continue
          </button>
        </div>
      }
    >
      <div
        style={{
          background: "#fbfdff",
          border: "1px solid #e6edf7",
          borderRadius: 18,
          padding: 20,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              Workspace Name *
            </label>
            <input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Marketing Team"
              style={onboardingInput}
              onFocus={onboardingInputFocus}
              onBlur={onboardingInputBlur}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              First Project
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>
                {" "}
                (optional)
              </span>
            </label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Website Redesign"
              style={onboardingInput}
              onFocus={onboardingInputFocus}
              onBlur={onboardingInputBlur}
            />
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   SETUP SECTION: Reusable card component for step 2 sections
────────────────────────────────────────────────────────────────────────────── */
function SetupSection({ title, subtitle, children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 20,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#94a3b8",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   ONBOARDING STEP TWO
────────────────────────────────────────────────────────────────────────────── */
function OnboardingStepTwo({
  children,
  onBack,
  onQuickSetup,
  onFinish,
  onLogout,
}) {
  return (
    <OnboardingShell
      step={2}
      title="Timeline Setup"
      subtitle="Choose how your timeline should be organized."
      onLogout={onLogout}
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <button
            onClick={onBack}
            style={onboardingSecondaryBtn}
            onMouseEnter={secondaryBtnHoverOn}
            onMouseLeave={secondaryBtnHoverOff}
          >
            ← Back
          </button>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={onQuickSetup}
              style={onboardingGhostBtn}
              onMouseEnter={ghostBtnHoverOn}
              onMouseLeave={ghostBtnHoverOff}
            >
              Quick Setup
            </button>

            <button
              onClick={onFinish}
              style={onboardingPrimaryBtn}
              onMouseEnter={primaryBtnHoverOn}
              onMouseLeave={primaryBtnHoverOff}
            >
              Start Planning
            </button>
          </div>
        </div>
      }
    >
      <div
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        {children}
      </div>
    </OnboardingShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   ONBOARDING MODAL (Main orchestrator)
────────────────────────────────────────────────────────────────────────────── */
function OnboardingModal({ onFinish, onLogout }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [setupMode, setSetupMode] = useState("custom");
  const [customSettings, setCustomSettings] = useState({
    ...DEF_SETTINGS,
    timelineStructure: DEFAULT_TIMELINE_STRUCTURE,
  });

  function handleNext() {
    if (!name.trim()) {
      alert("Workspace name is required");
      return;
    }
    setStep(2);
  }

  function handleFinish() {
    onFinish({
      name: name.trim(),
      setupMode,
      customSettings,
      initialProject: projectName.trim() || null,
    });
  }

  return step === 1 ? (
    <OnboardingStepOne
      workspaceName={name}
      setWorkspaceName={setName}
      projectName={projectName}
      setProjectName={setProjectName}
      onNext={handleNext}
      onLogout={onLogout}
    />
  ) : (
    <OnboardingStepTwo
      onBack={() => setStep(1)}
      onQuickSetup={() => setSetupMode("default")}
      onFinish={handleFinish}
      onLogout={onLogout}
    >
      {setupMode === "default" && (
        <>
          <SetupSection title="Primary Group" subtitle="Main phases">
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Planning → Development → Launch
            </div>
          </SetupSection>
          <SetupSection title="Secondary Group" subtitle="Support phases">
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Review → Optimization → Maintenance
            </div>
          </SetupSection>
        </>
      )}

      {setupMode === "custom" && (
        <>
          <SetupSection
            title="Set Timeline Phases"
            subtitle="Customize how you organize work"
          >
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Create the main phases that will structure your project timeline.
              These become the backbone of how you track progress.
            </div>
            <TimelineStructureEditor
              value={customSettings.timelineStructure}
              onChange={(next) =>
                setCustomSettings((prev) => ({
                  ...prev,
                  timelineStructure: next,
                }))
              }
            />
          </SetupSection>
        </>
      )}
    </OnboardingStepTwo>
  );
}

function EditTeamModal({ team, onClose, onSave, onDelete, canDelete }) {
  const [name, setName] = useState(team?.name || "");
  return (
    <Modal title="Edit Workspace" onClose={onClose} width={400}>
      <Fld label="Workspace Name">
        <Inp value={name} onChange={setName} />
      </Fld>
      <Actions
        left={
          canDelete && (
            <B
              v="danger"
              onClick={() => {
                if (
                  confirm(`Delete workspace "${team.name}" and ALL its data?`)
                )
                  onDelete();
              }}
            >
              Delete Workspace
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
