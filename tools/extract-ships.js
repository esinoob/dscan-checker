const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SDE_PATH = process.argv[2] || path.resolve(ROOT, 'evesde');

const SHIP_GROUP_IDS = new Set([
  25, 26, 27, 28, 30, 31, 237, 324, 358, 380, 419, 420, 463, 485, 513,
  540, 541, 543, 547, 659, 830, 831, 832, 833, 834, 883, 893, 894, 898,
  900, 902, 906, 941, 963, 1022, 1201, 1202, 1283, 1305, 1527, 1534, 1538, 1972
]);

// Higher-level grouping for UI display
const SUPER_GROUPS = {
  "Capitals": [485, 547, 659, 883, 1538],
  "Battleships": [27, 898, 900],
  "Battlecruisers": [419, 513, 540, 1201],
  "Cruisers": [26, 358, 832, 833, 894, 906, 963, 1972],
  "Destroyers": [420, 541, 1305, 1534],
  "Frigates": [25, 324, 830, 831, 834, 893, 1283, 1527],
  "Industrial": [28, 380, 463, 543, 902, 941, 1202],
  "Other": [30, 31, 237, 1022]
};

function readJsonl(filename) {
  const filepath = path.join(SDE_PATH, filename);
  const lines = fs.readFileSync(filepath, 'utf8').split('\n').filter(l => l.trim());
  return lines.map(l => JSON.parse(l));
}

// Build groupID -> groupName map
const groups = {};
for (const g of readJsonl('groups.jsonl')) {
  if (SHIP_GROUP_IDS.has(g._key)) {
    groups[g._key] = g.name.en;
  }
}

// Build typeName -> ship info map
const ships = {};
let count = 0;
for (const t of readJsonl('types.jsonl')) {
  if (t.published && SHIP_GROUP_IDS.has(t.groupID) && t.name && t.name.en) {
    ships[t.name.en] = {
      typeID: t._key,
      groupID: t.groupID,
      groupName: groups[t.groupID] || 'Unknown'
    };
    count++;
  }
}

// Build reverse lookup: groupID -> superGroup name
const groupToSuper = {};
for (const [superName, groupIds] of Object.entries(SUPER_GROUPS)) {
  for (const gid of groupIds) {
    groupToSuper[gid] = superName;
  }
}

// Add metadata
ships.__meta = {
  superGroups: SUPER_GROUPS,
  groupToSuper,
  extractedAt: new Date().toISOString()
};

const outPath = path.join(ROOT, 'ships.json');
fs.writeFileSync(outPath, JSON.stringify(ships, null, 2));

console.log(`Extracted ${count} ships across ${Object.keys(groups).length} groups -> ${outPath}`);
