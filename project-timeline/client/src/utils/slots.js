/**
 * utils/slots.js
 * Generates slot objects from a timeline structure with 2 groups.
 * Each slot represents a combination of Group 1 option × Group 2 option.
 */

export function buildSlots(structure) {
  // Currently supports 2 groups only (can extend to N groups later if needed)
  const [group1, group2] = structure;
  if (!group1 || !group2) return [];

  return group1.options.flatMap((opt1) =>
    group2.options.map((opt2) => ({
      id: `${opt1.id}__${opt2.id}`, // double underscore = safe separator
      g1Id: opt1.id,
      g2Id: opt2.id,
      g1Label: opt1.label,
      g2Label: opt2.label,
      color: opt1.color ?? opt2.color ?? "#94a3b8", // fallback chain: group1 → group2 → gray
      icon: opt2.icon ?? opt1.icon ?? null, // fallback chain: group2 → group1 → null
      order: opt1.order * group2.options.length + opt2.order,
    })),
  );
}

/**
 * Extract Group 1 options with colors for priority display in grid rows.
 */
export function getGroup1Options(structure) {
  const group1 = structure[0];
  return group1.options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    color: opt.color ?? "#94a3b8",
  }));
}
