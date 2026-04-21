/**
 * constants.js — App-wide constants and default data.
 */

export const TRACKING_MODES = {
  SIMPLE: "simple",
  GROUPED: "grouped",
  TASK: "task",
};

export const PLOT_UNITS = {
  HOURS: "hours",
  DAYS: "days",
  WEEKS: "weeks",
};

export const REPRESENTATION_TYPES = {
  COLOR: "color",
  ICON: "icon",
  TEXTURE: "texture",
};

export const DEFAULT_WORK_HOURS_PER_DAY = 8;

export const DEFAULT_TIMELINE_STRUCTURE = [
  {
    id: "group_primary",
    label: "Category 1",
    representation: REPRESENTATION_TYPES.COLOR,
    options: [
      {
        id: "opt_high",
        label: "High",
        color: "#ef4444",
        texture: "solid",
        order: 0,
      },
      {
        id: "opt_medium",
        label: "Medium",
        color: "#f97316",
        texture: "solid",
        order: 1,
      },
      {
        id: "opt_low",
        label: "Low",
        color: "#3b82f6",
        texture: "solid",
        order: 2,
      },
    ],
  },
  {
    id: "group_secondary",
    label: "Category 2",
    representation: REPRESENTATION_TYPES.ICON,
    options: [
      {
        id: "opt_bug",
        label: "Bug",
        icon: "bug",
        texture: "solid",
        order: 0,
      },
      {
        id: "opt_nf",
        label: "New Feature",
        icon: "sparkles",
        texture: "solid",
        order: 1,
      },
      {
        id: "opt_enh",
        label: "Enhancement",
        icon: "wrench",
        texture: "solid",
        order: 2,
      },
    ],
  },
];

export const DEF_SETTINGS = {
  excludeDays: [],
  excludeDates: [],
  holidays: [],
  timelineStructure: DEFAULT_TIMELINE_STRUCTURE,
  membersEnabled: true,
  trackingMode: TRACKING_MODES.GROUPED,
  plotUnit: PLOT_UNITS.HOURS,
  workHoursPerDay: 8,
};

export const DEF_TEAM_DATA = {
  projects: [],
  currentTimeline: null,
  archives: [],
};
