const fs = require("fs");

const content = fs.readFileSync("App.jsx", "utf-8");
const lines = content.split("\n");

// Define all deletions: [startLine, endLine] - 1-indexed, inclusive
const deletions = [
  { name: "getTimelineSummary (nested, DashboardScreen)", start: 3394, end: 3412 },
  { name: "buildProjectColorMap (nested, DashboardScreen)", start: 3429, end: 3435 },
  { name: "buildPrimaryColorMap (nested, DashboardScreen)", start: 3437, end: 3453 },
  { name: "TimelineProjectPreview (nested, DashboardScreen)", start: 3491, end: 3675 },
  { name: "doClearCurrentTimeline (2nd, App)", start: 2749, end: 2756 },
  { name: "add (2nd, TaskItemsEditor)", start: 7369, end: 7372 },
  { name: "handleSave (2nd, AddWorkspaceModal)", start: 10105, end: 10115 },
  { name: "EditTeamModal (2nd, top-level)", start: 10664, end: 10712 },
];

console.log("=== VERIFICATION BEFORE DELETION ===\n");

deletions.forEach((d) => {
  console.log(`${d.name}`);
  console.log(`  Lines ${d.start}-${d.end} (${d.end - d.start + 1} lines)`);
  console.log(`  Start: ${lines[d.start - 1]?.substring(0, 60)}`);
  console.log(`  End: ${lines[d.end - 1]?.substring(0, 60)}`);
  console.log();
});

// Sort deletions in reverse order so line numbers stay valid
const sorted = [...deletions].sort((a, b) => b.start - a.start);

// Create the cleaned file
let cleaned = lines;
let totalDeleted = 0;

sorted.forEach((d) => {
  const toDelete = d.end - d.start + 1;
  cleaned = [...cleaned.slice(0, d.start - 1), ...cleaned.slice(d.end)];
  totalDeleted += toDelete;
  console.log(`✓ Deleted ${d.name}`);
});

fs.writeFileSync("App.jsx", cleaned.join("\n"));

console.log(`\n✅ SUCCESS!`);
console.log(`   Deleted ${deletions.length} duplicate functions`);
console.log(`   Total lines removed: ${totalDeleted}`);
console.log(`   New file size: ${cleaned.length} lines`);
