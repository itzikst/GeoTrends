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

    // 1. Topographic Map Layer (Voyager + ESRI Hillshade)
    const topoVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const topoHillshade = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}?token=${esriApiKey}`, {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri, USGS',
        className: 'hillshade-layer'
    });

    const topoGroup = L.layerGroup([topoVoyager, topoHillshade]);

    // 2. Satellite View Layer (Esri World Imagery + Imagery Reference Labels)
    const satImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
    });

    const satLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Labels &copy; Esri',
        maxZoom: 19
    });

    const satelliteGroup = L.layerGroup([satImagery, satLabels]);

    // 3. Geologic Map Layer (Geological Survey of Israel gov.il 1:50,000 Ultra-Detail Map + Hillshade)
    // Macrostrat has been completely removed per request.
    const geologicPhysical = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        maxNativeZoom: 8,
        attribution: 'Tiles &copy; Esri &mdash; Source: US National Park Service'
    });

    const geologicHillshade = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}?token=${esriApiKey}`, {
        maxZoom: 18,
        maxNativeZoom: 16,
        attribution: 'Tiles &copy; Esri, USGS'
    });

    // GSI 1:50,000 High-Detail Official Map (494 detailed formation layers covering Timna & Israel)
    // We fetch root.json and pass modified style (stripping maxzoom) into options.style so MapLibre GL stretches tiles up to zoom 24
    const gsiGeology50k = L.layerGroup();
    const gsiVectorUrl = 'https://egozi.gsi.gov.il/arcgis/rest/services/Hosted/All_A_ZDissolove_g1_2/VectorTileServer';

    fetch(`${gsiVectorUrl}/resources/styles/root.json`)
        .then(res => res.json())
        .then(style => {
            style.sprite = `${gsiVectorUrl}/resources/sprites/sprite`;
            style.glyphs = `${gsiVectorUrl}/resources/fonts/{fontstack}/{range}.pbf`;
            if (style.sources && style.sources.esri) {
                style.sources.esri = {
                    type: 'vector',
                    bounds: [34.2642, 29.5044, 35.9622, 33.3407],
                    minzoom: 0,
                    maxzoom: 24,
                    scheme: 'xyz',
                    tiles: [`${gsiVectorUrl}/tile/{z}/{y}/{x}.pbf`]
                };
            }
            if (style.layers) {
                style.layers.forEach(l => {
                    delete l.maxzoom;
                    delete l.minzoom;
                });
            }
            const vectorLayer = L.esri.Vector.vectorTileLayer(gsiVectorUrl, {
                style: style,
                opacity: 0.8,
                attribution: 'Geology &copy; <a href="https://www.gov.il/he/departments/israel-geological-survey" target="_blank">Geological Survey of Israel (gov.il)</a>'
            });
            window._gsiVectorTileLayer = vectorLayer;

            gsiGeology50k.addLayer(vectorLayer);
        })
        .catch(err => console.error('Failed to load GSI 1:50k vector style:', err));

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

        try {
            const point = glMap.project([e.latlng.lng, e.latlng.lat]);
            const bbox = [[point.x - 10, point.y - 10], [point.x + 10, point.y + 10]];
            const features = glMap.queryRenderedFeatures(bbox);

            if (!features || features.length === 0) return;

            const geoFeat = features.find(f => f.layer && f.layer.id && (f.layer.id.startsWith('GeoFormation') || f.layer.id.startsWith('Geo_Formation'))) || features[0];
            if (!geoFeat || !geoFeat.layer || !geoFeat.layer.id) return;

            let layerId = geoFeat.layer.id;
            if (layerId.includes('/')) {
                layerId = layerId.split('/')[1];
            }

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

    // Helper for styling Jordan geological formations matching GSI official map colors
    function getJordanGeologyColor(code) {
        if (!code) return '#cbd5e1';
        if (code.startsWith('pC'))  return '#D93636'; // Precambrian Granite / Basement (GSI #D93636)
        if (code === 'Cs')          return '#C27555'; // Burj & Um Ishrin / Shehoret (GSI #C27555)
        if (code.startsWith('Ks1')) return '#A8C978'; // Amir / Evrona / Kurnub (GSI #A8C978)
        if (code.startsWith('K'))   return '#8FF04F'; // Cretaceous Limestone (GSI #8FF04F)
        if (code.startsWith('O'))   return '#059669'; // Ordovician
        if (code.startsWith('S'))   return '#0284c7'; // Silurian
        if (code.startsWith('TR'))  return '#7c3aed'; // Triassic
        if (code.startsWith('J'))   return '#2563eb'; // Jurassic
        if (code.startsWith('T'))   return '#FFF500'; // Tertiary (GSI #FFF500)
        if (code.startsWith('Qb'))  return '#334155'; // Quaternary Basalt
        if (code.startsWith('Q'))   return '#FFFFB6'; // Quaternary Alluvium & Sand (GSI #FFFFB6)
        return '#a8a29e';
    }

    // High-Resolution Jordan Geology GeoJSON Layer (1,455 high-detail geological polygons covering Faynan & Jordan)
    const jordanGeologyLayer = L.layerGroup();
    fetch('data/jordan_geology.geojson')
        .then(res => res.json())
        .then(geoJsonData => {
            const geoLayer = L.geoJSON(geoJsonData, {
                style: function (feature) {
                    const code = feature.properties ? feature.properties.Codierung : '';
                    return {
                        fillColor: getJordanGeologyColor(code),
                        fillOpacity: 0.75,
                        color: '#475569',
                        weight: 0.8
                    };
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.Codierung) {
                        const code = feature.properties.Codierung;
                        let desc = code;
                        if (code === 'Cs') desc = 'Burj Formation & Sandstone (DSL Ore Bed, Salib & Um Ishrin)';
                        else if (code.startsWith('pC')) desc = 'Precambrian Basement / Granites';
                        else if (code.startsWith('K')) desc = 'Amir, Evrona & Kurnub Formations (Cretaceous)';
                        else if (code.startsWith('Q')) desc = 'Quaternary Alluvium & Sediments';
                        layer.bindPopup(`<strong>Geological Formation (${code}):</strong><br/><em>${desc}</em>`);
                    }
                }
            });
            jordanGeologyLayer.addLayer(geoLayer);
        })
        .catch(err => console.error('Failed to load Jordan geology GeoJSON:', err));

    const geologicGroup = L.layerGroup([geologicPhysical, geologicHillshade, jordanGeologyLayer, gsiGeology50k]);

    const baseMapLayers = {
        topo: topoGroup,
        satellite: satelliteGroup,
        geologic: geologicGroup
    };

    // Default to Topographic map
    baseMapLayers.topo.addTo(map);

    const markerGroup = L.layerGroup().addTo(map);
    const highlightLayer = L.layerGroup().addTo(map);

    return { map, markerGroup, highlightLayer, baseMapLayers };
}

/**
 * Switches the active base map on the Leaflet instance.
 * @param {L.Map} map 
 * @param {Object} baseMapLayers 
 * @param {string} key 'topo' | 'satellite' | 'geologic'
 */
export function switchBaseMap(map, baseMapLayers, key) {
    Object.values(baseMapLayers).forEach(layerGroup => {
        if (map.hasLayer(layerGroup)) {
            map.removeLayer(layerGroup);
        }
    });

    if (baseMapLayers[key]) {
        baseMapLayers[key].addTo(map);
    }
}
