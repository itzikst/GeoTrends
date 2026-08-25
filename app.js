import { formatYearLabel, makeLinksClickable, calculateYearFromProgress } from './js/utils.js';
import { loadCSV, loadProjectConfig, fetchProjectsList, fetchServerFileList, normalizeLocationData, determineYearBounds } from './js/data-loader.js';
import { initMap, switchBaseMap, setProjectGeology, getIconForType, getIconKeyForType, starIcon, destroyIcon } from './js/map-manager.js';
import { parseAppUrl, updateUrlState, BASEMAP_TO_VIEW, VIEW_TO_BASEMAP, FILE_TO_REPO } from './js/url-parser.js';

// Global State
let locations = [];
let minYear = 0;
let maxYear = 0;
let currentYear = 0;
let isRunning = false;
let eventYears = [];
let currentRepo = 'timna';
let currentViewParam = 'topo';

// Animation variables for segment-based playback (5s per segment)
let segmentStartYear = 0;
let segmentEndYear = 0;
let segmentStartTime = 0;
const segmentDuration = 5000; // 5 seconds in ms

const HISTORICAL_PERIODS = [
    { name: 'Neolithic', start: -10000, end: -5800, color: 'rgba(59, 130, 246, 0.35)' },
    { name: 'Chalcolithic', start: -5800, end: -3600, color: 'rgba(16, 185, 129, 0.35)' },
    { name: 'EB', start: -3600, end: -2000, color: 'rgba(245, 158, 11, 0.35)' },
    { name: 'MB', start: -2000, end: -1500, color: 'rgba(239, 68, 68, 0.35)' },
    { name: 'LB', start: -1500, end: -1200, color: 'rgba(139, 92, 246, 0.35)' },
    { name: 'EI', start: -1200, end: -1000, color: 'rgba(236, 72, 153, 0.35)' },
    { name: 'LI', start: -1000, end: -586, color: 'rgba(20, 184, 166, 0.35)' },
    { name: 'Per', start: -586, end: -37, color: 'rgba(79, 70, 229, 0.35)' },
    { name: 'Rom', start: -37, end: 324, color: 'rgba(217, 70, 239, 0.35)' },
    { name: 'Byz', start: 324, end: 638, color: 'rgba(14, 165, 233, 0.35)' },
    { name: 'EM', start: 638, end: 1099, color: 'rgba(132, 204, 22, 0.35)' },
    { name: 'Cru', start: 1099, end: 1291, color: 'rgba(244, 63, 94, 0.35)' },
    { name: 'Mam', start: 1291, end: 1517, color: 'rgba(249, 115, 22, 0.35)' },
    { name: 'Ott', start: 1517, end: 1917, color: 'rgba(100, 116, 139, 0.35)' },
    { name: 'Mod', start: 1917, end: 2026, color: 'rgba(16, 185, 129, 0.4)' }
];

const DESTROY_THRESHOLD = 10; // Years before hiding to show destruction icon

// DOM Elements
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('csv-upload');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = playPauseBtn.querySelector('.play-icon');
const pauseIcon = playPauseBtn.querySelector('.pause-icon');
const resetBtn = document.getElementById('reset-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const dataTableBody = document.querySelector('#data-table tbody');
const timeIndicator = document.getElementById('time-indicator');

const updateIndicator = (year) => {
    const range = maxYear - minYear;
    const progress = (year - minYear) / range;
    timeIndicator.style.left = (progress * 100) + '%';
    const yearDisplay = document.getElementById('current-year-value');
    if (yearDisplay) {
        yearDisplay.textContent = formatYearLabel(Math.round(year));
    }
};

// 1. Initialize Leaflet Map
const esriApiKey = (typeof ESRI_API_KEY !== 'undefined') ? ESRI_API_KEY : (window.ESRI_API_KEY || '');
const { map, markerGroup, highlightLayer, baseMapLayers } = initMap('map', esriApiKey);
window.map = map;

// Dynamic geology legend updater
let currentGeologyLegendItems = [];
function updateGeologyLegend(items) {
    currentGeologyLegendItems = items || [];
    const geoSection = document.getElementById('geology-legend-section');
    if (!geoSection) return;
    const grid = geoSection.querySelector('.geology-legend-grid');
    if (!grid) return;

    if (!items || items.length === 0) {
        geoSection.style.display = 'none';
        grid.innerHTML = '';
        return;
    }

    grid.innerHTML = items.map(item => `
        <div style="display: flex; align-items: center; gap: 6px;" title="${item.label}">
            <span style="width: 14px; height: 14px; background: ${item.color}; border-radius: 3px; border: 1px solid rgba(0,0,0,0.3); flex-shrink: 0;"></span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.label}</span>
        </div>
    `).join('');

    const isGeologic = document.querySelector('.basemap-btn[data-basemap="geologic"]')?.classList.contains('active');
    const legendDiv = document.querySelector('.info.legend');
    if (isGeologic) {
        geoSection.style.display = 'block';
        if (legendDiv && !legendDiv.classList.contains('minimized')) {
            legendDiv.style.maxHeight = '520px';
        }
    }
}

// Helper to switch basemap UI and sync URL state
function setBasemapUIAndLayer(basemapKey, updateUrl = true) {
    if (!basemapKey) return;
    const basemapBtns = document.querySelectorAll('.basemap-btn');
    basemapBtns.forEach(btn => {
        if (btn.getAttribute('data-basemap') === basemapKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    switchBaseMap(map, baseMapLayers, basemapKey);

    const geoLegend = document.getElementById('geology-legend-section');
    const legendDiv = document.querySelector('.info.legend');
    if (basemapKey === 'geologic') {
        if (geoLegend) geoLegend.style.display = 'block';
        if (legendDiv && !legendDiv.classList.contains('minimized')) {
            legendDiv.style.maxHeight = '520px';
        }
    } else {
        if (geoLegend) geoLegend.style.display = 'none';
        if (legendDiv && !legendDiv.classList.contains('minimized')) {
            legendDiv.style.maxHeight = '320px';
        }
    }

    // Toggle high-contrast halo on marker icons for satellite & geologic views
    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (basemapKey === 'satellite' || basemapKey === 'geologic') {
            mapContainer.classList.add('high-contrast-markers');
        } else {
            mapContainer.classList.remove('high-contrast-markers');
        }
    }

    currentViewParam = BASEMAP_TO_VIEW[basemapKey] || 'topo';
    if (updateUrl) {
        updateUrlState(currentRepo, currentViewParam, false);
    }
}

// Base Map Selector Event Handler
const basemapSelector = document.getElementById('basemap-selector');
if (basemapSelector) {
    const basemapBtns = basemapSelector.querySelectorAll('.basemap-btn');
    basemapBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedMap = btn.getAttribute('data-basemap');
            setBasemapUIAndLayer(selectedMap, true);
        });
    });
}

// 2. Handle CSV Upload
uploadBtn.addEventListener('click', () => fileInput.click());

let currentProjectHeader = '';
let initialTargetYear = null;

// Load project according to URL repo and view parameters scheme app-url/repo?view=topo|geo|sattelites&year=YYYY
function loadProject(repo, viewParam = null, basemapKey = null, targetYear = null, updateUrl = false) {
    if (typeof targetYear === 'boolean') {
        updateUrl = targetYear;
        targetYear = null;
    }

    pauseAnimation();
    currentRepo = repo || currentRepo;
    if (viewParam) currentViewParam = viewParam;

    // Set initialTargetYear to targetYear (or null when switching repos so it resets to minYear of new repository)
    if (targetYear !== null && targetYear !== undefined && !isNaN(targetYear)) {
        initialTargetYear = targetYear;
    } else {
        initialTargetYear = null;
    }

    const targetBasemap = basemapKey || VIEW_TO_BASEMAP[currentViewParam] || 'topo';

    setBasemapUIAndLayer(targetBasemap, false);
    if (updateUrl) {
        updateUrlState(currentRepo, currentViewParam, targetYear, true);
    }

    loadProjectConfig(currentRepo)
        .then(config => {
            console.log(`Loaded project config for '${currentRepo}':`, config);
            currentProjectHeader = config.header || '';
            const mapHeader = document.getElementById('map-header');
            if (mapHeader && currentProjectHeader) {
                mapHeader.textContent = currentProjectHeader;
            }

            // Setup single active project geology and extract dynamic legend directly from data source
            setProjectGeology(map, baseMapLayers, config, (legendItems) => {
                updateGeologyLegend(legendItems);
            });

            return loadCSV(config.dataFile);
        })
        .then(data => {
            console.log(`Successfully loaded data for '${currentRepo}'`);
            processData(data);
        })
        .catch(err => {
            console.error(`Failed to load project '${currentRepo}':`, err);
        });
}

function loadInitialRepoFromURL() {
    const { repo, viewParam, basemapKey, yearParam } = parseAppUrl();
    loadProject(repo, viewParam, basemapKey, yearParam, false);
}
loadInitialRepoFromURL();

// Listen for browser Back/Forward navigation
window.addEventListener('popstate', () => {
    const { repo, viewParam, basemapKey, yearParam } = parseAppUrl();
    const repoChanged = (repo !== currentRepo);
    const viewChanged = (viewParam !== currentViewParam);

    if (repoChanged) {
        loadProject(repo, viewParam, basemapKey, yearParam, false);
    } else {
        if (viewChanged) {
            currentViewParam = viewParam;
            setBasemapUIAndLayer(basemapKey, false);
        }
        if (yearParam !== null && yearParam !== undefined && !isNaN(yearParam)) {
            pauseAnimation();
            currentYear = Math.max(minYear, Math.min(maxYear, yearParam));
            syncUI();
        }
    }
});

// 2b. Open Project Dropdown Logic
const openBtn = document.getElementById('open-btn');
const openDropdown = document.getElementById('open-dropdown');

if (openBtn && openDropdown) {
    openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = openDropdown.style.display === 'flex' || openDropdown.style.display === 'block';
        
        if (isVisible) {
            openDropdown.style.display = 'none';
        } else {
            openDropdown.style.display = 'flex';
            openDropdown.innerHTML = '<div class="dropdown-item" style="color: #94a3b8; cursor: default;">Loading projects...</div>';
            
            fetchProjectsList()
                .then(projects => {
                    openDropdown.innerHTML = '';
                    if (!projects || projects.length === 0) {
                        openDropdown.innerHTML = '<div class="dropdown-item" style="color: #94a3b8; cursor: default;">No projects found</div>';
                        return;
                    }
                    
                    projects.forEach(proj => {
                        const item = document.createElement('div');
                        item.className = 'dropdown-item';
                        item.textContent = proj.header || proj.repo;
                        item.title = `Open ${proj.header || proj.repo} (${proj.repo})`;
                        
                        item.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            openDropdown.style.display = 'none';
                            loadProject(proj.repo, currentViewParam, null, null, true);
                        });
                        
                        openDropdown.appendChild(item);
                    });
                })
                .catch(err => {
                    openDropdown.innerHTML = `<div class="dropdown-item" style="color: #ef4444; cursor: default;">Error: ${err.message}</div>`;
                });
        }
    });

    // Close open dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!openDropdown.contains(e.target) && e.target !== openBtn) {
            openDropdown.style.display = 'none';
        }
    });
}

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        pauseAnimation();
        initialTargetYear = null;
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                processData(results.data);
            },
            error: (err) => alert('CSV Error: ' + err.message)
        });
    }
});

// Global variable to keep track of current highlighted row in the sidebar
let currentHighlightedRow = null;

// Map to store current site markers by location name
const currentMarkers = new Map();

/**
 * Updates the map header text content based on loaded survey properties.
 * @param {Array<Object>} locationsList 
 */
function updateMapHeaderTitle(locationsList) {
    const mapHeader = document.getElementById('map-header');
    if (!mapHeader) return;

    if (currentProjectHeader) {
        mapHeader.textContent = currentProjectHeader;
        return;
    }

    const headerLoc = locationsList.find(l => l['location name'] && l['location name'].toLowerCase().trim() === 'header');
    if (headerLoc) {
        let headerText = '';
        if (headerLoc.periods && headerLoc.periods.length > 0) {
            headerText = headerLoc.periods[0][3] || headerLoc.periods[0][2] || '';
        }
        if (!headerText) {
            headerText = headerLoc.description || headerLoc.title || '';
        }
        if (headerText) {
            mapHeader.textContent = headerText;
            return;
        }
    }

    const isTimna = locationsList.some(l => l['location name'] && l['location name'].toLowerCase().includes('site_'));
    if (isTimna) {
        mapHeader.textContent = "Timna Valley Archaeological Sites & Features";
    } else {
        mapHeader.textContent = "Geographical Archaeological Trends";
    }
}

/**
 * Updates sliders, indicators, tick marks, and period bands.
 * @param {number} minY 
 * @param {number} maxY 
 */
function initializeTimelineControls(minY, maxY, targetYear = null) {
    if (targetYear !== null && targetYear !== undefined && !isNaN(targetYear)) {
        currentYear = Math.max(minY, Math.min(maxY, targetYear));
    } else {
        currentYear = minY;
    }
    updateIndicator(currentYear);
    drawRulerMarkers(minY, maxY);
    drawPeriodBands(minY, maxY);
}

function processData(rawData) {
    // 1. Normalize raw data rows
    const parsedLocations = normalizeLocationData(rawData);

    if (parsedLocations.length === 0) {
        alert('Invalid CSV data structure. Please use columns: location name, latitude, longitude, start year, end time, title, description');
        return;
    }

    locations = parsedLocations;

    // 2. Set Map Header Title
    updateMapHeaderTitle(locations);

    // 3. Compute global boundaries
    const boundsObj = determineYearBounds(locations);
    minYear = boundsObj.minYear;
    maxYear = boundsObj.maxYear;
    eventYears = boundsObj.eventYears;

    // 4. Draw timeline components & initialize target year
    initializeTimelineControls(minYear, maxYear, initialTargetYear);

    // 5. Enable control buttons
    playPauseBtn.disabled = false;
    resetBtn.disabled = false;
    nextBtn.disabled = false;
    prevBtn.disabled = false;

    // 6. Reset table & markers
    dataTableBody.innerHTML = '';
    syncUI();

    // 7. Auto-pan/zoom map to fit all points
    const visibleLocations = locations.filter(loc => {
        const n = loc['location name'].toLowerCase().trim();
        return n !== 'footer' && n !== 'header';
    });
    if (visibleLocations.length > 0) {
        const bounds = L.latLngBounds(visibleLocations.map(l => [l.latitude, l.longitude]));
        map.fitBounds(bounds.pad(0.1));
    }
}

// 3. Animation Logic

function setPlayState(playing) {
    if (playing) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

playPauseBtn.addEventListener('click', () => {
    if (isRunning) {
        pauseAnimation();
    } else {
        startAnimation();
    }
});

function startAnimation() {
    if (isRunning || currentYear >= maxYear) return;

    const nextTimestamp = eventYears.find(y => y > currentYear);
    if (nextTimestamp === undefined) return;

    isRunning = true;
    segmentStartYear = currentYear;
    segmentEndYear = nextTimestamp;
    segmentStartTime = performance.now();

    setPlayState(true);
    requestAnimationFrame(animationStep);
}

function pauseAnimation() {
    isRunning = false;
    setPlayState(false);
}

resetBtn.addEventListener('click', () => {
    pauseAnimation();
    currentYear = minYear;
    syncUI();
});

nextBtn.addEventListener('click', () => {
    pauseAnimation();
    const nextYear = eventYears.find(y => y > currentYear);
    if (nextYear !== undefined) {
        currentYear = nextYear;
        syncUI();
    }
});

prevBtn.addEventListener('click', () => {
    pauseAnimation();
    // Find largest event year strictly less than currentYear
    const prevYear = [...eventYears].reverse().find(y => y < currentYear);
    if (prevYear !== undefined) {
        currentYear = prevYear;
        syncUI();
    }
});

function syncUI() {
    updateIndicator(currentYear);
    updateMarkers(currentYear);
}

function animationStep(timestamp) {
    if (!isRunning) return;

    const elapsed = timestamp - segmentStartTime;
    const progress = Math.min(elapsed / segmentDuration, 1);

    // Interpolate current year within this segment
    currentYear = segmentStartYear + progress * (segmentEndYear - segmentStartYear);
    syncUI();

    if (progress < 1) {
        requestAnimationFrame(animationStep);
    } else {
        // We reached the end of this segment
        currentYear = segmentEndYear;
        syncUI();

        // Find next segment
        const nextTimestamp = eventYears.find(y => y > currentYear);
        if (nextTimestamp !== undefined) {
            segmentStartYear = currentYear;
            segmentEndYear = nextTimestamp;
            segmentStartTime = timestamp - (elapsed - segmentDuration); // adjust for overshoot
            requestAnimationFrame(animationStep);
        } else {
            pauseAnimation();
        }
    }
}



// Add a beautiful Map Legend
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.background = 'rgba(255, 255, 255, 0.35)'; // Frosted glass light background
    div.style.color = '#020617'; // Dark slate text for legibility
    div.style.padding = '12px 16px';
    div.style.borderRadius = '8px';
    div.style.border = '1px solid rgba(0, 0, 0, 0.15)';
    div.style.backdropFilter = 'blur(8px)';
    div.style.fontSize = '12px';
    div.style.fontFamily = 'Inter, sans-serif';
    const initialUrlState = parseAppUrl();
    const isInitialGeo = (initialUrlState.basemapKey === 'geologic');
    div.style.maxHeight = isInitialGeo ? '520px' : '320px';
    div.style.overflowY = 'auto';
    div.style.pointerEvents = 'auto'; // allow scrolling legend
    div.style.width = '320px'; // Fixed width to neatly accommodate 2 columns
    div.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'; // Beautiful smooth layout transitions!

    const labels = {
        'mining': 'Mining',
        'open_mining': 'Open Mining',
        'smelting': 'Smelting / Slag',
        'workshop': 'Workshop',
        'stone': 'Stone Feature',
        'burial': 'Burial / Tumulus',
        'cultic': 'Cultic / Shrine',
        'petroglyph': 'Petroglyph / Inscription',
        'ceramics': 'Ceramics / Pottery',
        'quarrying': 'Quarrying',
        'hunting': 'Hunting / Trap',
        'unknown': 'Unknown / Other'
    };

    let legendHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 0, 0, 0.15); padding-bottom: 5px; margin-bottom: 8px;">
            <h4 style="margin: 0; font-family: 'Outfit', sans-serif; font-size: 14px;">Legend</h4>
            <button class="legend-toggle-btn" style="background: transparent; border: none; cursor: pointer; color: inherit; display: flex; align-items: center; padding: 2px;" title="Minimize/Maximize">
                <svg class="toggle-icon-min" viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
                </svg>
                <svg class="toggle-icon-max" viewBox="0 0 24 24" width="16" height="16" style="display: none;">
                    <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
            </button>
        </div>
        <div class="legend-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 12px;">
    `;

    for (let key in labels) {
        legendHtml += `
            <div style="display: flex; align-items: center; gap: 8px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" title="${labels[key]}">
                <img src="icons/${key}.png" style="width: 20px; height: 20px; flex-shrink: 0;" />
                <span style="overflow: hidden; text-overflow: ellipsis;">${labels[key]}</span>
            </div>
        `;
    }

    legendHtml += `</div>
        <div id="geology-legend-section" class="geology-legend-section" style="display: none; margin-top: 10px; border-top: 1px solid rgba(0,0,0,0.15); padding-top: 8px;">
            <h5 style="margin: 0 0 6px 0; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;">Geology Units</h5>
            <div class="geology-legend-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 8px; font-size: 11px;">
            </div>
        </div>
    `;
    div.innerHTML = legendHtml;

    // Attach Toggle logic for Minimize / Maximize
    const toggleBtn = div.querySelector('.legend-toggle-btn');
    const grid = div.querySelector('.legend-grid');
    const iconMin = div.querySelector('.toggle-icon-min');
    const iconMax = div.querySelector('.toggle-icon-max');

    let isMinimized = false;
    toggleBtn.addEventListener('click', (e) => {
        L.DomEvent.stopPropagation(e);
        isMinimized = !isMinimized;
        if (isMinimized) {
            grid.style.display = 'none';
            iconMin.style.display = 'none';
            iconMax.style.display = 'block';
            div.style.width = '120px';
            div.style.maxHeight = '40px';
            div.style.overflowY = 'hidden';
            div.style.padding = '8px 12px';
        } else {
            grid.style.display = 'grid';
            iconMin.style.display = 'block';
            iconMax.style.display = 'none';
            div.style.width = '320px';
            const isGeologic = document.querySelector('.basemap-btn[data-basemap="geologic"]')?.classList.contains('active');
            div.style.maxHeight = isGeologic ? '520px' : '320px';
            div.style.overflowY = 'auto';
            div.style.padding = '12px 16px';
        }
    });

    // Auto-collapse legend on mobile
    if (window.innerWidth <= 768) {
        isMinimized = true;
        grid.style.display = 'none';
        iconMin.style.display = 'none';
        iconMax.style.display = 'block';
        div.style.maxHeight = '40px';
        div.style.overflowY = 'hidden';
        div.style.padding = '8px 12px';
    }

    // Disable Map Clicks/Drags through the Legend control pane
    L.DomEvent.disableClickPropagation(div);

    return div;
};

legend.addTo(map);

// Sync initial basemap UI state (ensures geology legend visibility is updated once legend DOM exists)
const initialUrl = parseAppUrl();
setBasemapUIAndLayer(initialUrl.basemapKey, false);

function drawRulerMarkers(minY, maxY) {
    const markersContainer = document.getElementById('ruler-markers');
    markersContainer.innerHTML = '';

    const range = maxY - minY;
    if (range <= 0) return;

    // Find the first multiple of 1000 >= minY
    const startMillennium = Math.ceil(minY / 1000) * 1000;

    for (let y = startMillennium; y <= maxY; y += 1000) {
        const percentage = ((y - minY) / range) * 100;

        const marker = document.createElement('div');
        marker.className = 'ruler-tick';
        marker.style.left = `${percentage}%`;

        const label = document.createElement('div');
        label.className = 'ruler-label';
        label.textContent = formatYearLabel(y);

        marker.appendChild(label);
        markersContainer.appendChild(marker);
    }
}

function drawPeriodBands(minY, maxY) {
    const container = document.getElementById('ruler-periods');
    if (!container) return;
    container.innerHTML = '';

    const range = maxY - minY;
    if (range <= 0) return;

    HISTORICAL_PERIODS.forEach(period => {
        // Calculate overlap with current range
        const overlapStart = Math.max(period.start, minY);
        const overlapEnd = Math.min(period.end, maxY);

        if (overlapStart < overlapEnd) {
            const left = ((overlapStart - minY) / range) * 100;
            const width = ((overlapEnd - overlapStart) / range) * 100;

            const band = document.createElement('div');
            band.className = 'ruler-period-band';
            band.style.left = `${left}%`;
            band.style.width = `${width}%`;
            band.style.backgroundColor = period.color;
            band.title = `${period.name} (${formatYearLabel(period.start)} - ${formatYearLabel(period.end)})`;

            // Lower the threshold to 0.8% since short names (like LB, EI, Rom, Byz, Mod) fit in extremely narrow bands
            if (width >= 0.8) {
                const label = document.createElement('span');
                label.textContent = period.name;
                band.appendChild(label);
            }

            container.appendChild(band);
        }
    });
}

// 3b. Time Ruler Interactive Click & Drag Scrubbing
(function initTimeRulerInteraction() {
    const timeRulerContainer = document.getElementById('time-ruler-container');
    if (!timeRulerContainer) return;

    let isDraggingRuler = false;

    function handleRulerInteraction(e) {
        if (!locations || locations.length === 0 || maxYear <= minYear) return;
        const timeRuler = document.getElementById('time-ruler');
        if (!timeRuler) return;

        const rect = timeRuler.getBoundingClientRect();
        if (rect.width <= 0) return;

        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
        const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newYear = calculateYearFromProgress(progress, minYear, maxYear);

        pauseAnimation();
        currentYear = newYear;
        syncUI();
        updateUrlState(currentRepo, currentViewParam, currentYear, false);
    }

    timeRulerContainer.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDraggingRuler = true;
        handleRulerInteraction(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDraggingRuler) return;
        handleRulerInteraction(e);
    });

    window.addEventListener('mouseup', () => {
        isDraggingRuler = false;
    });

    timeRulerContainer.addEventListener('touchstart', (e) => {
        isDraggingRuler = true;
        handleRulerInteraction(e);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isDraggingRuler) return;
        handleRulerInteraction(e);
    }, { passive: true });

    window.addEventListener('touchend', () => {
        isDraggingRuler = false;
    });

    window.addEventListener('touchcancel', () => {
        isDraggingRuler = false;
    });
})();

// 4. Update Map Markers
function updateMarkers(year) {
    markerGroup.clearLayers();
    highlightLayer.clearLayers();
    const mapFooter = document.getElementById('map-footer');
    let footerText = '';

    let count = 0;
    locations.forEach(loc => {
        if (loc['location name'].toLowerCase().trim() === 'footer') {
            // Footer specifically disappears exactly ON its end year
            const footerActive = loc.periods.find(p => year >= p[0] && year < p[1]);
            if (footerActive) {
                // p is [start, end, title, description]
                footerText = footerActive[3] || footerActive[2] || '';
            }
            return; // Skip normal marker logic
        }

        // Show normal locations if current year is within ANY of their periods
        const activePeriod = loc.periods.find(p => year >= p[0] && year <= p[1]);
        if (activePeriod) {
            // Calculate a dynamic threshold: max 10 years, but never more than half the period's total lifespan.
            // This prevents locations with short lifespans (like Tirtsa's 10 years) from starting immediately with a destroy icon.
            const lifespan = activePeriod[1] - activePeriod[0];
            const dynamicThreshold = Math.min(DESTROY_THRESHOLD, lifespan / 2);

            const isNearEnd = (activePeriod[1] - year) <= dynamicThreshold;

            // Resolve custom icon based on type
            const typeVal = activePeriod[2] || loc.title || loc.type || '';
            const customIcon = getIconForType(typeVal);

            let currentIcon;
            if (isNearEnd && (typeVal.toLowerCase().includes('destroy') || !typeVal)) {
                currentIcon = destroyIcon;
            } else if (customIcon) {
                currentIcon = customIcon;
            } else {
                currentIcon = isNearEnd ? destroyIcon : starIcon;
            }

            const marker = L.marker([loc.latitude, loc.longitude], { icon: currentIcon });

            // Add click listener to highlight nearest smelting site
            marker.on('click', () => {
                handleMarkerClick(loc, activePeriod, marker);
            });

            // Add label under the icon on mouse hover
            marker.bindTooltip(loc['location name'], {
                permanent: false,
                direction: 'bottom',
                className: 'map-label',
                offset: [0, 16] // Better offset for hover tooltips
            });

            // Calculate overall min/max years across all periods
            const starts = loc.periods.map(p => p[0]);
            const ends = loc.periods.map(p => p[1]);
            const locMinYear = Math.min(...starts);
            const locMaxYear = Math.max(...ends);

            // Use the active period's title and description if available, otherwise fallback
            const title = activePeriod[2] || loc.title || '';
            const desc = activePeriod[3] || loc.description || '';
            const iconKey = getIconKeyForType(typeVal);
            const clickableDesc = makeLinksClickable(desc);

            // Add popup with Title, Description, Type Icon and Custom CSS Class
            marker.bindPopup(`
                <div style="font-family: inherit; min-width: 180px;">
                    <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); padding-bottom: 6px; margin-bottom: 8px;">
                        <img src="icons/${iconKey}.png" style="width: 24px; height: 24px; flex-shrink: 0;" title="${typeVal || 'Type'}" />
                        <h3 style="margin: 0; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; color: #020617;">${loc['location name']}</h3>
                    </div>
                    <div style="font-size: 12px; color: #334155; line-height: 1.4; margin-bottom: 8px;">
                        <strong>Type:</strong> ${title || 'Unknown'}<br>
                        ${clickableDesc ? `<p style="margin: 6px 0 0 0;">${clickableDesc}</p>` : ''}
                    </div>
                    <div style="font-size: 11px; color: #475569; border-top: 1px dashed rgba(0, 0, 0, 0.1); padding-top: 6px;">
                        <strong>Historical Lifespan:</strong> ${formatYearLabel(locMinYear)} to ${formatYearLabel(locMaxYear)}
                    </div>
                </div>
            `, {
                className: 'custom-leaflet-popup'
            });

            markerGroup.addLayer(marker);
            count++;
        }
    });

    if (footerText) {
        // Apply text formatting rules
        let formattedText = footerText.replace(/#/g, ',');
        // Add a line break after . or ? if followed by a space
        formattedText = formattedText.replace(/([.?])\s+/g, '$1<br>');

        mapFooter.innerHTML = formattedText;
        mapFooter.style.display = 'block';
    } else {
        mapFooter.style.display = 'none';
    }

    updateDashboard();
    updateTable();
    console.log(`Updated markers for year ${Math.round(year)}. Count: ${count}`);
}

// 5. Active Features Dashboard Control (Top Right)
const dashboard = L.control({ position: 'topright' });

dashboard.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info dashboard-pane');
    div.style.background = 'rgba(255, 255, 255, 0.35)'; // Frosted glass light background
    div.style.color = '#020617'; // Dark slate text for legibility
    div.style.padding = '12px 16px';
    div.style.borderRadius = '8px';
    div.style.border = '1px solid rgba(0, 0, 0, 0.15)';
    div.style.backdropFilter = 'blur(8px)';
    div.style.fontSize = '13px';
    div.style.fontFamily = 'Inter, sans-serif';
    div.style.width = '240px';
    div.style.pointerEvents = 'auto';

    div.innerHTML = `
        <h4 style="margin: 0 0 10px 0; font-family: 'Outfit', sans-serif; font-size: 15px; border-bottom: 1px solid rgba(0, 0, 0, 0.15); padding-bottom: 5px;">Active Features Dashboard</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="icons/mining.png" style="width: 18px; height: 18px;" />
                    <span>Mining Features:</span>
                </div>
                <strong id="dash-mining-count" style="color: #2563eb; font-size: 16px;">0</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="icons/smelting.png" style="width: 18px; height: 18px;" />
                    <span>Smelting Features:</span>
                </div>
                <strong id="dash-smelting-count" style="color: #059669; font-size: 16px;">0</strong>
            </div>
            <div style="margin-top: 6px; font-size: 11px; color: #475569; text-align: center; border-top: 1px dashed rgba(0, 0, 0, 0.15); padding-top: 6px;">
                Currently in Viewport
            </div>
        </div>
    `;

    // Disable Map Clicks/Drags through the Dashboard control pane
    L.DomEvent.disableClickPropagation(div);

    return div;
};

dashboard.addTo(map);

function updateDashboard() {
    const miningEl = document.getElementById('dash-mining-count');
    const smeltingEl = document.getElementById('dash-smelting-count');
    if (!miningEl || !smeltingEl) return;

    let miningCount = 0;
    let smeltingCount = 0;

    const bounds = map.getBounds();

    locations.forEach(loc => {
        if (loc['location name'].toLowerCase().trim() === 'footer') return;

        // Check if active during the current year
        const activePeriod = loc.periods.find(p => currentYear >= p[0] && currentYear <= p[1]);
        if (activePeriod) {
            // Check if inside the current map viewport
            const latLng = L.latLng(loc.latitude, loc.longitude);
            if (bounds.contains(latLng)) {
                const typeVal = (activePeriod[2] || loc.title || loc.type || '').toLowerCase().trim();
                
                // Mining features
                if (typeVal.includes('mining') || typeVal.includes('shaft') || typeVal.includes('gallery')) {
                    miningCount++;
                }
                // Smelting features
                else if (typeVal.includes('smelting') || typeVal.includes('slag') || typeVal.includes('furnace')) {
                    smeltingCount++;
                }
            }
        }
    });

    miningEl.textContent = miningCount;
    smeltingEl.textContent = smeltingCount;
}

function updateTable() {
    if (!dataTableBody) return;
    dataTableBody.innerHTML = '';

    const bounds = map.getBounds();
    const visibleLocs = [];

    locations.forEach(loc => {
        if (loc['location name'].toLowerCase().trim() === 'footer') return;

        // Check if active during the current year
        const activePeriod = loc.periods.find(p => currentYear >= p[0] && currentYear <= p[1]);
        if (activePeriod) {
            // Check if inside the current map viewport bounds
            const latLng = L.latLng(loc.latitude, loc.longitude);
            if (bounds.contains(latLng)) {
                visibleLocs.push({ loc, activePeriod });
            }
        }
    });

    if (visibleLocs.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align: center; color: var(--text-dim); padding: 2rem;">No visible features in this area / time</td>`;
        dataTableBody.appendChild(tr);
        return;
    }

    visibleLocs.forEach(({ loc, activePeriod }) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.className = 'table-row-interactive';
        
        const typeVal = activePeriod[2] || loc.title || loc.type || '';
        const iconKey = getIconKeyForType(typeVal);

        const starts = loc.periods.map(p => p[0]);
        const ends = loc.periods.map(p => p[1]);
        const locMinYear = Math.min(...starts);
        const locMaxYear = Math.max(...ends);

        // List of custom colored icons that should NOT be inverted to white
        const coloredIcons = ['mining', 'smelting', 'cultic', 'petroglyph'];
        const shouldInvert = !coloredIcons.includes(iconKey);

        tr.innerHTML = `
            <td style="text-align: center; vertical-align: middle;">
                <img src="icons/${iconKey}.png" class="table-type-icon${shouldInvert ? ' icon-invert' : ''}" title="${typeVal || 'Unknown'}" />
            </td>
            <td>
                <span class="table-loc-name">${loc['location name']}</span>
            </td>
            <td>${formatYearLabel(locMinYear)}</td>
            <td>${formatYearLabel(locMaxYear)}</td>
        `;

        tr.addEventListener('click', () => {
            // Find the marker for this location in markerGroup
            markerGroup.eachLayer(m => {
                if (m.getLatLng().lat === loc.latitude && m.getLatLng().lng === loc.longitude) {
                    m.openPopup();
                    handleMarkerClick(loc, activePeriod, m);
                }
            });
        });

        dataTableBody.appendChild(tr);
    });
}

// Update dashboard and table when map is panned or zoomed
map.on('moveend', () => {
    updateDashboard();
    updateTable();
});

// Click listener on map background to clear active highlights
map.on('click', () => {
    highlightLayer.clearLayers();
});

// 6. Highlight Nearest Smelting Site on Mining Site Click / Catchment Mining Sites on Smelting Site Click
function handleMarkerClick(clickedLoc, clickedPeriod, clickedMarker) {
    highlightLayer.clearLayers();

    const typeVal = (clickedPeriod[2] || clickedLoc.title || clickedLoc.type || '').toLowerCase().trim();
    const isMining = typeVal.includes('mining') || typeVal.includes('shaft') || typeVal.includes('gallery');
    const isSmelting = typeVal.includes('smelting') || typeVal.includes('slag') || typeVal.includes('furnace');

    const clickedLatLng = L.latLng(clickedLoc.latitude, clickedLoc.longitude);

    if (isMining) {
        let nearestSmelting = null;
        let minDistance = Infinity;

        locations.forEach(loc => {
            if (loc['location name'] === clickedLoc['location name']) return;
            if (loc['location name'].toLowerCase().trim() === 'footer') return;

            // Check if the site is active during the current year
            const activePeriod = loc.periods.find(p => currentYear >= p[0] && currentYear <= p[1]);
            if (activePeriod) {
                const periodType = (activePeriod[2] || loc.title || loc.type || '').toLowerCase().trim();
                const isSm = periodType.includes('smelting') || periodType.includes('slag') || periodType.includes('furnace');

                if (isSm) {
                    const smeltingLatLng = L.latLng(loc.latitude, loc.longitude);
                    const distance = clickedLatLng.distanceTo(smeltingLatLng); // distance in meters

                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestSmelting = {
                            loc: loc,
                            latLng: smeltingLatLng,
                            activePeriod: activePeriod
                        };
                    }
                }
            }
        });

        if (nearestSmelting) {
            const distanceKm = (minDistance / 1000).toFixed(2);

            // 1. Draw an elegant green dashed line connecting the sites
            const polyline = L.polyline([clickedLatLng, nearestSmelting.latLng], {
                color: '#10b981', // Sleek green accent color
                weight: 3,
                dashArray: '8, 8',
                opacity: 0.8,
                className: 'connecting-highlight-line'
            }).addTo(highlightLayer);

            // 2. Draw a glowing highlight circle around the nearest smelting site
            L.circleMarker(nearestSmelting.latLng, {
                radius: 22,
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.15,
                weight: 2,
                className: 'glowing-highlight-circle'
            }).addTo(highlightLayer);

            // 3. Open a sleek popup near the midpoint of the line showing the relationship details
            polyline.bindPopup(`
                <div style="font-family: inherit; font-size: 12px; min-width: 160px; text-align: center;">
                    <strong style="color: var(--accent-secondary); font-size: 13px;">Nearest Smelting Site</strong><br>
                    <span style="font-size: 14px; font-weight: 700; display: inline-block; margin: 4px 0;">${nearestSmelting.loc['location name']}</span><br>
                    <div style="border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 4px; margin-top: 4px;">
                        Distance: <strong>${distanceKm} km</strong>
                    </div>
                </div>
            `, {
                className: 'custom-leaflet-popup'
            }).openPopup();
        }
    } else if (isSmelting) {
        const matchingMiningSites = [];

        // 1. Gather all currently active smelting sites on the map
        const activeSmeltingSites = [];
        locations.forEach(loc => {
            if (loc['location name'].toLowerCase().trim() === 'footer') return;
            const activePeriod = loc.periods.find(p => currentYear >= p[0] && currentYear <= p[1]);
            if (activePeriod) {
                const periodType = (activePeriod[2] || loc.title || loc.type || '').toLowerCase().trim();
                const isSm = periodType.includes('smelting') || periodType.includes('slag') || periodType.includes('furnace');
                if (isSm) {
                    activeSmeltingSites.push({
                        loc: loc,
                        latLng: L.latLng(loc.latitude, loc.longitude)
                    });
                }
            }
        });

        // 2. Find all active mining sites for which this clicked smelting site is their closest neighbor
        locations.forEach(loc => {
            if (loc['location name'] === clickedLoc['location name']) return;
            if (loc['location name'].toLowerCase().trim() === 'footer') return;

            const activePeriod = loc.periods.find(p => currentYear >= p[0] && currentYear <= p[1]);
            if (activePeriod) {
                const periodType = (activePeriod[2] || loc.title || loc.type || '').toLowerCase().trim();
                const isMin = periodType.includes('mining') || periodType.includes('shaft') || periodType.includes('gallery');

                if (isMin) {
                    const miningLatLng = L.latLng(loc.latitude, loc.longitude);
                    let closestSmelting = null;
                    let minDistance = Infinity;

                    activeSmeltingSites.forEach(sm => {
                        const dist = miningLatLng.distanceTo(sm.latLng);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestSmelting = sm;
                        }
                    });

                    // Match if the closest smelting site is this clicked one
                    if (closestSmelting && closestSmelting.loc['location name'] === clickedLoc['location name']) {
                        matchingMiningSites.push({
                            loc: loc,
                            latLng: miningLatLng,
                            distance: minDistance
                        });
                    }
                }
            }
        });

        // 3. Highlight connected mining sites with elegant blue lines and halos
        if (matchingMiningSites.length > 0) {
            matchingMiningSites.forEach(ms => {
                // Connecting blue dashed line
                L.polyline([clickedLatLng, ms.latLng], {
                    color: '#3b82f6', // Sleek blue supply line
                    weight: 2.5,
                    dashArray: '6, 6',
                    opacity: 0.75,
                    className: 'connecting-highlight-line'
                }).addTo(highlightLayer);

                // Glowing blue pulse halo around matching mining site
                L.circleMarker(ms.latLng, {
                    radius: 18,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.12,
                    weight: 2,
                    className: 'glowing-highlight-circle-blue'
                }).addTo(highlightLayer);
            });

            // Summary popup at clicked smelting site
            clickedMarker.bindPopup(`
                <div style="font-family: inherit; font-size: 12px; min-width: 180px; text-align: center;">
                    <strong style="color: var(--accent-primary); font-size: 13px;">Smelting Center Hub</strong><br>
                    <span style="font-size: 14px; font-weight: 700; display: inline-block; margin: 4px 0;">${clickedLoc['location name']}</span><br>
                    <div style="border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 6px; margin-top: 4px;">
                        Serving: <strong>${matchingMiningSites.length} active mining site${matchingMiningSites.length > 1 ? 's' : ''}</strong>
                    </div>
                </div>
            `, {
                className: 'custom-leaflet-popup'
            }).openPopup();
        } else {
            clickedMarker.bindPopup(`
                <div style="font-family: inherit; font-size: 12px; min-width: 180px; text-align: center;">
                    <strong style="color: var(--accent-primary); font-size: 13px;">Smelting Center Hub</strong><br>
                    <span style="font-size: 14px; font-weight: 700; display: inline-block; margin: 4px 0;">${clickedLoc['location name']}</span><br>
                    <div style="border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 6px; margin-top: 4px; color: var(--text-dim);">
                        No active mining sites are closest to this smelting center.
                    </div>
                </div>
            `, {
                className: 'custom-leaflet-popup'
            }).openPopup();
        }
    }
}

// =====================================================
// MOBILE SIDEBAR DRAWER TOGGLE LOGIC
// =====================================================
(function () {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (!menuToggle || !sidebar || !backdrop) return;

    function openDrawer() {
        sidebar.classList.add('open');
        backdrop.classList.add('active');
        menuToggle.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
    }

    // Hamburger button opens the drawer
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar.classList.contains('open')) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    // Close button (inside drawer) closes it
    if (sidebarClose) {
        sidebarClose.addEventListener('click', () => closeDrawer());
    }

    // Tapping the backdrop closes the drawer
    backdrop.addEventListener('click', () => closeDrawer());

    // Auto-close drawer on mobile after selecting a file or pressing play
    const isMobile = () => window.innerWidth <= 768;

    // Close after tapping a dropdown file item
    document.addEventListener('click', (e) => {
        if (!isMobile()) return;
        if (e.target.classList.contains('dropdown-item')) {
            setTimeout(() => closeDrawer(), 200);
        }
    });

    // Close drawer after play button is tapped on mobile
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (isMobile()) setTimeout(() => closeDrawer(), 300);
        });
    }
})();

// Ensure Leaflet recalculates map size after layout settles on mobile
// (fixes hit-testing offset when sidebar collapses the grid on first load)
window.addEventListener('load', () => {
    setTimeout(() => map.invalidateSize(), 100);
});

// =====================================================
// MOBILE MAP NAV BUTTONS (Prev / Next)
// =====================================================
(function () {
    const mobilePrevBtn = document.getElementById('mobile-prev-btn');
    const mobileNextBtn = document.getElementById('mobile-next-btn');

    if (!mobilePrevBtn || !mobileNextBtn) return;

    // Delegate clicks to the existing sidebar prev/next buttons
    mobilePrevBtn.addEventListener('click', () => { prevBtn.click(); mobilePrevBtn.blur(); });
    mobileNextBtn.addEventListener('click', () => { nextBtn.click(); mobileNextBtn.blur(); });

    // Force blur on touch release to prevent stuck styles on iOS/mobile browsers
    mobilePrevBtn.addEventListener('touchend', () => { setTimeout(() => mobilePrevBtn.blur(), 50); });
    mobileNextBtn.addEventListener('touchend', () => { setTimeout(() => mobileNextBtn.blur(), 50); });

    // Keep disabled state in sync with the sidebar buttons
    function syncDisabled() {
        mobilePrevBtn.disabled = prevBtn.disabled;
        mobileNextBtn.disabled = nextBtn.disabled;
    }

    const observer = new MutationObserver(syncDisabled);
    observer.observe(prevBtn, { attributes: true, attributeFilter: ['disabled'] });
    observer.observe(nextBtn, { attributes: true, attributeFilter: ['disabled'] });

    syncDisabled(); // Apply initial state
})();
