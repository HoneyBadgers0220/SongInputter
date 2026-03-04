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
    loadTunnelUrl();
}

async function loadTunnelUrl() {
    try {
        const res = await api("/api/tunnel-url");
        if (res && res.url) {
            const badge = document.getElementById("tunnelBadge");
            const urlSpan = document.getElementById("tunnelUrl");
            if (badge && urlSpan) {
                urlSpan.textContent = res.url;
                badge.classList.remove("hidden");
                badge.addEventListener("click", () => {
                    navigator.clipboard.writeText(res.url).then(() => {
                        toast("Tunnel URL copied!", "success");
                    });
                });
            }
        }
    } catch { /* no tunnel active */ }
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
    // View toggle (grid ↔ list)
    const viewToggle1 = document.getElementById("viewToggle");
    const viewToggle2 = document.getElementById("viewToggle2");
    function applyViewMode(isList) {
        dom.ratedGrid.classList.toggle("list-view", isList);
        dom.unratedGrid.classList.toggle("list-view", isList);
        [viewToggle1, viewToggle2].forEach(btn => {
            if (!btn) return;
            btn.classList.toggle("active", isList);
            btn.textContent = isList ? "▦" : "☰";
        });
        localStorage.setItem("songrate-list-view", isList ? "1" : "0");
        // Re-render to switch between card and table HTML
        renderRatedSongs();
        renderUnratedSongs();
    }
    // Restore saved preference
    applyViewMode(localStorage.getItem("songrate-list-view") === "1");
    [viewToggle1, viewToggle2].forEach(btn => {
        if (!btn) return;
        btn.addEventListener("click", () => {
            applyViewMode(!dom.ratedGrid.classList.contains("list-view"));
        });
    });
}

// ─── Smart Search ──────────────────────────────────────────────
// Supports: pipe OR (a|b), quotes ("exact"), negation (-term),
// regex (/pattern/i), space-separated AND
function smartMatch(query, ...fields) {
    const text = fields.map(f => (f || "").toLowerCase()).join(" ");
    if (!query) return true;

    const orGroups = query.split("|").map(g => g.trim()).filter(Boolean);
    return orGroups.some(group => {
        const tokens = [];
        const re = /([!-]?)("([^"]*)"|\/(.*?)\/([i]?)|(\S+))/g;
        let m;
        while ((m = re.exec(group)) !== null) {
            const negate = m[1] === "-" || m[1] === "!";
            if (m[3] !== undefined) {
                tokens.push({ negate, type: "exact", value: m[3].toLowerCase() });
            } else if (m[4] !== undefined) {
                try {
                    const flags = (m[5] || "") + (m[5]?.includes("i") ? "" : "i");
                    tokens.push({ negate, type: "regex", value: new RegExp(m[4], flags) });
                } catch {
                    tokens.push({ negate, type: "exact", value: m[4].toLowerCase() });
                }
            } else {
                tokens.push({ negate, type: "contains", value: m[6].toLowerCase() });
            }
        }
        return tokens.every(tok => {
            let hit;
            if (tok.type === "regex") hit = tok.value.test(text);
            else hit = text.includes(tok.value);
            return tok.negate ? !hit : hit;
        });
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
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            console.error(`API non-JSON response: ${url} (${res.status})`);
            return null;
        }
        const data = await res.json();
        if (!res.ok) {
            console.error(`API ${res.status}: ${url}`, data);
        }
        return data;
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

// ─── Color Palette System ──────────────────────────────────────
const PALETTES = {
    default: {
        accent: "#8b5cf6", accentHover: "#a78bfa", secondary: "#6366f1", textAccent: "#a78bfa",
        bgBase: "#0a0a0f", bgSurface: "#12121a", bgElevated: "#1a1a26",
        gradientBg: "linear-gradient(160deg, #0a0a0f 0%, #0f0b1e 40%, #0a0a0f 100%)",
    },
    midnight: {
        accent: "#3b82f6", accentHover: "#60a5fa", secondary: "#2563eb", textAccent: "#60a5fa",
        bgBase: "#070b14", bgSurface: "#0c1220", bgElevated: "#111827",
        gradientBg: "linear-gradient(160deg, #070b14 0%, #0a1628 40%, #070b14 100%)",
    },
    emerald: {
        accent: "#10b981", accentHover: "#34d399", secondary: "#059669", textAccent: "#34d399",
        bgBase: "#060f0b", bgSurface: "#0b1a14", bgElevated: "#10261d",
        gradientBg: "linear-gradient(160deg, #060f0b 0%, #081f14 40%, #060f0b 100%)",
    },
    rose: {
        accent: "#f43f5e", accentHover: "#fb7185", secondary: "#e11d48", textAccent: "#fb7185",
        bgBase: "#0f0608", bgSurface: "#1a0c10", bgElevated: "#261219",
        gradientBg: "linear-gradient(160deg, #0f0608 0%, #1a080e 40%, #0f0608 100%)",
    },
    amber: {
        accent: "#f59e0b", accentHover: "#fbbf24", secondary: "#d97706", textAccent: "#fbbf24",
        bgBase: "#0f0c06", bgSurface: "#1a160c", bgElevated: "#262012",
        gradientBg: "linear-gradient(160deg, #0f0c06 0%, #1a1408 40%, #0f0c06 100%)",
    },
    mono: {
        accent: "#a1a1aa", accentHover: "#d4d4d8", secondary: "#71717a", textAccent: "#d4d4d8",
        bgBase: "#09090b", bgSurface: "#111113", bgElevated: "#18181b",
        gradientBg: "linear-gradient(160deg, #09090b 0%, #0f0f12 40%, #09090b 100%)",
    },
    // Light modes
    light: {
        accent: "#7c3aed", accentHover: "#6d28d9", secondary: "#6366f1", textAccent: "#7c3aed",
        bgBase: "#f8f8fc", bgSurface: "#ffffff", bgElevated: "#f0f0f6",
        gradientBg: "linear-gradient(160deg, #f8f8fc 0%, #f0eeff 40%, #f8f8fc 100%)",
        textPrimary: "#1a1a2e", textSecondary: "#4a5568", textMuted: "#9ca3af",
        borderSubtle: "rgba(0, 0, 0, 0.08)", borderGlass: "rgba(0, 0, 0, 0.12)",
        bgGlass: "rgba(0, 0, 0, 0.03)", bgGlassHover: "rgba(0, 0, 0, 0.06)",
    },
    lightBlue: {
        accent: "#2563eb", accentHover: "#1d4ed8", secondary: "#3b82f6", textAccent: "#2563eb",
        bgBase: "#f0f4ff", bgSurface: "#ffffff", bgElevated: "#e8eeff",
        gradientBg: "linear-gradient(160deg, #f0f4ff 0%, #dbeafe 40%, #f0f4ff 100%)",
        textPrimary: "#0f172a", textSecondary: "#475569", textMuted: "#94a3b8",
        borderSubtle: "rgba(0, 0, 0, 0.06)", borderGlass: "rgba(0, 0, 0, 0.1)",
        bgGlass: "rgba(0, 0, 0, 0.03)", bgGlassHover: "rgba(0, 0, 0, 0.06)",
    },
    highContrast: {
        accent: "#facc15", accentHover: "#fde047", secondary: "#eab308", textAccent: "#facc15",
        bgBase: "#000000", bgSurface: "#0a0a0a", bgElevated: "#141414",
        gradientBg: "none",
        textPrimary: "#ffffff", textSecondary: "#e0e0e0", textMuted: "#b0b0b0",
        borderSubtle: "rgba(255, 255, 255, 0.2)", borderGlass: "rgba(255, 255, 255, 0.3)",
        bgGlass: "rgba(255, 255, 255, 0.08)", bgGlassHover: "rgba(255, 255, 255, 0.12)",
    },
};

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function buildCustomPalette(accent, bgBase, bgSurface) {
    return {
        accent, accentHover: lightenHex(accent, 40), secondary: lightenHex(accent, -20),
        textAccent: lightenHex(accent, 40),
        bgBase, bgSurface, bgElevated: lightenHex(bgSurface, 12),
        gradientBg: `linear-gradient(160deg, ${bgBase} 0%, ${lightenHex(bgBase, 8)} 40%, ${bgBase} 100%)`,
    };
}

function applyPalette(p) {
    const r = document.documentElement.style;
    r.setProperty("--accent-primary", p.accent);
    r.setProperty("--accent-primary-hover", p.accentHover);
    r.setProperty("--accent-secondary", p.secondary);
    r.setProperty("--accent-glow", hexToRgba(p.accent, 0.25));
    r.setProperty("--gradient-primary", `linear-gradient(135deg, ${p.accent}, ${p.secondary})`);
    r.setProperty("--text-accent", p.textAccent);
    r.setProperty("--bg-base", p.bgBase);
    r.setProperty("--bg-surface", p.bgSurface);
    r.setProperty("--bg-elevated", p.bgElevated);
    r.setProperty("--gradient-bg", p.gradientBg);
    r.setProperty("--shadow-glow", `0 0 30px ${hexToRgba(p.accent, 0.15)}`);
    // Text + border overrides (for light mode and high contrast)
    if (p.textPrimary) {
        r.setProperty("--text-primary", p.textPrimary);
        r.setProperty("--text-secondary", p.textSecondary);
        r.setProperty("--text-muted", p.textMuted);
        r.setProperty("--border-subtle", p.borderSubtle);
        r.setProperty("--border-glass", p.borderGlass);
        r.setProperty("--bg-glass", p.bgGlass);
        r.setProperty("--bg-glass-hover", p.bgGlassHover);
    } else {
        // Reset to dark-mode defaults
        r.setProperty("--text-primary", "#f0f0f5");
        r.setProperty("--text-secondary", "#9ca3af");
        r.setProperty("--text-muted", "#6b7280");
        r.setProperty("--border-subtle", "rgba(255, 255, 255, 0.06)");
        r.setProperty("--border-glass", "rgba(255, 255, 255, 0.1)");
        r.setProperty("--bg-glass", "rgba(255, 255, 255, 0.04)");
        r.setProperty("--bg-glass-hover", "rgba(255, 255, 255, 0.07)");
    }
}

function loadPalette() {
    const saved = localStorage.getItem("songrate-palette");
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        let p;
        if (data.id === "custom") {
            p = buildCustomPalette(data.accent || "#8b5cf6", data.bgBase || "#0a0a0f", data.bgSurface || "#12121a");
        } else {
            p = PALETTES[data.id] || PALETTES.default;
        }
        applyPalette(p);
    } catch { /* ignore */ }
}

function savePaletteChoice(id, customColors) {
    const data = { id, ...customColors };
    localStorage.setItem("songrate-palette", JSON.stringify(data));
}

function initPalette() {
    const container = document.getElementById("palettePresets");
    const customOpts = document.getElementById("customPaletteOptions");
    if (!container) return;

    // Restore active state
    const saved = localStorage.getItem("songrate-palette");
    let activeId = "default";
    let customData = {};
    if (saved) {
        try {
            const d = JSON.parse(saved);
            activeId = d.id || "default";
            customData = d;
        } catch { /* ignore */ }
    }

    container.querySelectorAll(".palette-swatch").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.palette === activeId);
    });

    // Show custom options if custom is active
    if (activeId === "custom" && customOpts) {
        customOpts.classList.remove("hidden");
        document.getElementById("customAccent").value = customData.accent || "#8b5cf6";
        document.getElementById("customBg").value = customData.bgBase || "#0a0a0f";
        document.getElementById("customSurface").value = customData.bgSurface || "#12121a";
    }

    // Swatch clicks
    container.addEventListener("click", (e) => {
        const btn = e.target.closest(".palette-swatch");
        if (!btn) return;
        const id = btn.dataset.palette;
        container.querySelectorAll(".palette-swatch").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        if (id === "custom") {
            customOpts?.classList.remove("hidden");
            const accent = document.getElementById("customAccent").value;
            const bg = document.getElementById("customBg").value;
            const surface = document.getElementById("customSurface").value;
            const p = buildCustomPalette(accent, bg, surface);
            applyPalette(p);
            savePaletteChoice("custom", { accent, bgBase: bg, bgSurface: surface });
        } else {
            customOpts?.classList.add("hidden");
            applyPalette(PALETTES[id]);
            savePaletteChoice(id);
        }
    });

    // Custom color pickers — live preview
    ["customAccent", "customBg", "customSurface"].forEach(inputId => {
        const el = document.getElementById(inputId);
        if (!el) return;
        el.addEventListener("input", () => {
            const accent = document.getElementById("customAccent").value;
            const bg = document.getElementById("customBg").value;
            const surface = document.getElementById("customSurface").value;
            const p = buildCustomPalette(accent, bg, surface);
            applyPalette(p);
            savePaletteChoice("custom", { accent, bgBase: bg, bgSurface: surface });
        });
    });
}

// Apply palette immediately on page load (before DOMContentLoaded for no flash)
loadPalette();

function openSettings() {
    dom.settingsMin.value = appSettings.ratingMin;
    dom.settingsMax.value = appSettings.ratingMax;
    initPalette(); // sync palette UI
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
    if (!dom.npAlbumArt || !dom.npTitle) return; // DOM not ready
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
    const isList = dom.ratedGrid.classList.contains("list-view");

    if (isList) {
        dom.ratedGrid.innerHTML = `
        <div class="table-wrap">
        <table class="ratings-table">
            <thead><tr>
                <th></th>
                <th>Title</th>
                <th>Artist</th>
                <th>Album</th>
                <th>Year</th>
                <th>Rating</th>
                <th>Tags</th>
            </tr></thead>
            <tbody>
            ${allRatings.map(r => `
                <tr class="ratings-table-row" data-id="${r.id}" onclick="openEditModal(getRatingById('${r.id}'))">
                    <td><img class="table-art" src="${r.albumArt || ""}" alt="" loading="lazy"
                        data-retries="0" data-vid="${r.videoId || ""}"
                        onerror="let n=+this.dataset.retries;if(n===0){this.dataset.retries=1;let s=this;setTimeout(()=>{s.src=s.src},1000)}else if(n===1&&this.dataset.vid){this.dataset.retries=2;this.src='https://i.ytimg.com/vi/'+this.dataset.vid+'/hqdefault.jpg'}else{this.style.display='none'}"></td>
                    <td class="table-title">${esc(r.title)}</td>
                    <td class="table-artist">${esc(r.artist)}</td>
                    <td class="table-album">${esc(r.album)}</td>
                    <td class="table-year">${r.year || ""}</td>
                    <td class="table-rating">${r.rating}</td>
                    <td class="table-tags">${r.tags && r.tags.length ? r.tags.map(t => "#" + t).join(" ") : ""}</td>
                </tr>
            `).join("")}
            </tbody>
        </table>
        </div>`;
    } else {
        dom.ratedGrid.innerHTML = allRatings
            .map(
                (r) => `
            <div class="rated-card" data-id="${r.id}" onclick="openEditModal(getRatingById('${r.id}'))">
                <img class="rated-card-art" src="${r.albumArt || ""}" alt="${esc(r.title)}" loading="lazy"
                     data-retries="0" data-vid="${r.videoId || ""}"
                     onerror="let n=+this.dataset.retries;if(n===0){this.dataset.retries=1;let s=this;setTimeout(()=>{s.src=s.src},1000)}else if(n===1&&this.dataset.vid){this.dataset.retries=2;this.src='https://i.ytimg.com/vi/'+this.dataset.vid+'/hqdefault.jpg'}else{this.style.display='none'}">
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
    const search = dom.unratedSearchInput.value.trim();

    let filtered = allUnrated.filter((u) => {
        if (!search) return true;
        return smartMatch(search, u.title, u.artist, u.album);
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
    const isList = dom.unratedGrid.classList.contains("list-view");

    if (isList) {
        dom.unratedGrid.innerHTML = `
        <div class="table-wrap">
        <table class="ratings-table">
            <thead><tr>
                <th></th>
                <th>Title</th>
                <th>Artist</th>
                <th>Album</th>
                <th>Year</th>
                <th></th>
            </tr></thead>
            <tbody>
            ${filtered.map(u => `
                <tr class="ratings-table-row" data-id="${u.id}" onclick="openRateUnratedModal('${u.id}')">
                    <td><img class="table-art" src="${u.albumArt || ""}" alt="" loading="lazy" onerror="this.style.display='none'"></td>
                    <td class="table-title">${esc(u.title)}</td>
                    <td class="table-artist">${esc(u.artist)}</td>
                    <td class="table-album">${esc(u.album)}</td>
                    <td class="table-year">${u.year || ""}</td>
                    <td><span class="rated-card-unrated-badge">UNRATED</span></td>
                </tr>
            `).join("")}
            </tbody>
        </table>
        </div>`;
    } else {
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
        // Reset the now-playing card so the song shows as unrated again
        if (currentTrack) {
            currentTrack.alreadyRated = false;
            currentTrack.existingRating = null;
            showTrackCard(currentTrack, false);
        }
        pausePolling();
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
                ? `<span class="search-result-badge rated">Rated ${track.existingRating?.rating ?? "?"}</span>`
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

