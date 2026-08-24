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

export const REPO_TO_CONFIG = {
    'timna': 'data/timna.json',
    'faynan': 'data/faynan.json',
    'iron_age': 'data/iron_age.json',
    // Aliases
    'iron-age': 'data/iron_age.json',
    'ironage': 'data/iron_age.json',
    'iron_age_cities': 'data/iron_age.json'
};

export const FILE_TO_REPO = {
    'timna_valley.csv': 'timna',
    'data/timna_valley.csv': 'timna',
    'timna.json': 'timna',
    'data/timna.json': 'timna',
    'faynan_data.csv': 'faynan',
    'data/faynan_data.csv': 'faynan',
    'faynan.json': 'faynan',
    'data/faynan.json': 'faynan',
    'iron_age_cities.csv': 'iron_age',
    'data/iron_age_cities.csv': 'iron_age',
    'iron_age.json': 'iron_age',
    'data/iron_age.json': 'iron_age'
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
 * Normalizes and parses a year query parameter (supports negative numbers, BCE/BC suffix).
 * @param {string|number} rawYear 
 * @returns {number|null}
 */
export function parseYearParam(rawYear) {
    if (rawYear === null || rawYear === undefined || rawYear === '') return null;
    let str = String(rawYear).trim();
    let isBC = false;
    if (str.toUpperCase().includes('BC') || str.toUpperCase().includes('BCE')) {
        isBC = true;
        str = str.replace(/BC|BCE/gi, '').trim();
    }
    const parsed = parseInt(str, 10);
    if (isNaN(parsed)) return null;
    if (isBC && parsed > 0) return -parsed;
    return parsed;
}

/**
 * Parses the current application URL or a given URL string.
 * @param {string} [urlString] 
 * @returns {{ repo: string, viewParam: string, basemapKey: string, filePath: string, configPath: string, yearParam: number|null }}
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

    // Extract query parameters 'view' and 'year'
    let rawView = '';
    let rawYear = null;
    if (search) {
        const params = new URLSearchParams(search);
        rawView = params.get('view') || '';
        rawYear = params.get('year');
    }
    const viewParam = normalizeView(rawView);
    const yearParam = parseYearParam(rawYear);
    const basemapKey = VIEW_TO_BASEMAP[viewParam] || 'topo';
    const filePath = REPO_TO_FILE[repo] || REPO_TO_FILE[DEFAULT_REPO];
    const configPath = REPO_TO_CONFIG[repo] || REPO_TO_CONFIG[DEFAULT_REPO];

    return {
        repo,
        viewParam,
        basemapKey,
        filePath,
        configPath,
        yearParam
    };
}

/**
 * Builds a relative URL string from repo, view, and optional year parameters.
 * @param {string} repo 
 * @param {string} viewParam 
 * @param {number|null} [yearParam=null]
 * @returns {string}
 */
export function buildAppUrl(repo, viewParam, yearParam = null) {
    const cleanRepo = normalizeRepo(repo);
    const cleanView = normalizeView(viewParam);
    let url = `/${cleanRepo}?view=${cleanView}`;
    if (yearParam !== null && yearParam !== undefined && !isNaN(yearParam)) {
        url += `&year=${yearParam}`;
    }
    return url;
}

/**
 * Updates browser history state and URL without page reload.
 * @param {string} repo 
 * @param {string} viewParam 
 * @param {number|boolean|null} [yearParam=null] Optional year number or boolean for push
 * @param {boolean} [push=false] Whether to push state or replace state
 */
export function updateUrlState(repo, viewParam, yearParam = null, push = false) {
    if (typeof window === 'undefined' || !window.history) return;

    if (typeof yearParam === 'boolean') {
        push = yearParam;
        yearParam = null;
    }

    const newUrl = buildAppUrl(repo, viewParam, yearParam);
    const currentState = window.history.state || {};
    const stateData = { ...currentState, repo, view: viewParam, year: yearParam };

    // Check if already at current URL
    const currentRelativeUrl = window.location.pathname + window.location.search;
    if (currentRelativeUrl === newUrl) return;

    if (push) {
        window.history.pushState(stateData, '', newUrl);
    } else {
        window.history.replaceState(stateData, '', newUrl);
    }
}
