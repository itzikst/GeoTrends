/**
 * GeoTrends - Application Logic
 * 1. Initialize Map
 * 2. Handle CSV Upload
 * 3. Animate over 60 seconds
 * 4. Filter markers by Year
 */

// Leaflet CDN Icon Path Fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Global State
let locations = [];
let minYear = 0;
let maxYear = 0;
let currentYear = 0;
let isRunning = false;
let lastTimestamp = 0;
let elapsedTime = 0;
let eventYears = [];
const totalDuration = 60000; // 60 seconds in ms

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

// UI Helpers
function formatYearLabel(year) {
    if (year < 0) return Math.abs(year) + ' BC';
    if (year > 0) return year; // optionally add AD
    return '0';
}

function makeLinksClickable(text) {
    if (!text) return '';
    // Match URLs starting with http/https or www.
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
        let href = url;
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
            href = 'http://' + href;
        }
        return `<a href="${href}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${url}</a>`;
    });
}

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
const map = L.map('map', {
    maxZoom: 18 // Explicitly allow map zooming up to level 18
}).setView([32.5, 36.0], 8); // Center on Decapolis Region

// Bottom Layer: CartoDB Voyager (Provides clean land colors and blue water without labels)
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Top Layer: ESRI World Hillshade (Provides the sharp 3D relief information)
L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}?token=${ESRI_API_KEY}`, {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NGA, NASA, CGIAR, N Robinson, NCEAS, NLS, OS, NMA, Geodatastyrelsen, Rijkswaterstaat, GSA, Geoland, FEMA, Intermap and the GIS user community',
    className: 'hillshade-layer'
}).addTo(map);

// Layer Group to store active markers
const markerGroup = L.layerGroup().addTo(map);
const highlightLayer = L.layerGroup().addTo(map);

// 2. Handle CSV Upload
uploadBtn.addEventListener('click', () => fileInput.click());

// Auto-load a default CSV if it exists
function loadDefaultCSV() {
    const defaultFiles = ['data/timna_valley.csv', 'Timna_Converted.csv', 'data/iron_age_cities.csv', 'decapolis.csv'];

    let tryLoad = (index) => {
        if (index >= defaultFiles.length) {
            console.log('No default CSV loaded');
            return;
        }
        const file = defaultFiles[index];
        fetch(file)
            .then(response => {
                if (response.ok) return response.text();
                throw new Error('File not found');
            })
            .then(csvText => {
                console.log(`Successfully loaded default CSV: ${file}`);
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        processData(results.data);
                    }
                });
            })
            .catch(() => {
                tryLoad(index + 1);
            });
    };

    tryLoad(0);
}
loadDefaultCSV();

// 2b. Open Server File Dropdown Logic
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
            openDropdown.innerHTML = '<div class="dropdown-item" style="color: #475569; cursor: default;">Loading server files...</div>';
            
            fetch(`data/files.json?v=${Date.now()}`)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to load server files');
                    return res.json();
                })
                .then(files => {
                    openDropdown.innerHTML = '';
                    if (files.length === 0) {
                        openDropdown.innerHTML = '<div class="dropdown-item" style="color: #475569; cursor: default;">No CSV files found</div>';
                        return;
                    }
                    
                    files.forEach(fileName => {
                        const item = document.createElement('div');
                        item.className = 'dropdown-item';
                        item.textContent = fileName;
                        item.title = `Click to load data/${fileName}`;
                        
                        item.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            openDropdown.style.display = 'none';
                            
                            // Load the selected CSV from the server's data directory
                            const filePath = `data/${fileName}`;
                            fetch(filePath)
                                .then(response => {
                                    if (!response.ok) throw new Error(`Could not load ${fileName}`);
                                    return response.text();
                                })
                                .then(csvText => {
                                    console.log(`Successfully loaded selected server CSV: ${filePath}`);
                                    Papa.parse(csvText, {
                                        header: true,
                                        dynamicTyping: true,
                                        skipEmptyLines: true,
                                        complete: (results) => {
                                            processData(results.data);
                                        }
                                    });
                                })
                                .catch(err => {
                                    alert(`Error loading file: ${err.message}`);
                                });
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
    document.addEventListener('click', () => {
        openDropdown.style.display = 'none';
    });
}

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
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

function processData(rawData) {
    // 1. Group by name and merge periods
    const locationMap = new Map();

    rawData.forEach(row => {
        // Normalize keys
        const normalized = {};
        for (let key in row) {
            normalized[key.toLowerCase().trim()] = row[key];
        }

        const name = normalized['location name'] || normalized['entitylabel'] || '';
        const isFooter = name && name.toLowerCase().trim() === 'footer';

        const lat = Number(normalized['latitude'] !== undefined ? normalized['latitude'] : normalized['lat']);
        const lng = Number(normalized['longitude'] !== undefined ? normalized['longitude'] : normalized['lng']);

        if (!name || (!isFooter && (isNaN(lat) || isNaN(lng)))) return;

        const start = Number(normalized['start year'] !== undefined ? normalized['start year'] : normalized['start']);
        const end = Number(normalized['end time'] !== undefined ? normalized['end time'] : normalized['end']);
        const titleVal = normalized['title'] || normalized['type'] || '';
        const descVal = normalized['description'] || normalized['entity'] || '';

        // Store back normalized coordinates and name
        normalized.latitude = lat;
        normalized.longitude = lng;
        normalized['location name'] = name;

        if (locationMap.has(name)) {
            // Already exists, just add the period with its own title/description
            locationMap.get(name).periods.push([start, end, titleVal, descVal]);
        } else {
            // New location
            const locObj = {
                ...normalized,
                periods: [[start, end, titleVal, descVal]]
            };
            // Remove the single start/end properties to avoid confusion
            delete locObj['start year'];
            delete locObj['end time'];
            delete locObj['start'];
            delete locObj['end'];
            locationMap.set(name, locObj);
        }
    });

    locations = Array.from(locationMap.values());

    // Dynamically update map header title
    const mapHeader = document.getElementById('map-header');
    if (mapHeader) {
        const isTimna = locations.some(l => l['location name'] && l['location name'].toLowerCase().includes('site_'));
        if (isTimna) {
            mapHeader.textContent = "Timna Valley Archaeological Sites & Features";
        } else {
            mapHeader.textContent = "Geographical Archaeological Trends";
        }
    }

    locations = Array.from(locationMap.values());

    if (locations.length === 0) {
        alert('Invalid CSV data structure. Please use columns: location name, latitude, longitude, start year, end time, title, description');
        return;
    }

    // 2. Compute global min/max year
    let allStarts = [];
    let allEnds = [];
    locations.forEach(l => {
        l.periods.forEach(p => {
            allStarts.push(p[0]);
            allEnds.push(p[1]);
        });
    });

    minYear = Math.min(...allStarts);
    maxYear = Math.max(...allEnds);

    // Create sorted array of unique event years for hopping
    eventYears = Array.from(new Set([...allStarts, ...allEnds])).sort((a, b) => a - b);

    currentYear = minYear;
    elapsedTime = 0;
    updateIndicator(currentYear);
    drawRulerMarkers(minYear, maxYear);
    drawPeriodBands(minYear, maxYear);

    // Enable buttons
    playPauseBtn.disabled = false;
    resetBtn.disabled = false;
    nextBtn.disabled = false;
    prevBtn.disabled = false;

    // Clear table initially (will be dynamically populated by updateMarkers)
    dataTableBody.innerHTML = '';
    const visibleLocations = locations.filter(loc => loc['location name'].toLowerCase() !== 'footer');

    // Reset markers
    updateMarkers(currentYear);

    // Zoom to fit all points with a 10% border
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
    isRunning = true;
    lastTimestamp = performance.now();
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
    elapsedTime = 0;
    syncUI();
});

nextBtn.addEventListener('click', () => {
    pauseAnimation();
    const nextYear = eventYears.find(y => y > currentYear);
    if (nextYear !== undefined) {
        currentYear = nextYear;
        syncElapsedTime();
        syncUI();
    }
});

prevBtn.addEventListener('click', () => {
    pauseAnimation();
    // Find largest event year strictly less than currentYear
    const prevYear = [...eventYears].reverse().find(y => y < currentYear);
    if (prevYear !== undefined) {
        currentYear = prevYear;
        syncElapsedTime();
        syncUI();
    }
});

function syncElapsedTime() {
    if (maxYear === minYear) return;
    const progress = (currentYear - minYear) / (maxYear - minYear);
    elapsedTime = progress * totalDuration;
}

function syncUI() {
    updateIndicator(currentYear);
    updateMarkers(currentYear);
}

function animationStep(timestamp) {
    if (!isRunning) return;

    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    elapsedTime += delta;

    const progress = Math.min(elapsedTime / totalDuration, 1);

    // Update current year
    currentYear = minYear + progress * (maxYear - minYear);
    syncUI();

    if (progress < 1) {
        requestAnimationFrame(animationStep);
    } else {
        pauseAnimation();
    }
}

// Define Custom Icons
const starIcon = L.icon({
    iconUrl: 'tel.png',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
});

const destroyIcon = L.icon({
    iconUrl: 'destroy.png',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
});

// Map each type to an icon stored in the icons folder
const typeIcons = {};
const iconNames = [
    'unknown', 'burial', 'ceramics', 'cultic', 'hunting',
    'mining', 'open_mining', 'petroglyph', 'quarrying',
    'smelting', 'stone', 'workshop'
];

iconNames.forEach(name => {
    typeIcons[name] = L.icon({
        iconUrl: `icons/${name}.png`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
});

function getIconForType(type) {
    if (!type) return typeIcons['unknown'];
    const t = type.toLowerCase().trim();

    if (t.includes('burial') || t.includes('tumulus') || t.includes('cairn')) {
        return typeIcons['burial'];
    }
    if (t.includes('pottery') || t.includes('ceramics') || t.includes('flint')) {
        if (t.includes('pottery') || t.includes('ceramics')) {
            return typeIcons['ceramics'];
        }
        if (t.includes('flint')) {
            return typeIcons['stone'];
        }
    }
    if (t.includes('cultic') || t.includes('shrine')) {
        return typeIcons['cultic'];
    }
    if (t.includes('hunting') || t.includes('trap')) {
        return typeIcons['hunting'];
    }
    if (t.includes('open_mining') || t.includes('placer')) {
        return typeIcons['open_mining'];
    }
    if (t.includes('mining') || t.includes('shaft') || t.includes('gallery')) {
        return typeIcons['mining'];
    }
    if (t.includes('petroglyph') || t.includes('inscription')) {
        return typeIcons['petroglyph'];
    }
    if (t.includes('quarrying')) {
        return typeIcons['quarrying'];
    }
    if (t.includes('smelting') || t.includes('slag') || t.includes('furnace')) {
        return typeIcons['smelting'];
    }
    if (t.includes('stone') || t.includes('wall') || t.includes('feature') || t.includes('structure')) {
        return typeIcons['stone'];
    }
    if (t.includes('workshop')) {
        return typeIcons['workshop'];
    }

    // Check if the type matches any icon name exactly (case insensitive)
    for (let name of iconNames) {
        if (t === name.toLowerCase()) {
            return typeIcons[name];
        }
    }

    return typeIcons['unknown'];
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
    div.style.maxHeight = '320px';
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

    legendHtml += `</div>`;
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
            div.style.maxHeight = '320px';
            div.style.overflowY = 'auto';
            div.style.padding = '12px 16px';
        }
    });

    // Disable Map Clicks/Drags through the Legend control pane
    L.DomEvent.disableClickPropagation(div);

    return div;
};

legend.addTo(map);

const DESTROY_THRESHOLD = 10; // Years before hiding to show destruction icon

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

function getIconKeyForType(type) {
    if (!type) return 'unknown';
    const t = type.toLowerCase().trim();

    if (t.includes('burial') || t.includes('tumulus') || t.includes('cairn')) {
        return 'burial';
    }
    if (t.includes('pottery') || t.includes('ceramics') || t.includes('flint')) {
        if (t.includes('pottery') || t.includes('ceramics')) {
            return 'ceramics';
        }
        if (t.includes('flint')) {
            return 'stone';
        }
    }
    if (t.includes('cultic') || t.includes('shrine')) {
        return 'cultic';
    }
    if (t.includes('hunting') || t.includes('trap')) {
        return 'hunting';
    }
    if (t.includes('open_mining') || t.includes('placer')) {
        return 'open_mining';
    }
    if (t.includes('mining') || t.includes('shaft') || t.includes('gallery')) {
        return 'mining';
    }
    if (t.includes('petroglyph') || t.includes('inscription')) {
        return 'petroglyph';
    }
    if (t.includes('quarrying')) {
        return 'quarrying';
    }
    if (t.includes('smelting') || t.includes('slag') || t.includes('furnace')) {
        return 'smelting';
    }
    if (t.includes('stone') || t.includes('wall') || t.includes('feature') || t.includes('structure')) {
        return 'stone';
    }
    if (t.includes('workshop')) {
        return 'workshop';
    }

    // Check if the type matches any icon name exactly (case insensitive)
    for (let name of iconNames) {
        if (t === name.toLowerCase()) {
            return name;
        }
    }

    return 'unknown';
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

