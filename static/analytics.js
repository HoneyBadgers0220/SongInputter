/**
 * SongRate Analytics — Interactive data analysis dashboard
 * Charts via Chart.js, sortable tables, custom graph builder
 */

// ─── State ─────────────────────────────────────────────────────
let analyticsData = null;
let rawRatings = [];
let currentShrinkage = 5;
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
    initTableSort();
    initCustomBuilder();
    initChartFilters();
    loadAnalytics();
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
async function loadAnalytics() {
    try {
        const [analytics, ratings] = await Promise.all([
            fetch(`/api/analytics?c=${currentShrinkage}`).then((r) => r.json()),
            fetch("/api/ratings").then((r) => r.json()),
        ]);
        analyticsData = analytics;
        rawRatings = ratings.ratings || [];
        renderAll();
    } catch (e) {
        console.error("Failed to load analytics", e);
    }
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

// ─── Artist Table ──────────────────────────────────────────────
function renderArtistTable() {
    const search = document.getElementById("artistSearch").value.toLowerCase();
    const minApp = parseInt(document.getElementById("artistMinAppearances").value) || 1;

    let data = analyticsData.artists.filter(
        (a) => a.appearances >= minApp && (!search || a.name.toLowerCase().includes(search))
    );

    const tbody = document.getElementById("artistTableBody");
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px">No artists found</td></tr>`;
        return;
    }

    tbody.innerHTML = data
        .map(
            (a) => `
        <tr class="${tierClass(a.rank)}">
            <td class="rank-cell rank-${a.rank}">${a.rank}</td>
            <td class="name-cell">${esc(a.name)}</td>
            <td class="score-cell">${a.appearances}</td>
            <td class="score-cell">${a.totalScore}</td>
            <td class="score-cell">${a.avgScore.toFixed(2)}</td>
            <td class="score-cell score-adjusted">${a.adjustedScore.toFixed(2)}</td>
            <td class="score-cell">${a.minRating}</td>
            <td class="score-cell">${a.maxRating}</td>
            <td class="score-cell">${a.albumCount}</td>
        </tr>`
        )
        .join("");
}

function renderAlbumTable() {
    const search = document.getElementById("albumSearch").value.toLowerCase();
    const minTracks = parseInt(document.getElementById("albumMinTracks").value) || 1;

    let data = analyticsData.albums.filter(
        (a) =>
            a.appearances >= minTracks &&
            (!search || a.name.toLowerCase().includes(search) || (a.artist || "").toLowerCase().includes(search))
    );

    const tbody = document.getElementById("albumTableBody");
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px">No albums found</td></tr>`;
        return;
    }

    tbody.innerHTML = data
        .map(
            (a) => `
        <tr class="${tierClass(a.rank)}">
            <td class="rank-cell rank-${a.rank}">${a.rank}</td>
            <td><img class="album-art-thumb" src="${a.albumArt || ""}" alt="" onerror="this.style.display='none'"></td>
            <td class="name-cell">${esc(a.name)}</td>
            <td>${esc(a.artist)}</td>
            <td>${a.year || ""}</td>
            <td class="score-cell">${a.appearances}</td>
            <td class="score-cell">${a.totalScore}</td>
            <td class="score-cell">${a.avgScore.toFixed(2)}</td>
            <td class="score-cell score-adjusted">${a.adjustedScore.toFixed(2)}</td>
        </tr>`
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
    const labels = Object.keys(dist).sort((a, b) => Number(a) - Number(b));
    const values = labels.map((l) => dist[l]);

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
    const settings = { min: 0, max: 10 };
    function avgToColor(avg) {
        const ratio = Math.max(0, Math.min(1, avg / settings.max));
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
                    pointRadius: data.map((d) => Math.min(4 + d.x * 1.5, 18)),
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
                y: { title: { display: true, text: "Total Score" }, beginAtZero: true },
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
