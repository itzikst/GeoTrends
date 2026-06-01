import { describe, it, expect } from 'vitest';
import { normalizeLocationData, determineYearBounds } from './data-loader.js';

describe('GeoTrends - Data Loader Unit Tests', () => {
    describe('normalizeLocationData()', () => {
        it('should group overlapping rows by location name and merge their periods', () => {
            const raw = [
                {
                    'Location Name': 'Timna Site 2',
                    'Latitude': 29.78,
                    'Longitude': 34.98,
                    'Start Year': -1200,
                    'End Time': -1000,
                    'Type': 'Mining site',
                    'Description': 'Early mines'
                },
                {
                    'Location Name': 'Timna Site 2',
                    'Latitude': 29.78,
                    'Longitude': 34.98,
                    'Start Year': -950,
                    'End Time': -900,
                    'Type': 'Smelting camp',
                    'Description': 'Iron Age smelting'
                }
            ];

            const result = normalizeLocationData(raw);

            expect(result).toHaveLength(1);
            expect(result[0]['location name']).toBe('Timna Site 2');
            expect(result[0].latitude).toBe(29.78);
            expect(result[0].longitude).toBe(34.98);
            expect(result[0].periods).toHaveLength(2);
            expect(result[0].periods[0]).toEqual([-1200, -1000, 'Mining site', 'Early mines']);
            expect(result[0].periods[1]).toEqual([-950, -900, 'Smelting camp', 'Iron Age smelting']);
        });

        it('should normalize varying coordinate and name casing', () => {
            const raw = [
                {
                    'entityLabel': 'Tel Megiddo',
                    'lat': 32.58,
                    'lng': 35.18,
                    'start': -1000,
                    'end': -800,
                    'title': 'Fortress'
                }
            ];

            const result = normalizeLocationData(raw);

            expect(result).toHaveLength(1);
            expect(result[0]['location name']).toBe('Tel Megiddo');
            expect(result[0].latitude).toBe(32.58);
            expect(result[0].longitude).toBe(35.18);
        });

        it('should exclude rows with invalid coordinates (unless they are footers)', () => {
            const raw = [
                { 'Location Name': 'Invalid Lat', 'Latitude': 'not-a-number', 'Longitude': 35 },
                { 'Location Name': 'Footer', 'Start Year': -1000, 'End Time': -500 }
            ];

            const result = normalizeLocationData(raw);
            expect(result).toHaveLength(1);
            expect(result[0]['location name']).toBe('Footer');
        });
    });

    describe('determineYearBounds()', () => {
        it('should compute absolute min and max years and return a sorted set of milestone event years', () => {
            const locations = [
                {
                    periods: [
                        [-1000, -800, 'P1'],
                        [-1200, -950, 'P2']
                    ]
                },
                {
                    periods: [
                        [-500, -300, 'P3']
                    ]
                }
            ];

            const bounds = determineYearBounds(locations);

            expect(bounds.minYear).toBe(-1200);
            expect(bounds.maxYear).toBe(-300);
            expect(bounds.eventYears).toEqual([-1200, -1000, -950, -800, -500, -300]);
        });

        it('should return empty/zeros for invalid or empty inputs', () => {
            expect(determineYearBounds([])).toEqual({ minYear: 0, maxYear: 0, eventYears: [] });
            expect(determineYearBounds(null)).toEqual({ minYear: 0, maxYear: 0, eventYears: [] });
        });
    });
});
