# D-Scan Checker

A compact, always-on-top Electron app for EVE Online that auto-detects D-Scan data from your clipboard and displays ship counts with change tracking.

## Features

- **Auto-detect** -- copies D-Scan from EVE, results appear instantly
- **Two views** -- column view (ships + groups side by side with hover cross-highlighting) or grouped view (hierarchical by ship class)
- **Delta tracking** -- green/red +/- indicators show what changed between scans, including ships that disappeared entirely
- **Scan history** -- every scan is saved automatically, browse back with prev/next arrows
- **Min-count filter** -- hide low-count ship types
- **Screenshot** -- capture the window to clipboard with one click
- **Always-on-top toggle** -- pin/unpin the window over your game
- **Frameless & compact** -- minimal footprint, remembers window position and size

## Install & Run

```bash
git clone <repo-url>
cd dscan-checker
npm install
npm start
```

## Build

Package as a standalone executable:

```bash
npm run build          # Windows portable exe
npm run build:linux    # Linux AppImage
npm run build:mac      # macOS DMG
```

Output goes to `dist/`.

## Usage

1. Launch the app
2. In EVE Online, open the D-Scan window and press Scan
3. Select all results (Ctrl+A) and copy (Ctrl+C)
4. The app detects the D-Scan data and displays ship counts

Copy a new D-Scan to see deltas (changes) from the previous scan. Use the arrows in the footer to browse through past scans.

## Controls

| Button | Action |
|--------|--------|
| Min filter | Hide ship types below a count threshold |
| `◀` `▶` | Browse scan history |
| `📌` | Toggle always-on-top |
| `📷` | Screenshot to clipboard |
| `↔` | Toggle between column and grouped view |

## Ship Database

The app uses `ships.json` which contains EVE ship types and their group/class mappings. To regenerate from the EVE SDE:

```bash
# Default: looks for JSONL files in ./evesde/
npm run extract

# Or specify a custom path:
node tools/extract-ships.js /path/to/evesde
```

Requires `types.jsonl` and `groups.jsonl` from the EVE Static Data Export.
