# SongRate — YouTube Music Song Rating App

Rate songs playing on YouTube Music in real time. See the artist, song title, album, year, and album art — then assign a rating. All data is saved locally. Works on both desktop and phone.

## Features

- **Real-time detection** — Detects what's playing on YouTube Music (phone or desktop)
- **Rich metadata** — Album art, artist, album name, original release year
- **Customizable rating scale** — Default 1–10, adjustable in settings
- **Related songs sidebar** — Dual search (title+artist and title-only) shows related versions
- **Other Versions sidebar** — Scans the artist's albums to find the same song on different releases (single vs album, remaster, etc.)
- **Song search** — Search YouTube Music directly and switch to any result
- **Poll pause** — Auto-detection pauses after manually selecting a song (configurable duration)
- **Pause Polling toggle** — Checkbox to fully stop polling for as long as needed
- **Anti-flicker protection** — Remembers recent songs to prevent "Now Playing" from reverting (buffer size configurable in settings)
- **Unrated songs tracker** — Songs you skip are saved automatically; bulk dismiss with "Dismiss All"
- **Songs25.csv checker** — Fuzzy-matches the current song against a CSV file, prints matches in the server console, and auto-removes matched rows
- **Duplicate detection** — Alerts you if a song was already rated
- **Edit & delete** — Modify song info or ratings anytime
- **Search, filter, sort** — Find songs instantly in the rated songs list
- **Export** — CSV and JSON export for data analysis
- **Summary stats** — Average rating, top artist, rating distribution
- **Analytics page** — Detailed charts and statistics at `/analytics`
- **Phone access** — Use on your phone via local network or Cloudflare Tunnel
- **PWA** — Install as an app on your phone's home screen

## Quick Start

### Prerequisites

- **Python 3.9+** — [Download here](https://www.python.org/downloads/)
- A **Google account** with YouTube Music
- **Windows** (tested on Windows 10/11)

### 1. Clone & Install

```bash
git clone https://github.com/HoneyBadgers0220/SongInputter.git
cd SongInputter
py setup.py
```

The setup wizard will:
1. Install Python dependencies (`ytmusicapi`, `flask`)
2. Walk you through browser authentication (see below)
3. Verify the connection

### 2. Browser Authentication

The app uses cookies from your YouTube Music session:

1. Open **https://music.youtube.com** in your browser (logged in)
2. Open **Developer Tools** (F12) → **Network** tab
3. Filter by `/browse` and click around in YouTube Music to trigger a request
4. Copy the **request headers** and paste them into the setup wizard
5. Auth stays valid for ~2 years unless you log out

### 3. Run

**Option A — Simple (desktop only):**
```bash
py server.py
```
Open **http://localhost:5000** in your browser.

**Option B — With phone access (recommended):**

Double-click **`Start SongRate.bat`** in the project folder. This will:
1. Kill any stale server/tunnel processes
2. Start the Flask server
3. Start a Cloudflare Tunnel for remote access
4. Copy the public URL to your clipboard

Open the URL on your phone and add it to your home screen for quick access.

> **Note:** For local network access (same Wi-Fi), the server also prints a `Network:` URL you can use without the tunnel.

## How It Works

1. Play a song on YouTube Music (phone or desktop)
2. It appears in SongRate within ~5 seconds
3. Rate it with the slider and click "Rate This Song"
4. If you skip it, it's saved to "Unrated Songs" so you can rate it later

### Sidebars

When a song is detected, two sidebars appear:

- **Related** — Search results for similar songs (dual search: title+artist and title-only)
- **Other Versions** — Scans the artist's albums on YouTube Music to find the exact same song on different releases (e.g. a single vs the album version, remasters, deluxe editions)

Click any sidebar item to switch "Now Playing" to that version. Polling pauses automatically so you have time to rate.

### Unrated Songs

Songs you play but don't rate are automatically saved to the **Unrated Songs** section. You can:
- **Rate** — Click to open a rating modal
- **Dismiss** — Remove individual songs
- **Dismiss All** — Clear the entire unrated list

### Songs25.csv Checker

If a `Songs25.csv` file exists in the project root, the server will fuzzy-match the currently playing song against it. On match:
- The full CSV row is printed in **green** in the server console
- The row is **deleted** from the CSV
- If no match, a gray "no match" message is printed (once per song)

Matching uses 85% similarity on the concatenated `"artist - title"` string, with parenthesized content stripped (e.g. "(Remastered)" is ignored).

### Phone Access

| Method | When to use |
|--------|-------------|
| Local network (`http://192.168.x.x:5000`) | Phone is on the same Wi-Fi as your PC |
| Cloudflare Tunnel (via `Start SongRate.bat`) | Phone is on any network (cellular, other Wi-Fi) |

**Install as app:** After opening SongRate on your phone:
- **iPhone:** Safari → Share → "Add to Home Screen"
- **Android:** Chrome → ⋮ → "Add to Home Screen"

## Settings

Accessible via the gear icon in the app header:

| Setting | Default | Description |
|---------|---------|-------------|
| Rating Range (min/max) | -3 to 3 | Any integer range, including negatives |
| Poll pause on selection | 10s | How long auto-detection pauses after manually picking a song |
| Anti-flicker buffer size | 5 | Number of recent songs remembered to prevent reverting |

## Data

Ratings are stored in `data/ratings.json`. Unrated songs are in `data/unrated.json`. Settings are in `data/settings.json`.

| Field | Description |
|-------|-------------|
| `videoId` | YouTube Music unique ID |
| `title` | Song title |
| `artist` | Artist name(s) |
| `album` | Album name |
| `year` | Original release year |
| `rating` | Numeric rating |
| `ratedAt` | ISO timestamp |
| `tags` | User-defined tags |
| `notes` | Free-text notes |

### Export

- **CSV**: Click the CSV button in the header, or `GET /api/export/csv`
- **JSON**: Click the JSON button, or `GET /api/export/json`

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/now-playing` | GET | Currently playing track |
| `/api/search` | GET | Search YouTube Music (`?q=`) |
| `/api/find-versions` | GET | Scan artist albums for other versions (`?title=&artist=&videoId=`) |
| `/api/ratings` | GET | Ratings with pagination (`?sort_by=`, `?min_rating=`, `?artist=`, `?limit=`, `?offset=`) |
| `/api/ratings` | POST | Add a rating |
| `/api/ratings/<id>` | PUT | Edit a rating |
| `/api/ratings/<id>` | DELETE | Delete a rating |
| `/api/unrated` | GET | All unrated/skipped songs |
| `/api/unrated` | POST | Save a song as unrated |
| `/api/unrated/<id>` | DELETE | Dismiss an unrated song |
| `/api/unrated/all` | DELETE | Dismiss all unrated songs |
| `/api/unrated/<id>/rate` | POST | Rate an unrated song (moves to rated) |
| `/api/settings` | GET | Current settings |
| `/api/settings` | POST | Update settings |
| `/api/enrich/<albumId>` | GET | Fetch original album release year |
| `/api/export/csv` | GET | Download ratings as CSV |
| `/api/export/json` | GET | Download ratings as JSON |

## Project Structure

```
Antigravity/
├── server.py              # Flask backend + YouTube Music API
├── setup.py               # One-time setup wizard
├── start.ps1              # PowerShell: server + tunnel (kills stale processes)
├── killServer.ps1         # Kill server + all cloudflared processes
├── killServer.bat         # Double-click to kill everything
├── Start SongRate.bat     # Double-click launcher
├── Songs25.csv            # Optional: song list for auto-matching
├── browser.json           # Auth credentials (gitignored)
├── data/
│   ├── ratings.json       # Saved ratings
│   ├── unrated.json       # Skipped/unrated songs
│   └── settings.json      # App settings
└── static/
    ├── index.html         # Frontend UI
    ├── app.js             # Frontend logic
    ├── style.css          # Styles
    ├── analytics.html     # Analytics page
    ├── analytics.js       # Analytics logic
    ├── analytics.css      # Analytics styles
    ├── manifest.json      # PWA manifest
    ├── sw.js              # Service worker
    └── icon.svg           # App icon
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "YTMusic not authenticated" | Run `py setup.py` again |
| Phone can't connect (local) | Allow Python through Windows Firewall when prompted |
| Cloudflare tunnel URL not detected | Check `tunnel.log` in the project folder |
| Songs not appearing | Make sure YouTube Music is playing and auth is valid |
| Old tunnel URLs still working | Run `killServer.bat` to kill all stale cloudflared processes |
| "Now Playing" reverts to old songs | Increase the anti-flicker buffer size in Settings |
