/**
 * GeoTrends - Leaflet Map & Markers Manager
 */

// Define Custom Icons
export const starIcon = L.icon({
    iconUrl: 'tel.png',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
});

export const destroyIcon = L.icon({
    iconUrl: 'destroy.png',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
});

// Map each type to an icon stored in the icons folder
export const typeIcons = {};
export const iconNames = [
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

/**
 * Private helper to normalize and resolve a raw type string to a standard icon key.
 * @param {string} type 
 * @returns {string}
 */
function resolveTypeKey(type) {
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

/**
 * Resolves a custom Leaflet Icon based on the period/location type text.
 * @param {string} type 
 * @returns {L.Icon}
 */
export function getIconForType(type) {
    const key = resolveTypeKey(type);
    return typeIcons[key] || typeIcons['unknown'];
}

/**
 * Returns the icon file key string corresponding to a type.
 * @param {string} type 
 * @returns {string}
 */
export function getIconKeyForType(type) {
    return resolveTypeKey(type);
}

/**
 * Initializes the Leaflet map with standard layered configuration (Voyager + ESRI Hillshade).
 * @param {string} domId 
 * @param {string} esriApiKey 
 * @returns {Object} { map, markerGroup, highlightLayer }
 */
export function initMap(domId, esriApiKey) {
    // Leaflet CDN Icon Path Fix (ensure loaded globally)
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(domId, {
        maxZoom: 18
    }).setView([32.5, 36.0], 8); // Center on Decapolis Region

    // Bottom Layer: CartoDB Voyager (Provides clean land colors and blue water without labels)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Top Layer: ESRI World Hillshade (Provides the sharp 3D relief information)
    L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}?token=${esriApiKey}`, {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri, USGS',
        className: 'hillshade-layer'
    }).addTo(map);

    const markerGroup = L.layerGroup().addTo(map);
    const highlightLayer = L.layerGroup().addTo(map);

    return { map, markerGroup, highlightLayer };
}
