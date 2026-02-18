/**
 * SongRate — YouTube Music Rating App
 * Frontend: last-3 anti-flicker, lazy album year enrichment,
 * unrated songs auto-capture, rating, editing, search/sort, export, settings.
 */

// ─── State ─────────────────────────────────────────────────────
let currentTrack = null;
let recentSongIds = [];          // last 3 confirmed song IDs (anti-flicker)
const MAX_RECENT = 3;
let allRatings = [];
let allUnrated = [];
let pollInterval = null;
let appSettings = { ratingMin: 1, ratingMax: 10 };
const POLL_MS = 5000;

// ─── DOM Refs ──────────────────────────────────────────────────
const $ = (sel) => document.getElementById(sel);

const dom = {
    connectionStatus: $("connectionStatus"),
    statusText: document.querySelector(".status-text"),
    nowPlayingEmpty: $("nowPlayingEmpty"),
    nowPlayingCard: $("nowPlayingCard"),
    npAlbumArt: $("npAlbumArt"),
    npTitle: $("npTitle"),
    npArtist: $("npArtist"),
    npAlbum: $("npAlbum"),
    npYear: $("npYear"),
    npAlreadyRated: $("npAlreadyRated"),
    npExistingRating: $("npExistingRating"),
    npEditExisting: $("npEditExisting"),
    npRatingForm: $("npRatingForm"),
    npRatingSlider: $("npRatingSlider"),
    npRatingDisplay: $("npRatingDisplay"),
    npRangeLabel: $("npRangeLabel"),
    npNotes: $("npNotes"),
    npTags: $("npTags"),
    npSubmitRating: $("npSubmitRating"),
    statTotal: $("statTotal"),
    statAverage: $("statAverage"),
    statHighest: $("statHighest"),
    statTopArtist: $("statTopArtist"),
    // Unrated section
    unratedGrid: $("unratedGrid"),
    unratedEmpty: $("unratedEmpty"),
    unratedSearchInput: $("unratedSearchInput"),
    // Rated section
    ratedGrid: $("ratedGrid"),
    ratedEmpty: $("ratedEmpty"),
    searchInput: $("searchInput"),
    sortSelect: $("sortSelect"),
    // Edit modal
    editModal: $("editModal"),
    modalClose: $("modalClose"),
    editId: $("editId"),
    editTitle: $("editTitle"),
    editArtist: $("editArtist"),
    editAlbum: $("editAlbum"),
    editYear: $("editYear"),
    editRating: $("editRating"),
    editRatingDisplay: $("editRatingDisplay"),
    editRangeLabel: $("editRangeLabel"),
    editNotes: $("editNotes"),
    editTags: $("editTags"),
    editSave: $("editSave"),
    editDelete: $("editDelete"),
    // Rate-unrated modal
    rateUnratedModal: $("rateUnratedModal"),
    rateUnratedClose: $("rateUnratedClose"),
    rateUnratedId: $("rateUnratedId"),
    rateUnratedArt: $("rateUnratedArt"),
    rateUnratedTitle: $("rateUnratedTitle"),
    rateUnratedArtist: $("rateUnratedArtist"),
    rateUnratedMeta: $("rateUnratedMeta"),
    rateUnratedRating: $("rateUnratedRating"),
    rateUnratedRatingDisplay: $("rateUnratedRatingDisplay"),
    rateUnratedRangeLabel: $("rateUnratedRangeLabel"),
    rateUnratedNotes: $("rateUnratedNotes"),
    rateUnratedTags: $("rateUnratedTags"),
    rateUnratedSave: $("rateUnratedSave"),
    rateUnratedDismiss: $("rateUnratedDismiss"),
    // Settings
    settingsModal: $("settingsModal"),
    settingsClose: $("settingsClose"),
    settingsMin: $("settingsMin"),
    settingsMax: $("settingsMax"),
    settingsSave: $("settingsSave"),
    btnSettings: $("btnSettings"),
    btnExportCSV: $("btnExportCSV"),
    btnExportJSON: $("btnExportJSON"),
    toastContainer: $("toastContainer"),
    // Search modal
    btnSearchSong: $("btnSearchSong"),
    searchModal: $("searchModal"),
    searchModalClose: $("searchModalClose"),
    searchSongInput: $("searchSongInput"),
    searchSongBtn: $("searchSongBtn"),
    searchLoading: $("searchLoading"),
    searchResults: $("searchResults"),
    searchEmpty: $("searchEmpty"),
};

// ─── Initialization ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    checkStatus();
    loadRatings();
    loadUnrated();
    startPolling();
    bindEvents();
});

function bindEvents() {
    dom.npRatingSlider.addEventListener("input", () => {
        dom.npRatingDisplay.textContent = dom.npRatingSlider.value;
    });
    dom.editRating.addEventListener("input", () => {
        dom.editRatingDisplay.textContent = dom.editRating.value;
    });
    dom.rateUnratedRating.addEventListener("input", () => {
        dom.rateUnratedRatingDisplay.textContent = dom.rateUnratedRating.value;
    });
    dom.npSubmitRating.addEventListener("click", submitRating);
    dom.npEditExisting.addEventListener("click", () => {
        if (currentTrack && currentTrack.existingRating) {
            openEditModal(currentTrack.existingRating);
        }
    });
    // Edit modal
    dom.modalClose.addEventListener("click", closeEditModal);
    dom.editModal.addEventListener("click", (e) => {
        if (e.target === dom.editModal) closeEditModal();
    });
    dom.editSave.addEventListener("click", saveEdit);
    dom.editDelete.addEventListener("click", deleteRating);
    // Rate-unrated modal
    dom.rateUnratedClose.addEventListener("click", closeRateUnratedModal);
    dom.rateUnratedModal.addEventListener("click", (e) => {
        if (e.target === dom.rateUnratedModal) closeRateUnratedModal();
    });
    dom.rateUnratedSave.addEventListener("click", saveRateUnrated);
    dom.rateUnratedDismiss.addEventListener("click", dismissUnrated);
    // Settings
    dom.btnSettings.addEventListener("click", openSettings);
    dom.settingsClose.addEventListener("click", closeSettings);
    dom.settingsModal.addEventListener("click", (e) => {
        if (e.target === dom.settingsModal) closeSettings();
    });
    dom.settingsSave.addEventListener("click", saveSettings);
    // Search & sort
    dom.searchInput.addEventListener("input", renderRatedSongs);
    dom.sortSelect.addEventListener("change", renderRatedSongs);
    dom.unratedSearchInput.addEventListener("input", renderUnratedSongs);
    // Export
    dom.btnExportCSV.addEventListener("click", () => {
        window.location.href = "/api/export/csv";
    });
    dom.btnExportJSON.addEventListener("click", () => {
        window.location.href = "/api/export/json";
    });
    // Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeEditModal();
            closeRateUnratedModal();
            closeSettings();
            closeSearchModal();
        }
    });
    // Search modal
    dom.btnSearchSong.addEventListener("click", openSearchModal);
    dom.searchModalClose.addEventListener("click", closeSearchModal);
    dom.searchModal.addEventListener("click", (e) => {
        if (e.target === dom.searchModal) closeSearchModal();
    });
    dom.searchSongBtn.addEventListener("click", doSongSearch);
    dom.searchSongInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSongSearch();
    });
}

// ─── API Helpers ───────────────────────────────────────────────
async function api(url, options = {}) {
    try {
        const res = await fetch(url, {
            headers: { "Content-Type": "application/json" },
            ...options,
        });
        return await res.json();
    } catch (err) {
        console.error(`API error: ${url}`, err);
        return null;
    }
}

// ─── Settings ──────────────────────────────────────────────────
async function loadSettings() {
    const data = await api("/api/settings");
    if (data) {
        appSettings = data;
        applySettingsToUI();
    }
}

function applySettingsToUI() {
    const min = appSettings.ratingMin;
    const max = appSettings.ratingMax;
    const mid = Math.round((min + max) / 2);

    dom.npRatingSlider.min = min;
    dom.npRatingSlider.max = max;
    dom.npRatingSlider.value = mid;
    dom.npRatingDisplay.textContent = mid;
    dom.npRangeLabel.textContent = `(${min}–${max})`;

    dom.editRating.min = min;
    dom.editRating.max = max;
    dom.editRangeLabel.textContent = `(${min}–${max})`;

    dom.rateUnratedRating.min = min;
    dom.rateUnratedRating.max = max;
    dom.rateUnratedRangeLabel.textContent = `(${min}–${max})`;

    dom.settingsMin.value = min;
    dom.settingsMax.value = max;
}

function openSettings() {
    dom.settingsMin.value = appSettings.ratingMin;
    dom.settingsMax.value = appSettings.ratingMax;
    dom.settingsModal.classList.remove("hidden");
}

function closeSettings() {
    dom.settingsModal.classList.add("hidden");
}

async function saveSettings() {
    const min = parseInt(dom.settingsMin.value);
    const max = parseInt(dom.settingsMax.value);

    if (isNaN(min) || isNaN(max)) {
        toast("Please enter valid numbers", "error");
        return;
    }
    if (min >= max) {
        toast("Min must be less than max", "error");
        return;
    }

    const result = await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({ ratingMin: min, ratingMax: max }),
    });

    if (result && result.success) {
        appSettings = result.settings;
        applySettingsToUI();
        closeSettings();
        toast("Settings saved", "success");
    } else {
        toast(result?.error || "Failed to save settings", "error");
    }
}

// ─── Status Check ──────────────────────────────────────────────
async function checkStatus() {
    const data = await api("/api/status");
    if (data && data.authenticated) {
        dom.connectionStatus.className = "connection-status connected";
        dom.statusText.textContent = "Connected";
    } else {
        dom.connectionStatus.className = "connection-status error";
        dom.statusText.textContent = "Not authenticated";
    }
}

// ─── Polling with Last-3 Anti-Flicker ──────────────────────────
//
// Simple rule:
//   Keep a list of the last 3 CONFIRMED song IDs.
//   When the server returns the top song:
//   - If it's the same as current → refresh metadata, keep it.
//   - If it's different AND in recentSongIds → it's a repeat/flicker, ignore it.
//   - If it's different AND NOT in recentSongIds → genuinely new song, switch to it.
//   When we switch, push the OLD song's ID into the recent list (max 3).
//   If the old song wasn't rated, save it as unrated.
//
function startPolling() {
    pollNowPlaying();
    pollInterval = setInterval(pollNowPlaying, POLL_MS);
}

async function pollNowPlaying() {
    const data = await api("/api/now-playing");
    if (!data || !data.track) {
        showEmptyState();
        return;
    }

    const incoming = data.track;

    // First load — just accept it
    if (!currentTrack) {
        acceptTrack(incoming, true);
        return;
    }

    // Same song as current — refresh metadata only (e.g. rating status)
    if (incoming.videoId === currentTrack.videoId) {
        incoming.year = incoming.year || currentTrack.year; // preserve enriched year
        currentTrack = incoming;
        showTrackCard(currentTrack, false);
        return;
    }

    // Different song — check if it's a recent repeat
    if (recentSongIds.includes(incoming.videoId)) {
        // This song was played recently. It's flickering back. Ignore it.
        console.log(`Anti-flicker: ignoring "${incoming.title}" (recent repeat)`);
        return;
    }

    // Genuinely new song — accept it
    acceptTrack(incoming, true);
}

function acceptTrack(track, animate) {
    // Save old track as unrated if it wasn't rated and isn't already unrated
    if (currentTrack && !currentTrack.alreadyRated && !currentTrack.alreadyUnrated) {
        saveAsUnrated(currentTrack);
    }

    // Push old track into recent list before switching
    if (currentTrack) {
        recentSongIds.push(currentTrack.videoId);
        if (recentSongIds.length > MAX_RECENT) {
            recentSongIds.shift();
        }
    }

    currentTrack = track;
    showTrackCard(currentTrack, animate);

    // Lazy-load release year
    enrichYearIfNeeded(currentTrack);
}

async function saveAsUnrated(track) {
    const payload = {
        videoId: track.videoId,
        title: track.title,
        artist: track.artist,
        album: track.album,
        albumId: track.albumId,
        year: track.year,
        albumArt: track.albumArt,
    };
    const result = await api("/api/unrated", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (result && result.success) {
        console.log(`Saved as unrated: "${track.title}"`);
        loadUnrated(); // refresh the unrated list
    }
}

async function enrichYearIfNeeded(track) {
    if (track.year || !track.albumId) return;

    const data = await api(`/api/enrich/${track.albumId}`);
    if (data && data.year && currentTrack && currentTrack.videoId === track.videoId) {
        currentTrack.year = data.year;
        dom.npYear.textContent = data.year;
        dom.npYear.style.display = "";
    }
}

// ─── Now Playing UI ────────────────────────────────────────────
function showEmptyState() {
    dom.nowPlayingEmpty.classList.remove("hidden");
    dom.nowPlayingCard.classList.add("hidden");
    currentTrack = null;
}

function showTrackCard(track, animate) {
    dom.nowPlayingEmpty.classList.add("hidden");
    dom.nowPlayingCard.classList.remove("hidden");

    if (animate) {
        dom.nowPlayingCard.style.animation = "none";
        dom.nowPlayingCard.offsetHeight; // reflow
        dom.nowPlayingCard.style.animation = "";
    }

    dom.npAlbumArt.src = track.albumArt || "";
    dom.npAlbumArt.alt = `${track.album || track.title} album art`;
    dom.npAlbumArt.onerror = function () {
        if (track.videoId && !this.src.includes("ytimg.com")) {
            this.src = `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`;
        } else {
            this.style.display = "none";
        }
    };
    dom.npTitle.textContent = track.title || "Unknown";
    dom.npArtist.textContent = track.artist || "Unknown Artist";
    dom.npAlbum.textContent = track.album || "Unknown Album";
    dom.npYear.textContent = track.year || "";
    dom.npYear.style.display = track.year ? "" : "none";

    if (track.alreadyRated && track.existingRating) {
        dom.npAlreadyRated.classList.remove("hidden");
        dom.npRatingForm.classList.add("hidden");
        dom.npExistingRating.textContent = track.existingRating.rating + "/" + appSettings.ratingMax;
    } else {
        dom.npAlreadyRated.classList.add("hidden");
        dom.npRatingForm.classList.remove("hidden");
        // Always re-apply slider constraints
        dom.npRatingSlider.min = appSettings.ratingMin;
        dom.npRatingSlider.max = appSettings.ratingMax;
        dom.npRangeLabel.textContent = `(${appSettings.ratingMin}–${appSettings.ratingMax})`;
        if (animate) {
            const mid = Math.round((appSettings.ratingMin + appSettings.ratingMax) / 2);
            dom.npRatingSlider.value = mid;
            dom.npRatingDisplay.textContent = mid;
            dom.npNotes.value = "";
            dom.npTags.value = "";
        }
    }
}

// ─── Submit Rating ─────────────────────────────────────────────
async function submitRating() {
    if (!currentTrack) return;

    const rating = parseInt(dom.npRatingSlider.value);
    const notes = dom.npNotes.value.trim();
    const tags = dom.npTags.value.split(",").map((t) => t.trim()).filter(Boolean);

    const payload = {
        videoId: currentTrack.videoId,
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        year: currentTrack.year,
        albumArt: currentTrack.albumArt,
        rating,
        notes,
        tags,
    };

    const result = await api("/api/ratings", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (result && result.success) {
        toast("Rating saved!", "success");
        currentTrack.alreadyRated = true;
        currentTrack.existingRating = result.entry;
        showTrackCard(currentTrack, false);
        loadRatings();
    } else if (result && result.duplicate) {
        toast("Song already rated", "info");
        pollNowPlaying();
    } else {
        toast(result?.error || "Failed to save", "error");
    }
}

// ─── Load & Render Ratings ─────────────────────────────────────
async function loadRatings() {
    const data = await api("/api/ratings");
    if (!data) return;

    allRatings = data.ratings || [];
    updateStats(data.stats);
    renderRatedSongs();
}

function updateStats(stats) {
    if (!stats) return;
    dom.statTotal.textContent = stats.total || 0;
    dom.statAverage.textContent = stats.averageRating || "—";
    dom.statHighest.textContent = stats.highestRating || "—";

    if (stats.topArtists && stats.topArtists.length > 0) {
        dom.statTopArtist.textContent = stats.topArtists[0][0];
    } else {
        dom.statTopArtist.textContent = "—";
    }
}

function renderRatedSongs() {
    const search = dom.searchInput.value.toLowerCase();
    const [sortBy, sortOrder] = dom.sortSelect.value.split("-");

    let filtered = allRatings.filter((r) => {
        if (!search) return true;
        return (
            (r.title || "").toLowerCase().includes(search) ||
            (r.artist || "").toLowerCase().includes(search) ||
            (r.album || "").toLowerCase().includes(search) ||
            (r.notes || "").toLowerCase().includes(search) ||
            (r.tags || []).some((t) => t.toLowerCase().includes(search))
        );
    });

    filtered.sort((a, b) => {
        let aVal = a[sortBy] ?? "";
        let bVal = b[sortBy] ?? "";

        if (sortBy === "rating" || sortBy === "year") {
            aVal = Number(aVal) || 0;
            bVal = Number(bVal) || 0;
        } else if (typeof aVal === "string") {
            aVal = aVal.toLowerCase();
            bVal = (bVal || "").toLowerCase();
        }

        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
    });

    if (filtered.length === 0) {
        dom.ratedGrid.innerHTML = "";
        dom.ratedEmpty.classList.remove("hidden");
        return;
    }

    dom.ratedEmpty.classList.add("hidden");
    dom.ratedGrid.innerHTML = filtered
        .map(
            (r) => `
        <div class="rated-card" data-id="${r.id}" onclick="openEditModal(getRatingById('${r.id}'))">
            <img class="rated-card-art" src="${r.albumArt || ""}" alt="${esc(r.title)}" onerror="this.style.display='none'">
            <div class="rated-card-info">
                <div class="rated-card-title">${esc(r.title)}</div>
                <div class="rated-card-artist">${esc(r.artist)}</div>
                <div class="rated-card-meta">${esc(r.album)}${r.year ? " · " + r.year : ""}${r.tags && r.tags.length ? " · " + r.tags.map(t => "#" + t).join(" ") : ""}</div>
            </div>
            <div class="rated-card-rating">${r.rating}</div>
        </div>
    `
        )
        .join("");
}

window.getRatingById = function (id) {
    return allRatings.find((r) => r.id === id);
};

// ─── Unrated Songs ─────────────────────────────────────────────
async function loadUnrated() {
    const data = await api("/api/unrated");
    if (!data) return;

    allUnrated = data.unrated || [];
    renderUnratedSongs();
}

function renderUnratedSongs() {
    const search = dom.unratedSearchInput.value.toLowerCase();

    let filtered = allUnrated.filter((u) => {
        if (!search) return true;
        return (
            (u.title || "").toLowerCase().includes(search) ||
            (u.artist || "").toLowerCase().includes(search) ||
            (u.album || "").toLowerCase().includes(search)
        );
    });

    // Sort newest first
    filtered.sort((a, b) => {
        const aDate = a.skippedAt || "";
        const bDate = b.skippedAt || "";
        return bDate.localeCompare(aDate);
    });

    if (filtered.length === 0) {
        dom.unratedGrid.innerHTML = "";
        dom.unratedEmpty.classList.remove("hidden");
        return;
    }

    dom.unratedEmpty.classList.add("hidden");
    dom.unratedGrid.innerHTML = filtered
        .map(
            (u) => `
        <div class="rated-card" data-id="${u.id}" onclick="openRateUnratedModal('${u.id}')">
            <img class="rated-card-art" src="${u.albumArt || ""}" alt="${esc(u.title)}" onerror="this.style.display='none'">
            <div class="rated-card-info">
                <div class="rated-card-title">${esc(u.title)}</div>
                <div class="rated-card-artist">${esc(u.artist)}</div>
                <div class="rated-card-meta">${esc(u.album)}${u.year ? " · " + u.year : ""}</div>
            </div>
            <div class="rated-card-unrated-badge">UNRATED</div>
        </div>
    `
        )
        .join("");
}

window.getUnratedById = function (id) {
    return allUnrated.find((u) => u.id === id);
};

// ─── Rate-Unrated Modal ────────────────────────────────────────
function openRateUnratedModal(id) {
    const entry = getUnratedById(id);
    if (!entry) return;

    dom.rateUnratedId.value = entry.id;
    dom.rateUnratedArt.src = entry.albumArt || "";
    dom.rateUnratedTitle.textContent = entry.title || "Unknown";
    dom.rateUnratedArtist.textContent = entry.artist || "Unknown Artist";
    dom.rateUnratedMeta.textContent = (entry.album || "") + (entry.year ? " · " + entry.year : "");

    const mid = Math.round((appSettings.ratingMin + appSettings.ratingMax) / 2);
    dom.rateUnratedRating.value = mid;
    dom.rateUnratedRatingDisplay.textContent = mid;
    dom.rateUnratedNotes.value = "";
    dom.rateUnratedTags.value = "";

    dom.rateUnratedModal.classList.remove("hidden");
}
window.openRateUnratedModal = openRateUnratedModal;

function closeRateUnratedModal() {
    dom.rateUnratedModal.classList.add("hidden");
}

async function saveRateUnrated() {
    const id = dom.rateUnratedId.value;
    if (!id) return;

    const entry = getUnratedById(id);
    if (!entry) return;

    const rating = parseInt(dom.rateUnratedRating.value);
    const notes = dom.rateUnratedNotes.value.trim();
    const tags = dom.rateUnratedTags.value.split(",").map((t) => t.trim()).filter(Boolean);

    const payload = {
        rating,
        notes,
        tags,
        title: entry.title,
        artist: entry.artist,
        album: entry.album,
        year: entry.year,
    };

    const result = await api(`/api/unrated/${id}/rate`, {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (result && result.success) {
        toast("Rating saved!", "success");
        closeRateUnratedModal();
        loadUnrated();
        loadRatings();
        pollNowPlaying(); // refresh now-playing badge
    } else {
        toast(result?.error || "Failed to save rating", "error");
    }
}

async function dismissUnrated() {
    const id = dom.rateUnratedId.value;
    if (!id) return;
    if (!confirm("Dismiss this song? It won't appear in unrated anymore.")) return;

    const result = await api(`/api/unrated/${id}`, { method: "DELETE" });

    if (result && result.success) {
        toast("Song dismissed", "info");
        closeRateUnratedModal();
        loadUnrated();
    } else {
        toast(result?.error || "Failed to dismiss", "error");
    }
}

// ─── Edit Modal (for rated songs) ──────────────────────────────
function openEditModal(entry) {
    if (!entry) return;
    dom.editId.value = entry.id;
    dom.editTitle.value = entry.title || "";
    dom.editArtist.value = entry.artist || "";
    dom.editAlbum.value = entry.album || "";
    dom.editYear.value = entry.year || "";
    dom.editRating.value = entry.rating || appSettings.ratingMin;
    dom.editRatingDisplay.textContent = entry.rating || appSettings.ratingMin;
    dom.editNotes.value = entry.notes || "";
    dom.editTags.value = (entry.tags || []).join(", ");
    dom.editModal.classList.remove("hidden");
}
window.openEditModal = openEditModal;

function closeEditModal() {
    dom.editModal.classList.add("hidden");
}

async function saveEdit() {
    const id = dom.editId.value;
    if (!id) return;

    const payload = {
        title: dom.editTitle.value.trim(),
        artist: dom.editArtist.value.trim(),
        album: dom.editAlbum.value.trim(),
        year: dom.editYear.value.trim(),
        rating: parseInt(dom.editRating.value),
        notes: dom.editNotes.value.trim(),
        tags: dom.editTags.value.split(",").map((t) => t.trim()).filter(Boolean),
    };

    const result = await api(`/api/ratings/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });

    if (result && result.success) {
        toast("Changes saved", "success");
        closeEditModal();
        loadRatings();
        pollNowPlaying();
    } else {
        toast(result?.error || "Failed to save", "error");
    }
}

async function deleteRating() {
    const id = dom.editId.value;
    if (!id) return;
    if (!confirm("Delete this rating?")) return;

    const result = await api(`/api/ratings/${id}`, { method: "DELETE" });

    if (result && result.success) {
        toast("Rating deleted", "success");
        closeEditModal();
        loadRatings();
        pollNowPlaying();
    } else {
        toast(result?.error || "Failed to delete", "error");
    }
}

// ─── Toast ─────────────────────────────────────────────────────
function toast(message, type = "info") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    dom.toastContainer.appendChild(el);
    setTimeout(() => {
        el.classList.add("toast-exit");
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ─── Search Modal ──────────────────────────────────────────────
function openSearchModal() {
    dom.searchModal.classList.remove("hidden");
    dom.searchSongInput.value = "";
    dom.searchResults.innerHTML = "";
    dom.searchEmpty.classList.add("hidden");
    dom.searchLoading.classList.add("hidden");
    setTimeout(() => dom.searchSongInput.focus(), 100);
}

function closeSearchModal() {
    dom.searchModal.classList.add("hidden");
}

async function doSongSearch() {
    const query = dom.searchSongInput.value.trim();
    if (!query) return;

    dom.searchResults.innerHTML = "";
    dom.searchEmpty.classList.add("hidden");
    dom.searchLoading.classList.remove("hidden");

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        dom.searchLoading.classList.add("hidden");

        if (!res.ok) {
            toast(data.error || "Search failed", "error");
            return;
        }

        const results = data.results || [];
        if (!results.length) {
            dom.searchEmpty.classList.remove("hidden");
            return;
        }

        dom.searchResults.innerHTML = results.map((track) => {
            const rated = track.alreadyRated;
            const badge = rated
                ? `<span class="search-result-badge rated">Rated ${track.existingRating.rating}</span>`
                : "";
            return `
                <div class="search-result-item${rated ? " already-rated" : ""}" data-vid="${track.videoId}">
                    <img class="search-result-art" src="${track.albumArt || ""}" alt="" onerror="this.style.visibility='hidden'">
                    <div class="search-result-info">
                        <div class="search-result-title">${esc(track.title)}</div>
                        <div class="search-result-meta">${esc(track.artist)} · ${esc(track.album)}</div>
                    </div>
                    ${badge}
                </div>`;
        }).join("");

        // Attach click handlers
        dom.searchResults.querySelectorAll(".search-result-item").forEach((el, i) => {
            el.addEventListener("click", () => {
                const track = results[i];
                acceptTrack(track, true);
                closeSearchModal();
                toast(`Loaded: ${track.title}`, "success");
            });
        });
    } catch (e) {
        dom.searchLoading.classList.add("hidden");
        toast("Search failed: " + (e.message || e), "error");
    }
}

function esc(str) {
    if (!str) return "";
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
}

