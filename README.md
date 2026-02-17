# SongRate — YouTube Music Song Rating App

Rate songs playing on YouTube Music in real time. View the artist, song title, album, year, and album art — then assign a numeric rating (1–10). All data is saved locally for analysis.

## Features

- **Real-time detection** — Detects what's playing on YouTube Music (phone or desktop)
- **Rich metadata** — Album art, artist, album name, release year
- **1–10 rating scale** — With optional notes and tags
- **Duplicate detection** — Alerts you if a song was already rated
- **Edit & delete** — Modify song info or ratings anytime
- **Search, filter, sort** — Find rated songs instantly
- **Export** — CSV and JSON export for data analysis
- **Summary stats** — Average rating, top artist, rating distribution

## Setup (One-Time)

### 1. Prerequisites

- **Python 3.9+** installed
- A **Google account** with YouTube Music

### 2. Run Setup

```bash
cd path/to/Antigravity
py setup.py
```

The wizard will:
1. Install Python dependencies
2. Walk you through copying request headers from your browser (see below)
3. Verify the connection

### How Browser Auth Works

The app authenticates using cookies from your YouTube Music session:

1. Open **https://music.youtube.com** in your browser (logged in)
2. Open **Developer Tools** (F12) → **Network** tab
3. Filter by `/browse` and click around in YouTube Music to trigger a request
4. Copy the **request headers** and paste them into the setup wizard
5. Auth stays valid for ~2 years unless you log out

## Usage

```bash
python server.py
```

Open **http://localhost:5000** in your browser.

Play a song on YouTube Music (phone or desktop) — it will appear in the app within ~10 seconds.

## Data Analysis

Ratings are stored in `data/ratings.json`. Each entry includes:

| Field | Description |
|-------|-------------|
| `videoId` | YouTube Music unique ID |
| `title` | Song title |
| `artist` | Artist name(s) |
| `album` | Album name |
| `year` | Release year |
| `rating` | Numeric rating (1–10) |
| `ratedAt` | ISO timestamp |
| `tags` | User-defined tags |
| `notes` | Free-text notes |

### Export

- **CSV**: Click the CSV button in the header, or visit `http://localhost:5000/api/export/csv`  
- **JSON**: Click the JSON button, or visit `http://localhost:5000/api/export/json`

### API

The app exposes a REST API for programmatic access:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ratings` | GET | All ratings (supports `?sort_by=`, `?min_rating=`, `?artist=`) |
| `/api/ratings` | POST | Add a rating |
| `/api/ratings/<id>` | PUT | Edit a rating |
| `/api/ratings/<id>` | DELETE | Delete a rating |
| `/api/now-playing` | GET | Currently playing track |
| `/api/export/csv` | GET | Download CSV |
| `/api/export/json` | GET | Download JSON |
