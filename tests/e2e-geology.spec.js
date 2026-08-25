import { test, expect } from '@playwright/test';

test.describe('Geology View & Project Config E2E Tests', () => {

    test('Timna Geologic View loads project config, GSI geology, hillshade, and dynamic legend', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('http://localhost:8080/timna?view=geologic', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.leaflet-tile-pane img', { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Verify no uncaught JavaScript exceptions occurred
        expect(pageErrors).toEqual([]);

        // Verify dynamic project header from timna.json
        const headerText = await page.textContent('#map-header');
        expect(headerText.trim()).toBe('Timna Valley Archaeological Sites & Features');

        // Verify active basemap button
        const activeBasemap = await page.getAttribute('.basemap-btn.active', 'data-basemap');
        expect(activeBasemap).toBe('geologic');

        // Verify geology legend section is visible and populated dynamically
        const geologyLegendStats = await page.evaluate(() => {
            const sec = document.getElementById('geology-legend-section');
            const legendDiv = document.querySelector('.info.legend');
            return {
                display: sec?.style.display,
                maxHeight: legendDiv?.style.maxHeight,
                itemCount: document.querySelectorAll('.geology-legend-grid > div').length
            };
        });
        expect(geologyLegendStats.display).toBe('block');
        expect(geologyLegendStats.maxHeight).toBe('520px');
        expect(geologyLegendStats.itemCount).toBeGreaterThan(0);

        // Verify map center is near Timna
        const center = await page.evaluate(() => window.map.getCenter());
        expect(center.lat).toBeGreaterThan(29.0);
        expect(center.lat).toBeLessThan(30.5);

        // Verify high-contrast-markers class is active in geologic view
        const hasHighContrast = await page.evaluate(() => {
            return document.getElementById('map')?.classList.contains('high-contrast-markers');
        });
        expect(hasHighContrast).toBe(true);

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

    test('Faynan Geologic View loads project config, Jordan geology polygons, and dynamic legend from GeoJSON', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('http://localhost:8080/faynan?view=geologic', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.leaflet-tile-pane img', { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Verify no uncaught JavaScript exceptions occurred
        expect(pageErrors).toEqual([]);

        // Verify dynamic project header from faynan.json
        const headerText = await page.textContent('#map-header');
        expect(headerText.trim()).toBe('Faynan Archaeological District Mining & Metallurgy');

        // Verify active basemap button
        const activeBasemap = await page.getAttribute('.basemap-btn.active', 'data-basemap');
        expect(activeBasemap).toBe('geologic');

        // Verify geology legend section is visible and contains swatches extracted from Jordan GeoJSON
        const geologyLegendDisplay = await page.evaluate(() => {
            return document.getElementById('geology-legend-section')?.style.display;
        });
        expect(geologyLegendDisplay).toBe('block');

        const legendItemCount = await page.evaluate(() => {
            return document.querySelectorAll('.geology-legend-grid > div').length;
        });
        expect(legendItemCount).toBeGreaterThan(0);

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

    test('Iron Age Geologic View loads project config, Hebrew header, and GSI geology', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.goto('http://localhost:8080/iron_age?view=geologic', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.leaflet-tile-pane img', { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Verify no uncaught JavaScript exceptions occurred
        expect(pageErrors).toEqual([]);

        // Verify dynamic project header from iron_age.json
        const headerText = await page.textContent('#map-header');
        expect(headerText.trim()).toBe('Samaria and Jezreel Valley: Iron Age Urban centers');

        // Verify active basemap button
        const activeBasemap = await page.getAttribute('.basemap-btn.active', 'data-basemap');
        expect(activeBasemap).toBe('geologic');

        // Verify map center is near central Israel / Samaria (lat ~32)
        const center = await page.evaluate(() => window.map.getCenter());
        expect(center.lat).toBeGreaterThan(31.5);
        expect(center.lat).toBeLessThan(33.0);

        // Verify markers exist on map
        const markerCount = await page.evaluate(() => {
            return document.querySelectorAll('.leaflet-marker-pane img').length;
        });
        expect(markerCount).toBeGreaterThan(0);
    });

    test('Open Project dropdown displays project headers from JSON configs', async ({ page }) => {
        await page.goto('http://localhost:8080/timna', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#open-btn', { timeout: 10000 });

        // Click Open Project button to open the dropdown
        await page.click('#open-btn');
        await page.waitForFunction(() => {
            const items = document.querySelectorAll('#open-dropdown .dropdown-item');
            return items.length > 0 && !items[0].textContent.includes('Loading');
        }, { timeout: 5000 });

        const itemTexts = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#open-dropdown .dropdown-item')).map(el => el.textContent.trim());
        });

        expect(itemTexts).toContain('Timna Valley Archaeological Sites & Features');
        expect(itemTexts).toContain('Faynan Archaeological District Mining & Metallurgy');
        expect(itemTexts).toContain('Samaria and Jezreel Valley: Iron Age Urban centers');
    });

    test('Opening URL with ?year=-1200 initializes app at 1200 BC', async ({ page }) => {
        await page.goto('http://localhost:8080/timna?year=-1200', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#current-year-value', { timeout: 10000 });
        await page.waitForTimeout(1500);

        // Verify year display shows 1200 BC
        const yearDisplay = await page.textContent('#current-year-value');
        expect(yearDisplay.trim()).toBe('1200 BC');

        // Verify markers are rendered for this specific year
        const markerCount = await page.evaluate(() => {
            return document.querySelectorAll('.leaflet-marker-pane img').length;
        });
        expect(markerCount).toBeGreaterThan(0);
    });

    test('Opening URL with standard query string ?view=geologic&year=-1000 parses correctly', async ({ page }) => {
        await page.goto('http://localhost:8080/faynan?view=geologic&year=-1000', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#current-year-value', { timeout: 10000 });
        await page.waitForTimeout(1500);

        // Verify year display shows 1000 BC
        const yearDisplay = await page.textContent('#current-year-value');
        expect(yearDisplay.trim()).toBe('1000 BC');

        // Verify active basemap is geologic
        const activeBasemap = await page.getAttribute('.basemap-btn.active', 'data-basemap');
        expect(activeBasemap).toBe('geologic');
    });

    test('Clicking on the time ruler updates current year and time indicator', async ({ page }) => {
        await page.goto('http://localhost:8080/timna', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#time-ruler', { timeout: 10000 });
        await page.waitForTimeout(1500);

        const initialYear = await page.textContent('#current-year-value');

        // Click near the middle of the time ruler
        const rulerBox = await page.locator('#time-ruler').boundingBox();
        expect(rulerBox).not.toBeNull();

        await page.mouse.click(rulerBox.x + rulerBox.width * 0.5, rulerBox.y + rulerBox.height * 0.5);
        await page.waitForTimeout(500);

        const updatedYear = await page.textContent('#current-year-value');
        expect(updatedYear).not.toBe(initialYear);

        // Click near the 80% mark on the ruler
        await page.mouse.click(rulerBox.x + rulerBox.width * 0.8, rulerBox.y + rulerBox.height * 0.5);
        await page.waitForTimeout(500);

        const finalYear = await page.textContent('#current-year-value');
        expect(finalYear).not.toBe(updatedYear);
    });

    test('Switching repositories resets year to minimum year of the new repository', async ({ page }) => {
        // 1. Open Timna at an advanced year (e.g. 1200 BC)
        await page.goto('http://localhost:8080/timna?year=-1200', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#current-year-value', { timeout: 10000 });
        await page.waitForTimeout(1500);

        const timnaYear = await page.textContent('#current-year-value');
        expect(timnaYear.trim()).toBe('1200 BC');

        // 2. Open dropdown and switch to Faynan
        await page.click('#open-btn');
        await page.waitForSelector('#open-dropdown .dropdown-item', { timeout: 5000 });
        
        // Click Faynan project
        const faynanItem = page.locator('#open-dropdown .dropdown-item', { hasText: 'Faynan Archaeological District' });
        await faynanItem.click();

        // 3. Wait for data to load and verify year resets to Faynan's minYear (1500 BC / -1500)
        await page.waitForFunction(() => {
            const header = document.querySelector('#map-header');
            return header && header.textContent.includes('Faynan');
        }, { timeout: 10000 });
        await page.waitForTimeout(1000);

        const faynanYear = await page.textContent('#current-year-value');
        expect(faynanYear.trim()).toBe('1500 BC');
    });

    test('Hybrid Mode: low-res Israel GeoJSON renders when zoomed out in Geologic view', async ({ page }) => {
        await page.goto('http://localhost:8080/timna?view=geologic', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.leaflet-tile-pane img', { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Zoom out to zoom level 8 (where GSI vector tiles have no data)
        await page.evaluate(() => window.map.setZoom(8));
        await page.waitForTimeout(2000);

        // Verify that the low-res GeoJSON overlay canvas or paths are rendered on map
        const hasOverlayElements = await page.evaluate(() => {
            const canvasCount = document.querySelectorAll('.leaflet-overlay-pane canvas').length;
            const pathCount = document.querySelectorAll('.leaflet-overlay-pane svg path').length;
            return canvasCount > 0 || pathCount > 0;
        });
        expect(hasOverlayElements).toBe(true);
    });

});
