# D-Scan Checker

A compact, always-on-top Electron app for EVE Online that auto-detects D-Scan data from your clipboard and displays ship counts with change tracking.

## Screenshots

![1](https://github.com/user-attachments/assets/6551509f-3764-4d54-9bb3-b87e3d798ab0)
![2](https://github.com/user-attachments/assets/14c3fd27-baa5-4e79-90e0-03ebeec1fe74)
![3](https://github.com/user-attachments/assets/c1b6860f-ce05-4ffc-b99d-4542c2d15baa)
![4](https://github.com/user-attachments/assets/67f8f78e-ddef-4b27-b2dd-4d0bca02474a)

## Features

- **Auto-detect** -- copies D-Scan from EVE, results appear instantly
- **Two views** -- column view (ships + groups side by side with hover cross-highlighting) or grouped view (hierarchical by ship class)
- **Delta tracking** -- green/red +/- indicators show what changed between scans, including ships that disappeared entirely
- **Scan history** -- every scan is saved automatically, browse back with prev/next arrows
- **System name** -- auto-detected from D-Scan entries and shown in the header
- **Grid filter** -- toggle between All / On-grid / Off-grid ships (off-grid = distance shows `-`)
- **Font size** -- adjustable via A-/A+ buttons, persisted across sessions
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
| `✕` | Close the app (top-right) |
| `◀` `▶` | Browse scan history |
| `📌` | Toggle always-on-top |
| `📷` | Screenshot to clipboard |
| `All` / `On` / `Off` | Cycle grid filter |
| `A-` `A+` | Decrease / increase font size |
| `↔` | Toggle between column and grouped view |

## Ship Database

The app uses `ships.json` which contains EVE ship types and their group/class mappings, all derived from the EVE SDE. Ship groups are detected by category, and the super-group hierarchy (Capital Ships, Battleships, etc.) is built from the market group tree — no hardcoded IDs. To regenerate:

```bash
# Default: looks for JSONL files in tools/evesde/
npm run extract

# Or specify a custom path:
node tools/extract-ships.js /path/to/evesde
```

Requires `types.jsonl`, `groups.jsonl`, and `marketGroups.jsonl` from the EVE Static Data Export.
