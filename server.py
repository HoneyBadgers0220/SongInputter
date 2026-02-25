"""
YouTube Music Song Rating App — Flask Backend
Polls ytmusicapi for currently playing track and manages song ratings.
"""

import json
import os
import re
import socket
import time
import uuid
import csv
import io
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, Response
from ytmusicapi import YTMusic

# ─── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RATINGS_FILE = DATA_DIR / "ratings.json"
UNRATED_FILE = DATA_DIR / "unrated.json"
SETTINGS_FILE = DATA_DIR / "settings.json"
BROWSER_AUTH_FILE = BASE_DIR / "browser.json"

DEFAULT_SETTINGS = {
    "ratingMin": 1,
    "ratingMax": 10,
    "shrinkageC": 5,
    "sidebarMode": "album",
}

# ─── Flask App ──────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder="static", static_url_path="")

# ─── YTMusic Init ───────────────────────────────────────────────────────────
ytmusic = None


def init_ytmusic():
    """Initialize YTMusic client with browser credentials."""
    global ytmusic
    if not BROWSER_AUTH_FILE.exists():
        print("ERROR: browser.json not found. Run 'python setup.py' first.")
        return False

    try:
        ytmusic = YTMusic(str(BROWSER_AUTH_FILE))
        print("✓ YTMusic authenticated successfully.")
        return True
    except Exception as e:
        print(f"ERROR initializing YTMusic: {e}")
        return False


# ─── Ratings Persistence (in-memory cache + crash-safe writes) ──────────────
import atexit
import threading

def _ensure_data_dir():
    DATA_DIR.mkdir(exist_ok=True)
    if not RATINGS_FILE.exists():
        with open(RATINGS_FILE, "w") as f:
            json.dump([], f)

# In-memory cache — loaded once, mutated in-place, flushed to disk atomically
_ratings_cache = None
_ratings_dirty = False
_ratings_lock = threading.Lock()

def _load_ratings():
    """Return the in-memory ratings list. Loads from disk on first call."""
    global _ratings_cache
    if _ratings_cache is None:
        _ensure_data_dir()
        try:
            with open(RATINGS_FILE, "r", encoding="utf-8") as f:
                _ratings_cache = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            _ratings_cache = []
    return _ratings_cache

def _save_ratings(ratings=None):
    """Mark cache dirty and flush to disk atomically (write-tmp + rename)."""
    global _ratings_cache, _ratings_dirty
    with _ratings_lock:
        if ratings is not None:
            _ratings_cache = ratings
        _ratings_dirty = True
    _flush_ratings()

def _flush_ratings():
    """Atomic write: write to .tmp file, then os.replace to avoid corruption."""
    global _ratings_dirty
    with _ratings_lock:
        if _ratings_cache is None or not _ratings_dirty:
            return
        _ensure_data_dir()
        tmp_file = str(RATINGS_FILE) + ".tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(_ratings_cache, f, indent=2, ensure_ascii=False)
        os.replace(tmp_file, RATINGS_FILE)
        _ratings_dirty = False

# Auto-save every 60 seconds in background
def _auto_save_loop():
    while True:
        time.sleep(60)
        try:
            _flush_ratings()
        except Exception as e:
            print(f"[auto-save] Error: {e}")

_auto_save_thread = threading.Thread(target=_auto_save_loop, daemon=True)
_auto_save_thread.start()

# Flush on shutdown (Ctrl+C, crash, etc.)
atexit.register(_flush_ratings)


# ─── Unrated Songs Persistence ──────────────────────────────────────────────
def _load_unrated():
    _ensure_data_dir()
    if not UNRATED_FILE.exists():
        return []
    try:
        with open(UNRATED_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def _save_unrated(unrated):
    _ensure_data_dir()
    with open(UNRATED_FILE, "w", encoding="utf-8") as f:
        json.dump(unrated, f, indent=2, ensure_ascii=False)


# ─── Settings Persistence ───────────────────────────────────────────────────
def _load_settings():
    _ensure_data_dir()
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                stored = json.load(f)
                return {**DEFAULT_SETTINGS, **stored}
        except (json.JSONDecodeError, FileNotFoundError):
            pass
    return dict(DEFAULT_SETTINGS)


def _save_settings(settings):
    _ensure_data_dir()
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)


# ─── History Cache ──────────────────────────────────────────────────────────
_history_cache = {"data": None, "timestamp": 0}
CACHE_TTL = 5  # seconds



def _get_cached_history():
    now = time.time()
    if _history_cache["data"] is not None and (now - _history_cache["timestamp"]) < CACHE_TTL:
        return _history_cache["data"]

    if ytmusic is None:
        return None

    try:
        history = ytmusic.get_history()
        _history_cache["data"] = history
        _history_cache["timestamp"] = now
        return history
    except Exception as e:
        print(f"Error fetching history: {type(e).__name__}: {e!r}")
        return None


# ─── Album Metadata Cache (for original release year) ──────────────────────
_album_cache = {}


def _get_album_year(album_id):
    """Fetch album release year via get_album(). Cached."""
    if not album_id:
        return ""
    if album_id in _album_cache:
        return _album_cache[album_id]

    if ytmusic is None:
        return ""

    try:
        album = ytmusic.get_album(album_id)
        year = album.get("year", "")
        _album_cache[album_id] = year
        return year
    except Exception as e:
        print(f"Error fetching album {album_id}: {e}")
        _album_cache[album_id] = ""  # cache the failure too
        return ""


def _extract_track_info(track):
    """Extract clean track info from a history item. Fast — no extra API calls."""
    video_id = track.get("videoId", "")
    title = track.get("title", "Unknown")
    artists = ", ".join(a.get("name", "") for a in track.get("artists", []) if a.get("name"))
    if not artists:
        artists = "Unknown Artist"

    # Album from history item
    album_info = track.get("album")
    album_name = album_info.get("name", "") if album_info else ""
    album_id = album_info.get("id", "") if album_info else ""

    # Thumbnail — try to get the best quality available
    thumbnails = track.get("thumbnails", [])
    album_art = ""
    if thumbnails:
        # Pick the largest thumbnail
        best = max(thumbnails, key=lambda t: t.get("width", 0) * t.get("height", 0))
        album_art = best.get("url", "")
        # Strip size params from YouTube thumbnail URLs to get full resolution
        if album_art and "lh3.googleusercontent.com" in album_art:
            album_art = album_art.split("=")[0] + "=w512-h512-l90-rj"
    # Fallback: YouTube video thumbnail
    if not album_art and video_id:
        album_art = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    # Use cached album year if available
    year = _album_cache.get(album_id, "") if album_id else ""

    # Check ratings and unrated lists for this song (use dict for O(1) lookup)
    ratings = _load_ratings()
    existing = next((r for r in ratings if r.get("videoId") == video_id), None)
    unrated = _load_unrated()
    unrated_ids = {u.get("videoId") for u in unrated}
    already_unrated = video_id in unrated_ids

    return {
        "videoId": video_id,
        "title": title,
        "artist": artists,
        "album": album_name,
        "albumId": album_id,
        "year": year,
        "albumArt": album_art,
        "played": track.get("played", ""),
        "alreadyRated": existing is not None,
        "existingRating": existing if existing else None,
        "alreadyUnrated": already_unrated,
    }


# ─── API Routes ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/analytics")
def analytics_page():
    return send_from_directory(app.static_folder, "analytics.html")


@app.route("/api/analytics")
def api_analytics():
    """Comprehensive analytics with Bayesian adjusted scores."""
    ratings = _load_ratings()
    settings = _load_settings()
    shrinkage_c = float(request.args.get("c", settings.get("shrinkageC", 5)))
    split_artists = request.args.get("splitArtists", "0") == "1"

    if not ratings:
        return jsonify({"artists": [], "albums": [], "timeline": [],
                        "distribution": {}, "decades": {}, "tags": [],
                        "globalMean": 0, "totalSongs": 0, "shrinkageC": shrinkage_c})

    # Global mean
    all_scores = [r["rating"] for r in ratings if isinstance(r.get("rating"), (int, float))]
    global_mean = sum(all_scores) / len(all_scores) if all_scores else 0

    # ── Artist rankings ──
    artist_data = {}
    for r in ratings:
        raw_artist = r.get("artist", "Unknown")
        # Split multi-artist credits if enabled, otherwise treat as single
        artist_names = [a.strip() for a in raw_artist.split(",")] if split_artists else [raw_artist]
        for a in artist_names:
            if not a:
                continue
            if a not in artist_data:
                artist_data[a] = {"scores": [], "albums": set()}
            if isinstance(r.get("rating"), (int, float)):
                artist_data[a]["scores"].append(r["rating"])
            artist_data[a]["albums"].add(r.get("album", ""))

    artists = []
    for name, d in artist_data.items():
        n = len(d["scores"])
        if n == 0:
            continue
        total = sum(d["scores"])
        avg = total / n
        adjusted = (n * avg + shrinkage_c * global_mean) / (n + shrinkage_c)
        artists.append({
            "name": name,
            "appearances": n,
            "totalScore": round(total, 2),
            "avgScore": round(avg, 3),
            "adjustedScore": round(adjusted, 3),
            "albumCount": len(d["albums"]),
            "minRating": min(d["scores"]),
            "maxRating": max(d["scores"]),
        })
    artists.sort(key=lambda x: x["adjustedScore"], reverse=True)
    for i, a in enumerate(artists):
        a["rank"] = i + 1

    # ── Album rankings ──
    album_data = {}
    for r in ratings:
        album_key = r.get("album", "Unknown") or "Unknown"
        if album_key not in album_data:
            album_data[album_key] = {
                "scores": [], "artist": r.get("artist", ""),
                "year": r.get("year", ""), "albumArt": r.get("albumArt", "")
            }
        if isinstance(r.get("rating"), (int, float)):
            album_data[album_key]["scores"].append(r["rating"])

    albums = []
    for name, d in album_data.items():
        n = len(d["scores"])
        if n == 0:
            continue
        total = sum(d["scores"])
        avg = total / n
        adjusted = (n * avg + shrinkage_c * global_mean) / (n + shrinkage_c)
        albums.append({
            "name": name,
            "artist": d["artist"],
            "year": d["year"],
            "albumArt": d["albumArt"],
            "appearances": n,
            "totalScore": round(total, 2),
            "avgScore": round(avg, 3),
            "adjustedScore": round(adjusted, 3),
            "minRating": min(d["scores"]),
            "maxRating": max(d["scores"]),
        })
    albums.sort(key=lambda x: x["adjustedScore"], reverse=True)
    for i, a in enumerate(albums):
        a["rank"] = i + 1

    # ── Timeline (ratings per day) ──
    timeline = {}
    for r in ratings:
        day = r.get("ratedAt", "")[:10]
        if day:
            if day not in timeline:
                timeline[day] = {"count": 0, "totalRating": 0}
            timeline[day]["count"] += 1
            if isinstance(r.get("rating"), (int, float)):
                timeline[day]["totalRating"] += r["rating"]
    timeline_list = []
    for day, d in sorted(timeline.items()):
        timeline_list.append({
            "date": day,
            "count": d["count"],
            "avgRating": round(d["totalRating"] / d["count"], 2) if d["count"] else 0,
        })

    # ── Rating distribution ──
    distribution = {}
    for s in all_scores:
        key = str(int(round(s)))
        distribution[key] = distribution.get(key, 0) + 1

    # ── Decade distribution ──
    decades = {}
    for r in ratings:
        year = r.get("year", "")
        if year and str(year).isdigit():
            decade = str(int(year) // 10 * 10) + "s"
            if decade not in decades:
                decades[decade] = {"count": 0, "totalRating": 0}
            decades[decade]["count"] += 1
            if isinstance(r.get("rating"), (int, float)):
                decades[decade]["totalRating"] += r["rating"]
    decades_list = {}
    for dec, d in sorted(decades.items()):
        decades_list[dec] = {
            "count": d["count"],
            "avgRating": round(d["totalRating"] / d["count"], 2) if d["count"] else 0,
        }

    # ── Tag analysis ──
    tag_data = {}
    for r in ratings:
        for tag in (r.get("tags") or []):
            t = tag.strip().lower()
            if not t:
                continue
            if t not in tag_data:
                tag_data[t] = {"count": 0, "totalRating": 0}
            tag_data[t]["count"] += 1
            if isinstance(r.get("rating"), (int, float)):
                tag_data[t]["totalRating"] += r["rating"]
    tags = []
    for name, d in tag_data.items():
        tags.append({
            "tag": name,
            "count": d["count"],
            "avgRating": round(d["totalRating"] / d["count"], 2) if d["count"] else 0,
        })
    tags.sort(key=lambda x: x["count"], reverse=True)

    return jsonify({
        "artists": artists,
        "albums": albums,
        "timeline": timeline_list,
        "distribution": distribution,
        "decades": decades_list,
        "tags": tags,
        "globalMean": round(global_mean, 3),
        "totalSongs": len(ratings),
        "shrinkageC": shrinkage_c,
    })


@app.route("/api/status")
def api_status():
    """Check if YTMusic is authenticated."""
    return jsonify({"authenticated": ytmusic is not None})


# ─── Setup Endpoints ────────────────────────────────────────────────────────
@app.route("/api/setup/status")
def api_setup_status():
    """Check if setup is needed."""
    has_file = BROWSER_AUTH_FILE.exists()
    return jsonify({
        "needsSetup": ytmusic is None,
        "hasAuthFile": has_file,
        "authenticated": ytmusic is not None,
    })


@app.route("/api/setup/headers", methods=["POST"])
def api_setup_headers():
    """Accept pasted headers and generate browser.json."""
    global ytmusic
    data = request.get_json()
    if not data or "headers" not in data:
        return jsonify({"error": "No headers provided"}), 400

    raw = data["headers"].strip()
    if not raw:
        return jsonify({"error": "Empty headers"}), 400

    try:
        parsed = _parse_auth_headers(raw)
        if not parsed:
            return jsonify({"error": "Could not parse headers. See instructions for your browser."}), 400

        # Check for required fields
        lower_keys = {k.lower(): k for k in parsed}
        if "cookie" not in lower_keys:
            return jsonify({
                "error": "Missing 'Cookie' header. Chrome sometimes hides cookies — try the 'Copy as fetch (Node.js)' method or use Firefox."
            }), 400

        # Try ytmusicapi.setup with raw headers first (most reliable)
        headers_raw = _dict_to_raw_headers(parsed)

        import ytmusicapi
        ytmusicapi.setup(filepath=str(BROWSER_AUTH_FILE), headers_raw=headers_raw)

        # Re-initialize
        ytmusic = YTMusic(str(BROWSER_AUTH_FILE))
        return jsonify({"success": True, "message": "Authentication saved successfully!"})

    except Exception as e:
        return jsonify({"error": f"Setup failed: {str(e)}"}), 500


@app.route("/api/setup/verify")
def api_setup_verify():
    """Verify the current auth by fetching history."""
    if ytmusic is None:
        return jsonify({"verified": False, "error": "Not authenticated"})

    try:
        history = ytmusic.get_history()
        if history:
            latest = history[0]
            title = latest.get("title", "Unknown")
            artist = ", ".join(a.get("name", "") for a in latest.get("artists", []))
            return jsonify({
                "verified": True,
                "message": f"Connected! Most recent: {title} by {artist}",
            })
        return jsonify({"verified": True, "message": "Connected! (No listening history yet)"})
    except Exception as e:
        return jsonify({"verified": False, "error": f"Verification failed: {str(e)}"})


def _parse_auth_headers(raw):
    """Auto-detect header format and return a dict. Supports:
    1. Firefox/Chrome raw headers (key: value per line)
    2. Chrome 'Copy as fetch (Node.js)' format
    3. Direct JSON object
    """
    raw = raw.strip()

    # ── Attempt 1: Direct JSON object { "key": "value", ... }
    if raw.startswith("{"):
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass

    # ── Attempt 2: Chrome 'Copy as fetch (Node.js)' — extract headers object
    fetch_match = re.search(
        r'["\']?headers["\']?\s*[=:]\s*(\{[^}]+\})',
        raw,
        re.DOTALL | re.IGNORECASE,
    )
    if fetch_match:
        json_str = fetch_match.group(1)
        # Fix single quotes to double quotes for JSON parsing
        json_str = json_str.replace("'", '"')
        try:
            obj = json.loads(json_str)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass

    # ── Attempt 3: Raw key: value lines (Firefox copy, Chrome manual copy)
    lines = raw.splitlines()
    result = {}
    current_key = None
    for line in lines:
        # Skip blank lines and HTTP method lines (GET /browse, POST /browse)
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.upper().startswith(("GET ", "POST ", "PUT ", "DELETE ", "PATCH ", "OPTIONS ")):
            continue

        colon_idx = stripped.find(":")
        if colon_idx > 0:
            key = stripped[:colon_idx].strip()
            value = stripped[colon_idx + 1:].strip()
            # Skip pseudo-headers like :authority, :method, :path, :scheme
            if key.startswith(":"):
                continue
            result[key] = value
            current_key = key
        elif current_key:
            # Continuation line (wrapped header value)
            result[current_key] += " " + stripped

    if result:
        return result

    return None


def _dict_to_raw_headers(headers_dict):
    """Convert a headers dict back to raw 'key: value' format for ytmusicapi.setup()."""
    return "\n".join(f"{k}: {v}" for k, v in headers_dict.items())


@app.route("/api/settings", methods=["GET"])
def get_settings():
    """Return current settings including rating range."""
    return jsonify(_load_settings())


@app.route("/api/settings", methods=["POST"])
def update_settings():
    """Update settings (rating range, etc)."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    settings = _load_settings()

    if "ratingMin" in data:
        settings["ratingMin"] = int(data["ratingMin"])
    if "ratingMax" in data:
        settings["ratingMax"] = int(data["ratingMax"])
    if "shrinkageC" in data:
        settings["shrinkageC"] = max(0, float(data["shrinkageC"]))
    if "sidebarMode" in data and data["sidebarMode"] in ("album", "related"):
        settings["sidebarMode"] = data["sidebarMode"]

    if settings["ratingMin"] >= settings["ratingMax"]:
        return jsonify({"error": "Min must be less than max"}), 400

    _save_settings(settings)
    return jsonify({"success": True, "settings": settings})


@app.route("/api/now-playing")
def now_playing():
    """Return the most recently played track from history."""
    if ytmusic is None:
        return jsonify({"error": "YTMusic not authenticated. Run setup.py first."}), 503

    history = _get_cached_history()
    if not history:
        return jsonify({"track": None})

    track_info = _extract_track_info(history[0])

    return jsonify({"track": track_info})



@app.route("/api/search")
def api_search():
    """Search YouTube Music for songs. Returns results in track-info format."""
    if ytmusic is None:
        return jsonify({"error": "YTMusic not authenticated."}), 503

    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"results": []})

    try:
        results = ytmusic.search(query, filter="songs", limit=20)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    tracks = []
    for item in results:
        if item.get("resultType") != "song":
            continue
        tracks.append(_extract_track_info(item))

    return jsonify({"results": tracks})


@app.route("/api/find-versions")
def api_find_versions():
    """Find other versions of a song by scanning the artist's albums."""
    if ytmusic is None:
        return jsonify({"error": "YTMusic not authenticated."}), 503

    title = request.args.get("title", "").strip()
    artist = request.args.get("artist", "").strip()
    current_video_id = request.args.get("videoId", "").strip()
    if not title or not artist:
        return jsonify({"versions": []})

    title_lower = title.lower().strip()

    try:
        # Search for the artist's albums
        album_results = ytmusic.search(artist, filter="albums", limit=15)
        versions = []
        seen_video_ids = {current_video_id} if current_video_id else set()
        ratings = _load_ratings()  # Load once for all version checks

        for album_item in album_results:
            browse_id = album_item.get("browseId")
            if not browse_id:
                continue

            # Only check albums by the matching artist
            album_artists = album_item.get("artists", [])
            artist_names = [a.get("name", "").lower() for a in album_artists] if album_artists else []
            if not any(artist.lower() in name for name in artist_names):
                continue

            try:
                album_data = ytmusic.get_album(browse_id)
            except Exception:
                continue

            album_title = album_data.get("title", "")
            album_year = album_data.get("year", "")
            album_art = ""
            thumbs = album_data.get("thumbnails", [])
            if thumbs:
                album_art = thumbs[-1].get("url", "")

            # Scan tracks for matching title
            for track in album_data.get("tracks", []):
                track_title = (track.get("title") or "").lower().strip()
                video_id = track.get("videoId", "")
                if track_title == title_lower and video_id and video_id not in seen_video_ids:
                    seen_video_ids.add(video_id)

                    # Check rated status (ratings loaded once above)
                    already_rated = False
                    existing_rating = None
                    for r in ratings:
                        if r.get("videoId") == video_id:
                            already_rated = True
                            existing_rating = r
                            break

                    versions.append({
                        "videoId": video_id,
                        "title": track.get("title", title),
                        "artist": artist,
                        "album": album_title,
                        "albumId": browse_id,
                        "albumArt": album_art,
                        "year": album_year,
                        "isAlbum": album_title.lower() != title_lower,
                        "alreadyRated": already_rated,
                        "existingRating": existing_rating,
                    })

        return jsonify({"versions": versions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/album-tracks")
def api_album_tracks():
    """Return all tracks on an album by its browseId."""
    if ytmusic is None:
        return jsonify({"error": "YTMusic not authenticated."}), 503

    album_id = request.args.get("albumId", "").strip()
    if not album_id:
        return jsonify({"tracks": []})

    try:
        album_data = ytmusic.get_album(album_id)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    album_title = album_data.get("title", "")
    album_year = album_data.get("year", "")
    album_art = ""
    thumbs = album_data.get("thumbnails", [])
    if thumbs:
        album_art = thumbs[-1].get("url", "")

    ratings = _load_ratings()
    rated_ids = {r.get("videoId"): r for r in ratings}

    tracks = []
    for i, track in enumerate(album_data.get("tracks", [])):
        video_id = track.get("videoId", "")
        artists = ", ".join(
            a.get("name", "") for a in track.get("artists", []) if a.get("name")
        ) or "Unknown Artist"
        existing = rated_ids.get(video_id)
        tracks.append({
            "videoId": video_id,
            "title": track.get("title", "Unknown"),
            "artist": artists,
            "album": album_title,
            "albumId": album_id,
            "albumArt": album_art,
            "year": album_year,
            "trackNumber": i + 1,
            "alreadyRated": existing is not None,
            "existingRating": existing,
        })

    return jsonify({"tracks": tracks, "album": album_title, "year": album_year})


@app.route("/api/enrich/<album_id>")
def enrich_album(album_id):
    """Fetch original album release year. Called lazily by frontend."""
    year = _get_album_year(album_id)
    return jsonify({"year": year})


def _smart_match(query, *fields):
    """Smart search: supports OR (|), negation (- or !), exact phrases ("..."), regex (/.../), implicit AND."""
    text = " ".join((f or "").lower() for f in fields)
    if not query:
        return True

    or_groups = [g.strip() for g in query.split("|") if g.strip()]
    for group in or_groups:
        # Tokenize: quoted strings, regex, bare words
        tokens = []
        import re as _re
        for m in _re.finditer(r'([!\-]?)(?:"([^"]*)"|/([^/]*)/(i?)|(\S+))', group):
            negate = m.group(1) in ("-", "!")
            if m.group(2) is not None:
                tokens.append({"negate": negate, "type": "exact", "value": m.group(2).lower()})
            elif m.group(3) is not None:
                try:
                    flags = _re.IGNORECASE
                    tokens.append({"negate": negate, "type": "regex", "value": _re.compile(m.group(3), flags)})
                except _re.error:
                    tokens.append({"negate": negate, "type": "exact", "value": m.group(3).lower()})
            else:
                tokens.append({"negate": negate, "type": "contains", "value": m.group(5).lower()})

        if all(
            (not tok["negate"]) == (
                tok["value"].search(text) is not None if tok["type"] == "regex"
                else tok["value"] in text
            )
            for tok in tokens
        ):
            return True
    return False


@app.route("/api/ratings", methods=["GET"])
def get_ratings():
    """Return ratings with pagination. Supports filtering, sorting, search."""
    all_ratings = _load_ratings()

    # Optional filtering
    artist = request.args.get("artist", "").lower()
    min_rating = request.args.get("min_rating", type=int)
    max_rating = request.args.get("max_rating", type=int)
    search = request.args.get("search", "").strip()
    sort_by = request.args.get("sort_by", "ratedAt")
    sort_order = request.args.get("sort_order", "desc")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    # Work on a copy so we don't mutate the cache
    filtered = list(all_ratings)

    if artist:
        filtered = [r for r in filtered if artist in r.get("artist", "").lower()]
    if min_rating is not None:
        filtered = [r for r in filtered if r.get("rating", 0) >= min_rating]
    if max_rating is not None:
        filtered = [r for r in filtered if r.get("rating", 0) <= max_rating]
    if search:
        tags_str = lambda r: " ".join(r.get("tags", []))
        filtered = [r for r in filtered if _smart_match(
            search,
            r.get("title", ""),
            r.get("artist", ""),
            r.get("album", ""),
            r.get("notes", ""),
            tags_str(r),
        )]

    # Sort the copy
    reverse = sort_order == "desc"
    if sort_by in ("rating", "year"):
        filtered.sort(key=lambda r: r.get(sort_by, 0) or 0, reverse=reverse)
    else:
        filtered.sort(key=lambda r: r.get(sort_by, "").lower() if isinstance(r.get(sort_by), str) else str(r.get(sort_by, "")), reverse=reverse)

    total = len(filtered)
    if limit > 0:
        page = filtered[offset:offset + limit]
    else:
        page = filtered  # limit=0 means return all

    return jsonify({
        "ratings": page,
        "total": total,
        "offset": offset,
        "hasMore": limit > 0 and offset + limit < total,
        "stats": _compute_stats(all_ratings),  # stats always on full dataset
    })


@app.route("/api/ratings", methods=["POST"])
def add_rating():
    """Save a new rating. Rejects duplicates by videoId."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    video_id = data.get("videoId")
    rating = data.get("rating")

    if not video_id:
        return jsonify({"error": "videoId is required"}), 400
    settings = _load_settings()
    r_min, r_max = settings["ratingMin"], settings["ratingMax"]
    if rating is None or not isinstance(rating, (int, float)) or not (r_min <= rating <= r_max):
        return jsonify({"error": f"rating must be between {r_min} and {r_max}"}), 400

    ratings = _load_ratings()

    # Check for duplicate
    if any(r.get("videoId") == video_id for r in ratings):
        return jsonify({"error": "Song already rated", "duplicate": True}), 409

    entry = {
        "id": str(uuid.uuid4()),
        "videoId": video_id,
        "title": data.get("title", "Unknown"),
        "artist": data.get("artist", "Unknown Artist"),
        "album": data.get("album", ""),
        "year": data.get("year", ""),
        "albumArt": data.get("albumArt", ""),
        "rating": rating,
        "ratedAt": datetime.now().isoformat(),
        "tags": data.get("tags", []),
        "notes": data.get("notes", ""),
    }

    ratings.append(entry)
    _save_ratings(ratings)

    return jsonify({"success": True, "entry": entry}), 201


@app.route("/api/ratings/<entry_id>", methods=["PUT"])
def update_rating(entry_id):
    """Update an existing rating or edit song info."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    ratings = _load_ratings()
    entry = next((r for r in ratings if r.get("id") == entry_id), None)

    if not entry:
        return jsonify({"error": "Rating not found"}), 404

    # Update allowed fields
    updatable = ["title", "artist", "album", "year", "rating", "tags", "notes"]
    for field in updatable:
        if field in data:
            if field == "rating":
                settings = _load_settings()
                r_min, r_max = settings["ratingMin"], settings["ratingMax"]
                if not isinstance(data[field], (int, float)) or not (r_min <= data[field] <= r_max):
                    return jsonify({"error": f"rating must be {r_min}-{r_max}"}), 400
            entry[field] = data[field]

    entry["updatedAt"] = datetime.now().isoformat()
    _save_ratings(ratings)

    return jsonify({"success": True, "entry": entry})


@app.route("/api/ratings/<entry_id>", methods=["DELETE"])
def delete_rating(entry_id):
    """Delete a rating."""
    ratings = _load_ratings()
    original_len = len(ratings)
    ratings = [r for r in ratings if r.get("id") != entry_id]

    if len(ratings) == original_len:
        return jsonify({"error": "Rating not found"}), 404

    _save_ratings(ratings)
    return jsonify({"success": True})


# ─── Unrated Songs API ──────────────────────────────────────────────────────
@app.route("/api/unrated", methods=["GET"])
def get_unrated():
    """Return all unrated/skipped songs."""
    unrated = _load_unrated()
    return jsonify({"unrated": unrated, "total": len(unrated)})


@app.route("/api/unrated", methods=["POST"])
def add_unrated():
    """Save a song as unrated/skipped."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    video_id = data.get("videoId")
    if not video_id:
        return jsonify({"error": "videoId is required"}), 400

    # Skip if already rated or already in unrated
    ratings = _load_ratings()
    if any(r.get("videoId") == video_id for r in ratings):
        return jsonify({"skipped": True, "reason": "already rated"}), 200

    unrated = _load_unrated()
    if any(u.get("videoId") == video_id for u in unrated):
        return jsonify({"skipped": True, "reason": "already in unrated"}), 200

    entry = {
        "id": str(uuid.uuid4()),
        "videoId": video_id,
        "title": data.get("title", "Unknown"),
        "artist": data.get("artist", "Unknown Artist"),
        "album": data.get("album", ""),
        "albumId": data.get("albumId", ""),
        "year": data.get("year", ""),
        "albumArt": data.get("albumArt", ""),
        "skippedAt": datetime.now().isoformat(),
        "tags": [],
        "notes": "",
    }

    unrated.append(entry)
    _save_unrated(unrated)
    return jsonify({"success": True, "entry": entry}), 201


@app.route("/api/unrated/<entry_id>", methods=["DELETE"])
def delete_unrated(entry_id):
    """Remove an unrated entry (dismiss it)."""
    unrated = _load_unrated()
    original_len = len(unrated)
    unrated = [u for u in unrated if u.get("id") != entry_id]

    if len(unrated) == original_len:
        return jsonify({"error": "Entry not found"}), 404

    _save_unrated(unrated)
    return jsonify({"success": True})


@app.route("/api/unrated/all", methods=["DELETE"])
def delete_all_unrated():
    """Dismiss all unrated songs."""
    _save_unrated([])
    return jsonify({"success": True})


@app.route("/api/unrated/<entry_id>/rate", methods=["POST"])
def rate_unrated(entry_id):
    """Move an unrated song to rated. Requires a rating."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    rating = data.get("rating")
    settings = _load_settings()
    r_min, r_max = settings["ratingMin"], settings["ratingMax"]
    if rating is None or not isinstance(rating, (int, float)) or not (r_min <= rating <= r_max):
        return jsonify({"error": f"rating must be between {r_min} and {r_max}"}), 400

    # Find in unrated
    unrated = _load_unrated()
    entry = next((u for u in unrated if u.get("id") == entry_id), None)
    if not entry:
        return jsonify({"error": "Unrated entry not found"}), 404

    # Check not already rated
    ratings = _load_ratings()
    if any(r.get("videoId") == entry.get("videoId") for r in ratings):
        # Remove from unrated and skip
        unrated = [u for u in unrated if u.get("id") != entry_id]
        _save_unrated(unrated)
        return jsonify({"error": "Song already rated", "duplicate": True}), 409

    # Create rated entry
    rated_entry = {
        "id": str(uuid.uuid4()),
        "videoId": entry.get("videoId"),
        "title": data.get("title", entry.get("title", "Unknown")),
        "artist": data.get("artist", entry.get("artist", "Unknown Artist")),
        "album": data.get("album", entry.get("album", "")),
        "year": data.get("year", entry.get("year", "")),
        "albumArt": entry.get("albumArt", ""),
        "rating": rating,
        "ratedAt": datetime.now().isoformat(),
        "tags": data.get("tags", []),
        "notes": data.get("notes", ""),
    }

    ratings.append(rated_entry)
    _save_ratings(ratings)

    # Remove from unrated
    unrated = [u for u in unrated if u.get("id") != entry_id]
    _save_unrated(unrated)

    return jsonify({"success": True, "entry": rated_entry}), 201


@app.route("/api/export/csv")
def export_csv():
    """Export all ratings as CSV for data analysis."""
    ratings = _load_ratings()

    output = io.StringIO()
    if ratings:
        fieldnames = ["id", "videoId", "title", "artist", "album", "year",
                       "albumArt", "rating", "ratedAt", "updatedAt", "tags", "notes"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in ratings:
            row = dict(r)
            # Convert tags list to semicolon-separated string
            if isinstance(row.get("tags"), list):
                row["tags"] = "; ".join(row["tags"])
            writer.writerow(row)

    csv_content = output.getvalue()
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=song_ratings.csv"},
    )


@app.route("/api/export/json")
def export_json():
    """Export all ratings as formatted JSON for data analysis."""
    ratings = _load_ratings()
    return Response(
        json.dumps(ratings, indent=2, ensure_ascii=False),
        mimetype="application/json",
        headers={"Content-Disposition": "attachment; filename=song_ratings.json"},
    )


def _compute_stats(ratings):
    """Compute summary statistics for data analysis."""
    if not ratings:
        return {"total": 0}

    numeric_ratings = [r["rating"] for r in ratings if isinstance(r.get("rating"), (int, float))]

    # Count by artist
    artist_counts = {}
    artist_avg = {}
    for r in ratings:
        a = r.get("artist", "Unknown")
        artist_counts[a] = artist_counts.get(a, 0) + 1
        if a not in artist_avg:
            artist_avg[a] = []
        if isinstance(r.get("rating"), (int, float)):
            artist_avg[a].append(r["rating"])

    top_artists = sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    artist_averages = {a: round(sum(rs) / len(rs), 2) for a, rs in artist_avg.items() if rs}

    # Rating distribution
    distribution = {str(i): 0 for i in range(1, 11)}
    for r in numeric_ratings:
        distribution[str(int(round(r)))] = distribution.get(str(int(round(r))), 0) + 1

    return {
        "total": len(ratings),
        "averageRating": round(sum(numeric_ratings) / len(numeric_ratings), 2) if numeric_ratings else 0,
        "highestRating": max(numeric_ratings) if numeric_ratings else 0,
        "lowestRating": min(numeric_ratings) if numeric_ratings else 0,
        "topArtists": top_artists,
        "artistAverages": artist_averages,
        "ratingDistribution": distribution,
    }


# ─── Main ───────────────────────────────────────────────────────────────────
def _get_local_ip():
    """Get the machine's local network IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "unknown"


if __name__ == "__main__":
    print("=" * 50)
    print("  YouTube Music Song Rating App")
    print("=" * 50)

    if init_ytmusic():
        print("  ✓ YTMusic ready")
    else:
        print("  ⚠ YTMusic not authenticated — setup wizard will appear in browser")

    local_ip = _get_local_ip()
    print(f"  → Ratings file: {RATINGS_FILE}")
    print(f"  → Local:   http://localhost:5000")
    print(f"  → Network: http://{local_ip}:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", debug=True, port=5000, use_reloader=False)
