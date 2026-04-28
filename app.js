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
let animationStartTime = null;
const totalDuration = 60000; // 60 seconds in ms

// DOM Elements
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('csv-upload');
const runBtn = document.getElementById('run-btn');
const stopBtn = document.getElementById('stop-btn');
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
const map = L.map('map').setView([32.5, 36.0], 8); // Center on Decapolis Region

// Add OpenTopoMap layer (Topographic style)
L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> | Data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Layer Group to store active markers
const markerGroup = L.layerGroup().addTo(map);

// 2. Handle CSV Upload
uploadBtn.addEventListener('click', () => fileInput.click());

// Auto-load decapolis.csv if it exists
fetch('decapolis.csv')
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
        const isFooter = name && name.toLowerCase() === 'footer';
        if (!name || (!isFooter && (!normalized['latitude'] || !normalized['longitude']))) return;

        const start = Number(normalized['start year']);
        const end = Number(normalized['end time']);

        if (locationMap.has(name)) {
            // Already exists, just add the period
            locationMap.get(name).periods.push([start, end]);
        } else {
            // New location
            const locObj = {
                ...normalized,
                periods: [[start, end]]
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

    currentYear = minYear;
    updateYearDisplay(currentYear);
    updateIndicator(currentYear);

    // Enable Run button
    runBtn.disabled = false;

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
runBtn.addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    animationStartTime = performance.now();
    runBtn.disabled = true;
    stopBtn.disabled = false;
    requestAnimationFrame(animationStep);
});

stopBtn.addEventListener('click', () => {
    isRunning = false;
    stopBtn.disabled = true;
    runBtn.disabled = false;
});

function animationStep(timestamp) {
    if (!isRunning) return;

    const elapsed = timestamp - animationStartTime;
    const progress = Math.min(elapsed / totalDuration, 1);

    // Update current year
    currentYear = minYear + progress * (maxYear - minYear);

    updateYearDisplay(currentYear);
    updateIndicator(currentYear);
    updateMarkers(currentYear);

    if (progress < 1) {
        requestAnimationFrame(animationStep);
    } else {
        isRunning = false;
        runBtn.disabled = false;
        stopBtn.disabled = true;
        alert('Animation Completed');
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
        // Show if current year is within ANY of the periods
        const activePeriod = loc.periods.find(p => year >= p[0] && year <= p[1]);

        if (loc['location name'].toLowerCase() === 'footer') {
            if (activePeriod) {
                footerText = loc.description || loc.title || '';
            }
            return; // Skip normal marker logic
        }

        if (activePeriod) {
            const isNearEnd = (activePeriod[1] - year) <= DESTROY_THRESHOLD;
            const currentIcon = isNearEnd ? destroyIcon : starIcon;
            
            const marker = L.marker([loc.latitude, loc.longitude], { icon: currentIcon });

            // Build periods string for popup
            const periodsHtml = loc.periods
                .map(p => `<li>${p[0]} to ${p[1]}</li>`)
                .join('');

            // Add popup with Title & Description
            marker.bindPopup(`
                <div style="font-family: inherit; min-width: 150px;">
                    <h3 style="margin:0">${loc.title}</h3>
                    <p style="margin:5px 0; font-size: 12px; color: #555;">${loc.description}</p>
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
        mapFooter.textContent = footerText;
        mapFooter.style.display = 'block';
    } else {
        mapFooter.style.display = 'none';
    }

    console.log(`Updated markers for year ${Math.round(year)}. Count: ${count}`);
}
