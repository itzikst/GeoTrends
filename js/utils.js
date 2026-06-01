/**
 * GeoTrends - Pure Utility Helpers
 */

/**
 * Formats a year number into a human-readable string (e.g. 1000 BC or 500).
 * @param {number} year 
 * @returns {string}
 */
export function formatYearLabel(year) {
    if (year < 0) return Math.abs(year) + ' BC';
    if (year > 0) return String(year);
    return '0';
}

/**
 * Converts plain text URLs within a string into clickable HTML anchor tags.
 * @param {string} text 
 * @returns {string}
 */
export function makeLinksClickable(text) {
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
