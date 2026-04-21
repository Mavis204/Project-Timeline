/**
 * dateUtils.js — Pure date/calendar helpers.
 *
 * These are stateless pure functions. They stay 100% on the client in
 * full-stack mode — no server changes needed.
 *
 * All dates are represented as ISO strings: "YYYY-MM-DD".
 */

export const MON_S = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const MON_F = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const DOW_S = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Format a Date object or ISO string to "YYYY-MM-DD". */
export function fd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${s2(dt.getMonth() + 1)}-${s2(dt.getDate())}`;
}

/** Zero-pad a number to 2 digits. */
export function s2(n) {
  return String(n).padStart(2, "0");
}

/** Parse an ISO "YYYY-MM-DD" string to a local Date (no timezone shift). */
export function pd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Add n calendar days to an ISO date string and return the new ISO string. */
export function addD(s, n) {
  const d = pd(s);
  d.setDate(d.getDate() + n);
  return fd(d);
}

/** Return the number of calendar days between two ISO date strings (b - a). */
export function diffD(a, b) {
  return Math.round((pd(b) - pd(a)) / 86400000);
}

/** Format an ISO date string to "Mon D, YYYY" (short month). */
export function fmt(s) {
  if (!s) return "—";
  const d = pd(s);
  return `${MON_S[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Format an ISO date string to "Month D, YYYY" (full month). */
export function fmtF(s) {
  if (!s) return "—";
  const d = pd(s);
  return `${MON_F[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Convert hours to work days (ceiling of hours/8). */
export function cd8(h) {
  return Math.ceil(Number(h || 0) / 8);
}

/** Coerce a value (string, array, undefined) to a clean string array. */
export function toArr(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  return String(v)
    .split(/[,&]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Return all ISO date strings in the inclusive range [a, b]. */
export function dRange(a, b) {
  const r = [];
  let c = a;
  while (c <= b) {
    r.push(c);
    c = addD(c, 1);
  }
  return r;
}

/** Return today's date as "YYYY-MM-DD". */
export function today() {
  return fd(new Date());
}

/**
 * Classify a date as 'weekend', 'holiday', 'alignment', or 'work'.
 * @param {string} s - ISO date string.
 * @param {object} cfg - Settings object: { holidays, excludeDays, alignDay }.
 */
export function dayType(s, cfg) {
  const d = pd(s);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return "weekend";
  if ((cfg.excludeDates || []).includes(s)) return "excluded";
  if ((cfg.holidays || []).includes(s)) return "holiday";
  const excludeDays = Array.isArray(cfg.excludeDays)
    ? cfg.excludeDays
    : cfg.alignDay !== undefined
      ? [cfg.alignDay]
      : [];
  if (excludeDays.includes(dow)) return "alignment";
  return "work";
}

/**
 * Return the first n working dates starting from `start`.
 * @param {string} start - ISO date string.
 * @param {number} n - Number of working days to collect.
 * @param {object} cfg - Settings object.
 * @returns {string[]} Array of ISO date strings.
 */
export function workDates(start, n, cfg) {
  if (!n || n <= 0) return [];
  const r = [];
  let c = start,
    i = 0;
  while (r.length < n && i < 700) {
    if (dayType(c, cfg) === "work") r.push(c);
    c = addD(c, 1);
    i++;
  }
  return r;
}
