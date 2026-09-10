# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\gameplay-loop.spec.ts >> Complete Gameplay Loop with Crew System >> Test J: Full station capacity blocks extra vehicle purchase
- Location: tests\gameplay-loop.spec.ts:169:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Fahrzeug kaufen")').first()
    - locator resolved to <button type="button" class="btn btn--primary vehicle-shop-buy">Fahrzeug kaufen</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <button type="button">2x</button> from <div>…</div> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div>…</div> intercepts pointer events
  - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button type="button">1x</button> from <div>…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    11 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button type="button">1x</button> from <div>…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div>…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button type="button">1x</button> from <div>…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button type="button">1x</button> from <div>…</div> subtree intercepts pointer events
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
      - button "Wachen" [ref=e15] [cursor=pointer]
  - main [ref=e17]:
    - generic [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]: Fuhrpark erweitern
          - heading "Fahrzeug kaufen" [level=2] [ref=e23]
          - paragraph [ref=e24]:
            - text: Neue Einheit für
            - strong [ref=e25]: Rettungswache Zentrum
        - button "Zur Wache" [ref=e26] [cursor=pointer]
      - generic [ref=e27]:
        - navigation "Fahrzeugkategorien" [ref=e28]:
          - button "Rettungsfahrzeuge" [ref=e29] [cursor=pointer]
        - generic [ref=e30]:
          - text: Stellplätze
          - strong [ref=e31]: 1 / 2
          - text: · Guthaben
          - strong [ref=e32]: 100.000 €
      - article [ref=e34]:
        - generic [ref=e35]:
          - generic [ref=e36]: Rettungsdienst
          - generic [ref=e37]: 25.000 €
        - heading "RTW" [level=3] [ref=e38]
        - paragraph [ref=e39]: Rettungswagen für die medizinische Erstversorgung und den Transport von Patienten.
        - generic [ref=e40]:
          - generic [ref=e41]:
            - generic [ref=e42]: Funkrufname
            - textbox "Funkrufname" [ref=e43]:
              - /placeholder: RTW-1
          - button "Fahrzeug kaufen" [ref=e44] [cursor=pointer]
  - generic [ref=e45]:
    - generic [ref=e46]:
      - strong [ref=e47]: DEV PANEL
      - button "✕" [ref=e48] [cursor=pointer]
    - generic [ref=e49]:
      - strong [ref=e51]: "Guthaben:"
      - generic [ref=e52]:
        - spinbutton [ref=e53]: "100000"
        - button "SET" [ref=e54] [cursor=pointer]
      - generic [ref=e55]: "Aktuell: 100.000 €"
    - generic [ref=e56]:
      - strong [ref=e58]: "Zeit-Multiplikator:"
      - generic [ref=e59]:
        - button "0.1x" [ref=e60] [cursor=pointer]
        - button "0.5x" [ref=e61] [cursor=pointer]
        - button "1x" [ref=e62] [cursor=pointer]
        - button "2x" [ref=e63] [cursor=pointer]
        - button "5x" [ref=e64] [cursor=pointer]
      - generic [ref=e65]: Wartezeiten werden mit diesem Faktor verkürzt
    - button "📍 Test-Einsatz JETZT" [ref=e67] [cursor=pointer]
    - button "🔴 RESET" [ref=e69] [cursor=pointer]
```

# Test source

```ts
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
> 192 |         await newVehicleButtons.first().click();
      |                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
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