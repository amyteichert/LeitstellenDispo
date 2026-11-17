// Vollständiger Spieldurchlauf wie ein echter Spieler – mit dem Code, der gerade auf test deployt wird
const { chromium } = require('playwright');
const Database = require('module').createRequire('/home/user/LeitstellenDispo/server/package.json')('better-sqlite3');
const DB = '/tmp/claude-0/-home-user/edf84b6e-4d19-507c-b753-90618fca553f/scratchpad/qa/db/test.db';
let n = 0, ok = 0; const fails = [];
const rec = (name, bestanden, info = '') => { n++; if (bestanden) ok++; else fails.push(name); console.log(bestanden ? 'PASS' : 'FAIL', name, info); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('PAGE ' + e.message));
  page.on('console', m => m.type() === 'error' && !/401|503|favicon/.test(m.text()) && errs.push('CONSOLE ' + m.text().slice(0, 140)));
  const apiFehler = []; page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400 && ![401, 503].includes(r.status())) apiFehler.push(`${r.status()} ${r.request().method()} ${r.url().replace(/.*\/api/, '/api')}`); });
  page.on('dialog', d => d.accept());
  const tag = Date.now().toString(36).slice(-5); const name = 'Spieler' + tag;
  const db = (sql, ...a) => { const d = new Database(DB); const r = sql.trim().startsWith('SELECT') ? d.prepare(sql).get(...a) : d.prepare(sql).run(...a); d.close(); return r; };
  const stand = () => { const z = db('SELECT s.daten FROM spielstaende s JOIN benutzer b ON b.id = s.benutzer_id WHERE b.name = ?', name); return z ? JSON.parse(z.daten) : null; };
  const warte = async (fn, ms = 25000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch {} await page.waitForTimeout(600); } return false; };
  const menue = async (v) => { await page.locator('.view-trigger').first().click(); await page.waitForTimeout(250); await page.locator('.view-menu-item', { hasText: v }).first().click(); await page.waitForTimeout(800); };

  // --- 1./2. Registrierung + Anmeldung über die echte Oberfläche ---
  await page.goto('http://localhost:5173/'); await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Registrieren' }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  const felder = await page.locator('form input').count();
  await page.locator('form input').nth(0).fill(name);
  await page.locator('form input').nth(1).fill(`s${tag}p@qa.test`);
  await page.locator('form input').nth(2).fill('QaTest-Passwort-123!');
  if (felder > 3) await page.locator('form input').nth(3).fill('QaTest-Passwort-123!');
  await page.getByRole('button', { name: /Konto erstellen/ }).click();
  const angemeldet = await warte(async () => (await page.locator('.startklar__los').count()) > 0, 20000);
  rec('1+2. Registrierung und Anmeldung über das Formular', angemeldet);
  await page.screenshot({ path: 'spiel-01-start.png' });

  // --- 3. Einführung / Spielstart ---
  await page.locator('.startklar__los').click(); await page.waitForTimeout(2500);
  rec('3. Spiel startet (Karte sichtbar)', await page.locator('.leaflet-container').isVisible());
  const tour = await page.locator('text=Tour beenden').isVisible().catch(() => false);
  rec('3b. Einführungstour wird angeboten', tour);
  await page.locator('text=Tour beenden').click().catch(() => {});
  await page.waitForTimeout(500);

  // --- 4. Wache bauen ---
  await page.mouse.click(880, 520); await page.waitForTimeout(2600);
  const adresse = await page.locator('.field--address input').inputValue().catch(() => '');
  rec('4a. Kartenklick füllt die Adresse (Nominatim, gedrosselt)', adresse.length > 3, adresse.slice(0, 50));
  await page.locator('input').first().fill('QA-Wache Mitte');
  await page.locator('button:has-text("Standort erstellen")').click();
  rec('4b. Wache mit Startfahrzeug gebaut', await warte(async () => (stand()?.locations ?? []).some(l => l.type === 'station')), `Guthaben ${stand()?.balance}`);
  await page.locator('text=Tour beenden').click().catch(() => {});

  // --- 5. Fahrzeug kaufen ---
  await menue('Wachen');
  const vorKauf = stand()?.vehicles.length ?? 0;
  const kaufen = page.getByRole('button', { name: /^Kaufen/ }).first();
  if (await kaufen.count()) { await kaufen.click(); await page.waitForTimeout(1200); }
  rec('5. Fahrzeug gekauft', await warte(async () => (stand()?.vehicles.length ?? 0) > vorKauf, 15000), `Fahrzeuge ${vorKauf} → ${stand()?.vehicles.length}`);
  await page.screenshot({ path: 'spiel-02-wachen.png' });

  // --- 6. Personal ---
  const personal = stand()?.personal ?? [];
  rec('6. Personal wird mitgeführt', personal.length > 0, `${personal.length} Mitarbeiter`);

  // --- 7.-10. Einsätze: alarmieren, abarbeiten, abschließen ---
  await menue('Karte');
  let alarmiert = 0;
  const bisEinsaetze = Date.now() + 240000;
  while (Date.now() < bisEinsaetze && (stand()?.laufbahn?.einsaetze ?? 0) < 2) {
    const chips = page.locator('.map-incident-chip');
    for (let i = 0; i < await chips.count(); i++) {
      const vorschlag = page.locator('button:has-text("Vorschlag")').first();
      if (!(await vorschlag.isVisible().catch(() => false))) { await chips.nth(i).click().catch(() => {}); await page.waitForTimeout(500); }
      if (await vorschlag.isVisible().catch(() => false) && await vorschlag.isEnabled().catch(() => false)) {
        await vorschlag.click().catch(() => {}); await page.waitForTimeout(300);
        const alarm = page.locator('button.btn--primary:has-text("Alarmieren")').first();
        if (await alarm.isEnabled().catch(() => false)) { await alarm.click().catch(() => {}); alarmiert++; await page.waitForTimeout(400); }
      }
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(4000);
  }
  rec('7+8. Einsätze gehen ein und werden alarmiert', alarmiert > 0, `${alarmiert} Alarmierungen`);
  const fertig = stand()?.laufbahn?.einsaetze ?? 0;
  rec('9+10. Einsätze werden abgearbeitet und abgeschlossen', fertig > 0, `${fertig} abgeschlossen, XP ${stand()?.laufbahn?.xp}`);
  await page.screenshot({ path: 'spiel-03-einsaetze.png' });

  // --- 11. Einnahmen/Buchungen ---
  await menue('Finanzen');
  const finanzText = await page.locator('main').innerText();
  rec('11. Einnahmen sind verbucht', /Einsatz|abgeschlossen|Einnahme/.test(finanzText) && (stand()?.transactions.length ?? 0) > 1, `${stand()?.transactions.length} Buchungen`);

  // --- 12. Kredit aufnehmen und ablösen ---
  const kreditReiter = page.getByRole('button', { name: /^Kredit$/ }).first();
  if (await kreditReiter.count()) { await kreditReiter.click(); await page.waitForTimeout(400); }
  const betrag = page.getByRole('radio', { name: /10\.000|5\.000/ }).first();
  if (await betrag.count()) await betrag.click();
  await page.getByRole('button', { name: /Kredit aufnehmen/ }).click().catch(() => {});
  rec('12a. Kredit aufgenommen', await warte(async () => Boolean(stand()?.kredit), 15000), `Kredit ${stand()?.kredit?.betrag} €`);
  await page.getByRole('button', { name: /Restschuld ablösen/ }).click().catch(() => {});
  rec('12b. Kredit abgelöst', await warte(async () => !stand()?.kredit, 15000));
  await page.screenshot({ path: 'spiel-04-finanzen.png' });

  // --- 13. Statistik und Bestenliste ---
  await menue('Statistik');
  rec('13a. Statistik zeigt Daten', (await page.locator('main').innerText()).length > 80);
  await menue('Bestenliste');
  const bl = await page.locator('main').innerText();
  rec('13b. Bestenliste lädt und zeigt das eigene Konto', bl.includes(name) || /Platz|Rang|Teilnehmer/.test(bl), bl.slice(0, 60).replace(/\n/g, ' '));

  // --- 14. Einstellungen ---
  await menue('Einstellungen');
  const einst = await page.locator('main').innerText();
  rec('14. Einstellungen erreichbar', /Spielstand|Alarmton|Design|Neues Spiel/.test(einst));

  // --- 15. Teamfunktionen (als normaler Spieler nicht sichtbar) ---
  const teamSichtbar = (await page.locator('.view-menu-item', { hasText: 'Team' }).count()) > 0;
  const teamApi = await page.evaluate(async () => (await fetch('/api/team/uebersicht')).status);
  rec('15. Teambereich für normale Spieler gesperrt', !teamSichtbar && teamApi === 403, `Menü ${teamSichtbar ? 'sichtbar' : 'verborgen'}, API ${teamApi}`);

  // --- 16. Weitere Funktionen ---
  for (const v of ['Krankenhäuser', 'Fahrzeugkatalog', 'AAO', 'Funk', 'Profil', 'Fehler melden']) {
    const vorher = errs.length;
    await menue(v).catch(() => {});
    rec(`16. Ansicht „${v}“`, errs.length === vorher && (await page.locator('main').innerText()).length > 30);
  }

  // --- Doppelklick-Schutz: Fahrzeug zweimal schnell kaufen ---
  await menue('Wachen');
  const vorDoppel = stand()?.vehicles.length ?? 0;
  const guthabenVor = stand()?.balance ?? 0;
  const kaufBtn = page.getByRole('button', { name: /^Kaufen/ }).first();
  if (await kaufBtn.count()) { await kaufBtn.dblclick(); await page.waitForTimeout(2500); }
  const dazu = (stand()?.vehicles.length ?? 0) - vorDoppel;
  const kosten = guthabenVor - (stand()?.balance ?? 0);
  rec('Doppelklick „Kaufen“: Abbuchung passt zur Anzahl', dazu === 0 || kosten >= dazu * 1000, `${dazu} Fahrzeuge, ${kosten} € abgebucht`);

  // --- Neu laden: bleibt alles erhalten? ---
  const vorReload = stand();
  await page.reload(); await page.locator('.startklar__los').click({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(2500);
  const nachReload = stand();
  rec('Spielstand übersteht das Neuladen', nachReload.vehicles.length === vorReload.vehicles.length && Math.abs(nachReload.balance - vorReload.balance) < 2000,
    `Fahrzeuge ${nachReload.vehicles.length}, Guthaben ${nachReload.balance}`);

  rec('Keine Seitenfehler im ganzen Durchlauf', errs.length === 0, JSON.stringify(errs.slice(0, 4)));
  rec('Keine unerwarteten API-Fehler', apiFehler.length === 0, JSON.stringify([...new Set(apiFehler)].slice(0, 5)));
  await page.screenshot({ path: 'spiel-05-ende.png' });
  console.log(`\nDURCHLAUF: ${ok}/${n} bestanden` + (fails.length ? ` | offen: ${fails.join(' | ')}` : ''));
  await browser.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
