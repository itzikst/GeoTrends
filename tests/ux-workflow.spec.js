import { test, expect } from '@playwright/test';

test.describe('GeoTrends - Interactive UX Staging Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Load the dashboard application home page
        await page.goto('/');
        
        // Wait for the Leaflet map container to be fully initialized and visible
        await page.waitForSelector('#map', { state: 'visible' });
    });

    test('should verify correct layout layout parameters and copyright overlays', async ({ page }, testInfo) => {
        const isMobile = testInfo.project.name.startsWith('mobile');

        // 1. Verify standard container structure
        const appContainer = page.locator('.app-container');
        await expect(appContainer).toBeVisible();

        // 2. Verify copyright panel is flush in the bottom-left corner of the map
        const copyright = page.locator('#map-copyright');
        await expect(copyright).toBeVisible();
        await expect(copyright).toContainText('Itzik Stauber');
        await expect(copyright).toContainText('Explore Israel');
        
        // Check exact stylesheet details are aligned flush with map container left
        const mapContainer = page.locator('.map-container');
        const mapBox = await mapContainer.boundingBox();
        const copyrightBox = await copyright.boundingBox();
        
        expect(mapBox).not.toBeNull();
        expect(copyrightBox).not.toBeNull();
        expect(Math.abs(copyrightBox.x - mapBox.x)).toBeLessThan(5); // Sits flush on the left of map container

        // 3. Verify mobile-specific vs desktop-specific styles
        const sidebarCloseBtn = page.locator('#sidebar-close');
        const hamburgerBtn = page.locator('#menu-toggle');
        const mobileNav = page.locator('#mobile-map-nav');

        if (isMobile) {
            // Mobile: hamburger menu visible, close button hidden until sidebar opens
            await expect(hamburgerBtn).toBeVisible();
            await expect(mobileNav).toBeVisible();
            
            // Verify mobile nav buttons sit strictly above the flush copyright notice
            const mobileNavBox = await mobileNav.boundingBox();
            
            expect(mobileNavBox).not.toBeNull();
            // mobileNav sits higher than copyright
            expect(mobileNavBox.y + mobileNavBox.height).toBeLessThan(copyrightBox.y + 5); 
        } else {
            // Desktop/Laptop: hamburger hidden, mobile close button completely hidden
            await expect(hamburgerBtn).not.toBeVisible();
            await expect(sidebarCloseBtn).not.toBeVisible();
            await expect(mobileNav).not.toBeVisible();
        }
    });

    test('should verify automatic Timna dataset parsing and dynamic controls activation', async ({ page }) => {
        // Since loadDefaultCSV runs immediately on window load, we wait for controls to enable
        const playBtn = page.locator('#play-pause-btn');
        const prevBtn = page.locator('#prev-btn');
        const nextBtn = page.locator('#next-btn');

        // Confirm buttons become enabled after CSV loads successfully
        await expect(playBtn).toBeEnabled({ timeout: 10000 });
        await expect(prevBtn).toBeEnabled(); // Confirms that both buttons are active once data is ready
        await expect(nextBtn).toBeEnabled();

        // Verify that the markers have loaded and are rendered on map canvas
        const markerCount = await page.locator('.leaflet-marker-icon').count();
        expect(markerCount).toBeGreaterThan(0);
    });

    test('should verify animation navigation loops and time indicator changes', async ({ page }, testInfo) => {
        const isMobile = testInfo.project.name.startsWith('mobile');

        // Wait for data load
        const nextBtn = page.locator('#next-btn');
        const prevBtn = page.locator('#prev-btn');
        await expect(nextBtn).toBeEnabled({ timeout: 10000 });

        // Retrieve initial year display text
        const initialYear = await page.locator('#current-year-value').innerText();

        if (isMobile) {
            // On mobile, click the floating map next button
            const mobileNextBtn = page.locator('#mobile-next-btn');
            await expect(mobileNextBtn).toBeEnabled();
            await mobileNextBtn.click();
        } else {
            // On desktop/laptop, click the sidebar next button
            await nextBtn.click();
        }

        // Verify timeline year progresses and prev button enables
        const steppedYear = await page.locator('#current-year-value').innerText();
        expect(steppedYear).not.toBe(initialYear);
        await expect(prevBtn).toBeEnabled();
    });

    test('should verify clickable personal copyright links open in new window', async ({ page }) => {
        const copyright = page.locator('#map-copyright');
        const facebookLink = copyright.locator('a:has-text("Itzik Stauber")');
        const exploreLink = copyright.locator('a:has-text("Explore Israel")');

        await expect(facebookLink).toHaveAttribute('href', 'https://www.facebook.com/itzik.stauber');
        await expect(facebookLink).toHaveAttribute('target', '_blank');

        await expect(exploreLink).toHaveAttribute('href', 'https://exploreisrael.online/en');
        await expect(exploreLink).toHaveAttribute('target', '_blank');
    });

    test('should switch between base map views (Topographic, Satellite, Geologic)', async ({ page }) => {
        const selector = page.locator('#basemap-selector');
        await expect(selector).toBeVisible();

        const topoBtn = page.locator('.basemap-btn[data-basemap="topo"]');
        const satBtn = page.locator('.basemap-btn[data-basemap="satellite"]');
        const geoBtn = page.locator('.basemap-btn[data-basemap="geologic"]');

        await expect(topoBtn).toHaveClass(/active/);

        // Switch to Satellite
        await satBtn.click();
        await expect(satBtn).toHaveClass(/active/);
        await expect(topoBtn).not.toHaveClass(/active/);

        // Switch to Geologic
        await geoBtn.click();
        await expect(geoBtn).toHaveClass(/active/);
        await expect(satBtn).not.toHaveClass(/active/);

        // Switch back to Topographic
        await topoBtn.click();
        await expect(topoBtn).toHaveClass(/active/);
    });
});
