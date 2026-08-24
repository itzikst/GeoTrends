/**
 * GeoTrends - URL Parsing & State Management Module
 * 
 * Supports:
 * - Repository Path: /{repo} where repo can be 'timna' (default), 'faynan', or 'iron_age'
 * - View Query Param: ?view={view} where view can be 'topo' (default), 'satellite', or 'geologic'
 */

export const REPO_TO_FILE = {
    'timna': 'data/timna_valley.csv',
    'faynan': 'data/faynan_data.csv',
    'iron_age': 'data/iron_age_cities.csv',
    // Aliases
    'iron-age': 'data/iron_age_cities.csv',
    'ironage': 'data/iron_age_cities.csv',
    'iron_age_cities': 'data/iron_age_cities.csv'
};

export const FILE_TO_REPO = {
    'timna_valley.csv': 'timna',
    'data/timna_valley.csv': 'timna',
    'faynan_data.csv': 'faynan',
    'data/faynan_data.csv': 'faynan',
    'iron_age_cities.csv': 'iron_age',
    'data/iron_age_cities.csv': 'iron_age'
};

export const VIEW_TO_BASEMAP = {
    'topo': 'topo',
    'topography': 'topo',
    'satellite': 'satellite',
    'sat': 'satellite',
    'geologic': 'geologic',
    'geo': 'geologic',
    'geology': 'geologic'
};

export const BASEMAP_TO_VIEW = {
    'topo': 'topo',
    'satellite': 'satellite',
    'geologic': 'geologic'
};

const DEFAULT_REPO = 'timna';
const DEFAULT_VIEW = 'topo';

/**
 * Normalizes repository key from path or string.
 * @param {string} rawRepo 
 * @returns {string} canonical repo name ('timna' | 'faynan' | 'iron_age')
 */
export function normalizeRepo(rawRepo) {
    if (!rawRepo) return DEFAULT_REPO;
    const clean = rawRepo.toLowerCase().trim().replace(/^[/#]+|[/#]+$/g, '');
    if (clean === 'iron-age' || clean === 'ironage' || clean === 'iron_age_cities') {
        return 'iron_age';
    }
    if (REPO_TO_FILE[clean]) {
        return clean;
    }
    return DEFAULT_REPO;
}

/**
 * Normalizes view parameter from query param.
 * @param {string} rawView 
 * @returns {string} canonical view name ('topo' | 'satellite' | 'geologic')
 */
export function normalizeView(rawView) {
    if (!rawView) return DEFAULT_VIEW;
    const clean = rawView.toLowerCase().trim();
    const basemap = VIEW_TO_BASEMAP[clean];
    if (basemap && BASEMAP_TO_VIEW[basemap]) {
        return BASEMAP_TO_VIEW[basemap];
    }
    return DEFAULT_VIEW;
}

/**
 * Parses the current application URL or a given URL string.
 * @param {string} [urlString] 
 * @returns {{ repo: string, viewParam: string, basemapKey: string, filePath: string }}
 */
export function parseAppUrl(urlString) {
    let pathname = '';
    let search = '';

    if (urlString) {
        try {
            const parsed = new URL(urlString, 'http://localhost');
            pathname = parsed.pathname;
            search = parsed.search;
        } catch (e) {
            pathname = urlString.split('?')[0] || '';
            search = urlString.includes('?') ? '?' + urlString.split('?')[1] : '';
        }
    } else if (typeof window !== 'undefined' && window.location) {
        pathname = window.location.pathname;
        search = window.location.search;
    }

    // Extract first segment after leading slash
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments.length > 0 ? segments[0] : '';
    
    // Ignore static files or index.html in the path
    const candidateRepo = (firstSegment.includes('.') || firstSegment === 'index.html') ? '' : firstSegment;
    const repo = normalizeRepo(candidateRepo);

    // Extract query parameter 'view'
    let rawView = '';
    if (search) {
        const params = new URLSearchParams(search);
        rawView = params.get('view') || '';
    }
    const viewParam = normalizeView(rawView);
    const basemapKey = VIEW_TO_BASEMAP[viewParam] || 'topo';
    const filePath = REPO_TO_FILE[repo] || REPO_TO_FILE[DEFAULT_REPO];

    return {
        repo,
        viewParam,
        basemapKey,
        filePath
    };
}

/**
 * Builds a relative URL string from repo and view parameters.
 * @param {string} repo 
 * @param {string} viewParam 
 * @returns {string}
 */
export function buildAppUrl(repo, viewParam) {
    const cleanRepo = normalizeRepo(repo);
    const cleanView = normalizeView(viewParam);
    return `/${cleanRepo}?view=${cleanView}`;
}

/**
 * Updates browser history state and URL without page reload.
 * @param {string} repo 
 * @param {string} viewParam 
 * @param {boolean} [push=false] Whether to push state or replace state
 */
export function updateUrlState(repo, viewParam, push = false) {
    if (typeof window === 'undefined' || !window.history) return;

    const newUrl = buildAppUrl(repo, viewParam);
    const currentState = window.history.state || {};
    const stateData = { ...currentState, repo, view: viewParam };

    // Check if already at current URL
    const currentRelativeUrl = window.location.pathname + window.location.search;
    if (currentRelativeUrl === newUrl) return;

    if (push) {
        window.history.pushState(stateData, '', newUrl);
    } else {
        window.history.replaceState(stateData, '', newUrl);
    }
}
