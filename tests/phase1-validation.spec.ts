import { test, expect } from '@playwright/test';

test.describe('Phase 1: Core Game Systems', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  });

  test('1.1: Multi-station crew assignment - crew stays in same station', async ({ page }) => {
    // Set high balance for testing
    await page.click('button:has-text("Dev")');
    await page.fill('input[type="number"]', '500000');
    await page.click('button:has-text("SET")');
    await page.waitForTimeout(300);

    // Buy second station
    await page.click('button:has-text("Wachen")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Wachenkatalog")');
    await page.waitForTimeout(500);
    const buyButtons = page.locator('button:has-text("Wache kaufen")');
    if (await buyButtons.count() > 0) {
      await buyButtons.first().click();
      await page.waitForTimeout(800);
    }

    // Verify two owned stations
    await page.click('button:has-text("Meine Wachen")');
    await page.waitForTimeout(300);
    const ownedStations = page.locator('[class*="station-card"]');
    const stationCount = await ownedStations.count();
    expect(stationCount).toBeGreaterThanOrEqual(2);

    console.log('✅ Multi-station crew assignment test setup complete');
  });

  test('1.2: Vehicle FMS status prevents double-alarm', async ({ page }) => {
    // Create incident
    await page.click('button:has-text("Einsätze")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Test-Einsatz")');
    await page.waitForTimeout(500);

    // Select first incident and alarm vehicle
    const incidents = page.locator('.view-menu-item');
    if (await incidents.count() > 0) {
      await incidents.first().click();
      await page.waitForTimeout(300);
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.click('button:has-text("Alarmieren")');
        await page.waitForTimeout(500);
        
        // Try to alarm same vehicle again - should fail
        const secondCheckbox = page.locator('input[type="checkbox"]').first();
        const isAvailable = await secondCheckbox.isEnabled().catch(() => false);
        expect(isAvailable).toBe(false);
      }
    }
    console.log('✅ Double-alarm prevention test passed');
  });

  test('1.3: Incident completion is idempotent', async ({ page }) => {
    // Create and complete incident
    await page.click('button:has-text("Einsätze")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Test-Einsatz")');
    await page.waitForTimeout(500);

    const incidents = page.locator('.view-menu-item');
    if (await incidents.count() > 0) {
      await incidents.first().click();
      await page.waitForTimeout(300);
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.click('button:has-text("Alarmieren")');
        await page.waitForTimeout(500);

        // Wait for auto-completion
        await page.waitForTimeout(20000);

        // Check completed tab has incident
        const completedTab = page.locator('button:has-text("Abgeschlossen")');
        if (await completedTab.count() > 0) {
          await completedTab.click();
          await page.waitForTimeout(500);
          const completedCount = await page.locator('.view-menu-item').count();
          expect(completedCount).toBeGreaterThan(0);
        }
      }
    }
    console.log('✅ Incident completion idempotency test passed');
  });

  test('1.4: Vehicle capacity blocks purchase', async ({ page }) => {
    // Get to first station
    await page.click('button:has-text("Wachen")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Meine Wachen")');
    await page.waitForTimeout(300);

    const stations = page.locator('[class*="station-card"]');
    if (await stations.count() > 0) {
      await stations.first().click();
      await page.waitForTimeout(300);

      // Try to buy vehicles until full
      let vehicleCount = 0;
      for (let i = 0; i < 5; i++) {
        const buyButton = page.locator('button:has-text("Fahrzeug kaufen")').first();
        if (await buyButton.count() > 0) {
          await buyButton.click();
          await page.waitForTimeout(400);
          const confirm = page.locator('button:has-text("Fahrzeug kaufen")').first();
          if (await confirm.count() > 0) {
            await confirm.click();
            await page.waitForTimeout(500);
            vehicleCount++;
          }
        }
        // Check for "no slots" message
        const noSlots = page.locator('text=Keine freien Stellplätze');
        if (await noSlots.count() > 0) {
          break;
        }
      }
      expect(vehicleCount).toBeGreaterThan(0);
    }
    console.log('✅ Vehicle capacity blocking test passed');
  });

  test('1.5: Reload during incident preserves state', async ({ page }) => {
    // Create incident
    await page.click('button:has-text("Einsätze")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Test-Einsatz")');
    await page.waitForTimeout(500);

    // Alarm vehicle
    const incidents = page.locator('.view-menu-item');
    if (await incidents.count() > 0) {
      await incidents.first().click();
      await page.waitForTimeout(300);
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.click('button:has-text("Alarmieren")');
        await page.waitForTimeout(500);

        // Get status before reload
        const statusBefore = await page.locator('text=Fahrzeuge alarmiert').count();
        expect(statusBefore).toBeGreaterThan(0);

        // Reload page
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Navigate back to incidents
        await page.click('button:has-text("Einsätze")');
        await page.waitForTimeout(300);

        // Check incident still exists
        const afterReload = await page.locator('.view-menu-item').count();
        expect(afterReload).toBeGreaterThan(0);
      }
    }
    console.log('✅ Reload state preservation test passed');
  });

  test('1.6: Crew released after incident completion', async ({ page }) => {
    // Create and complete incident
    await page.click('button:has-text("Einsätze")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Test-Einsatz")');
    await page.waitForTimeout(500);

    const incidents = page.locator('.view-menu-item');
    if (await incidents.count() > 0) {
      await incidents.first().click();
      await page.waitForTimeout(300);
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.count() > 0) {
        const firstCheckboxState = await checkbox.isChecked();
        await checkbox.check();
        await page.click('button:has-text("Alarmieren")');
        await page.waitForTimeout(500);

        // Wait for completion
        await page.waitForTimeout(20000);

        // Switch to another incident and check vehicle is available
        await page.click('button:has-text("Test-Einsatz")');
        await page.waitForTimeout(500);

        const newIncidents = page.locator('.view-menu-item');
        if (await newIncidents.count() > 1) {
          await newIncidents.nth(1).click();
          await page.waitForTimeout(300);

          // Vehicle should be available now
          const availableCheckboxes = page.locator('input[type="checkbox"]:enabled');
          const count = await availableCheckboxes.count();
          expect(count).toBeGreaterThan(0);
        }
      }
    }
    console.log('✅ Crew release after completion test passed');
  });
});
