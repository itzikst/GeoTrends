/**
 * GeoTrends - CSV Data Loader
 * Interacts with PapaParse and server files APIs
 */

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
