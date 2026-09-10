# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\gameplay-loop.spec.ts >> Complete Gameplay Loop with Crew System >> Test H: Multi-station warning shows vehicles from separate owned stations
- Location: tests\gameplay-loop.spec.ts:122:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 2
Received:    0
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
      - button "Wachen" [ref=e15] [cursor=pointer]
  - main [ref=e17]:
    - generic [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]: Standortnetz
          - heading "Wachen" [level=2] [ref=e23]
        - generic [ref=e24]: 4 Standorte
      - generic [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]:
              - button "Meine Wachen" [active] [ref=e29] [cursor=pointer]
              - button "Wachenkatalog" [ref=e30] [cursor=pointer]
            - textbox "Wachensuche" [ref=e31]:
              - /placeholder: Name, Ort, Adresse, Postleitzahl
            - generic [ref=e32]:
              - combobox [ref=e33]:
                - option "Alle Wachentypen" [selected]
                - option "Rettungswache"
                - option "Feuerwache"
              - combobox [ref=e34]:
                - option "Alle Bundesländer" [selected]
                - option "Baden-Württemberg"
          - list [ref=e35]:
            - listitem [ref=e36]:
              - button "Rettungswache Zentrum Rettungswache Eigene Wache Bergheimer Straße 7" [ref=e37] [cursor=pointer]:
                - strong [ref=e38]: Rettungswache Zentrum
                - generic [ref=e39]: Rettungswache
                - generic [ref=e40]: Eigene Wache
                - generic [ref=e41]: Bergheimer Straße 7
            - listitem [ref=e42]:
              - button "Rettungswache Süd Rettungswache Eigene Wache Schloßgartenweg 13" [ref=e43] [cursor=pointer]:
                - strong [ref=e44]: Rettungswache Süd
                - generic [ref=e45]: Rettungswache
                - generic [ref=e46]: Eigene Wache
                - generic [ref=e47]: Schloßgartenweg 13
            - listitem [ref=e48]:
              - button "Rettungswache Nord Rettungswache Eigene Wache Nordring 42" [ref=e49] [cursor=pointer]:
                - strong [ref=e50]: Rettungswache Nord
                - generic [ref=e51]: Rettungswache
                - generic [ref=e52]: Eigene Wache
                - generic [ref=e53]: Nordring 42
            - listitem [ref=e54]:
              - button "Feuerwache West Feuerwache Eigene Wache Mühlhausenstraße 18" [ref=e55] [cursor=pointer]:
                - strong [ref=e56]: Feuerwache West
                - generic [ref=e57]: Feuerwache
                - generic [ref=e58]: Eigene Wache
                - generic [ref=e59]: Mühlhausenstraße 18
        - generic [ref=e61]:
          - heading "Rettungswache Zentrum" [level=3] [ref=e62]
          - generic [ref=e63]:
            - button "Meine Wachen" [ref=e64] [cursor=pointer]
            - button "Wachenkatalog" [ref=e65] [cursor=pointer]
          - generic [ref=e66]:
            - button "Fuhrpark" [ref=e67] [cursor=pointer]
            - button "Wachenausbau" [ref=e68] [cursor=pointer]
          - generic [ref=e69]:
            - paragraph [ref=e70]:
              - generic [ref=e71]: Besitz
              - strong [ref=e72]: Eigene Wache
            - paragraph [ref=e73]:
              - generic [ref=e74]: Wachentyp
              - strong [ref=e75]: Rettungswache
            - paragraph [ref=e76]:
              - generic [ref=e77]: Fahrzeuge
              - strong [ref=e78]: 1 / 2
            - paragraph [ref=e79]:
              - generic [ref=e80]: Standort
              - strong [ref=e81]: Bergheimer Straße 7
            - paragraph [ref=e82]:
              - generic [ref=e83]: Ort
              - strong [ref=e84]: Stuttgart, 70173
            - paragraph [ref=e85]:
              - generic [ref=e86]: Bundesland
              - strong [ref=e87]: Baden-Württemberg
            - paragraph [ref=e88]:
              - generic [ref=e89]: Koordinaten
              - strong [ref=e90]: 48.7750, 9.1771
          - heading "Fahrzeuge" [level=4] [ref=e91]
          - list [ref=e92]:
            - listitem [ref=e93]:
              - strong [ref=e94]: RTW-1
              - generic [ref=e95]: RTW
              - generic [ref=e96]: "[4] Ankunft Einsatzstelle"
          - button "Fahrzeug kaufen" [ref=e97] [cursor=pointer]
  - generic [ref=e98]:
    - generic [ref=e99]:
      - strong [ref=e100]: DEV PANEL
      - button "✕" [ref=e101] [cursor=pointer]
    - generic [ref=e102]:
      - strong [ref=e104]: "Guthaben:"
      - generic [ref=e105]:
        - spinbutton [ref=e106]: "100000"
        - button "SET" [ref=e107] [cursor=pointer]
      - generic [ref=e108]: "Aktuell: 100.000 €"
    - generic [ref=e109]:
      - strong [ref=e111]: "Zeit-Multiplikator:"
      - generic [ref=e112]:
        - button "0.1x" [ref=e113] [cursor=pointer]
        - button "0.5x" [ref=e114] [cursor=pointer]
        - button "1x" [ref=e115] [cursor=pointer]
        - button "2x" [ref=e116] [cursor=pointer]
        - button "5x" [ref=e117] [cursor=pointer]
      - generic [ref=e118]: Wartezeiten werden mit diesem Faktor verkürzt
    - button "📍 Test-Einsatz JETZT" [ref=e120] [cursor=pointer]
    - button "🔴 RESET" [ref=e122] [cursor=pointer]
```

# Test source

```ts
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
> 143 |     expect(ownedStationCount).toBeGreaterThanOrEqual(2);
      |                               ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
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
  166 |     console.log('✅ Test H PASSED: Multi-station vehicle context is visible');
  167 |   });
  168 | 
  169 |   test('Test J: Full station capacity blocks extra vehicle purchase', async ({ page }) => {
  170 |     await page.click('button:has-text("Dev")');
  171 |     await page.fill('input[type="number"]', '100000');
  172 |     await page.click('button:has-text("SET")');
  173 |     await page.waitForTimeout(300);
  174 | 
  175 |     await page.click('button:has-text("Wachen")');
  176 |     await page.waitForTimeout(300);
  177 |     await page.click('button:has-text("Meine Wachen")');
  178 |     await page.waitForTimeout(300);
  179 | 
  180 |     const firstStation = page.locator('.station-card').first();
  181 |     if (await firstStation.count() > 0) {
  182 |       await firstStation.click();
  183 |       await page.waitForTimeout(300);
  184 |     }
  185 | 
  186 |     const purchaseVehicleButton = page.locator('button:has-text("Fahrzeug kaufen")').first();
  187 |     if (await purchaseVehicleButton.count() > 0) {
  188 |       await purchaseVehicleButton.click();
  189 |       await page.waitForTimeout(500);
  190 |       const newVehicleButtons = page.locator('button:has-text("Fahrzeug kaufen")');
  191 |       if (await newVehicleButtons.count() > 0) {
  192 |         await newVehicleButtons.first().click();
  193 |         await page.waitForTimeout(500);
  194 |       }
  195 |     }
  196 | 
  197 |     await expect(page.locator('text=Keine freien Stellplätze')).toBeVisible({ timeout: 5000 });
  198 |     console.log('✅ Test J PASSED: station capacity blocks extra vehicle purchase');
  199 |   });
  200 | });
  201 | 
```