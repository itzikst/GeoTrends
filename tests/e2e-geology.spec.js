import { test, expect } from '@playwright/test';

test.describe('Geology View & Hillshade E2E Tests', () => {

    test('Timna Geologic View loads GSI geology, hillshade, and synced legend', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('http://localhost:8080/timna?view=geologic', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.leaflet-tile-pane img', { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Verify no uncaught JavaScript exceptions occurred
        expect(pageErrors).toEqual([]);

        // Verify active basemap button
        const activeBasemap = await page.getAttribute('.basemap-btn.active', 'data-basemap');
        expect(activeBasemap).toBe('geologic');

        // Verify geology legend section is visible
        const geologyLegendDisplay = await page.evaluate(() => {
            return document.getElementById('geology-legend-section')?.style.display;
        });
        expect(geologyLegendDisplay).toBe('block');

        // Verify map center is near Timna
        const center = await page.evaluate(() => window.map.getCenter());
        expect(center.lat).toBeGreaterThan(29.0);
        expect(center.lat).toBeLessThan(30.5);

        // Verify tile layers and markers exist on map
        const layerStats = await page.evaluate(() => {
            return {
                tileImages: document.querySelectorAll('.leaflet-tile-pane img').length,
                markers: document.querySelectorAll('.leaflet-marker-pane img').length
            };
        });

        expect(layerStats.tileImages).toBeGreaterThan(0);
        expect(layerStats.markers).toBeGreaterThan(0);
    });

    test('Faynan Geologic View loads Jordan geology polygons, hillshade, and markers', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('http://localhost:8080/faynan?view=geologic', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.leaflet-tile-pane img', { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Verify no uncaught JavaScript exceptions occurred
        expect(pageErrors).toEqual([]);

        // Verify active basemap button
        const activeBasemap = await page.getAttribute('.basemap-btn.active', 'data-basemap');
        expect(activeBasemap).toBe('geologic');

        // Verify geology legend section is visible
        const geologyLegendDisplay = await page.evaluate(() => {
            return document.getElementById('geology-legend-section')?.style.display;
        });
        expect(geologyLegendDisplay).toBe('block');

        // Verify map center is near Faynan
        const center = await page.evaluate(() => window.map.getCenter());
        expect(center.lat).toBeGreaterThan(30.0);
        expect(center.lat).toBeLessThan(31.5);

        // Verify Jordan geology SVG paths, tile images, and markers are rendered
        const layerStats = await page.evaluate(() => {
            return {
                tileImages: document.querySelectorAll('.leaflet-tile-pane img').length,
                svgPaths: document.querySelectorAll('.leaflet-overlay-pane svg path').length,
                markers: document.querySelectorAll('.leaflet-marker-pane img').length
            };
        });

        expect(layerStats.tileImages).toBeGreaterThan(0);
        expect(layerStats.svgPaths).toBeGreaterThan(100);
        expect(layerStats.markers).toBeGreaterThan(0);
    });

});
