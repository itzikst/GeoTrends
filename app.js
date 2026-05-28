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

// 2. Handle CSV Upload
uploadBtn.addEventListener('click', () => fileInput.click());

// Auto-load a default CSV if it exists
function loadDefaultCSV() {
    const defaultFiles = ['Timna1.csv', 'Timna_Converted.csv', 'iron_age_cities.csv', 'decapolis.csv'];

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

    // Populate table (showing first period as representative)
    dataTableBody.innerHTML = '';
    const visibleLocations = locations.filter(loc => loc['location name'].toLowerCase() !== 'footer');
    visibleLocations.slice(0, 15).forEach(loc => {
        const tr = document.createElement('tr');
        const firstP = loc.periods[0];
        tr.innerHTML = `
            <td>${loc['location name']} ${loc.periods.length > 1 ? `(${loc.periods.length} periods)` : ''}</td>
            <td>${firstP[0]}</td>
            <td>${firstP[1]}</td>
        `;
        dataTableBody.appendChild(tr);
    });

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
    'Unknown', 'burial', 'ceramics', 'cultic', 'hunting',
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
    if (!type) return typeIcons['Unknown'];
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

    return typeIcons['Unknown'];
}

// Add a beautiful Map Legend
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.background = 'rgba(15, 23, 42, 0.85)';
    div.style.color = 'var(--text-main)';
    div.style.padding = '12px 16px';
    div.style.borderRadius = '8px';
    div.style.border = '1px solid var(--border-color)';
    div.style.backdropFilter = 'blur(8px)';
    div.style.fontSize = '12px';
    div.style.fontFamily = 'Inter, sans-serif';
    div.style.maxHeight = '320px';
    div.style.overflowY = 'auto';
    div.style.pointerEvents = 'auto'; // allow scrolling legend
    div.style.width = '320px'; // Fixed width to neatly accommodate 2 columns

    let legendHtml = `
        <h4 style="margin: 0 0 8px 0; font-family: 'Outfit', sans-serif; font-size: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">Legend</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 12px;">
    `;

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
        'Unknown': 'Unknown / Other'
    };

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
    { name: 'Neolithic', start: -10000, end: -5800, color: 'rgba(59, 130, 246, 0.15)' },
    { name: 'Chalcolithic', start: -5800, end: -3600, color: 'rgba(16, 185, 129, 0.15)' },
    { name: 'EB', start: -3600, end: -2000, color: 'rgba(245, 158, 11, 0.15)' },
    { name: 'MB', start: -2000, end: -1500, color: 'rgba(239, 68, 68, 0.15)' },
    { name: 'LB', start: -1500, end: -1200, color: 'rgba(139, 92, 246, 0.15)' },
    { name: 'EI', start: -1200, end: -1000, color: 'rgba(236, 72, 153, 0.15)' },
    { name: 'LI', start: -1000, end: -586, color: 'rgba(20, 184, 166, 0.15)' },
    { name: 'Per', start: -586, end: -37, color: 'rgba(79, 70, 229, 0.15)' },
    { name: 'Rom', start: -37, end: 324, color: 'rgba(217, 70, 239, 0.15)' },
    { name: 'Byz', start: 324, end: 638, color: 'rgba(14, 165, 233, 0.15)' },
    { name: 'EM', start: 638, end: 1099, color: 'rgba(132, 204, 22, 0.15)' },
    { name: 'Cru', start: 1099, end: 1291, color: 'rgba(244, 63, 94, 0.15)' },
    { name: 'Mam', start: 1291, end: 1517, color: 'rgba(249, 115, 22, 0.15)' },
    { name: 'Ott', start: 1517, end: 1917, color: 'rgba(100, 116, 139, 0.15)' },
    { name: 'Mod', start: 1917, end: 2026, color: 'rgba(16, 185, 129, 0.2)' }
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

            // Add label under the icon on mouse hover
            marker.bindTooltip(loc['location name'], {
                permanent: false,
                direction: 'bottom',
                className: 'map-label',
                offset: [0, 16] // Better offset for hover tooltips
            });

            // Build periods string for popup
            const periodsHtml = loc.periods
                .map(p => `<li>${p[0]} to ${p[1]}</li>`)
                .join('');

            // Use the active period's title and description if available, otherwise fallback
            const title = activePeriod[2] || loc.title || '';
            const desc = activePeriod[3] || loc.description || '';

            // Add popup with Title & Description
            marker.bindPopup(`
                <div style="font-family: inherit; min-width: 150px;">
                    <h3 style="margin:0">${title}</h3>
                    <p style="margin:5px 0; font-size: 12px; color: #555;">${desc}</p>
                    <div style="font-size: 11px; margin-top: 8px; border-top: 1px solid #eee; padding-top: 5px;">
                        <strong>Historical Periods:</strong>
                        <ul style="margin: 5px 0; padding-left: 15px;">
                            ${periodsHtml}
                        </ul>
                    </div>
                </div>
            `);

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
    console.log(`Updated markers for year ${Math.round(year)}. Count: ${count}`);
}

// 5. Active Features Dashboard Control (Top Right)
const dashboard = L.control({ position: 'topright' });

dashboard.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info dashboard-pane');
    div.style.background = 'rgba(15, 23, 42, 0.85)';
    div.style.color = 'var(--text-main)';
    div.style.padding = '12px 16px';
    div.style.borderRadius = '8px';
    div.style.border = '1px solid var(--border-color)';
    div.style.backdropFilter = 'blur(8px)';
    div.style.fontSize = '13px';
    div.style.fontFamily = 'Inter, sans-serif';
    div.style.width = '240px';
    div.style.pointerEvents = 'auto';

    div.innerHTML = `
        <h4 style="margin: 0 0 10px 0; font-family: 'Outfit', sans-serif; font-size: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">Active Features Dashboard</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="icons/mining.png" style="width: 18px; height: 18px;" />
                    <span>Mining Features:</span>
                </div>
                <strong id="dash-mining-count" style="color: var(--accent-primary); font-size: 16px;">0</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="icons/smelting.png" style="width: 18px; height: 18px;" />
                    <span>Smelting Features:</span>
                </div>
                <strong id="dash-smelting-count" style="color: var(--accent-secondary); font-size: 16px;">0</strong>
            </div>
            <div style="margin-top: 6px; font-size: 11px; color: var(--text-dim); text-align: center; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px;">
                Currently in Viewport
            </div>
        </div>
    `;
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

// Update dashboard when map is panned or zoomed
map.on('moveend', updateDashboard);

