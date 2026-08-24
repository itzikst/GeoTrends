/**
 * GeoTrends - CSV Data Loader
 * Interacts with PapaParse and server files APIs
 */

/**
 * Loads the project configuration JSON for a given repository.
 * @param {string} repo 
 * @returns {Promise<Object>}
 */
export function loadProjectConfig(repo) {
    const configUrl = `data/${repo}.json`;
    return fetch(`${configUrl}?v=${Date.now()}`)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load project config: ${configUrl}`);
            return response.json();
        });
}

/**
 * Loads a CSV file from a given URL/path and parses it into JSON objects.
 * @param {string} filePath 
 * @returns {Promise<Array<Object>>}
 */
export function loadCSV(filePath) {
    return new Promise((resolve, reject) => {
        fetch(filePath)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch file: ${filePath}`);
                return response.text();
            })
            .then(csvText => {
                // Ensure PapaParse exists globally
                if (typeof Papa === 'undefined') {
                    throw new Error('PapaParse library is not loaded');
                }
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        resolve(results.data);
                    },
                    error: (err) => {
                        reject(err);
                    }
                });
            })
            .catch(err => reject(err));
    });
}

/**
 * Fetches the list of CSV files available on the server.
 * @returns {Promise<Array<string>>}
 */
export function fetchServerFileList() {
    return fetch(`data/files.json?v=${Date.now()}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load server files list');
            return response.json();
        });
}

/**
 * Normalizes, groups, and merges location periods from raw parsed CSV rows.
 * @param {Array<Object>} rawData 
 * @returns {Array<Object>}
 */
export function normalizeLocationData(rawData) {
    if (!rawData || !Array.isArray(rawData)) return [];

    const locationMap = new Map();

    rawData.forEach(row => {
        // Normalize keys
        const normalized = {};
        for (let key in row) {
            normalized[key.toLowerCase().trim()] = row[key];
        }

        const name = normalized['location name'] || normalized['entitylabel'] || '';
        const isFooter = name && name.toLowerCase().trim() === 'footer';
        const isHeader = name && name.toLowerCase().trim() === 'header';

        const lat = Number(normalized['latitude'] !== undefined ? normalized['latitude'] : normalized['lat']);
        const lng = Number(normalized['longitude'] !== undefined ? normalized['longitude'] : normalized['lng']);

        if (!name || (!isFooter && !isHeader && (isNaN(lat) || isNaN(lng)))) return;

        const start = Number(normalized['start year'] !== undefined ? normalized['start year'] : normalized['start']);
        const end = Number(normalized['end time'] !== undefined ? normalized['end time'] : normalized['end']);
        const titleVal = normalized['title'] || normalized['type'] || '';
        const descVal = normalized['description'] || normalized['entity'] || '';

        // Store back normalized coordinates and name
        normalized.latitude = lat;
        normalized.longitude = lng;
        normalized['location name'] = name;

        if (locationMap.has(name)) {
            locationMap.get(name).periods.push([start, end, titleVal, descVal]);
        } else {
            const locObj = {
                ...normalized,
                periods: [[start, end, titleVal, descVal]]
            };
            delete locObj['start year'];
            delete locObj['end time'];
            delete locObj['start'];
            delete locObj['end'];
            locationMap.set(name, locObj);
        }
    });

    return Array.from(locationMap.values());
}

/**
 * Extracts overall timeline boundaries and unique event milestones.
 * @param {Array<Object>} locationsList 
 * @returns {Object} { minYear, maxYear, eventYears }
 */
export function determineYearBounds(locationsList) {
    if (!locationsList || locationsList.length === 0) {
        return { minYear: 0, maxYear: 0, eventYears: [] };
    }

    let allStarts = [];
    let allEnds = [];
    locationsList.forEach(l => {
        if (l.periods && Array.isArray(l.periods)) {
            l.periods.forEach(p => {
                allStarts.push(p[0]);
                allEnds.push(p[1]);
            });
        }
    });

    if (allStarts.length === 0) {
        return { minYear: 0, maxYear: 0, eventYears: [] };
    }

    const minY = Math.min(...allStarts);
    const maxY = Math.max(...allEnds);
    const years = Array.from(new Set([...allStarts, ...allEnds])).sort((a, b) => a - b);

    return { minYear: minY, maxYear: maxY, eventYears: years };
}
