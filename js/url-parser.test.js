import { describe, it, expect } from 'vitest';
import {
    normalizeRepo,
    normalizeView,
    parseAppUrl,
    buildAppUrl,
    REPO_TO_FILE,
    FILE_TO_REPO,
    VIEW_TO_BASEMAP
} from './url-parser.js';

describe('URL Parser Module', () => {
    describe('normalizeRepo', () => {
        it('defaults to timna when empty or undefined', () => {
            expect(normalizeRepo('')).toBe('timna');
            expect(normalizeRepo(null)).toBe('timna');
            expect(normalizeRepo(undefined)).toBe('timna');
        });

        it('normalizes valid repos', () => {
            expect(normalizeRepo('timna')).toBe('timna');
            expect(normalizeRepo('faynan')).toBe('faynan');
            expect(normalizeRepo('iron_age')).toBe('iron_age');
        });

        it('handles case-insensitivity and slashes', () => {
            expect(normalizeRepo('/Faynan/')).toBe('faynan');
            expect(normalizeRepo('TIMNA')).toBe('timna');
        });

        it('handles iron-age aliases', () => {
            expect(normalizeRepo('iron-age')).toBe('iron_age');
            expect(normalizeRepo('ironage')).toBe('iron_age');
            expect(normalizeRepo('iron_age_cities')).toBe('iron_age');
        });

        it('falls back to timna for unknown repo', () => {
            expect(normalizeRepo('unknown_repo_123')).toBe('timna');
        });
    });

    describe('normalizeView', () => {
        it('defaults to topo when empty or undefined', () => {
            expect(normalizeView('')).toBe('topo');
            expect(normalizeView(null)).toBe('topo');
            expect(normalizeView(undefined)).toBe('topo');
        });

        it('normalizes valid views', () => {
            expect(normalizeView('topo')).toBe('topo');
            expect(normalizeView('satellite')).toBe('satellite');
            expect(normalizeView('geologic')).toBe('geologic');
        });

        it('handles view aliases', () => {
            expect(normalizeView('geo')).toBe('geologic');
            expect(normalizeView('geology')).toBe('geologic');
            expect(normalizeView('sat')).toBe('satellite');
            expect(normalizeView('topography')).toBe('topo');
        });

        it('falls back to topo for unknown view', () => {
            expect(normalizeView('unknown_view')).toBe('topo');
        });
    });

    describe('parseAppUrl', () => {
        it('parses root URL / as timna repo and topo view', () => {
            const parsed = parseAppUrl('http://localhost:8080/');
            expect(parsed.repo).toBe('timna');
            expect(parsed.viewParam).toBe('topo');
            expect(parsed.basemapKey).toBe('topo');
            expect(parsed.filePath).toBe('data/timna_valley.csv');
            expect(parsed.filePath).toBe('data/timna_valley.csv');
            expect(parsed.configPath).toBe('data/timna.json');
        });

        it('parses /faynan route', () => {
            const parsed = parseAppUrl('http://localhost:8080/faynan');
            expect(parsed.repo).toBe('faynan');
            expect(parsed.viewParam).toBe('topo');
            expect(parsed.basemapKey).toBe('topo');
            expect(parsed.filePath).toBe('data/faynan_data.csv');
            expect(parsed.configPath).toBe('data/faynan.json');
        });

        it('parses /iron_age route with view=geologic', () => {
            const parsed = parseAppUrl('http://localhost:8080/iron_age?view=geologic');
            expect(parsed.repo).toBe('iron_age');
            expect(parsed.viewParam).toBe('geologic');
            expect(parsed.basemapKey).toBe('geologic');
            expect(parsed.filePath).toBe('data/iron_age_cities.csv');
            expect(parsed.configPath).toBe('data/iron_age.json');
        });

        it('parses /faynan?view=satellite', () => {
            const parsed = parseAppUrl('http://localhost:8080/faynan?view=satellite');
            expect(parsed.repo).toBe('faynan');
            expect(parsed.viewParam).toBe('satellite');
            expect(parsed.basemapKey).toBe('satellite');
            expect(parsed.filePath).toBe('data/faynan_data.csv');
            expect(parsed.configPath).toBe('data/faynan.json');
        });

        it('handles view alias ?view=geo', () => {
            const parsed = parseAppUrl('http://localhost:8080/timna?view=geo');
            expect(parsed.repo).toBe('timna');
            expect(parsed.viewParam).toBe('geologic');
            expect(parsed.basemapKey).toBe('geologic');
            expect(parsed.filePath).toBe('data/timna_valley.csv');
            expect(parsed.configPath).toBe('data/timna.json');
        });
    });

    describe('buildAppUrl', () => {
        it('builds canonical route string', () => {
            expect(buildAppUrl('timna', 'topo')).toBe('/timna?view=topo');
            expect(buildAppUrl('faynan', 'geologic')).toBe('/faynan?view=geologic');
            expect(buildAppUrl('iron-age', 'satellite')).toBe('/iron_age?view=satellite');
        });
    });

    describe('FILE_TO_REPO mapping', () => {
        it('correctly maps CSV and JSON filenames to repos', () => {
            expect(FILE_TO_REPO['timna_valley.csv']).toBe('timna');
            expect(FILE_TO_REPO['faynan_data.csv']).toBe('faynan');
            expect(FILE_TO_REPO['iron_age_cities.csv']).toBe('iron_age');
            expect(FILE_TO_REPO['timna.json']).toBe('timna');
            expect(FILE_TO_REPO['faynan.json']).toBe('faynan');
            expect(FILE_TO_REPO['iron_age.json']).toBe('iron_age');
        });
    });
});
