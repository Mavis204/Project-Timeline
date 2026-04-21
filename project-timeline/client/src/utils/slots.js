/**
 * utils/slots.js
 * Supports:
 * - Group 1 only
 * - Group 1 + Group 2
 * - Group 1 + Group 2 + Group 3
 * - group representation: color | icon | texture
 */

function getGroupVisual(opt, representation) {
  if (representation === "color") {
    return {
      color: opt.color ?? "#94a3b8",
      icon: null,
      texture: null,
    };
  }

  if (representation === "icon") {
    return {
      color: null,
      icon: opt.icon ?? "circle",
      texture: null,
    };
  }

  if (representation === "texture") {
    return {
      color: null,
      icon: null,
      texture: opt.texture ?? "solid",
    };
  }

  return {
    color: opt.color ?? null,
    icon: opt.icon ?? null,
    texture: opt.texture ?? null,
  };
}

function mergeVisuals(...visuals) {
  return {
    color:
      visuals.find((v) => v?.color != null)?.color ??
      "#94a3b8",

    texture:
      visuals.find((v) => v?.texture != null)?.texture ??
      "solid",

    icon:
      visuals.find((v) => v?.icon != null)?.icon ??
      null,
  };
}

export function buildSlots(structure = []) {
  const validGroups = (structure || []).filter(
    (g) => g && Array.isArray(g.options) && g.options.length > 0,
  );

  if (validGroups.length === 0) return [];

  let slots = [];

  if (validGroups.length === 1) {
    const group1 = validGroups[0];

    slots = group1.options.map((opt1) => {
      const v1 = getGroupVisual(opt1, group1.representation);

      return {
        id: opt1.id,
        g1Id: opt1.id,
        g2Id: null,
        g3Id: null,
        g1Label: opt1.label,
        g2Label: "",
        g3Label: "",
        ...mergeVisuals(v1),
        order: opt1.order ?? 0,
      };
    });
  } else if (validGroups.length === 2) {
    const [group1, group2] = validGroups;

    slots = group1.options.flatMap((opt1) =>
      group2.options.map((opt2) => {
        const v1 = getGroupVisual(opt1, group1.representation);
        const v2 = getGroupVisual(opt2, group2.representation);

        return {
          id: `${opt1.id}__${opt2.id}`,
          g1Id: opt1.id,
          g2Id: opt2.id,
          g3Id: null,
          g1Label: opt1.label,
          g2Label: opt2.label,
          g3Label: "",
          ...mergeVisuals(v1, v2),
          order:
            (opt1.order ?? 0) * group2.options.length +
            (opt2.order ?? 0),
        };
      }),
    );
  } else {
    const [group1, group2, group3] = validGroups;

    slots = group1.options.flatMap((opt1) =>
      group2.options.flatMap((opt2) =>
        group3.options.map((opt3) => {
          const v1 = getGroupVisual(opt1, group1.representation);
          const v2 = getGroupVisual(opt2, group2.representation);
          const v3 = getGroupVisual(opt3, group3.representation);

          return {
            id: `${opt1.id}__${opt2.id}__${opt3.id}`,
            g1Id: opt1.id,
            g2Id: opt2.id,
            g3Id: opt3.id,
            g1Label: opt1.label,
            g2Label: opt2.label,
            g3Label: opt3.label,
            ...mergeVisuals(v1, v2, v3),
            order:
              (opt1.order ?? 0) * group2.options.length * group3.options.length +
              (opt2.order ?? 0) * group3.options.length +
              (opt3.order ?? 0),
          };
        }),
      ),
    );
  }

  return slots;
}

export function getGroup1Options(structure = []) {
  const group1 = structure?.[0];
  if (!group1?.options) return [];

  return group1.options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    color: opt.color ?? "#94a3b8",
    icon: opt.icon ?? null,
    texture: opt.texture ?? "solid",
    representation: group1.representation || "color",
  }));
}

export function getGroup2Options(structure = []) {
  const group2 = structure?.[1];
  if (!group2?.options) return [];

  return group2.options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    color: opt.color ?? "#94a3b8",
    icon: opt.icon ?? null,
    texture: opt.texture ?? "solid",
    representation: group2.representation || "icon",
  }));
}
