/**
 * SongRate — YouTube Music Rating App
 * Frontend: last-3 anti-flicker, lazy album year enrichment,
 * unrated songs auto-capture, rating, editing, search/sort, export, settings.
 */

// ─── State ─────────────────────────────────────────────────────
let currentTrack = null;
let recentSongIds = [];          // confirmed song IDs (anti-flicker)
let allRatings = [];
let allUnrated = [];
let pollInterval = null;
let pollPauseTimeout = null;
let appSettings = { ratingMin: 1, ratingMax: 10, pollPauseMs: 10000, maxRecent: 5, sidebarMode: "album" };
const POLL_MS = 5000;

// ─── DOM Refs ──────────────────────────────────────────────────
const $ = (sel) => document.getElementById(sel);

const dom = {
    connectionStatus: $("connectionStatus"),
    statusText: document.querySelector(".status-text"),
    nowPlayingEmpty: $("nowPlayingEmpty"),
    npLayout: $("npLayout"),
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
    // Pagination
    ratedCount: $("ratedCount"),
    btnLoadMore: $("btnLoadMore"),
    // Search modal
    btnSearchSong: $("btnSearchSong"),
    searchModal: $("searchModal"),
    searchModalClose: $("searchModalClose"),
    searchSongInput: $("searchSongInput"),
    searchSongBtn: $("searchSongBtn"),
    searchLoading: $("searchLoading"),
    searchResults: $("searchResults"),
    searchEmpty: $("searchEmpty"),
    // Alt versions
    altVersionsPanel: $("altVersionsPanel"),
    altVersionsList: $("altVersionsList"),
    altVersionsLoading: $("altVersionsLoading"),
    // Other Versions (album lookup)
    otherVersionsPanel: $("otherVersionsPanel"),
    otherVersionsList: $("otherVersionsList"),
};

// ─── Initialization ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    // Check if setup is needed before loading anything else
    const setupData = await api("/api/setup/status");
    if (setupData && setupData.needsSetup) {
        showSetupWizard();
        return;
    }

    initMainApp();
});

function initMainApp() {
    loadSettings();
    checkStatus();
    loadRatings();
    loadUnrated();
    startPolling();
    bindEvents();
}

function bindEvents() {
    dom.npRatingSlider.addEventListener("input", () => {
        dom.npRatingDisplay.value = dom.npRatingSlider.value;
    });
    dom.npRatingDisplay.addEventListener("input", () => {
        const v = clampRating(dom.npRatingDisplay.value);
        dom.npRatingSlider.value = v;
    });
    dom.editRating.addEventListener("input", () => {
        dom.editRatingDisplay.value = dom.editRating.value;
    });
    dom.editRatingDisplay.addEventListener("input", () => {
        const v = clampRating(dom.editRatingDisplay.value);
        dom.editRating.value = v;
    });
    dom.rateUnratedRating.addEventListener("input", () => {
        dom.rateUnratedRatingDisplay.value = dom.rateUnratedRating.value;
    });
    dom.rateUnratedRatingDisplay.addEventListener("input", () => {
        const v = clampRating(dom.rateUnratedRatingDisplay.value);
        dom.rateUnratedRating.value = v;
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
    // Search & sort (server-side, debounced)
    let searchDebounce = null;
    dom.searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => loadRatings(), 300);
    });
    dom.sortSelect.addEventListener("change", () => loadRatings());
    dom.btnLoadMore.addEventListener("click", loadMoreRatings);
    dom.unratedSearchInput.addEventListener("input", renderUnratedSongs);
    document.getElementById("btnDismissAllUnrated")?.addEventListener("click", async () => {
        if (!confirm("Dismiss all unrated songs? This cannot be undone.")) return;
        const res = await api("/api/unrated/all", { method: "DELETE" });
        if (res && res.success) {
            toast("All unrated songs dismissed", "success");
            loadUnrated();
        } else {
            toast("Failed to dismiss", "error");
        }
    });
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

// ─── Helpers ───────────────────────────────────────────────────
function clampRating(val) {
    const n = parseInt(val);
    if (isNaN(n)) return appSettings.ratingMin;
    return Math.max(appSettings.ratingMin, Math.min(appSettings.ratingMax, n));
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
        // Enforce defaults and types
        appSettings.ratingMin = parseInt(data.ratingMin) || -3;
        appSettings.ratingMax = parseInt(data.ratingMax) || 3;
        appSettings.shrinkage = parseFloat(data.shrinkage) || 0;
        appSettings.pollPauseMs = parseInt(data.pollPauseMs) || 10000;
        appSettings.maxRecent = parseInt(data.maxRecent) || 5;
        appSettings.sidebarMode = data.sidebarMode || "album";
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
    dom.npRatingDisplay.value = mid;
    dom.npRatingDisplay.min = min;
    dom.npRatingDisplay.max = max;
    dom.npRangeLabel.textContent = `(${min}–${max})`;

    dom.editRating.min = min;
    dom.editRating.max = max;
    dom.editRatingDisplay.min = min;
    dom.editRatingDisplay.max = max;
    dom.editRangeLabel.textContent = `(${min}–${max})`;

    dom.rateUnratedRating.min = min;
    dom.rateUnratedRating.max = max;
    dom.rateUnratedRatingDisplay.min = min;
    dom.rateUnratedRatingDisplay.max = max;
    dom.rateUnratedRangeLabel.textContent = `(${min}–${max})`;

    dom.settingsMin.value = min;
    dom.settingsMax.value = max;

    const pollPauseEl = document.getElementById("settingsPollPause");
    if (pollPauseEl) pollPauseEl.value = Math.round(appSettings.pollPauseMs / 1000);

    const maxRecentEl = document.getElementById("settingsMaxRecent");
    if (maxRecentEl) maxRecentEl.value = appSettings.maxRecent;

    const sidebarModeEl = document.getElementById("settingsSidebarMode");
    if (sidebarModeEl) sidebarModeEl.value = appSettings.sidebarMode;

    // Update sidebar title based on mode
    const sidebarTitle = document.querySelector("#altVersionsPanel .alt-versions-title");
    if (sidebarTitle) sidebarTitle.textContent = appSettings.sidebarMode === "album" ? "Album Tracks" : "Related";
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
    const pollPauseSec = parseInt(document.getElementById("settingsPollPause").value) || 10;
    const maxRecent = parseInt(document.getElementById("settingsMaxRecent").value) || 5;
    const sidebarMode = document.getElementById("settingsSidebarMode")?.value || "album";

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
        body: JSON.stringify({ ratingMin: min, ratingMax: max, pollPauseMs: pollPauseSec * 1000, maxRecent: maxRecent, sidebarMode: sidebarMode }),
    });

    if (result && result.success) {
        appSettings.ratingMin = parseInt(result.settings.ratingMin) || min;
        appSettings.ratingMax = parseInt(result.settings.ratingMax) || max;
        appSettings.pollPauseMs = parseInt(result.settings.pollPauseMs) || pollPauseSec * 1000;
        appSettings.maxRecent = parseInt(result.settings.maxRecent) || maxRecent;
        appSettings.sidebarMode = result.settings.sidebarMode || sidebarMode;
        applySettingsToUI();
        // Refresh the sidebar if track is playing
        if (currentTrack) {
            if (appSettings.sidebarMode === "album") loadAlbumTracks(currentTrack);
            else loadAltVersions(currentTrack);
        }
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
    const toggle = document.getElementById("pausePollToggle");
    if (toggle && toggle.checked) return; // manual pause active
    pollNowPlaying();
    pollInterval = setInterval(pollNowPlaying, POLL_MS);
}

function pausePolling() {
    // Always stop current polling and cancel any pending resume
    clearInterval(pollInterval);
    pollInterval = null;
    clearTimeout(pollPauseTimeout);
    const toggle = document.getElementById("pausePollToggle");
    if (toggle && toggle.checked) return; // manual pause — don't auto-resume
    // Restart after configured delay
    pollPauseTimeout = setTimeout(() => {
        pollPauseTimeout = null;
        startPolling();
    }, appSettings.pollPauseMs);
}

// Manual pause toggle
document.getElementById("pausePollToggle")?.addEventListener("change", (e) => {
    if (e.target.checked) {
        clearInterval(pollInterval);
        pollInterval = null;
        clearTimeout(pollPauseTimeout);
        pollPauseTimeout = null;
    } else {
        startPolling();
    }
});
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

    // Genuinely new song — accept it (from poll)
    acceptTrack(incoming, true, true);
}

function acceptTrack(track, animate, fromPoll = false) {
    // Save old track as unrated if it wasn't rated and isn't already unrated
    if (currentTrack && !currentTrack.alreadyRated && !currentTrack.alreadyUnrated) {
        saveAsUnrated(currentTrack);
    }

    if (fromPoll) {
        // Poll-originated switch: push old track into recent list (anti-flicker)
        if (currentTrack) {
            recentSongIds.push(currentTrack.videoId);
            if (recentSongIds.length > appSettings.maxRecent) {
                recentSongIds.shift();
            }
        }
    } else {
        // Manual selection: clear recent list so polling resumes cleanly
        recentSongIds.length = 0;
    }

    currentTrack = track;
    showTrackCard(currentTrack, animate);

    // Lazy-load release year
    enrichYearIfNeeded(currentTrack);

    // Load sidebar based on mode
    if (appSettings.sidebarMode === "album") loadAlbumTracks(currentTrack);
    else loadAltVersions(currentTrack);
    loadOtherVersions(currentTrack);
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
    dom.npLayout.classList.add("hidden");
    currentTrack = null;
}

function showTrackCard(track, animate) {
    dom.nowPlayingEmpty.classList.add("hidden");
    dom.npLayout.classList.remove("hidden");

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
            dom.npRatingDisplay.value = mid;
            dom.npNotes.value = "";
            dom.npTags.value = "";
        }
    }
}

// ─── Submit Rating ─────────────────────────────────────────────
async function submitRating() {
    if (!currentTrack) return;

    const rating = clampRating(dom.npRatingDisplay.value);
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
        pausePolling(); // Reset auto-resume timer — user is still on this song
    } else if (result && result.duplicate) {
        toast("Song already rated", "info");
        if (currentTrack) {
            currentTrack.alreadyRated = true;
            currentTrack.existingRating = result.entry || currentTrack.existingRating;
            showTrackCard(currentTrack, false);
        }
    } else {
        toast(result?.error || "Failed to save", "error");
    }
}

// ─── Load & Render Ratings (paginated) ──────────────────────────
const PAGE_SIZE = 50;
let currentOffset = 0;
let hasMoreRatings = false;
let totalFiltered = 0;

async function loadRatings(append = false) {
    if (!append) {
        currentOffset = 0;
        allRatings = [];
    }

    const [sortBy, sortOrder] = dom.sortSelect.value.split("-");
    const search = dom.searchInput.value.trim();
    const params = new URLSearchParams({
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: PAGE_SIZE,
        offset: currentOffset,
    });
    if (search) params.set("search", search);

    const data = await api(`/api/ratings?${params}`);
    if (!data) return;

    allRatings = allRatings.concat(data.ratings || []);
    hasMoreRatings = data.hasMore || false;
    totalFiltered = data.total || 0;
    currentOffset = allRatings.length;

    updateStats(data.stats);
    renderRatedSongs();
}

async function loadMoreRatings() {
    await loadRatings(true);
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
    if (allRatings.length === 0) {
        dom.ratedGrid.innerHTML = "";
        dom.ratedEmpty.classList.remove("hidden");
        dom.ratedCount.textContent = "";
        dom.btnLoadMore.style.display = "none";
        return;
    }

    dom.ratedEmpty.classList.add("hidden");
    dom.ratedGrid.innerHTML = allRatings
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

    // Update count & Load More button
    dom.ratedCount.textContent = `Showing ${allRatings.length} of ${totalFiltered}`;
    dom.btnLoadMore.style.display = hasMoreRatings ? "" : "none";
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
    dom.rateUnratedRatingDisplay.value = mid;
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
        // Refresh now-playing badge if the unrated song is the one currently showing
        if (currentTrack && entry.videoId && currentTrack.videoId === entry.videoId) {
            currentTrack.alreadyRated = true;
            currentTrack.existingRating = result.entry || { rating: payload.rating };
            showTrackCard(currentTrack, false);
        }
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
    dom.editRatingDisplay.value = entry.rating || appSettings.ratingMin;
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
        // Update current track in-place if the edited song is the one currently showing
        // (Don't call pollNowPlaying — that would fetch whatever YTM last played,
        //  which may be a different song from what the user manually selected)
        if (currentTrack && result.entry && currentTrack.videoId === result.entry.videoId) {
            currentTrack.alreadyRated = true;
            currentTrack.existingRating = result.entry;
            currentTrack.title = result.entry.title || currentTrack.title;
            currentTrack.artist = result.entry.artist || currentTrack.artist;
            currentTrack.album = result.entry.album || currentTrack.album;
            currentTrack.year = result.entry.year || currentTrack.year;
            showTrackCard(currentTrack, false);
        }
        pausePolling(); // Reset auto-resume timer — user is still on this song
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
                pausePolling();
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

// ─── Alt Versions Sidebar ──────────────────────────────────────
async function loadAltVersions(track) {
    if (!track || !track.title) return;

    dom.altVersionsList.innerHTML = '<div class="alt-versions-loading">Searching…</div>';

    try {
        // Dual search: title+artist (precise) and title-only (catches cross-album versions)
        const q1 = `${track.title} ${track.artist || ""}`.trim();
        const q2 = track.title.trim();

        const [res1, res2] = await Promise.all([
            fetch(`/api/search?q=${encodeURIComponent(q1)}`).then(r => r.json()).catch(() => null),
            q1 !== q2
                ? fetch(`/api/search?q=${encodeURIComponent(q2)}`).then(r => r.json()).catch(() => null)
                : Promise.resolve(null),
        ]);

        // Merge and deduplicate by videoId
        const seen = new Set();
        const merged = [];
        for (const data of [res1, res2]) {
            if (!data || !data.results) continue;
            for (const r of data.results) {
                if (r.videoId && !seen.has(r.videoId)) {
                    seen.add(r.videoId);
                    merged.push(r);
                }
            }
        }

        // Filter out the current track
        const alts = merged.filter(r => r.videoId !== track.videoId);
        if (!alts.length) {
            dom.altVersionsList.innerHTML = '<div class="alt-versions-empty">No other versions found</div>';
            return;
        }

        renderAltVersions(alts, track.videoId);
    } catch (e) {
        dom.altVersionsList.innerHTML = '<div class="alt-versions-empty">Could not load</div>';
    }
}

function renderAltVersions(alts, activeVideoId) {
    // Count how many results share each albumId — multi-track = album, not single
    const albumIdCounts = {};
    alts.forEach(t => {
        if (t.albumId) albumIdCounts[t.albumId] = (albumIdCounts[t.albumId] || 0) + 1;
    });

    dom.altVersionsList.innerHTML = alts.map((t, i) => {
        const isActive = t.videoId === activeVideoId;
        // Single heuristic: album name matches title AND albumId only appears once in results
        const nameMatch = t.album && t.title && t.album.toLowerCase().trim() === t.title.toLowerCase().trim();
        const appearsOnce = !t.albumId || (albumIdCounts[t.albumId] || 0) <= 1;
        const isSingle = nameMatch && appearsOnce;
        const badgeClass = isSingle ? "single" : "album";
        const badgeText = isSingle ? "Single" : "Album";
        return `
            <div class="alt-version-item${isActive ? " active" : ""}" data-alt-idx="${i}">
                <img class="alt-version-art" src="${t.albumArt || ""}" alt="" onerror="this.style.visibility='hidden'">
                <div class="alt-version-info">
                    <div class="alt-version-name">${esc(t.title)}</div>
                    <div class="alt-version-meta">${esc(t.album || t.artist)}</div>
                </div>
                <span class="alt-version-badge ${badgeClass}">${badgeText}</span>
            </div>`;
    }).join("");

    dom.altVersionsList.querySelectorAll(".alt-version-item").forEach((el, i) => {
        el.addEventListener("click", () => {
            const track = alts[i];
            recentSongIds.length = 0; // Clear anti-flicker so polling resumes cleanly
            currentTrack = track;
            showTrackCard(track, true);
            enrichYearIfNeeded(track);
            pausePolling();
            if (appSettings.sidebarMode === "album") loadAlbumTracks(track);
            else loadAltVersions(track);
            loadOtherVersions(track);
            toast(`Switched to: ${track.album || track.title}`, "success");
        });
    });
}

// ─── Other Versions (album lookup) ─────────────────────────────
async function loadOtherVersions(track) {
    if (!track || !track.title || !track.artist) {
        dom.otherVersionsList.innerHTML = '<div class="alt-versions-empty">—</div>';
        return;
    }

    dom.otherVersionsList.innerHTML = '<div class="alt-versions-loading">Scanning albums…</div>';

    try {
        const params = new URLSearchParams({
            title: track.title,
            artist: track.artist,
            videoId: track.videoId || "",
        });
        const res = await fetch(`/api/find-versions?${params}`);
        const data = await res.json();

        if (!res.ok || !data.versions || !data.versions.length) {
            dom.otherVersionsList.innerHTML = '<div class="alt-versions-empty">No other versions found</div>';
            return;
        }

        const versions = data.versions;
        dom.otherVersionsList.innerHTML = versions.map((v, i) => {
            const badge = v.isAlbum ? "album" : "single";
            const badgeText = v.isAlbum ? "Album" : "Single";
            const ratedIndicator = v.alreadyRated ? ' <span style="color:var(--accent);font-size:11px">★ Rated</span>' : "";
            return `
                <div class="alt-version-item" data-ov-idx="${i}">
                    <img class="alt-version-art" src="${v.albumArt || ""}" alt="" onerror="this.style.visibility='hidden'">
                    <div class="alt-version-info">
                        <div class="alt-version-name">${esc(v.album)}${ratedIndicator}</div>
                        <div class="alt-version-meta">${v.year || ""}</div>
                    </div>
                    <span class="alt-version-badge ${badge}">${badgeText}</span>
                </div>`;
        }).join("");

        dom.otherVersionsList.querySelectorAll(".alt-version-item").forEach((el, i) => {
            el.addEventListener("click", () => {
                const v = versions[i];
                recentSongIds.length = 0; // Clear anti-flicker so polling resumes cleanly
                currentTrack = v;
                showTrackCard(v, true);
                enrichYearIfNeeded(v);
                pausePolling();
                if (appSettings.sidebarMode === "album") loadAlbumTracks(v);
                else loadAltVersions(v);
                loadOtherVersions(v);
                toast(`Switched to: ${v.album} version`, "success");
            });
        });
    } catch (e) {
        dom.otherVersionsList.innerHTML = '<div class="alt-versions-empty">Could not load</div>';
    }
}

// ─── Album Tracks Sidebar ──────────────────────────────────────
async function loadAlbumTracks(track) {
    if (!track || !track.albumId) {
        dom.altVersionsList.innerHTML = '<div class="alt-versions-empty">No album info available</div>';
        return;
    }

    dom.altVersionsList.innerHTML = '<div class="alt-versions-loading">Loading album…</div>';

    try {
        const res = await fetch(`/api/album-tracks?albumId=${encodeURIComponent(track.albumId)}`);
        const data = await res.json();

        if (!res.ok || !data.tracks || !data.tracks.length) {
            dom.altVersionsList.innerHTML = '<div class="alt-versions-empty">No tracks found</div>';
            return;
        }

        const albumTracks = data.tracks;
        dom.altVersionsList.innerHTML = albumTracks.map((t, i) => {
            const isActive = t.videoId === track.videoId;
            const ratedIndicator = t.alreadyRated ? ' <span style="color:var(--accent);font-size:11px">★</span>' : "";
            return `
                <div class="alt-version-item${isActive ? " active" : ""}" data-at-idx="${i}">
                    <span class="alt-version-track-num">${t.trackNumber}</span>
                    <div class="alt-version-info">
                        <div class="alt-version-name">${esc(t.title)}${ratedIndicator}</div>
                        <div class="alt-version-meta">${esc(t.artist)}</div>
                    </div>
                </div>`;
        }).join("");

        dom.altVersionsList.querySelectorAll(".alt-version-item").forEach((el, i) => {
            el.addEventListener("click", () => {
                const t = albumTracks[i];
                if (t.videoId === track.videoId) return; // already playing
                recentSongIds.length = 0;
                currentTrack = t;
                showTrackCard(t, true);
                enrichYearIfNeeded(t);
                pausePolling();
                loadAlbumTracks(t);
                loadOtherVersions(t);
                toast(`Now playing: ${t.title}`, "success");
            });
        });
    } catch (e) {
        dom.altVersionsList.innerHTML = '<div class="alt-versions-empty">Could not load album</div>';
    }
}

// ─── Setup Wizard ──────────────────────────────────────────────
function showSetupWizard() {
    const wizard = document.getElementById("setupWizard");
    const header = document.querySelector(".app-header");
    const main = document.querySelector(".app-main");

    wizard.classList.remove("hidden");
    if (header) header.style.display = "none";
    if (main) main.style.display = "none";

    bindSetupEvents();
}

function hideSetupWizard() {
    const wizard = document.getElementById("setupWizard");
    const header = document.querySelector(".app-header");
    const main = document.querySelector(".app-main");

    wizard.classList.add("hidden");
    if (header) header.style.display = "";
    if (main) main.style.display = "";
}

function bindSetupEvents() {
    // Browser tabs
    const tabFirefox = document.getElementById("tabFirefox");
    const tabChrome = document.getElementById("tabChrome");
    const instrFirefox = document.getElementById("instrFirefox");
    const instrChrome = document.getElementById("instrChrome");

    tabFirefox.addEventListener("click", () => {
        tabFirefox.classList.add("active");
        tabChrome.classList.remove("active");
        instrFirefox.classList.remove("hidden");
        instrChrome.classList.add("hidden");
    });

    tabChrome.addEventListener("click", () => {
        tabChrome.classList.add("active");
        tabFirefox.classList.remove("active");
        instrChrome.classList.remove("hidden");
        instrFirefox.classList.add("hidden");
    });

    // Step navigation
    document.getElementById("setupGoToPaste").addEventListener("click", () => {
        setupGoToStep(2);
    });

    document.getElementById("setupBackToInstr").addEventListener("click", () => {
        setupGoToStep(1);
    });

    // Submit headers
    document.getElementById("setupSubmitHeaders").addEventListener("click", submitSetupHeaders);
}

function setupGoToStep(step) {
    const panels = [
        document.getElementById("setupStep1"),
        document.getElementById("setupStep2"),
        document.getElementById("setupStep3"),
    ];
    const indicators = [
        document.getElementById("setupStep1Indicator"),
        document.getElementById("setupStep2Indicator"),
        document.getElementById("setupStep3Indicator"),
    ];

    panels.forEach((p, i) => {
        p.classList.toggle("hidden", i !== step - 1);
    });
    indicators.forEach((ind, i) => {
        ind.classList.toggle("active", i <= step - 1);
        ind.classList.toggle("completed", i < step - 1);
    });

    // Focus textarea when on step 2
    if (step === 2) {
        setTimeout(() => document.getElementById("setupHeadersInput").focus(), 100);
    }
}

async function submitSetupHeaders() {
    const textarea = document.getElementById("setupHeadersInput");
    const feedback = document.getElementById("setupFeedback");
    const submitBtn = document.getElementById("setupSubmitHeaders");
    const raw = textarea.value.trim();

    if (!raw) {
        showSetupFeedback("Please paste your headers first.", "error");
        return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = "Authenticating…";
    showSetupFeedback("Sending headers to server…", "info");

    try {
        const res = await fetch("/api/setup/headers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headers: raw }),
        });
        const data = await res.json();

        if (!res.ok) {
            showSetupFeedback(data.error || "Authentication failed.", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit & Authenticate";
            return;
        }

        // Success — go to verify step
        showSetupFeedback("", "hidden");
        setupGoToStep(3);
        verifySetup();

    } catch (err) {
        showSetupFeedback("Network error: " + (err.message || err), "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit & Authenticate";
    }
}

async function verifySetup() {
    const statusEl = document.getElementById("setupVerifyStatus");

    try {
        const data = await api("/api/setup/verify");

        if (data && data.verified) {
            statusEl.innerHTML = `
                <div class="setup-success-icon">✓</div>
                <h3 class="setup-success-title">You're all set!</h3>
                <p class="setup-success-msg">${esc(data.message)}</p>
                <button class="btn-primary" id="setupFinish">Launch SongRate →</button>
            `;
            document.getElementById("setupFinish").addEventListener("click", () => {
                hideSetupWizard();
                initMainApp();
            });
        } else {
            statusEl.innerHTML = `
                <div class="setup-fail-icon">✗</div>
                <h3 class="setup-fail-title">Verification Failed</h3>
                <p class="setup-fail-msg">${esc(data?.error || "Could not connect to YouTube Music.")}</p>
                <p class="setup-fail-hint">Your auth was saved but might be invalid. Try again with fresh headers.</p>
                <button class="btn-sm" id="setupRetry">← Try Again</button>
            `;
            document.getElementById("setupRetry").addEventListener("click", () => {
                document.getElementById("setupHeadersInput").value = "";
                const submitBtn = document.getElementById("setupSubmitHeaders");
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit & Authenticate";
                setupGoToStep(1);
            });
        }
    } catch (err) {
        statusEl.innerHTML = `
            <div class="setup-fail-icon">✗</div>
            <h3 class="setup-fail-title">Something went wrong</h3>
            <p class="setup-fail-msg">${esc(err.message || String(err))}</p>
            <button class="btn-sm" id="setupRetry">← Try Again</button>
        `;
        document.getElementById("setupRetry").addEventListener("click", () => {
            setupGoToStep(1);
        });
    }
}

function showSetupFeedback(msg, type) {
    const el = document.getElementById("setupFeedback");
    if (type === "hidden" || !msg) {
        el.classList.add("hidden");
        return;
    }
    el.classList.remove("hidden");
    el.className = `setup-feedback ${type}`;
    el.textContent = msg;
}

