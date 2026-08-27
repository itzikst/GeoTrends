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
 * Initializes the Leaflet map with support for 3 base maps (Topographic, Satellite, Geologic).
 * @param {string} domId 
 * @param {string} esriApiKey 
 * @returns {Object} { map, markerGroup, highlightLayer, baseMapLayers }
 */
export function initMap(domId, esriApiKey) {
    if (esriApiKey) {
        window._esriApiKey = esriApiKey;
    }

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

    const tokenParam = (esriApiKey && typeof esriApiKey === 'string' && esriApiKey.trim().length > 0)
        ? `?token=${encodeURIComponent(esriApiKey.trim())}`
        : '';

    // 1. Topographic Map Layer (Voyager + ESRI Hillshade)
    const topoVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const topoHillshade = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}${tokenParam}`, {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri, USGS',
        className: 'hillshade-layer'
    });

    const topoGroup = L.layerGroup([topoVoyager, topoHillshade]);

    // 2. Satellite View Layer (Esri World Imagery + Imagery Reference Labels)
    const satImagery = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}${tokenParam}`, {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    });

    const satLabels = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}${tokenParam}`, {
        attribution: 'Labels &copy; Esri',
        maxZoom: 19
    });

    const satelliteGroup = L.layerGroup([satImagery, satLabels]);

    // 3. Geologic Map Layer (Voyager + ESRI Hillshade Base + High-Detail Geology Layers on Top)
    const geologicVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const geologicHillshade = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}${tokenParam}`, {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri, USGS',
        className: 'hillshade-layer'
    });

    // Dynamic overlay container for active project's geology (single geology layer per project)
    const activeGeologyOverlay = L.layerGroup();
    const geologicGroup = L.layerGroup([geologicVoyager, geologicHillshade, activeGeologyOverlay]);

    const baseMapLayers = {
        topo: topoGroup,
        satellite: satelliteGroup,
        geologic: geologicGroup
    };

    const markerGroup = L.layerGroup().addTo(map);
    const highlightLayer = L.layerGroup().addTo(map);

    // Map click listener for GSI Geology Vector Tile features in Timna / Israel
    map.on('click', function (e) {
        const activeBtn = document.querySelector('.basemap-btn.active');
        if (!activeBtn || activeBtn.getAttribute('data-basemap') !== 'geologic') return;

        let glMap = null;
        const vLayer = window._gsiVectorTileLayer;
        if (vLayer && vLayer._maplibreGL) {
            glMap = vLayer._maplibreGL._glMap || vLayer._maplibreGL._map || vLayer._maplibreGL;
        }

        if (!glMap) {
            map.eachLayer(l => {
                if (l._maplibreGL) {
                    glMap = l._maplibreGL._glMap || l._maplibreGL._map || l._maplibreGL;
                }
            });
        }

        if (!glMap || typeof glMap.queryRenderedFeatures !== 'function') return;

        // At low zoom levels (< 10), GSI tiles only send empty/macro region data without detailed formation info
        if (map.getZoom() < 10) return;

        try {
            const point = glMap.project([e.latlng.lng, e.latlng.lat]);
            const bbox = [[point.x - 10, point.y - 10], [point.x + 10, point.y + 10]];
            const features = glMap.queryRenderedFeatures(bbox);

            if (!features || features.length === 0) return;

            const geoFeat = features.find(f => f.layer && f.layer.id && (f.layer.id.startsWith('GeoFormation') || f.layer.id.startsWith('Geo_Formation'))) 
                || features.find(f => f.layer && f.layer.id && !f.layer.id.toLowerCase().includes('keymap') && !f.layer.id.toLowerCase().includes('boundary'))
                || features[0];
            if (!geoFeat || !geoFeat.layer || !geoFeat.layer.id) return;

            let layerId = geoFeat.layer.id;
            if (layerId.includes('/')) {
                layerId = layerId.split('/')[1];
            }

            // Skip showing popup if layer ID/name is missing, empty, or just generic region placeholder
            if (!layerId || layerId.toLowerCase().includes('region') || layerId.toLowerCase().includes('boundary') || layerId.toLowerCase().includes('sheet')) return;

            let formattedName = layerId;
            if (layerId.includes(' - ')) {
                const parts = layerId.split(' - ');
                formattedName = `${parts[1]} (${parts[0]})`;
            }

            L.popup({ autoPan: true })
                .setLatLng(e.latlng)
                .setContent(`
                    <div style="font-family: 'Inter', sans-serif; padding: 2px 4px;">
                        <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Geological Unit (GSI)</span>
                        <strong style="font-size: 13px; color: #0f172a;">${formattedName}</strong>
                    </div>
                `)
                .openOn(map);
        } catch (err) {
            console.warn('GSI vector click error:', err);
        }
    });

    return { map, markerGroup, highlightLayer, baseMapLayers, activeGeologyOverlay };
}

// Canonical color palette for Jordan formations
export function getJordanGeologyColor(code) {
    if (!code) return '#cbd5e1';
    if (code.startsWith('pC'))  return '#D93636'; // Precambrian Granite / Basement
    if (code === 'Cs')          return '#C27555'; // Burj & Um Ishrin / Shehoret
    if (code.startsWith('Ks1')) return '#A8C978'; // Amir / Evrona / Kurnub
    if (code.startsWith('Ks'))  return '#8FF04F'; // Cretaceous Limestone
    if (code.startsWith('K'))   return '#8FF04F'; // Cretaceous Limestone
    if (code.startsWith('O'))   return '#059669'; // Ordovician
    if (code.startsWith('S'))   return '#0284c7'; // Silurian
    if (code.startsWith('TR'))  return '#7c3aed'; // Triassic
    if (code.startsWith('J'))   return '#2563eb'; // Jurassic
    if (code.startsWith('T') || code.startsWith('Ts')) return '#FFF500'; // Tertiary
    if (code.startsWith('Qb'))  return '#334155'; // Quaternary Basalt
    if (code.startsWith('Q') || code.startsWith('q')) return '#E5DE95'; // Quaternary Alluvium & Sand
    return '#a8a29e';
}

const JORDAN_CODE_LABELS = {
    'pC': 'Precambrian Granite',
    'Cs': 'Burj & Um Ishrin',
    'Ks1': 'Amir & Kurnub Sandstone',
    'Ks': 'Cretaceous Limestone',
    'K': 'Cretaceous Formations',
    'O': 'Ordovician Formations',
    'S': 'Silurian Formations',
    'TR': 'Triassic Formations',
    'J': 'Jurassic Formations',
    'T': 'Tertiary Formations',
    'Qb': 'Quaternary Basalt',
    'Q': 'Quaternary Alluvium'
};

const GSI_DEFAULT_LEGEND = [
    { label: 'Precambrian Granite', color: '#D93636' },
    { label: 'Timna Formation', color: '#FF6C0A' },
    { label: 'Burj & Um Ishrin', color: '#C27555' },
    { label: 'Amir Formation', color: '#A8C978' },
    { label: 'Evrona Formation', color: '#9BBEC0' },
    { label: 'Kurnub Sandstone', color: '#B0903F' },
    { label: 'Cretaceous Limestone', color: '#8FF04F' },
    { label: 'Tertiary Formations', color: '#FFF500' },
    { label: 'Quaternary Basalt', color: '#334155' },
    { label: 'Quaternary Alluvium', color: '#E5DE95' }
];

// In-memory cache for loaded GeoJSON datasets
const geoJsonCache = new Map();

/**
 * Dynamically configures the geology overlay and extracts geology legend units for the active project.
 * Supports:
 * - 'geojson': Single GeoJSON file (e.g. Jordan geology in Faynan)
 * - 'external': Single external VectorTileServer
 * - 'hybrid': Low-zoom GeoJSON fallback with high-zoom VectorTileServer (e.g. Timna, Iron Age)
 * @param {L.Map} map
 * @param {Object} baseMapLayers
 * @param {Object} projectConfig { geologyType, geologyData, lowResGeology, highResGeology, zoomThreshold, legend, attribution }
 * @param {Function} onLegendReady Callback receiving Array<{ label: string, color: string }>
 */
export function setProjectGeology(map, baseMapLayers, projectConfig, onLegendReady) {
    const geologicGroup = baseMapLayers?.geologic;
    if (!geologicGroup) return;

    // Remove any previous hybrid zoom listeners
    if (map._hybridZoomHandler) {
        map.off('zoomend', map._hybridZoomHandler);
        map._hybridZoomHandler = null;
    }

    // Clear previous dynamic geology layers
    const layers = geologicGroup.getLayers();
    // Keep geologicVoyager (idx 0) and geologicHillshade (idx 1), remove any previous overlays (idx 2+)
    for (let i = 2; i < layers.length; i++) {
        try {
            geologicGroup.removeLayer(layers[i]);
        } catch (e) {
            console.warn('Notice removing previous geology layer:', e);
        }
    }

    if (!projectConfig || !projectConfig.geologyType || projectConfig.geologyType === 'none') {
        if (typeof onLegendReady === 'function') onLegendReady([]);
        return;
    }

    // 1. GEOJSON MODE
    if (projectConfig.geologyType === 'geojson') {
        const geoJsonUrl = projectConfig.geologyData || projectConfig.lowResGeology;
        fetch(geoJsonUrl)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(geoJsonData => {
                // Dynamically scan features to extract unique geology units
                const presentCodes = new Set();
                if (geoJsonData.features && Array.isArray(geoJsonData.features)) {
                    geoJsonData.features.forEach(f => {
                        const code = f.properties ? (f.properties.Codierung || f.properties.symbol) : '';
                        if (code) {
                            let baseKey = code;
                            if (code.startsWith('pC')) baseKey = 'pC';
                            else if (code.startsWith('Ks1')) baseKey = 'Ks1';
                            else if (code.startsWith('Ks') || code.startsWith('K')) baseKey = 'Ks';
                            else if (code.startsWith('Ts') || code.startsWith('T')) baseKey = 'T';
                            else if (code.startsWith('Qs') || code.startsWith('Q') || code.startsWith('q')) baseKey = 'Q';
                            else if (code.startsWith('Qb')) baseKey = 'Qb';
                            presentCodes.add(baseKey);
                        }
                    });
                }

                // Generate dynamic legend items directly from data source
                const legendItems = [];
                presentCodes.forEach(code => {
                    const label = JORDAN_CODE_LABELS[code] || code;
                    const color = getJordanGeologyColor(code);
                    legendItems.push({ label, color });
                });

                if (typeof onLegendReady === 'function') {
                    onLegendReady(legendItems);
                }

                const geoLayer = L.geoJSON(geoJsonData, {
                    style: function (feature) {
                        const code = feature.properties ? (feature.properties.Codierung || feature.properties.symbol) : '';
                        return {
                            fillColor: feature.properties?.fillColor || getJordanGeologyColor(code),
                            fillOpacity: 0.65,
                            color: '#475569',
                            weight: 1
                        };
                    },
                    onEachFeature: function (feature, layer) {
                        if (feature.properties && (feature.properties.Codierung || feature.properties.name_eng)) {
                            const nameEng = feature.properties.name_eng || '';
                            const nameHeb = feature.properties.name_heb || '';
                            const code = feature.properties.Codierung || feature.properties.symbol || '';
                            
                            let content = `<strong>Geological Formation (${code}):</strong><br/>`;
                            if (nameEng) content += `<em>${nameEng}</em><br/>`;
                            if (nameHeb) content += `<span style="font-size: 11px; color: #64748b;">${nameHeb}</span>`;
                            layer.bindPopup(content);
                        }
                    }
                });

                geologicGroup.addLayer(geoLayer);
            })
            .catch(err => {
                console.error(`Failed to load GeoJSON from ${geoJsonUrl}:`, err);
                if (typeof onLegendReady === 'function') onLegendReady([]);
            });
    }

    // 2. HYBRID OR EXTERNAL VECTOR MODE
    else if (projectConfig.geologyType === 'hybrid' || projectConfig.geologyType === 'external') {
        const isHybrid = projectConfig.geologyType === 'hybrid' || !!projectConfig.lowResGeology;
        const lowResUrl = projectConfig.lowResGeology || projectConfig.geologyData?.lowRes;
        const highResUrl = projectConfig.highResGeology || projectConfig.geologyData?.highRes || projectConfig.geologyData;
        const zoomThreshold = typeof projectConfig.zoomThreshold === 'number'
            ? projectConfig.zoomThreshold
            : (projectConfig.geologyData?.zoomThreshold || 11);
        const attributionText = projectConfig.attribution || 'Geology &copy; <a href="https://www.gov.il/he/departments/israel-geological-survey" target="_blank">Geological Survey of Israel (gov.il)</a>';

        if (isHybrid && lowResUrl) {
            const geoCanvasRenderer = L.canvas({ padding: 0.5 });
            let lowResGeoLayer = null;

            function createLowResLayer(data) {
                return L.geoJSON(data, {
                    renderer: geoCanvasRenderer,
                    style: function (feature) {
                        return {
                            fillColor: feature.properties?.fillColor || '#cbd5e1',
                            fillOpacity: 0.70,
                            color: '#64748b',
                            weight: 0.5
                        };
                    },
                    onEachFeature: function (feature, layer) {
                        if (feature.properties) {
                            const nameEng = feature.properties.name_eng || 'Geological Formation';
                            const nameHeb = feature.properties.name_heb || '';
                            const symbol = feature.properties.symbol || '';
                            layer.bindPopup(`
                                <div style="font-family: 'Inter', sans-serif; padding: 2px 4px;">
                                    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Geological Unit</span>
                                    <strong style="font-size: 13px; color: #0f172a;">${nameEng}</strong>
                                    ${nameHeb ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${nameHeb} ${symbol ? `(${symbol})` : ''}</div>` : ''}
                                </div>
                            `);
                        }
                    }
                });
            }

            function updateHybridZoom() {
                if (!lowResGeoLayer) return;
                const zoom = map.getZoom();
                if (zoom < zoomThreshold) {
                    if (!geologicGroup.hasLayer(lowResGeoLayer)) {
                        geologicGroup.addLayer(lowResGeoLayer);
                    }
                } else {
                    if (geologicGroup.hasLayer(lowResGeoLayer)) {
                        geologicGroup.removeLayer(lowResGeoLayer);
                    }
                }
            }

            // Load and cache low-res GeoJSON
            const loadGeoJsonPromise = geoJsonCache.has(lowResUrl)
                ? Promise.resolve(geoJsonCache.get(lowResUrl))
                : fetch(lowResUrl)
                    .then(r => {
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        return r.json();
                    })
                    .then(data => {
                        geoJsonCache.set(lowResUrl, data);
                        return data;
                    });

            loadGeoJsonPromise
                .then(data => {
                    lowResGeoLayer = createLowResLayer(data);
                    updateHybridZoom();

                    map._hybridZoomHandler = updateHybridZoom;
                    map.on('zoomend', map._hybridZoomHandler);
                })
                .catch(err => {
                    console.warn(`Could not load low-res geology GeoJSON from ${lowResUrl}:`, err);
                });
        }

        // Initialize high-res external vector tile layer
        if (highResUrl) {
            const createLayer = (L.esri && L.esri.Vector && typeof L.esri.Vector.vectorTileLayer === 'function')
                ? L.esri.Vector.vectorTileLayer
                : (L.esri && typeof L.esri.vectorTileLayer === 'function' ? L.esri.vectorTileLayer : null);

            if (createLayer) {
                try {
                    const layerOptions = {
                        opacity: 0.8,
                        style: function (style) {
                            if (style) {
                                style.sprite = `${highResUrl}/resources/sprites/sprite`;
                                style.glyphs = `${highResUrl}/resources/fonts/{fontstack}/{range}.pbf`;
                                if (style.sources && style.sources.esri) {
                                    style.sources.esri.bounds = [34.2642, 29.5044, 35.9622, 33.3407];
                                }
                                if (style.layers) {
                                    style.layers = style.layers.filter(l => !l.id.toLowerCase().includes('keymap'));
                                    style.layers.forEach(l => {
                                        delete l.minzoom;
                                        delete l.maxzoom;
                                    });
                                }
                            }
                            return style;
                        },
                        attribution: attributionText
                    };

                    if (window._esriApiKey && typeof window._esriApiKey === 'string' && window._esriApiKey.trim().length > 0) {
                        layerOptions.apikey = window._esriApiKey.trim();
                        layerOptions.token = window._esriApiKey.trim();
                    }

                    const vectorLayer = createLayer(highResUrl, layerOptions);

                    if (vectorLayer) {
                        const origOnRemove = vectorLayer.onRemove;
                        vectorLayer.onRemove = function (mapInstance) {
                            try {
                                if (origOnRemove) {
                                    origOnRemove.call(this, mapInstance || this._map);
                                }
                            } catch (e) {
                                console.warn('Suppressed vectorLayer onRemove error:', e);
                            }
                        };
                        window._gsiVectorTileLayer = vectorLayer;
                        geologicGroup.addLayer(vectorLayer);
                    }

                    if (typeof onLegendReady === 'function') {
                        onLegendReady(projectConfig.legend || GSI_DEFAULT_LEGEND);
                    }
                } catch (err) {
                    console.error(`Failed to create external vector layer from ${highResUrl}:`, err);
                    if (typeof onLegendReady === 'function') onLegendReady([]);
                }
            }
        }
    }
}

/**
 * Switches the active base map on the Leaflet instance.
 * @param {L.Map} map 
 * @param {Object} baseMapLayers 
 * @param {string} key 'topo' | 'satellite' | 'geologic'
 */
export function switchBaseMap(map, baseMapLayers, key) {
    Object.keys(baseMapLayers).forEach(k => {
        const layerGroup = baseMapLayers[k];
        if (k !== key && map.hasLayer(layerGroup)) {
            try {
                map.removeLayer(layerGroup);
            } catch (err) {
                console.warn(`Handled removeLayer notice on ${k}:`, err);
            }
        }
    });

    if (baseMapLayers[key] && !map.hasLayer(baseMapLayers[key])) {
        try {
            map.addLayer(baseMapLayers[key]);
        } catch (err) {
            console.error(`Error adding basemap ${key}:`, err);
        }
    }
}
