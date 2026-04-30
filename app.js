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
const currentYearValue = document.getElementById('current-year-value');
const timeIndicator = document.getElementById('time-indicator');

// UI Helpers
const updateYearDisplay = (year) => {
    currentYearValue.textContent = Math.round(year);
};

const updateIndicator = (year) => {
    const range = maxYear - minYear;
    const progress = (year - minYear) / range;
    timeIndicator.style.left = (progress * 100) + '%';
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

// Auto-load decapolis.csv if it exists
fetch('iron_age_cities.csv')
    .then(response => {
        if (response.ok) return response.text();
        throw new Error('Default CSV not found');
    })
    .then(csvText => {
        Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                processData(results.data);
            }
        });
    })
    .catch(err => console.log('No default CSV loaded:', err.message));

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

        const name = normalized['location name'];
        const isFooter = name && name.toLowerCase().trim() === 'footer';
        if (!name || (!isFooter && (!normalized['latitude'] || !normalized['longitude']))) return;

        const start = Number(normalized['start year']);
        const end = Number(normalized['end time']);

        if (locationMap.has(name)) {
            // Already exists, just add the period with its own title/description
            locationMap.get(name).periods.push([start, end, normalized.title, normalized.description]);
        } else {
            // New location
            const locObj = {
                ...normalized,
                periods: [[start, end, normalized.title, normalized.description]]
            };
            // Remove the single start/end properties to avoid confusion
            delete locObj['start year'];
            delete locObj['end time'];
            locationMap.set(name, locObj);
        }
    });

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
    updateYearDisplay(currentYear);
    updateIndicator(currentYear);

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
    updateYearDisplay(currentYear);
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
    iconUrl: 'star.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
});

const destroyIcon = L.icon({
    iconUrl: 'destroy.jpg',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
});

const DESTROY_THRESHOLD = 10; // Years before hiding to show destruction icon

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
            const currentIcon = isNearEnd ? destroyIcon : starIcon;

            const marker = L.marker([loc.latitude, loc.longitude], { icon: currentIcon });

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

    console.log(`Updated markers for year ${Math.round(year)}. Count: ${count}`);
}
