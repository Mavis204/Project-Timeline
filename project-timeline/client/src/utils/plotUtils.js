/**
 * plotUtils.js — Core Gantt/timeline plotting algorithm.
 *
 * Pure functions only. Client-side in full-stack mode.
 * Could optionally be moved to the server if you want server-side
 * pre-computation of timeline positions.
 */

import { addD, dayType } from "./dateUtils";

/**
 * Sequential partial-day plotter.
 *
 * Given a list of priority/work-type slots (each with an `hours` field),
 * fills them into consecutive working days starting from `plotStart`,
 * splitting across day boundaries as needed.
 *
 * @param {Array<{id, hours, color, wtId, pId, name}>} slots
 * @param {string} plotStart - ISO date string for the first working day.
 * @param {object} settings  - Calendar settings (holidays, excludeDays).
 * @returns {Map<string, Array>} Map of ISO date → array of day segments.
 *
 * Each segment: { slotId, startFrac, endFrac, color, wtId, pId, slotName, segHours, totalHours }
 * startFrac/endFrac are 0–1 fractions of the 8-hour day.
 *
 * PostgreSQL equivalent (if moving to server):
 *   This logic maps to a server-side function that returns rows like:
 *   { plot_date DATE, slot_id TEXT, start_frac NUMERIC, end_frac NUMERIC, ... }
 */
export function plotPartialDays(slots, plotStart, settings) {
  const result = new Map();
  let cursor = plotStart;

  // Advance to first working day
  let safety = 0;
  while (dayType(cursor, settings) !== "work" && safety < 30) {
    cursor = addD(cursor, 1);
    safety++;
  }

  let dayUsed = 0; // hours used in current working day (0–8)

  slots.forEach((slot) => {
    if (!slot.hours || slot.hours <= 0) return;
    let rem = slot.hours;

    while (rem > 0) {
      const avail = 8 - dayUsed;
      const used = Math.min(rem, avail);
      const sf = dayUsed / 8;
      const ef = (dayUsed + used) / 8;

      if (!result.has(cursor)) result.set(cursor, []);
      result.get(cursor).push({
        slotId: slot.id,
        startFrac: sf,
        endFrac: ef,
        color: slot.color,
        wtId: slot.wtId,
        pId: slot.pId,
        slotName: slot.name,
        g1Label: slot.g1Label,
        g2Label: slot.g2Label,
        icon: slot.icon,
        segHours: used,
        totalHours: slot.hours,
      });

      rem -= used;
      dayUsed += used;

      if (dayUsed >= 8) {
        dayUsed = 0;
        cursor = addD(cursor, 1);
        let s2 = 0;
        while (dayType(cursor, settings) !== "work" && s2 < 30) {
          cursor = addD(cursor, 1);
          s2++;
        }
      }
    }
  });

  return result;
}
