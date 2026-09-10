# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\gameplay-loop.spec.ts >> Complete Gameplay Loop with Crew System >> Test B: Vehicle FMS prevents double-alarming
- Location: tests\gameplay-loop.spec.ts:47:7

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
              - button "Kreislaufprobleme Rettungsdienst · Rettungswache Zentrum 240 € · 0 alarmiert" [active] [ref=e45] [cursor=pointer]:
                - strong [ref=e46]: Kreislaufprobleme
                - generic [ref=e47]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e48]: 240 € · 0 alarmiert
            - listitem [ref=e49]:
              - button "Atemnot Rettungsdienst · Rettungswache Nord 260 € · 0 alarmiert" [ref=e50] [cursor=pointer]:
                - strong [ref=e51]: Atemnot
                - generic [ref=e52]: Rettungsdienst · Rettungswache Nord
                - generic [ref=e53]: 260 € · 0 alarmiert
            - listitem [ref=e54]:
              - button "Schnittverletzung Rettungsdienst · Rettungswache Süd 230 € · 0 alarmiert" [ref=e55] [cursor=pointer]:
                - strong [ref=e56]: Schnittverletzung
                - generic [ref=e57]: Rettungsdienst · Rettungswache Süd
                - generic [ref=e58]: 230 € · 0 alarmiert
            - listitem [ref=e59]:
              - button "Brennender PKW Feuerwehr · Rettungswache Süd 310 € · 0 alarmiert" [ref=e60] [cursor=pointer]:
                - strong [ref=e61]: Brennender PKW
                - generic [ref=e62]: Feuerwehr · Rettungswache Süd
                - generic [ref=e63]: 310 € · 0 alarmiert
            - listitem [ref=e64]:
              - button "Atemnot Rettungsdienst · Feuerwache West 260 € · 0 alarmiert" [ref=e65] [cursor=pointer]:
                - strong [ref=e66]: Atemnot
                - generic [ref=e67]: Rettungsdienst · Feuerwache West
                - generic [ref=e68]: 260 € · 0 alarmiert
            - listitem [ref=e69]:
              - button "Brennender Papierkorb Feuerwehr · Rettungswache Süd 220 € · 0 alarmiert" [ref=e70] [cursor=pointer]:
                - strong [ref=e71]: Brennender Papierkorb
                - generic [ref=e72]: Feuerwehr · Rettungswache Süd
                - generic [ref=e73]: 220 € · 0 alarmiert
            - listitem [ref=e74]:
              - button "Brennender PKW Feuerwehr · Rettungswache Süd 310 € · 0 alarmiert" [ref=e75] [cursor=pointer]:
                - strong [ref=e76]: Brennender PKW
                - generic [ref=e77]: Feuerwehr · Rettungswache Süd
                - generic [ref=e78]: 310 € · 0 alarmiert
            - listitem [ref=e79]:
              - button "Kreislaufprobleme Rettungsdienst · Rettungswache Zentrum 240 € · 0 alarmiert" [ref=e80] [cursor=pointer]:
                - strong [ref=e81]: Kreislaufprobleme
                - generic [ref=e82]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e83]: 240 € · 0 alarmiert
            - listitem [ref=e84]:
              - button "Sturz Rettungsdienst · Rettungswache Zentrum 220 € · 0 alarmiert" [ref=e85] [cursor=pointer]:
                - strong [ref=e86]: Sturz
                - generic [ref=e87]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e88]: 220 € · 0 alarmiert
            - listitem [ref=e89]:
              - button "Schnittverletzung Rettungsdienst · Rettungswache Zentrum 230 € · 0 alarmiert" [ref=e90] [cursor=pointer]:
                - strong [ref=e91]: Schnittverletzung
                - generic [ref=e92]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e93]: 230 € · 0 alarmiert
            - listitem [ref=e94]:
              - button "Mülleimerbrand Feuerwehr · Rettungswache Zentrum 250 € · 1 alarmiert" [ref=e95] [cursor=pointer]:
                - strong [ref=e96]: Mülleimerbrand
                - generic [ref=e97]: Feuerwehr · Rettungswache Zentrum
                - generic [ref=e98]: 250 € · 1 alarmiert
            - listitem [ref=e99]:
              - button "Sturz Rettungsdienst · Rettungswache Zentrum 220 € · 0 alarmiert" [ref=e100] [cursor=pointer]:
                - strong [ref=e101]: Sturz
                - generic [ref=e102]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e103]: 220 € · 0 alarmiert
            - listitem [ref=e104]:
              - button "Schnittverletzung Rettungsdienst · Rettungswache Zentrum 230 € · 0 alarmiert" [ref=e105] [cursor=pointer]:
                - strong [ref=e106]: Schnittverletzung
                - generic [ref=e107]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e108]: 230 € · 0 alarmiert
            - listitem [ref=e109]:
              - button "Sturz Rettungsdienst · Rettungswache Zentrum 220 € · 0 alarmiert" [ref=e110] [cursor=pointer]:
                - strong [ref=e111]: Sturz
                - generic [ref=e112]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e113]: 220 € · 0 alarmiert
            - listitem [ref=e114]:
              - button "Brustschmerzen Rettungsdienst · Rettungswache Zentrum 280 € · 0 alarmiert" [ref=e115] [cursor=pointer]:
                - strong [ref=e116]: Brustschmerzen
                - generic [ref=e117]: Rettungsdienst · Rettungswache Zentrum
                - generic [ref=e118]: 280 € · 0 alarmiert
        - generic [ref=e120]:
          - heading "Kreislaufprobleme" [level=3] [ref=e121]
          - generic [ref=e122]:
            - generic [ref=e123]:
              - strong [ref=e124]: "Status:"
              - text: Offen
            - generic [ref=e125]:
              - strong [ref=e126]: "Belohnung:"
              - text: 240 €
          - generic [ref=e127]:
            - strong [ref=e129]: Anforderungen
            - generic [ref=e130]:
              - generic [ref=e131]: RTW
              - generic [ref=e132]: 1× (0/1)
          - heading "Eingesetzte Fahrzeuge (0)" [level=4] [ref=e133]
          - paragraph [ref=e134]: Keine Fahrzeuge eingesetzt.
          - heading "Verfügbare Fahrzeuge" [level=4] [ref=e135]
          - list [ref=e136]:
            - listitem [ref=e137]:
              - generic [ref=e138]:
                - checkbox "RTW-1 – RTW Rettungswache Zentrum · 2.4 km · ca. 2:40 Fahrzeug ist derzeit nicht einsatzbereit. Nicht verfügbar" [disabled] [ref=e139]
                - generic [ref=e140]:
                  - generic [ref=e141]: RTW-1 – RTW
                  - generic [ref=e142]: Rettungswache Zentrum · 2.4 km · ca. 2:40
                  - generic [ref=e143]: Fahrzeug ist derzeit nicht einsatzbereit.
                - generic [ref=e144]: Nicht verfügbar
          - button "Alarmieren" [disabled] [ref=e146]
  - button "🔧 Dev" [ref=e147] [cursor=pointer]
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
  26  |       await vehicleCheckbox.check();
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
> 65  |       await checkbox.check();
      |                      ^ Error: locator.check: Test timeout of 30000ms exceeded.
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
  127 | 
  128 |     await page.click('button:has-text("Wachen")');
  129 |     await page.waitForTimeout(300);
  130 |     await page.click('button:has-text("Wachenkatalog")');
  131 |     await page.waitForTimeout(500);
  132 | 
  133 |     const stationButtons = page.locator('button:has-text("Wache kaufen")');
  134 |     if (await stationButtons.count() > 0) {
  135 |       await stationButtons.first().click();
  136 |       await page.waitForTimeout(500);
  137 |     }
  138 | 
  139 |     await page.click('button:has-text("Meine Wachen")');
  140 |     await page.waitForTimeout(300);
  141 | 
  142 |     const ownedStationCount = await page.locator('button .station-card').count();
  143 |     expect(ownedStationCount).toBeGreaterThanOrEqual(2);
  144 | 
  145 |     await page.click('button:has-text("Fahrzeug kaufen")');
  146 |     await page.waitForTimeout(500);
  147 |     const buyButtons = page.locator('button:has-text("Fahrzeug kaufen")');
  148 |     if (await buyButtons.count() > 0) {
  149 |       await buyButtons.first().click();
  150 |       await page.waitForTimeout(500);
  151 |     }
  152 | 
  153 |     await page.click('button:has-text("Einsätze")');
  154 |     await page.waitForTimeout(300);
  155 |     await page.click('button:has-text("Test-Einsatz")');
  156 |     await page.waitForTimeout(500);
  157 | 
  158 |     const incidentButton = page.locator('.view-menu-item').first();
  159 |     if (await incidentButton.count() > 0) {
  160 |       await incidentButton.click();
  161 |       await page.waitForTimeout(300);
  162 |     }
  163 | 
  164 |     await expect(page.locator('text=Rettungswache')).toBeVisible({ timeout: 5000 });
  165 |     await expect(page.locator('text=Alarmieren')).toBeVisible({ timeout: 5000 });
```