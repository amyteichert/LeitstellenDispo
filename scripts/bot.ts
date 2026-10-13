/**
 * CLI-Bot für LeitstellenDispo.
 *
 * Spielt das Spiel im Zeitraffer durch (Simulation), lässt den Bot arbeiten und
 * gibt am Ende einen Bericht aus – inklusive Fehlerwächter. Mit `--haertetest`
 * läuft stattdessen der Robustheits-/Härtetest, der prüft, ob kaputte Eingaben
 * das Spiel (bzw. einen späteren Server) zum Absturz bringen könnten.
 *
 * Aufruf (nach `npm install`):
 *   npm run bot -- --tage 7 --ziel geld
 *   npm run bot -- --haertetest --versuche 5000
 *
 * Optionen:
 *   --tage N        Simulierte Spieltage (Standard 7)
 *   --stunden N     Alternativ zu --tage: simulierte Stunden
 *   --ziel X        einsaetze | geld | ausbauen | schnell | chaos (Standard einsaetze)
 *   --seed N        Startwert für reproduzierbare Läufe (Standard 1)
 *   --log N         Wie viele der letzten Protokollzeilen gezeigt werden (Standard 15)
 *   --haertetest    Härtetest statt Simulation
 *   --versuche N    Anzahl Angriffe im Härtetest (Standard 2000)
 */
import {
  BOT_ZIEL_LABELS,
  haerteTest,
  nurFehler,
  simuliere,
  type BotZiel,
} from '@leitstellendispo/shared';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const hatFlag = (name: string): boolean => process.argv.includes(`--${name}`);
const zahl = (name: string, standard: number): number => {
  const wert = Number(arg(name));
  return Number.isFinite(wert) ? wert : standard;
};
const euro = (betrag: number): string => `${Math.round(betrag).toLocaleString('de-DE')} €`;

const ZIELE: BotZiel[] = ['einsaetze', 'geld', 'ausbauen', 'schnell', 'chaos'];

function laufeHaertetest(): void {
  const versuche = zahl('versuche', 2000);
  const seed = zahl('seed', 1);
  console.log(`\n🛡️  Härtetest läuft (${versuche} Angriffe, Seed ${seed}) …\n`);
  const ergebnis = haerteTest({ seed, versuche });

  console.log(`Sauber verarbeitet: ${ergebnis.sauberVerarbeitet}`);
  if (ergebnis.abstuerze.length === 0) {
    console.log('✅ Kein Absturz. Die geprüften Funktionen halten Mülldaten stand.');
    return;
  }
  console.log(`\n❌ ${ergebnis.abstuerze.length} Absturz/Abstürze gefunden:\n`);
  const nachBereich = new Map<string, { anzahl: number; beispiel: string }>();
  for (const fund of ergebnis.abstuerze) {
    const eintrag = nachBereich.get(fund.bereich) ?? { anzahl: 0, beispiel: '' };
    eintrag.anzahl += 1;
    eintrag.beispiel = `${fund.eingabe} → ${fund.fehler}`;
    nachBereich.set(fund.bereich, eintrag);
  }
  for (const [bereich, eintrag] of nachBereich) {
    console.log(`  • ${bereich}: ${eintrag.anzahl}×   z. B. ${eintrag.beispiel}`);
  }
  process.exitCode = 1;
}

function laufeSimulation(): void {
  const zielArg = (arg('ziel') ?? 'einsaetze') as BotZiel;
  const ziel: BotZiel = ZIELE.includes(zielArg) ? zielArg : 'einsaetze';
  const seed = zahl('seed', 1);
  const stunden = arg('stunden') !== undefined ? zahl('stunden', 24) : zahl('tage', 7) * 24;
  const dauerMs = stunden * 60 * 60 * 1000;
  const logZeilen = zahl('log', 15);

  console.log(`\n🚒 Bot-Simulation – Ziel: ${BOT_ZIEL_LABELS[ziel]} | ${stunden} h Spielzeit | Seed ${seed}\n`);
  const start = Date.now();
  const ergebnis = simuliere({ ziel, dauerMs, seed });
  const dauer = ((Date.now() - start) / 1000).toFixed(1);

  const { statistik, log, probleme } = ergebnis;
  console.log('── Bilanz ───────────────────────────────');
  console.log(`  Startguthaben:        ${euro(statistik.startGuthaben)}`);
  console.log(`  Endguthaben:          ${euro(statistik.endGuthaben)}`);
  console.log(`  Einnahmen:            ${euro(statistik.einnahmen)}`);
  console.log(`  Ausgaben:             ${euro(statistik.ausgaben)}`);
  console.log('── Einsätze ─────────────────────────────');
  console.log(`  Erzeugt:              ${statistik.einsaetzeErzeugt}`);
  console.log(`  Abgeschlossen:        ${statistik.einsaetzeAbgeschlossen}`);
  console.log(`  Verfallen (ignoriert):${statistik.einsaetzeVerfallen}`);
  console.log('── Bestand ──────────────────────────────');
  console.log(`  Wachen:               ${statistik.wachen}`);
  console.log(`  Fahrzeuge:            ${statistik.fahrzeuge}`);
  console.log(`  (Rechenzeit: ${dauer} s für ${statistik.schritte} Schritte)`);

  if (log.length > 0) {
    console.log(`\n── Letzte ${Math.min(logZeilen, log.length)} Bot-Aktionen ──`);
    for (const aktion of log.slice(-logZeilen)) {
      const uhrzeit = new Date(aktion.jetzt).toLocaleTimeString('de-DE');
      console.log(`  ${uhrzeit}  [${aktion.art}] ${aktion.text}`);
    }
  }

  const fehler = nurFehler(probleme);
  const warnungen = probleme.filter((problem) => problem.schwere === 'warnung');
  console.log('\n── Fehlerwächter ────────────────────────');
  if (fehler.length === 0) {
    console.log('  ✅ Keine Invariante verletzt.');
  } else {
    console.log(`  ❌ ${fehler.length} Fehler:`);
    for (const problem of fehler) console.log(`     • [${problem.code}] ${problem.text}`);
    process.exitCode = 1;
  }
  if (warnungen.length > 0) {
    console.log(`  ⚠ ${warnungen.length} Warnung(en):`);
    for (const problem of warnungen.slice(0, 10)) console.log(`     • [${problem.code}] ${problem.text}`);
  }
  console.log('');
}

if (hatFlag('haertetest')) {
  laufeHaertetest();
} else {
  laufeSimulation();
}
