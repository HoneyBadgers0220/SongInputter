"""
YouTube Music Song Rating App — Flask Backend
Polls ytmusicapi for currently playing track and manages song ratings.
"""

import json
import os
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


# ─── Ratings Persistence ────────────────────────────────────────────────────
def _ensure_data_dir():
    DATA_DIR.mkdir(exist_ok=True)
    if not RATINGS_FILE.exists():
        with open(RATINGS_FILE, "w") as f:
            json.dump([], f)


def _load_ratings():
    _ensure_data_dir()
    try:
        with open(RATINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def _save_ratings(ratings):
    _ensure_data_dir()
    with open(RATINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(ratings, f, indent=2, ensure_ascii=False)


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
        print(f"Error fetching history: {e}")
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

    # Check ratings and unrated lists for this song
    ratings = _load_ratings()
    existing = next((r for r in ratings if r.get("videoId") == video_id), None)
    unrated = _load_unrated()
    already_unrated = any(u.get("videoId") == video_id for u in unrated)

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


@app.route("/api/status")
def api_status():
    """Check if YTMusic is authenticated."""
    return jsonify({"authenticated": ytmusic is not None})


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


@app.route("/api/enrich/<album_id>")
def enrich_album(album_id):
    """Fetch original album release year. Called lazily by frontend."""
    year = _get_album_year(album_id)
    return jsonify({"year": year})


@app.route("/api/ratings", methods=["GET"])
def get_ratings():
    """Return all ratings. Supports query params for filtering."""
    ratings = _load_ratings()

    # Optional filtering
    artist = request.args.get("artist", "").lower()
    min_rating = request.args.get("min_rating", type=int)
    max_rating = request.args.get("max_rating", type=int)
    sort_by = request.args.get("sort_by", "ratedAt")  # ratedAt, rating, artist, title, year
    sort_order = request.args.get("sort_order", "desc")  # asc, desc

    if artist:
        ratings = [r for r in ratings if artist in r.get("artist", "").lower()]
    if min_rating is not None:
        ratings = [r for r in ratings if r.get("rating", 0) >= min_rating]
    if max_rating is not None:
        ratings = [r for r in ratings if r.get("rating", 0) <= max_rating]

    # Sort
    reverse = sort_order == "desc"
    if sort_by in ("rating", "year"):
        ratings.sort(key=lambda r: r.get(sort_by, 0) or 0, reverse=reverse)
    else:
        ratings.sort(key=lambda r: r.get(sort_by, "").lower() if isinstance(r.get(sort_by), str) else str(r.get(sort_by, "")), reverse=reverse)

    return jsonify({
        "ratings": ratings,
        "total": len(ratings),
        "stats": _compute_stats(_load_ratings()),  # stats always on full dataset
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
                       "rating", "ratedAt", "updatedAt", "tags", "notes"]
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
        local_ip = _get_local_ip()
        print(f"  → Ratings file: {RATINGS_FILE}")
        print(f"  → Local:   http://localhost:5000")
        print(f"  → Network: http://{local_ip}:5000")
        print(f"  Open the Network URL on your phone!")
        print("=" * 50)
        app.run(host="0.0.0.0", debug=True, port=5000, use_reloader=False)
    else:
        print("\n  ✗ Failed to initialize. Run 'python setup.py' first.")
        print("=" * 50)
