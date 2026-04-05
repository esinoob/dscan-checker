const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SDE_PATH = process.argv[2] || path.join(__dirname, 'evesde');

const SHIPS_MARKET_GROUP = 4; // Top-level "Ships" market group

function readJsonl(filename) {
  const filepath = path.join(SDE_PATH, filename);
  const lines = fs.readFileSync(filepath, 'utf8').split('\n').filter(l => l.trim());
  return lines.map(l => JSON.parse(l));
}

// Build set of published ship group IDs from categoryID 6
const shipGroupIds = new Set();
const groups = {};
for (const g of readJsonl('groups.jsonl')) {
  if (g.categoryID === 6 && g.published) {
    shipGroupIds.add(g._key);
    groups[g._key] = g.name.en;
  }
}

// Build market group tree
const marketGroups = {};
for (const mg of readJsonl('marketGroups.jsonl')) {
  marketGroups[mg._key] = { name: mg.name.en, parentGroupID: mg.parentGroupID };
}

// Walk up market group tree to find the immediate child of SHIPS_MARKET_GROUP
function findSuperGroup(marketGroupID) {
  if (!marketGroupID || !marketGroups[marketGroupID]) return 'Other';

  let current = marketGroupID;
  const visited = new Set();
  while (current) {
    if (visited.has(current)) return 'Other';
    visited.add(current);
    const mg = marketGroups[current];
    if (!mg) return 'Other';
    if (mg.parentGroupID === SHIPS_MARKET_GROUP) {
      return mg.name;
    }
    current = mg.parentGroupID;
  }
  return 'Other';
}

// Build typeName -> ship info, and track super-group votes per groupID
const ships = {};
const groupSuperVotes = {}; // groupID -> { superGroupName: count }
const superGroupMass = {};  // superGroupName -> { total, count } for avg mass
let count = 0;

for (const t of readJsonl('types.jsonl')) {
  if (t.published && shipGroupIds.has(t.groupID) && t.name && t.name.en) {
    const superGroup = findSuperGroup(t.marketGroupID);

    ships[t.name.en] = {
      typeID: t._key,
      groupID: t.groupID
    };

    if (!groupSuperVotes[t.groupID]) groupSuperVotes[t.groupID] = {};
    groupSuperVotes[t.groupID][superGroup] = (groupSuperVotes[t.groupID][superGroup] || 0) + 1;

    if (t.mass) {
      if (!superGroupMass[superGroup]) superGroupMass[superGroup] = { total: 0, count: 0 };
      superGroupMass[superGroup].total += t.mass;
      superGroupMass[superGroup].count++;
    }

    count++;
  }
}

// Assign each groupID to the best super-group.
// "Special Edition Ships" is a market category, not a hull class — prefer any other.
const superGroups = {};
const groupToSuper = {};
for (const [gid, votes] of Object.entries(groupSuperVotes)) {
  const candidates = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const nonSpecial = candidates.find(([name]) => name !== 'Special Edition Ships');
  const best = nonSpecial ? nonSpecial[0] : candidates[0][0];
  groupToSuper[gid] = best;
  if (!superGroups[best]) superGroups[best] = [];
  superGroups[best].push(Number(gid));
}

// Sort super-groups by average ship mass (descending = biggest first)
const superGroupOrder = Object.keys(superGroups).sort((a, b) => {
  const avgA = superGroupMass[a] ? superGroupMass[a].total / superGroupMass[a].count : 0;
  const avgB = superGroupMass[b] ? superGroupMass[b].total / superGroupMass[b].count : 0;
  return avgB - avgA;
});

// Add metadata
ships.__meta = {
  groups,
  superGroups,
  superGroupOrder,
  groupToSuper,
  extractedAt: new Date().toISOString()
};

const outPath = path.join(ROOT, 'ships.json');
fs.writeFileSync(outPath, JSON.stringify(ships, null, 2));

console.log(`Extracted ${count} ships across ${Object.keys(groups).length} groups -> ${outPath}`);
