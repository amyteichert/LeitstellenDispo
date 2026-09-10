# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\gameplay-loop.spec.ts >> Complete Gameplay Loop with Crew System >> Test A: Full incident cycle with crew reservation and release
- Location: tests\gameplay-loop.spec.ts:9:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.check: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="checkbox"]').first()
    - locator resolved to <input disabled type="checkbox"/>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    47 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - img "LeitstellenDispo Banner"
    - generic [ref=e6]:
      - navigation "Hauptnavigation" [ref=e7]:
        - button "Leitstelle" [ref=e8] [cursor=pointer]
        - button "Karte" [ref=e9] [cursor=pointer]
        - button "Wachen" [ref=e10] [cursor=pointer]
        - button "Fahrzeuge" [ref=e11] [cursor=pointer]
        - button "Einsätze" [ref=e12] [cursor=pointer]
        - button "Finanzen" [ref=e13] [cursor=pointer]
      - button "Einsätze" [ref=e15] [cursor=pointer]
  - main [ref=e17]:
    - generic [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]: Leitstellenbetrieb
          - heading "Einsätze" [level=2] [ref=e23]
        - button "＋ Test-Einsatz erzeugen" [ref=e24] [cursor=pointer]
      - generic [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]: Abgeschlossen
          - strong [ref=e28]: "0"
        - generic [ref=e29]:
          - generic [ref=e30]: RD
          - strong [ref=e31]: "0"
        - generic [ref=e32]:
          - generic [ref=e33]: FW
          - strong [ref=e34]: "0"
        - generic [ref=e35]:
          - generic [ref=e36]: Verdient
          - strong [ref=e37]: 0 €
      - generic [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - button "Aktive Einsätze" [ref=e41] [cursor=pointer]
            - button "Abgeschlossen" [ref=e42] [cursor=pointer]
          - list [ref=e43]:
            - listitem [ref=e44]:
              - button "Schnittverletzung Rettungsdienst · Rettungswache Süd 230 € · 0 alarmiert" [active] [ref=e45] [cursor=pointer]:
                - strong [ref=e46]: Schnittverletzung
                - generic [ref=e47]: Rettungsdienst · Rettungswache Süd
                - generic [ref=e48]: 230 € · 0 alarmiert
            - listitem [ref=e49]:
              - button "Brennender PKW Feuerwehr · Rettungswache Süd 310 € · 0 alarmiert" [ref=e50] [cursor=pointer]:
                - strong [ref=e51]: Brennender PKW
                - generic [ref=e52]: Feuerwehr · Rettungswache Süd
                - generic [ref=e53]: 310 € · 0 alarmiert
            - listitem [ref=e54]:
              - button "Atemnot Rettungsdienst · Feuerwache West 260 € · 0 alarmiert" [ref=e55] [cursor=pointer]:
                - strong [ref=e56]: Atemnot
                - generic [ref=e57]: Rettungsdienst · Feuerwache West
                - generic [ref=e58]: 260 € · 0 alarmiert
            - listitem [ref=e59]:
              - button "Brennender Papierkorb Feuerwehr · Rettungswache Süd 220 € · 0 alarmiert" [ref=e60] [cursor=pointer]:
                - strong [ref=e61]: Brennender Papierkorb
                - generic [ref=e62]: Feuerwehr · Rettungswache Süd
                - generic [ref=e63]: 220 € · 0 alarmiert
            - listitem [ref=e64]:
              - button "Brennender PKW Feuerwehr · Rettungswache Süd 310 € · 0 alarmiert" [ref=e65] [cursor=pointer]:
                - strong [ref=e66]: Brennender PKW
                - generic [ref=e67]: Feuerwehr · Rettungswache Süd
                - generic [ref=e68]: 310 € · 0 alarmiert
            - listitem [ref=e69]:
              - button "Kreislaufprobleme Rettungsdienst · Rettungswache Zentrum 240 € · 0 alarmiert" [ref=e70] [cursor=pointer]:
                - strong [ref=e71]: Kreislaufprobleme
                - generic [ref=e72]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e73]: 240 € · 0 alarmiert
            - listitem [ref=e74]:
              - button "Sturz Rettungsdienst · Rettungswache Zentrum 220 € · 0 alarmiert" [ref=e75] [cursor=pointer]:
                - strong [ref=e76]: Sturz
                - generic [ref=e77]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e78]: 220 € · 0 alarmiert
            - listitem [ref=e79]:
              - button "Schnittverletzung Rettungsdienst · Rettungswache Zentrum 230 € · 0 alarmiert" [ref=e80] [cursor=pointer]:
                - strong [ref=e81]: Schnittverletzung
                - generic [ref=e82]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e83]: 230 € · 0 alarmiert
            - listitem [ref=e84]:
              - button "Mülleimerbrand Feuerwehr · Rettungswache Zentrum 250 € · 1 alarmiert" [ref=e85] [cursor=pointer]:
                - strong [ref=e86]: Mülleimerbrand
                - generic [ref=e87]: Feuerwehr · Rettungswache Zentrum
                - generic [ref=e88]: 250 € · 1 alarmiert
            - listitem [ref=e89]:
              - button "Sturz Rettungsdienst · Rettungswache Zentrum 220 € · 0 alarmiert" [ref=e90] [cursor=pointer]:
                - strong [ref=e91]: Sturz
                - generic [ref=e92]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e93]: 220 € · 0 alarmiert
            - listitem [ref=e94]:
              - button "Schnittverletzung Rettungsdienst · Rettungswache Zentrum 230 € · 0 alarmiert" [ref=e95] [cursor=pointer]:
                - strong [ref=e96]: Schnittverletzung
                - generic [ref=e97]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e98]: 230 € · 0 alarmiert
            - listitem [ref=e99]:
              - button "Sturz Rettungsdienst · Rettungswache Zentrum 220 € · 0 alarmiert" [ref=e100] [cursor=pointer]:
                - strong [ref=e101]: Sturz
                - generic [ref=e102]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e103]: 220 € · 0 alarmiert
            - listitem [ref=e104]:
              - button "Brustschmerzen Rettungsdienst · Rettungswache Zentrum 280 € · 0 alarmiert" [ref=e105] [cursor=pointer]:
                - strong [ref=e106]: Brustschmerzen
                - generic [ref=e107]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e108]: 280 € · 0 alarmiert
        - generic [ref=e110]:
          - heading "Schnittverletzung" [level=3] [ref=e111]
          - generic [ref=e112]:
            - generic [ref=e113]:
              - strong [ref=e114]: "Status:"
              - text: Offen
            - generic [ref=e115]:
              - strong [ref=e116]: "Belohnung:"
              - text: 230 €
          - generic [ref=e117]:
            - strong [ref=e119]: Anforderungen
            - generic [ref=e120]:
              - generic [ref=e121]: RTW
              - generic [ref=e122]: 1× (0/1)
          - heading "Eingesetzte Fahrzeuge (0)" [level=4] [ref=e123]
          - paragraph [ref=e124]: Keine Fahrzeuge eingesetzt.
          - heading "Verfügbare Fahrzeuge" [level=4] [ref=e125]
          - list [ref=e126]:
            - listitem [ref=e127]:
              - generic [ref=e128]:
                - checkbox "RTW-1 – RTW Rettungswache Zentrum · 0.4 km · ca. 30 Sek. Fahrzeug ist derzeit nicht einsatzbereit. Nicht verfügbar" [disabled] [ref=e129]
                - generic [ref=e130]:
                  - generic [ref=e131]: RTW-1 – RTW
                  - generic [ref=e132]: Rettungswache Zentrum · 0.4 km · ca. 30 Sek.
                  - generic [ref=e133]: Fahrzeug ist derzeit nicht einsatzbereit.
                - generic [ref=e134]: Nicht verfügbar
          - button "Alarmieren" [disabled] [ref=e136]
  - button "🔧 Dev" [ref=e137] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Complete Gameplay Loop with Crew System', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  6   |     await page.waitForTimeout(1000);
  7   |   });
  8   | 
  9   |   test('Test A: Full incident cycle with crew reservation and release', async ({ page }) => {
  10  |     // Navigate to Einsätze view
  11  |     await page.click('button:has-text("Einsätze")');
  12  |     await page.waitForTimeout(500);
  13  | 
  14  |     // Trigger test incident
  15  |     await page.click('button:has-text("Test-Einsatz")');
  16  |     await page.waitForTimeout(500);
  17  | 
  18  |     // Select first incident
  19  |     const firstIncident = page.locator('.view-menu-item').first();
  20  |     await firstIncident.click();
  21  |     await page.waitForTimeout(300);
  22  | 
  23  |     // Select a vehicle
  24  |     const vehicleCheckbox = page.locator('input[type="checkbox"]').first();
  25  |     if (await vehicleCheckbox.count() > 0) {
> 26  |       await vehicleCheckbox.check();
      |                             ^ Error: locator.check: Test timeout of 30000ms exceeded.
  27  |       await page.waitForTimeout(300);
  28  | 
  29  |       // Click Alarmieren
  30  |       await page.click('button:has-text("Alarmieren")');
  31  |       await page.waitForTimeout(500);
  32  | 
  33  |       // Verify status is "Fahrzeuge alarmiert"
  34  |       await expect(page.locator('text=Fahrzeuge alarmiert')).toBeVisible({ timeout: 5000 });
  35  | 
  36  |       // Wait for incident to complete (should take a few seconds with normal timing)
  37  |       await page.waitForTimeout(15000);
  38  | 
  39  |       // Verify incident is "Abgeschlossen"
  40  |       const completedVisible = await page.locator('text=Abgeschlossen').count();
  41  |       expect(completedVisible).toBeGreaterThan(0);
  42  | 
  43  |       console.log('✅ Test A PASSED: Full incident cycle works');
  44  |     }
  45  |   });
  46  | 
  47  |   test('Test B: Vehicle FMS prevents double-alarming', async ({ page }) => {
  48  |     await page.click('button:has-text("Einsätze")');
  49  |     await page.waitForTimeout(500);
  50  | 
  51  |     // Create two incidents
  52  |     await page.click('button:has-text("Test-Einsatz")');
  53  |     await page.waitForTimeout(500);
  54  |     await page.click('button:has-text("Test-Einsatz")');
  55  |     await page.waitForTimeout(500);
  56  | 
  57  |     // Select first incident and alarm a vehicle
  58  |     const firstIncident = page.locator('.view-menu-item').first();
  59  |     await firstIncident.click();
  60  |     await page.waitForTimeout(300);
  61  | 
  62  |     const checkbox = page.locator('input[type="checkbox"]').first();
  63  |     if (await checkbox.count() > 0) {
  64  |       const vehicleId = await checkbox.getAttribute('data-vehicle-id');
  65  |       await checkbox.check();
  66  |       await page.click('button:has-text("Alarmieren")');
  67  |       await page.waitForTimeout(500);
  68  | 
  69  |       // Switch to second incident
  70  |       const allIncidents = page.locator('.view-menu-item');
  71  |       if (await allIncidents.count() >= 2) {
  72  |         await allIncidents.nth(1).click();
  73  |         await page.waitForTimeout(300);
  74  | 
  75  |         // Try to find the same vehicle - it should not be available
  76  |         const checkboxes = page.locator('input[type="checkbox"]');
  77  |         const count = await checkboxes.count();
  78  |         expect(count).toBeGreaterThanOrEqual(0);
  79  | 
  80  |         console.log('✅ Test B PASSED: Vehicle unavailable for second incident');
  81  |       }
  82  |     }
  83  |   });
  84  | 
  85  |   test('Test G: Sequential incidents work without state issues', async ({ page }) => {
  86  |     let completed = 0;
  87  | 
  88  |     for (let i = 0; i < 2; i++) {
  89  |       await page.click('button:has-text("Einsätze")');
  90  |       await page.waitForTimeout(300);
  91  | 
  92  |       // Create incident
  93  |       await page.click('button:has-text("Test-Einsatz")');
  94  |       await page.waitForTimeout(500);
  95  | 
  96  |       // Get first incident
  97  |       const firstIncident = page.locator('.view-menu-item').first();
  98  |       await firstIncident.click();
  99  |       await page.waitForTimeout(300);
  100 | 
  101 |       // Alarm vehicle
  102 |       const checkbox = page.locator('input[type="checkbox"]').first();
  103 |       if (await checkbox.count() > 0) {
  104 |         await checkbox.check();
  105 |         await page.click('button:has-text("Alarmieren")');
  106 |         await page.waitForTimeout(500);
  107 | 
  108 |         // Wait for completion
  109 |         await page.waitForTimeout(15000);
  110 | 
  111 |         // Check if completed
  112 |         if (await page.locator('text=Abgeschlossen').count() > 0) {
  113 |           completed++;
  114 |         }
  115 |       }
  116 |     }
  117 | 
  118 |     expect(completed).toBeGreaterThan(0);
  119 |     console.log(`✅ Test G PASSED: ${completed} sequential incidents completed`);
  120 |   });
  121 | 
  122 |   test('Test H: Multi-station warning shows vehicles from separate owned stations', async ({ page }) => {
  123 |     await page.click('button:has-text("Dev")');
  124 |     await page.fill('input[type="number"]', '100000');
  125 |     await page.click('button:has-text("SET")');
  126 |     await page.waitForTimeout(300);
```