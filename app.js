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
    // Normalize data: trim keys and lowercase them to handle variability
    locations = rawData.map(row => {
        const normalized = {};
        for (let key in row) {
            normalized[key.toLowerCase().trim()] = row[key];
        }
        return normalized;
    });

    // Filter out truly invalid rows
    locations = locations.filter(row => row['location name'] && row['latitude'] && row['longitude']);

    if (locations.length === 0) {
        alert('Invalid CSV data structure. Please use columns: location name, latitude, longitude, start year, end time, title, description');
        return;
    }

    // Compute min/max year
    minYear = Math.min(...locations.map(l => l['start year'] || 0));
    maxYear = Math.max(...locations.map(l => l['end time'] || 0));
    
    currentYear = minYear;
    updateYearDisplay(currentYear);
    updateIndicator(currentYear);

    // Enable Run button
    runBtn.disabled = false;

    // Populate table
    dataTableBody.innerHTML = '';
    locations.slice(0, 15).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row['location name']}</td>
            <td>${row['start year']}</td>
            <td>${row['end time']}</td>
        `;
        dataTableBody.appendChild(tr);
    });

    // Reset markers
    updateMarkers(currentYear);
    
    // Zoom to fit all points with a 10% border
    const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]));
    map.fitBounds(bounds.pad(0.1));
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

// Define Custom Icon
const destroyIcon = L.icon({
    iconUrl: 'destroy.jpg',
    iconSize: [32, 32], // Size of the icon
    iconAnchor: [16, 32], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -32], // Point from which the popup should open relative to the iconAnchor
});

// 4. Update Map Markers
function updateMarkers(year) {
    markerGroup.clearLayers();
    
    let count = 0;
    locations.forEach(loc => {
        const start = Number(loc['start year']);
        const end = Number(loc['end time']);
        
        // Show if current year is between start and end
        if (year >= start && year <= end) {
            const marker = L.marker([loc.latitude, loc.longitude], { icon: destroyIcon });
            
            // Add popup with Title & Description
            marker.bindPopup(`
                <div style="font-family: inherit">
                    <h3 style="margin:0">${loc.title}</h3>
                    <p style="margin:5px 0; font-size: 12px; color: #555;">${loc.description}</p>
                    <small>Period: ${start} to ${end}</small>
                </div>
            `);
            
            markerGroup.addLayer(marker);
            count++;
        }
    });
    console.log(`Updated markers for year ${Math.round(year)}. Count: ${count}`);
}
