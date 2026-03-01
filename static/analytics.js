/**
 * SongRate Analytics — Interactive data analysis dashboard
 * Charts via Chart.js, sortable tables, custom graph builder
 */

// ─── Apply saved palette from main app ─────────────────────────
(function () {
    const saved = localStorage.getItem("songrate-palette");
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        const PALETTES = {
            default: null,
            midnight: { accent: "#3b82f6", accentHover: "#60a5fa", secondary: "#2563eb", textAccent: "#60a5fa", bgBase: "#070b14", bgSurface: "#0c1220", bgElevated: "#111827", gradientBg: "linear-gradient(160deg, #070b14 0%, #0a1628 40%, #070b14 100%)" },
            emerald: { accent: "#10b981", accentHover: "#34d399", secondary: "#059669", textAccent: "#34d399", bgBase: "#060f0b", bgSurface: "#0b1a14", bgElevated: "#10261d", gradientBg: "linear-gradient(160deg, #060f0b 0%, #081f14 40%, #060f0b 100%)" },
            rose: { accent: "#f43f5e", accentHover: "#fb7185", secondary: "#e11d48", textAccent: "#fb7185", bgBase: "#0f0608", bgSurface: "#1a0c10", bgElevated: "#261219", gradientBg: "linear-gradient(160deg, #0f0608 0%, #1a080e 40%, #0f0608 100%)" },
            amber: { accent: "#f59e0b", accentHover: "#fbbf24", secondary: "#d97706", textAccent: "#fbbf24", bgBase: "#0f0c06", bgSurface: "#1a160c", bgElevated: "#262012", gradientBg: "linear-gradient(160deg, #0f0c06 0%, #1a1408 40%, #0f0c06 100%)" },
            mono: { accent: "#a1a1aa", accentHover: "#d4d4d8", secondary: "#71717a", textAccent: "#d4d4d8", bgBase: "#09090b", bgSurface: "#111113", bgElevated: "#18181b", gradientBg: "linear-gradient(160deg, #09090b 0%, #0f0f12 40%, #09090b 100%)" },
            light: { accent: "#7c3aed", accentHover: "#6d28d9", secondary: "#6366f1", textAccent: "#7c3aed", bgBase: "#f8f8fc", bgSurface: "#ffffff", bgElevated: "#f0f0f6", gradientBg: "linear-gradient(160deg, #f8f8fc 0%, #f0eeff 40%, #f8f8fc 100%)", textPrimary: "#1a1a2e", textSecondary: "#4a5568", textMuted: "#9ca3af", borderSubtle: "rgba(0,0,0,0.08)", borderGlass: "rgba(0,0,0,0.12)", bgGlass: "rgba(0,0,0,0.03)", bgGlassHover: "rgba(0,0,0,0.06)" },
            lightBlue: { accent: "#2563eb", accentHover: "#1d4ed8", secondary: "#3b82f6", textAccent: "#2563eb", bgBase: "#f0f4ff", bgSurface: "#ffffff", bgElevated: "#e8eeff", gradientBg: "linear-gradient(160deg, #f0f4ff 0%, #dbeafe 40%, #f0f4ff 100%)", textPrimary: "#0f172a", textSecondary: "#475569", textMuted: "#94a3b8", borderSubtle: "rgba(0,0,0,0.06)", borderGlass: "rgba(0,0,0,0.1)", bgGlass: "rgba(0,0,0,0.03)", bgGlassHover: "rgba(0,0,0,0.06)" },
            highContrast: { accent: "#facc15", accentHover: "#fde047", secondary: "#eab308", textAccent: "#facc15", bgBase: "#000000", bgSurface: "#0a0a0a", bgElevated: "#141414", gradientBg: "none", textPrimary: "#ffffff", textSecondary: "#e0e0e0", textMuted: "#b0b0b0", borderSubtle: "rgba(255,255,255,0.2)", borderGlass: "rgba(255,255,255,0.3)", bgGlass: "rgba(255,255,255,0.08)", bgGlassHover: "rgba(255,255,255,0.12)" },
        };
        function hexToRgba(hex, a) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r},${g},${b},${a})`; }
        function lighten(hex, n) { let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); r = Math.min(255, r + n); g = Math.min(255, g + n); b = Math.min(255, b + n); return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`; }
        let p;
        if (data.id === "custom") {
            const a = data.accent || "#8b5cf6", bg = data.bgBase || "#0a0a0f", sf = data.bgSurface || "#12121a";
            p = { accent: a, accentHover: lighten(a, 40), secondary: lighten(a, -20), textAccent: lighten(a, 40), bgBase: bg, bgSurface: sf, bgElevated: lighten(sf, 12), gradientBg: `linear-gradient(160deg,${bg} 0%,${lighten(bg, 8)} 40%,${bg} 100%)` };
        } else {
            p = PALETTES[data.id];
        }
        if (!p) return;
        const s = document.documentElement.style;
        s.setProperty("--accent-primary", p.accent);
        s.setProperty("--accent-primary-hover", p.accentHover);
        s.setProperty("--accent-secondary", p.secondary);
        s.setProperty("--accent-glow", hexToRgba(p.accent, 0.25));
        s.setProperty("--gradient-primary", `linear-gradient(135deg, ${p.accent}, ${p.secondary})`);
        s.setProperty("--text-accent", p.textAccent);
        s.setProperty("--bg-base", p.bgBase);
        s.setProperty("--bg-surface", p.bgSurface);
        s.setProperty("--bg-elevated", p.bgElevated);
        s.setProperty("--gradient-bg", p.gradientBg);
        s.setProperty("--shadow-glow", `0 0 30px ${hexToRgba(p.accent, 0.15)}`);
        if (p.textPrimary) {
            s.setProperty("--text-primary", p.textPrimary);
            s.setProperty("--text-secondary", p.textSecondary);
            s.setProperty("--text-muted", p.textMuted);
            s.setProperty("--border-subtle", p.borderSubtle);
            s.setProperty("--border-glass", p.borderGlass);
            s.setProperty("--bg-glass", p.bgGlass);
            s.setProperty("--bg-glass-hover", p.bgGlassHover);
        }
    } catch { }
})();

// ─── State ─────────────────────────────────────────────────────
let analyticsData = null;
let rawRatings = [];
let currentShrinkage = 5;
let splitArtists = true;
let chartInstances = {};
let currentSort = { table: null, key: "adjustedScore", dir: "desc" };

// Chart.js dark theme defaults
Chart.defaults.color = "#a0a0b0";
Chart.defaults.borderColor = "rgba(255,255,255,0.06)";
Chart.defaults.font.family = "Inter, sans-serif";

const COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
    "#a855f7", "#d946ef", "#f59e0b", "#10b981", "#0ea5e9",
    "#e11d48", "#7c3aed", "#2563eb", "#059669", "#dc2626",
];

// ─── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initShrinkage();
    initSplitArtists();
    initTableSort();
    initCustomBuilder();
    initCustomValidation();
    initChartFilters();
    initImport();
    loadAnalytics();
});

function initImport() {
    const importBtn = document.getElementById("importBtn");
    const fileInput = document.getElementById("importFileInput");
    const dismissBtn = document.getElementById("importDismiss");

    if (importBtn && fileInput) {
        importBtn.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", (e) => {
            if (e.target.files[0]) handleFileImport(e.target.files[0]);
            e.target.value = ""; // allow re-importing same file
        });
    }
    if (dismissBtn) {
        dismissBtn.addEventListener("click", loadAnalytics);
    }
}

function initSplitArtists() {
    const toggle = document.getElementById("splitArtistsToggle");
    if (toggle) {
        toggle.addEventListener("change", () => {
            splitArtists = toggle.checked;
            if (usingImported) loadImportedData(rawRatings);
            else loadAnalytics();
        });
    }
}

// Wire the ⓘ info toggle
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("shrinkageInfoToggle");
    const panel = document.getElementById("shrinkageInfo");
    if (btn && panel) {
        btn.addEventListener("click", () => panel.classList.toggle("hidden"));
    }
});

// ─── Tabs ──────────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
            btn.classList.add("active");
            const panel = document.getElementById("tab" + capitalize(btn.dataset.tab));
            if (panel) panel.classList.add("active");
        });
    });
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Shrinkage Slider ──────────────────────────────────────────
function initShrinkage() {
    const slider = document.getElementById("shrinkageSlider");
    const numInput = document.getElementById("shrinkageValue");
    const saveBtn = document.getElementById("saveShrinkageDefault");

    slider.addEventListener("input", () => {
        numInput.value = slider.value;
        currentShrinkage = parseFloat(slider.value);
        loadAnalytics();
    });

    numInput.addEventListener("input", () => {
        const val = parseFloat(numInput.value);
        if (!isNaN(val) && val >= 0) {
            slider.value = Math.min(val, parseFloat(slider.max));
            currentShrinkage = val;
            loadAnalytics();
        }
    });

    saveBtn.addEventListener("click", async () => {
        const res = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shrinkageC: currentShrinkage }),
        });
        const data = await res.json();
        if (data.success) toast("Default shrinkage saved", "success");
        else toast(data.error || "Failed", "error");
    });

    // Load saved default
    fetch("/api/settings")
        .then((r) => r.json())
        .then((s) => {
            if (s.shrinkageC != null) {
                slider.value = s.shrinkageC;
                numInput.value = s.shrinkageC;
                currentShrinkage = s.shrinkageC;
            }
        });
}

// ─── Data Loading ──────────────────────────────────────────────
let usingImported = false;

async function loadAnalytics() {
    try {
        const [analytics, ratings] = await Promise.all([
            fetch(`/api/analytics?c=${currentShrinkage}&splitArtists=${splitArtists ? 1 : 0}&_t=${Date.now()}`).then((r) => r.json()),
            fetch("/api/ratings?limit=0").then((r) => r.json()),
        ]);
        analyticsData = analytics;
        rawRatings = ratings.ratings || [];
        usingImported = false;
        updateImportBanner();
        renderAll();
    } catch (e) {
        console.error("Failed to load analytics", e);
    }
}

function loadImportedData(ratings) {
    // Build analytics-compatible structures from raw ratings
    rawRatings = ratings;
    usingImported = true;

    const allScores = ratings
        .filter(r => typeof r.rating === "number")
        .map(r => r.rating);
    const globalMean = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    // Build artist data
    const artistMap = {};
    const albumMap = {};
    const decades = {};
    const tags = {};

    ratings.forEach(r => {
        const rawArtist = r.artist || "Unknown";
        const artistNames = splitArtists ? rawArtist.split(",").map(a => a.trim()).filter(Boolean) : [rawArtist];
        const album = r.album || "Unknown";
        const rating = r.rating;

        // Artists — count for each credited artist
        artistNames.forEach(artist => {
            if (!artistMap[artist]) artistMap[artist] = { scores: [], albums: new Set() };
            if (typeof rating === "number") artistMap[artist].scores.push(rating);
            artistMap[artist].albums.add(album);
        });

        // Albums
        if (!albumMap[album]) albumMap[album] = { scores: [], artist, year: r.year || "", albumArt: r.albumArt || "" };
        if (typeof rating === "number") albumMap[album].scores.push(rating);

        // Decades
        const year = r.year;
        if (year && String(year).match(/^\d+$/)) {
            const dec = String(Math.floor(parseInt(year) / 10) * 10) + "s";
            if (!decades[dec]) decades[dec] = { count: 0, totalRating: 0 };
            decades[dec].count++;
            if (typeof rating === "number") decades[dec].totalRating += rating;
        }

        // Tags
        (r.tags || []).forEach(t => {
            const tl = t.trim().toLowerCase();
            if (tl) tags[tl] = (tags[tl] || 0) + 1;
        });
    });

    // Build arrays
    const artists = Object.entries(artistMap).map(([name, d]) => {
        const n = d.scores.length;
        if (n === 0) return null;
        const total = d.scores.reduce((a, b) => a + b, 0);
        const avg = total / n;
        const adj = (n * avg + currentShrinkage * globalMean) / (n + currentShrinkage);
        return {
            name, appearances: n, totalScore: Math.round(total * 100) / 100,
            avgScore: Math.round(avg * 1000) / 1000,
            adjustedScore: Math.round(adj * 1000) / 1000,
            albumCount: d.albums.size,
            minRating: Math.min(...d.scores), maxRating: Math.max(...d.scores),
        };
    }).filter(Boolean);
    artists.sort((a, b) => b.adjustedScore - a.adjustedScore);
    artists.forEach((a, i) => a.rank = i + 1);

    const albums = Object.entries(albumMap).map(([name, d]) => {
        const n = d.scores.length;
        if (n === 0) return null;
        const total = d.scores.reduce((a, b) => a + b, 0);
        const avg = total / n;
        const adj = (n * avg + currentShrinkage * globalMean) / (n + currentShrinkage);
        return {
            name, artist: d.artist, year: d.year, albumArt: d.albumArt,
            appearances: n, totalScore: Math.round(total * 100) / 100,
            avgScore: Math.round(avg * 1000) / 1000,
            adjustedScore: Math.round(adj * 1000) / 1000,
            minRating: Math.min(...d.scores), maxRating: Math.max(...d.scores),
        };
    }).filter(Boolean);
    albums.sort((a, b) => b.adjustedScore - a.adjustedScore);
    albums.forEach((a, i) => a.rank = i + 1);

    const decadesList = {};
    Object.entries(decades).sort().forEach(([dec, d]) => {
        decadesList[dec] = { count: d.count, avgRating: d.count ? Math.round(d.totalRating / d.count * 100) / 100 : 0 };
    });

    analyticsData = {
        artists, albums, decades: decadesList, globalMean,
        totalSongs: ratings.length, shrinkageC: currentShrinkage,
    };

    updateImportBanner();
    renderAll();
}

function updateImportBanner() {
    const banner = document.getElementById("importBanner");
    if (!banner) return;
    if (usingImported) {
        banner.classList.remove("hidden");
        banner.querySelector(".import-count").textContent = rawRatings.length;
    } else {
        banner.classList.add("hidden");
    }
}

function handleFileImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;

            if (file.name.endsWith(".json")) {
                let data = JSON.parse(text);
                // Support both raw array and { ratings: [...] } format
                if (Array.isArray(data)) {
                    loadImportedData(data);
                } else if (data.ratings && Array.isArray(data.ratings)) {
                    loadImportedData(data.ratings);
                } else {
                    toast("Invalid JSON: expected an array of ratings or { ratings: [...] }", "error");
                    return;
                }
                toast(`Imported ${rawRatings.length} ratings from JSON`, "success");
            } else if (file.name.endsWith(".csv")) {
                const ratings = parseCSV(text);
                if (!ratings.length) {
                    toast("No valid data found in CSV", "error");
                    return;
                }
                loadImportedData(ratings);
                toast(`Imported ${ratings.length} ratings from CSV`, "success");
            } else {
                toast("Unsupported file type. Use .json or .csv", "error");
            }
        } catch (err) {
            toast("Import failed: " + (err.message || err), "error");
        }
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

    // Map common header names
    const fieldMap = {
        title: ["title", "song", "track", "name"],
        artist: ["artist", "artists", "performer"],
        album: ["album"],
        year: ["year", "release_year", "release year"],
        rating: ["rating", "score", "rate"],
        ratedAt: ["ratedat", "rated_at", "date", "timestamp"],
        notes: ["notes", "note", "comment"],
        tags: ["tags", "tag", "genre"],
    };

    function findField(header) {
        for (const [field, aliases] of Object.entries(fieldMap)) {
            if (aliases.includes(header)) return field;
        }
        return null;
    }

    const colMap = {};
    headers.forEach((h, i) => {
        const field = findField(h);
        if (field) colMap[field] = i;
    });

    if (!colMap.hasOwnProperty("title") && !colMap.hasOwnProperty("artist")) {
        return [];
    }

    return lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const entry = {};
        for (const [field, idx] of Object.entries(colMap)) {
            let val = cols[idx] || "";
            if (field === "rating") val = parseFloat(val) || 0;
            else if (field === "year") val = val.replace(/[^\d]/g, "");
            else if (field === "tags") val = val.split(";").map(t => t.trim()).filter(Boolean);
            entry[field] = val;
        }
        return entry;
    }).filter(r => r.title || r.artist);
}

function renderAll() {
    if (!analyticsData) return;
    renderSummary();
    renderArtistTable();
    renderAlbumTable();
    renderCharts();
}

// ─── Summary Cards ─────────────────────────────────────────────
function renderSummary() {
    document.getElementById("sumTotal").textContent = analyticsData.totalSongs;
    document.getElementById("sumGlobalMean").textContent = analyticsData.globalMean.toFixed(2);
    document.getElementById("sumArtists").textContent = analyticsData.artists.length;
    document.getElementById("sumAlbums").textContent = analyticsData.albums.length;
}

// ─── Smart Search ──────────────────────────────────────────────
// Supports: pipe OR (a|b), quotes ("exact"), negation (-term),
// regex (/pattern/i), space-separated AND
function smartMatch(query, ...fields) {
    const text = fields.map(f => (f || "").toLowerCase()).join(" ");
    if (!query) return true;

    // Pipe = OR between groups
    const orGroups = query.split("|").map(g => g.trim()).filter(Boolean);
    return orGroups.some(group => {
        // Tokenize: respect quoted strings, regex, and bare words
        const tokens = [];
        const re = /([!-]?)("([^"]*)"|\/([^\/]*)\/([i]?)|(\S+))/g;
        let m;
        while ((m = re.exec(group)) !== null) {
            const negate = m[1] === "-" || m[1] === "!";
            if (m[3] !== undefined) {
                // Quoted exact phrase
                tokens.push({ negate, type: "exact", value: m[3].toLowerCase() });
            } else if (m[4] !== undefined) {
                // Regex pattern
                try {
                    const flags = (m[5] || "") + (m[5]?.includes("i") ? "" : "i");
                    tokens.push({ negate, type: "regex", value: new RegExp(m[4], flags) });
                } catch { /* invalid regex — treat as literal */
                    tokens.push({ negate, type: "exact", value: m[4].toLowerCase() });
                }
            } else {
                // Bare word — substring match
                tokens.push({ negate, type: "contains", value: m[6].toLowerCase() });
            }
        }
        // AND: every token must match (or not-match if negated)
        return tokens.every(tok => {
            let hit;
            if (tok.type === "regex") hit = tok.value.test(text);
            else if (tok.type === "exact") hit = text.includes(tok.value);
            else hit = text.includes(tok.value);
            return tok.negate ? !hit : hit;
        });
    });
}

// ─── Column-Specific Search ────────────────────────────────────
// Like smartMatch but supports field:value prefixes, e.g:
//   artist:radiohead  tag:rock  album:"in rainbows"  year:2007
// Bare tokens (no prefix) match all fields.
// fieldsMap = { artist: "Radiohead", album: "OK Computer", tag: "rock british", ... }
function smartFieldMatch(query, fieldsMap) {
    if (!query) return true;
    const allText = Object.values(fieldsMap).map(v => (v || "").toLowerCase()).join(" ");

    const orGroups = query.split("|").map(g => g.trim()).filter(Boolean);
    return orGroups.some(group => {
        const tokens = [];
        // Match field:value, field:"quoted value", or regular tokens
        const re = /([!-]?)(?:(\w+):)?("([^"]*)"|\/([^/]*)\/([i]?)|(\S+))/g;
        let m;
        while ((m = re.exec(group)) !== null) {
            const negate = m[1] === "-" || m[1] === "!";
            const field = m[2] ? m[2].toLowerCase() : null; // e.g. "artist", "tag", null
            let tok;
            if (m[4] !== undefined) {
                tok = { negate, field, type: "exact", value: m[4].toLowerCase() };
            } else if (m[5] !== undefined) {
                try {
                    const flags = (m[6] || "") + (m[6]?.includes("i") ? "" : "i");
                    tok = { negate, field, type: "regex", value: new RegExp(m[5], flags) };
                } catch {
                    tok = { negate, field, type: "exact", value: m[5].toLowerCase() };
                }
            } else {
                tok = { negate, field, type: "contains", value: m[7].toLowerCase() };
            }
            tokens.push(tok);
        }

        return tokens.every(tok => {
            // Determine which text to search: specific field or all fields
            let searchText;
            if (tok.field && fieldsMap[tok.field] !== undefined) {
                searchText = (fieldsMap[tok.field] || "").toLowerCase();
            } else if (tok.field) {
                // Unknown field name — try matching against all text anyway
                searchText = allText;
            } else {
                searchText = allText;
            }

            let hit;
            if (tok.type === "regex") hit = tok.value.test(searchText);
            else hit = searchText.includes(tok.value);
            return tok.negate ? !hit : hit;
        });
    });
}

// ─── Entity Tag Helpers ────────────────────────────────────────
function renderTagPills(tags, entityType, entityName) {
    const pills = (tags || []).map(t =>
        `<span class="entity-tag-pill" data-type="${entityType}" data-name="${esc(entityName)}" data-tag="${esc(t)}">${esc(t)}<button class="tag-remove" onclick="event.stopPropagation();removeEntityTag('${entityType}','${esc(entityName).replace(/'/g, "\\'")}','${esc(t).replace(/'/g, "\\\'")}')">&times;</button></span>`
    ).join("");
    return `<span class="entity-tags-wrap">${pills}<button class="tag-add-btn" onclick="event.stopPropagation();showTagInput(this,'${entityType}','${esc(entityName).replace(/'/g, "\\\'")}')" title="Add tag">+</button></span>`;
}

window.showTagInput = function (btn, entityType, entityName) {
    // If already open, skip
    if (btn.parentElement.querySelector(".tag-inline-input")) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tag-inline-input";
    input.placeholder = "tag name…";
    input.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && input.value.trim()) {
            e.preventDefault();
            await addEntityTag(entityType, entityName, input.value.trim());
            input.remove();
        } else if (e.key === "Escape") {
            input.remove();
        }
    });
    input.addEventListener("blur", () => setTimeout(() => input.remove(), 200));
    btn.parentElement.insertBefore(input, btn);
    input.focus();
};

async function addEntityTag(entityType, entityName, newTag) {
    // Find existing tags from current data
    const list = entityType === "artists" ? analyticsData.artists : analyticsData.albums;
    const entity = list.find(a => {
        if (entityType === "artists") return a.name === entityName;
        return `${a.artist} \u2014 ${a.name}` === entityName;
    });
    const existing = entity ? [...(entity.tags || [])] : [];
    if (existing.includes(newTag)) return;
    existing.push(newTag);
    await saveEntityTags(entityType, entityName, existing);
}

window.removeEntityTag = async function (entityType, entityName, tag) {
    const list = entityType === "artists" ? analyticsData.artists : analyticsData.albums;
    const entity = list.find(a => {
        if (entityType === "artists") return a.name === entityName;
        return `${a.artist} \u2014 ${a.name}` === entityName;
    });
    if (!entity) return;
    const updated = (entity.tags || []).filter(t => t !== tag);
    await saveEntityTags(entityType, entityName, updated);
};

async function saveEntityTags(entityType, entityName, tags) {
    const res = await fetch("/api/entity-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: entityType, name: entityName, tags }),
    });
    if (res.ok) {
        // Update local data and re-render
        const list = entityType === "artists" ? analyticsData.artists : analyticsData.albums;
        const entity = list.find(a => {
            if (entityType === "artists") return a.name === entityName;
            return `${a.artist} \u2014 ${a.name}` === entityName;
        });
        if (entity) entity.tags = tags;
        if (entityType === "artists") renderArtistTable();
        else renderAlbumTable();
    }
}

// ─── Artist Table ──────────────────────────────────────────────
function renderArtistTable() {
    const search = document.getElementById("artistSearch").value.trim();
    const minApp = parseInt(document.getElementById("artistMinAppearances").value) || 1;

    let data = analyticsData.artists.filter(
        (a) => a.appearances >= minApp && smartFieldMatch(search, {
            artist: a.name, name: a.name, tag: (a.tags || []).join(" ")
        })
    );

    const tbody = document.getElementById("artistTableBody");
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px">No artists found</td></tr>`;
        return;
    }

    tbody.innerHTML = data
        .map(
            (a, i) => `
        <tr class="${tierClass(i + 1)}">
            <td class="rank-cell rank-${i + 1}">${i + 1}</td>
            <td class="name-cell">${esc(a.name)}</td>
            <td class="score-cell">${a.appearances}</td>
            <td class="score-cell">${a.totalScore}</td>
            <td class="score-cell">${a.avgScore.toFixed(2)}</td>
            <td class="score-cell score-adjusted">${a.adjustedScore.toFixed(2)}</td>
            <td class="score-cell">${a.minRating}</td>
            <td class="score-cell">${a.maxRating}</td>
            <td class="score-cell">${a.albumCount}</td>
            <td class="tags-cell">${renderTagPills(a.tags, "artists", a.name)}</td>
        </tr>`
        )
        .join("");
}

function renderAlbumTable() {
    const search = document.getElementById("albumSearch").value.trim();
    const minTracks = parseInt(document.getElementById("albumMinTracks").value) || 1;

    let data = analyticsData.albums.filter(
        (a) =>
            a.appearances >= minTracks && smartFieldMatch(search, {
                album: a.name, name: a.name, artist: a.artist,
                year: String(a.year || ""), tag: (a.tags || []).join(" ")
            })
    );

    const tbody = document.getElementById("albumTableBody");
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px">No albums found</td></tr>`;
        return;
    }

    tbody.innerHTML = data
        .map(
            (a, i) => {
                const tagKey = `${a.artist} \u2014 ${a.name}`;
                return `
        <tr class="${tierClass(i + 1)}">
            <td class="rank-cell rank-${i + 1}">${i + 1}</td>
            <td><img class="album-art-thumb" src="${a.albumArt || ""}" alt="" onerror="this.style.display='none'"></td>
            <td class="name-cell">${esc(a.name)}</td>
            <td>${esc(a.artist)}</td>
            <td>${a.year || ""}</td>
            <td class="score-cell">${a.appearances}</td>
            <td class="score-cell">${a.totalScore}</td>
            <td class="score-cell">${a.avgScore.toFixed(2)}</td>
            <td class="score-cell score-adjusted">${a.adjustedScore.toFixed(2)}</td>
            <td class="tags-cell">${renderTagPills(a.tags, "albums", tagKey)}</td>
        </tr>`;
            }
        )
        .join("");
}

// Search & filter listeners
document.addEventListener("DOMContentLoaded", () => {
    ["artistSearch", "artistMinAppearances"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", renderArtistTable);
    });
    ["albumSearch", "albumMinTracks"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", renderAlbumTable);
    });
});

function tierClass(rank) {
    if (rank === 1) return "tier-gold";
    if (rank === 2) return "tier-silver";
    if (rank === 3) return "tier-bronze";
    return "";
}

// ─── Table Sorting ─────────────────────────────────────────────
function initTableSort() {
    document.querySelectorAll(".analytics-table th[data-sort]").forEach((th) => {
        th.addEventListener("click", () => {
            const key = th.dataset.sort;
            const table = th.closest("table");
            const isArtist = table.id === "artistTable";
            const dataArr = isArtist ? analyticsData.artists : analyticsData.albums;

            // Determine direction
            const wasDesc = th.classList.contains("sorted-desc");
            const wasAsc = th.classList.contains("sorted-asc");
            // Clear all sort indicators in this table
            table.querySelectorAll("th").forEach((h) => {
                h.classList.remove("sorted-asc", "sorted-desc");
            });

            let dir;
            if (wasDesc) dir = "asc";
            else dir = "desc";

            th.classList.add(dir === "desc" ? "sorted-desc" : "sorted-asc");

            // Sort the data in-place
            dataArr.sort((a, b) => {
                let av = a[key] ?? "";
                let bv = b[key] ?? "";
                if (typeof av === "string") {
                    av = av.toLowerCase();
                    bv = (bv || "").toLowerCase();
                }
                if (av < bv) return dir === "asc" ? -1 : 1;
                if (av > bv) return dir === "asc" ? 1 : -1;
                return 0;
            });

            // Re-rank
            dataArr.forEach((item, i) => (item.rank = i + 1));

            if (isArtist) renderArtistTable();
            else renderAlbumTable();
        });
    });
}

// ─── Chart Filters ─────────────────────────────────────────────
function getChartFilters() {
    return {
        minSongs: parseInt(document.getElementById("chartMinSongs").value) || 1,
        yearFrom: parseInt(document.getElementById("chartYearFrom").value) || null,
        yearTo: parseInt(document.getElementById("chartYearTo").value) || null,
        ratingMin: parseFloat(document.getElementById("chartRatingMin").value),
        ratingMax: parseFloat(document.getElementById("chartRatingMax").value),
    };
}

function filterRatings(ratings) {
    const f = getChartFilters();
    return ratings.filter((r) => {
        if (!isNaN(f.ratingMin) && r.rating < f.ratingMin) return false;
        if (!isNaN(f.ratingMax) && r.rating > f.ratingMax) return false;
        const yr = parseInt(r.year);
        if (f.yearFrom && yr && yr < f.yearFrom) return false;
        if (f.yearTo && yr && yr > f.yearTo) return false;
        return true;
    });
}

function filterArtists(artists) {
    const f = getChartFilters();
    return artists.filter((a) => a.appearances >= f.minSongs);
}

function filterAlbums(albums) {
    const f = getChartFilters();
    return albums.filter((a) => a.appearances >= f.minSongs);
}

function initChartFilters() {
    document.getElementById("chartFilterApply").addEventListener("click", renderCharts);
    document.getElementById("chartFilterReset").addEventListener("click", () => {
        document.getElementById("chartMinSongs").value = "1";
        document.getElementById("chartYearFrom").value = "";
        document.getElementById("chartYearTo").value = "";
        document.getElementById("chartRatingMin").value = "";
        document.getElementById("chartRatingMax").value = "";
        renderCharts();
    });
}

// ─── Charts ────────────────────────────────────────────────────
function renderCharts() {
    renderDistributionChart();
    renderTimelineChart();
    renderTopArtistsChart();
    renderTopAlbumsChart();
    renderDecadesChart();
    renderTrendChart();
    renderArtistScatter();
    renderRadarChart();
    renderCumulativeChart();
    renderTagChart();
}

function getOrCreate(id, type, config) {
    if (chartInstances[id]) chartInstances[id].destroy();
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    chartInstances[id] = new Chart(ctx, { type, ...config });
    return chartInstances[id];
}

function renderDistributionChart() {
    const filtered = filterRatings(rawRatings);
    const dist = {};
    filtered.forEach((r) => {
        const key = r.rating;
        dist[key] = (dist[key] || 0) + 1;
    });

    // Find the actual min and max ratings present in ALL data (not just filtered)
    const allRatings = rawRatings.map(r => r.rating).filter(r => typeof r === 'number');
    const dataMin = Math.min(...allRatings, ...Object.keys(dist).map(Number));
    const dataMax = Math.max(...allRatings, ...Object.keys(dist).map(Number));

    // Fill ALL integer steps between min and max so no gaps appear
    const labels = [];
    for (let i = dataMin; i <= dataMax; i++) {
        labels.push(String(i));
    }
    const values = labels.map((l) => dist[Number(l)] || 0);

    getOrCreate("chartDistribution", "bar", {
        data: {
            labels,
            datasets: [
                {
                    label: "Songs",
                    data: values,
                    backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
                    borderRadius: 6,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { title: { display: true, text: "Rating" } },
            },
        },
    });
}

function renderTimelineChart() {
    const filtered = filterRatings(rawRatings);
    const byDate = {};
    filtered.forEach((r) => {
        const d = (r.ratedAt || "").substring(0, 10);
        if (d) byDate[d] = (byDate[d] || 0) + 1;
    });
    const dates = Object.keys(byDate).sort();
    getOrCreate("chartTimeline", "bar", {
        data: {
            labels: dates,
            datasets: [
                {
                    label: "Songs Rated",
                    data: dates.map((d) => byDate[d]),
                    backgroundColor: COLORS[0] + "aa",
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { title: { display: true, text: "Date" } },
            },
        },
    });
}

// Metric labels for display
const METRIC_LABELS = {
    adjustedScore: "Adjusted Score",
    avgScore: "Average Score",
    totalScore: "Total Score",
    appearances: "Songs Rated",
    albumCount: "Albums",
    minRating: "Min Rating",
    maxRating: "Max Rating",
    range: "Range (Max - Min)",
    scorePerAlbum: "Score per Album",
};

function getMetricValue(item, metric) {
    switch (metric) {
        case "range": return item.maxRating - item.minRating;
        case "scorePerAlbum": return item.albumCount ? Math.round(item.totalScore / item.albumCount * 100) / 100 : 0;
        default: return item[metric] ?? 0;
    }
}

function renderTopArtistsChart() {
    const metric = document.getElementById("artistChartMetric").value;
    const label = METRIC_LABELS[metric] || metric;

    // Sort by selected metric (descending) and take top 10
    const sorted = [...filterArtists(analyticsData.artists)]
        .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
        .slice(0, 10);

    getOrCreate("chartTopArtists", "bar", {
        data: {
            labels: sorted.map((a) => a.name),
            datasets: [
                {
                    label: label,
                    data: sorted.map((a) => getMetricValue(a, metric)),
                    backgroundColor: COLORS.slice(0, 10),
                    borderRadius: 6,
                },
            ],
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: label } },
            },
        },
    });
}

function renderTopAlbumsChart() {
    const metric = document.getElementById("albumChartMetric").value;
    const label = METRIC_LABELS[metric] || metric;

    const sorted = [...filterAlbums(analyticsData.albums)]
        .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
        .slice(0, 10);

    getOrCreate("chartTopAlbums", "bar", {
        data: {
            labels: sorted.map((a) => truncate(a.name, 25)),
            datasets: [
                {
                    label: label,
                    data: sorted.map((a) => getMetricValue(a, metric)),
                    backgroundColor: COLORS.slice(0, 10).reverse(),
                    borderRadius: 6,
                },
            ],
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: label } },
            },
        },
    });
}

// Dropdown change listeners — re-render just that chart
document.addEventListener("DOMContentLoaded", () => {
    const artistSel = document.getElementById("artistChartMetric");
    const albumSel = document.getElementById("albumChartMetric");
    if (artistSel) artistSel.addEventListener("change", renderTopArtistsChart);
    if (albumSel) albumSel.addEventListener("change", renderTopAlbumsChart);
});

function renderDecadesChart() {
    const dec = analyticsData.decades;
    const labels = Object.keys(dec).sort();
    getOrCreate("chartDecades", "bar", {
        data: {
            labels,
            datasets: [
                {
                    label: "Songs",
                    data: labels.map((l) => dec[l].count),
                    backgroundColor: COLORS[4] + "cc",
                    borderRadius: 6,
                    yAxisID: "y",
                },
                {
                    label: "Avg Rating",
                    data: labels.map((l) => dec[l].avgRating),
                    type: "line",
                    borderColor: COLORS[0],
                    backgroundColor: COLORS[0] + "33",
                    tension: 0.3,
                    pointRadius: 4,
                    yAxisID: "y1",
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, position: "left", title: { display: true, text: "Songs" } },
                y1: { position: "right", title: { display: true, text: "Avg Rating" }, grid: { drawOnChartArea: false } },
            },
        },
    });
}

function renderTrendChart() {
    if (!rawRatings.length) return;

    // Sort by ratedAt and compute rolling average
    const sorted = [...filterRatings(rawRatings)]
        .filter((r) => r.ratedAt && typeof r.rating === "number")
        .sort((a, b) => a.ratedAt.localeCompare(b.ratedAt));

    const cumulative = [];
    let sum = 0;
    sorted.forEach((r, i) => {
        sum += r.rating;
        cumulative.push({
            label: `Song ${i + 1}`,
            value: Math.round((sum / (i + 1)) * 100) / 100,
            rating: r.rating,
        });
    });

    getOrCreate("chartTrend", "line", {
        data: {
            labels: cumulative.map((c) => c.label),
            datasets: [
                {
                    label: "Running Average",
                    data: cumulative.map((c) => c.value),
                    borderColor: COLORS[0],
                    backgroundColor: COLORS[0] + "22",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                },
                {
                    label: "Individual Rating",
                    data: cumulative.map((c) => c.rating),
                    borderColor: COLORS[3] + "66",
                    pointBackgroundColor: COLORS[3],
                    pointRadius: 3,
                    showLine: false,
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                y: { title: { display: true, text: "Rating" } },
            },
        },
    });
}

function renderArtistScatter() {
    const artists = filterArtists(analyticsData.artists);
    if (!artists.length) return;

    // Color by avg score: red (low) -> yellow (mid) -> green (high)
    const allRatings = rawRatings.map(r => r.rating).filter(r => typeof r === 'number');
    const rMax = allRatings.length ? Math.max(...allRatings) : 10;
    const rMin = allRatings.length ? Math.min(...allRatings) : 0;

    function avgToColor(avg) {
        const range = rMax - rMin || 1;
        const ratio = Math.max(0, Math.min(1, (avg - rMin) / range));
        const hue = ratio * 120; // 0=red, 60=yellow, 120=green
        return `hsl(${hue}, 80%, 50%)`;
    }

    const data = artists.map((a) => ({
        x: a.appearances,
        y: a.totalScore,
        artist: a.name,
        avg: a.avgScore,
    }));

    getOrCreate("chartArtistScatter", "scatter", {
        data: {
            datasets: [
                {
                    label: "Artists",
                    data: data,
                    backgroundColor: data.map((d) => avgToColor(d.avg)),
                    borderColor: data.map((d) => avgToColor(d.avg)),
                    pointRadius: 7,
                    pointHoverRadius: 10,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const d = ctx.raw;
                            return `${d.artist}: ${d.x} songs, total ${d.y}, avg ${d.avg.toFixed(2)}`;
                        },
                    },
                },
            },
            scales: {
                x: { title: { display: true, text: "Songs Rated" }, beginAtZero: true },
                y: { title: { display: true, text: "Total Score" } },
            },
        },
    });
}

function renderRadarChart() {
    const top5 = filterArtists(analyticsData.artists).slice(0, 5);
    if (top5.length < 2) return;

    // Normalize metrics to 0-10 scale for radar
    const maxApp = Math.max(...top5.map((a) => a.appearances), 1);
    const maxAlbums = Math.max(...top5.map((a) => a.albumCount), 1);
    const rMax = 10; // rating max

    getOrCreate("chartRadar", "radar", {
        data: {
            labels: ["Adjusted Score", "Avg Score", "Songs", "Albums", "Consistency"],
            datasets: top5.map((a, i) => ({
                label: a.name,
                data: [
                    a.adjustedScore,
                    a.avgScore,
                    (a.appearances / maxApp) * rMax,
                    (a.albumCount / maxAlbums) * rMax,
                    rMax - (a.maxRating - a.minRating), // consistency = small range is good
                ],
                borderColor: COLORS[i],
                backgroundColor: COLORS[i] + "22",
                pointBackgroundColor: COLORS[i],
            })),
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: rMax,
                    ticks: { stepSize: 2, display: false },
                    grid: { color: "rgba(255,255,255,0.06)" },
                    angleLines: { color: "rgba(255,255,255,0.06)" },
                },
            },
        },
    });
}

// ─── Custom Graph Builder ──────────────────────────────────────
function initCustomBuilder() {
    document.getElementById("customGenerate").addEventListener("click", generateCustomChart);
}

function generateCustomChart() {
    const chartType = document.getElementById("customChartType").value;
    const groupBy = document.getElementById("customGroupBy").value;
    const metric = document.getElementById("customMetric").value;
    const sortMode = document.getElementById("customSort").value;
    const limit = parseInt(document.getElementById("customLimit").value) || 20;
    const minRating = parseFloat(document.getElementById("customMinRating").value);
    const maxRating = parseFloat(document.getElementById("customMaxRating").value);

    // Filter ratings
    let filtered = [...rawRatings];
    if (!isNaN(minRating)) filtered = filtered.filter((r) => r.rating >= minRating);
    if (!isNaN(maxRating)) filtered = filtered.filter((r) => r.rating <= maxRating);

    if (!filtered.length) {
        document.getElementById("customEmpty").classList.remove("hidden");
        return;
    }
    document.getElementById("customEmpty").classList.add("hidden");

    // Group data
    const groups = {};
    filtered.forEach((r) => {
        let key;
        switch (groupBy) {
            case "artist":
                key = r.artist || "Unknown";
                break;
            case "album":
                key = r.album || "Unknown";
                break;
            case "year":
                key = r.year || "Unknown";
                break;
            case "rating":
                key = String(r.rating);
                break;
            case "ratedMonth":
                key = (r.ratedAt || "").substring(0, 7);
                break;
            case "tag":
                const tags = r.tags && r.tags.length ? r.tags : ["(no tag)"];
                tags.forEach((t) => {
                    if (!groups[t]) groups[t] = { count: 0, totalRating: 0, scores: [] };
                    groups[t].count++;
                    groups[t].totalRating += r.rating || 0;
                    groups[t].scores.push(r.rating || 0);
                });
                return;
            default:
                key = "Unknown";
        }
        if (!groups[key]) groups[key] = { count: 0, totalRating: 0, scores: [] };
        groups[key].count++;
        groups[key].totalRating += r.rating || 0;
        groups[key].scores.push(r.rating || 0);
    });

    // Calculate metric
    const globalMean = analyticsData.globalMean || 0;
    let entries = Object.entries(groups).map(([label, d]) => {
        let value;
        switch (metric) {
            case "count":
                value = d.count;
                break;
            case "avgRating":
                value = d.count ? d.totalRating / d.count : 0;
                break;
            case "totalScore":
                value = d.totalRating;
                break;
            case "adjustedScore":
                const avg = d.count ? d.totalRating / d.count : 0;
                value = (d.count * avg + currentShrinkage * globalMean) / (d.count + currentShrinkage);
                break;
        }
        return { label, value: Math.round(value * 100) / 100 };
    });

    // Sort
    const [sortKey, sortDir] = sortMode.split("-");
    entries.sort((a, b) => {
        const av = sortKey === "label" ? a.label.toLowerCase() : a.value;
        const bv = sortKey === "label" ? b.label.toLowerCase() : b.value;
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
    });

    entries = entries.slice(0, limit);

    // Chart title
    const metricLabel = { count: "Count", avgRating: "Avg Rating", totalScore: "Total Score", adjustedScore: "Adjusted Score" }[metric];
    const groupLabel = { artist: "Artist", album: "Album", year: "Year", rating: "Rating", ratedMonth: "Month", tag: "Tag" }[groupBy];
    document.getElementById("customChartTitle").textContent = `${metricLabel} by ${groupLabel}`;

    // Render
    const labels = entries.map((e) => truncate(e.label, 20));
    const values = entries.map((e) => e.value);
    const colors = entries.map((_, i) => COLORS[i % COLORS.length]);

    let type = chartType;
    let opts = { responsive: true };

    if (chartType === "horizontalBar") {
        type = "bar";
        opts.indexAxis = "y";
    } else if (chartType === "pie") {
        type = "doughnut";
    } else if (chartType === "scatter") {
        type = "scatter";
        const scatterData = entries.map((e, i) => ({ x: i, y: e.value }));
        getOrCreate("chartCustom", "scatter", {
            data: {
                datasets: [
                    {
                        label: metricLabel,
                        data: scatterData,
                        backgroundColor: COLORS[0],
                        pointRadius: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        ticks: { callback: (v) => labels[v] || "" },
                        title: { display: true, text: groupLabel },
                    },
                    y: { title: { display: true, text: metricLabel } },
                },
            },
        });
        return;
    }

    getOrCreate("chartCustom", type, {
        data: {
            labels,
            datasets: [
                {
                    label: metricLabel,
                    data: values,
                    backgroundColor: type === "doughnut" ? colors : colors[0] + "cc",
                    borderColor: type === "line" ? COLORS[0] : undefined,
                    borderRadius: type === "bar" ? 6 : undefined,
                    tension: 0.3,
                    fill: type === "line",
                },
            ],
        },
        options: opts,
    });
}

// ─── Smart Custom Chart Validation ─────────────────────────────
function initCustomValidation() {
    const chartTypeEl = document.getElementById("customChartType");
    const groupByEl = document.getElementById("customGroupBy");
    const metricEl = document.getElementById("customMetric");

    // When chart type changes, update available combos
    chartTypeEl.addEventListener("change", updateCustomOptions);
    groupByEl.addEventListener("change", updateCustomOptions);
    updateCustomOptions();
}

function updateCustomOptions() {
    const chartTypeEl = document.getElementById("customChartType");
    const groupBy = document.getElementById("customGroupBy").value;
    const metricEl = document.getElementById("customMetric");

    // Scatter only makes sense with numeric group-by (year, rating)
    // Line only makes sense with ordered axes (year, ratedMonth, rating)

    const orderedGroups = ["year", "ratedMonth", "rating"];
    const isOrdered = orderedGroups.includes(groupBy);

    // Disable line chart when group-by is unordered (artist names, albums, tags)
    const lineOpt = chartTypeEl.querySelector('option[value="line"]');
    if (lineOpt) lineOpt.disabled = !isOrdered;

    // Disable scatter when group-by is unordered
    const scatterOpt = chartTypeEl.querySelector('option[value="scatter"]');
    if (scatterOpt) scatterOpt.disabled = !isOrdered;

    // If current chart type is now disabled, switch to bar
    if (chartTypeEl.selectedOptions[0]?.disabled) {
        chartTypeEl.value = "bar";
    }

    // Adjusted Score doesn't make sense when grouping by rating or ratedMonth
    const adjOpt = metricEl.querySelector('option[value="adjustedScore"]');
    if (adjOpt) adjOpt.disabled = ["rating", "ratedMonth"].includes(groupBy);

    if (metricEl.selectedOptions[0]?.disabled) {
        metricEl.value = "count";
    }
}

// ─── New Charts: Cumulative + Tags ─────────────────────────────
function renderCumulativeChart() {
    if (!rawRatings.length) return;

    const sorted = [...filterRatings(rawRatings)]
        .filter((r) => r.ratedAt)
        .sort((a, b) => a.ratedAt.localeCompare(b.ratedAt));

    // Group by date
    const byDate = {};
    sorted.forEach((r) => {
        const d = r.ratedAt.substring(0, 10);
        byDate[d] = (byDate[d] || 0) + 1;
    });

    const dates = Object.keys(byDate).sort();
    let cumulative = 0;
    const cumData = dates.map(d => {
        cumulative += byDate[d];
        return cumulative;
    });

    getOrCreate("chartCumulative", "line", {
        data: {
            labels: dates,
            datasets: [
                {
                    label: "Total Songs Rated",
                    data: cumData,
                    borderColor: COLORS[9],
                    backgroundColor: COLORS[9] + "22",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: "Total Songs" } },
                x: { title: { display: true, text: "Date" } },
            },
        },
    });
}

function renderTagChart() {
    const filtered = filterRatings(rawRatings);
    const tagCounts = {};
    filtered.forEach((r) => {
        if (r.tags && r.tags.length) {
            r.tags.forEach((t) => {
                tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
        }
    });

    const sorted = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    if (!sorted.length) {
        // Hide the chart if no tags
        const canvas = document.getElementById("chartTags");
        if (canvas) canvas.closest(".chart-card").style.display = "none";
        return;
    }

    const canvas = document.getElementById("chartTags");
    if (canvas) canvas.closest(".chart-card").style.display = "";

    getOrCreate("chartTags", "doughnut", {
        data: {
            labels: sorted.map(([t]) => t),
            datasets: [
                {
                    data: sorted.map(([, c]) => c),
                    backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length]),
                    borderWidth: 0,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "right",
                    labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
                },
            },
        },
    });
}

// ─── Utilities ─────────────────────────────────────────────────
function esc(str) {
    if (!str) return "";
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
}

function truncate(str, max) {
    return str && str.length > max ? str.substring(0, max) + "..." : str || "";
}

function toast(message, type) {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    document.getElementById("toastContainer").appendChild(el);
    setTimeout(() => {
        el.classList.add("toast-exit");
        setTimeout(() => el.remove(), 300);
    }, 3000);
}
