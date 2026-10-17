import { BOT_ZIEL_LABELS, getFahrzeugTyp, type BotZiel } from '@leitstellendispo/shared';
import { GESCHWINDIGKEITEN, useBot } from '../useBot';

const euro = (betrag: number) => `${Math.round(betrag).toLocaleString('de-DE')} €`;
const spielzeit = (ms: number) => {
  const stunden = Math.floor(ms / 3_600_000);
  const tage = Math.floor(stunden / 24);
  return tage > 0 ? `${tage} Tg ${stunden % 24} h` : `${stunden} h`;
};
const ZIELE = Object.keys(BOT_ZIEL_LABELS) as BotZiel[];

function Kachel({ titel, wert, farbe }: { titel: string; wert: string; farbe?: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', padding: 10, borderRadius: 10, boxShadow: 'var(--shadow-card)', minWidth: 120 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{titel}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: farbe }}>{wert}</div>
    </div>
  );
}

/**
 * Bot-Werkzeug im Dev-Bereich: spielt automatisch auf einem EIGENEN Sandbox-Spielstand
 * (dein echtes Konto bleibt unberührt). Steuerung, Live-Protokoll, Besitz, Fehlerwächter, Härtetest.
 */
export default function BotWerkzeug() {
  const bot = useBot();
  const { spielstand, statistik, log, probleme, haertetest } = bot;
  const stationen = spielstand.locations.filter((location) => location.type === 'station');
  const fahrzeugeNachTyp = spielstand.vehicles.reduce<Record<string, number>>((acc, vehicle) => {
    const typ = vehicle.type ?? 'Unbekannt';
    acc[typ] = (acc[typ] ?? 0) + 1;
    return acc;
  }, {});
  const fehler = probleme.filter((problem) => problem.schwere === 'fehler');
  const warnungen = probleme.filter((problem) => problem.schwere === 'warnung');

  return (
    <article className="ausbau-karte" style={{ gridColumn: '1 / -1' }}>
      <span className="ausbau-karte__kategorie">Automatik</span>
      <h3>Bot</h3>
      <p>
        Spielt automatisch auf einem <strong>eigenen Sandbox-Spielstand</strong> – dein echtes Spiel bleibt unberührt.
        Baut Wachen, kauft &amp; besetzt Fahrzeuge, alarmiert Einsätze. Läuft, solange dieser Reiter offen ist (Fortschritt wird gemerkt).
      </p>

      {/* Steuerung */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
        {bot.laeuft ? (
          <button type="button" className="btn btn--danger" onClick={bot.stopp}>■ Stopp</button>
        ) : (
          <button type="button" className="btn btn--primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={bot.start}>▶ Start</button>
        )}
        <button type="button" className="btn" onClick={bot.zuruecksetzen}>↺ Zurücksetzen</button>
        <label className="field" style={{ margin: 0 }}>
          <span>Ziel</span>
          <select value={bot.ziel} onChange={(event) => bot.setZiel(event.target.value as BotZiel)}>
            {ZIELE.map((z) => <option key={z} value={z}>{BOT_ZIEL_LABELS[z]}</option>)}
          </select>
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span>Geschwindigkeit</span>
          <select value={bot.geschwindigkeit} onChange={(event) => bot.setGeschwindigkeit(event.target.value)}>
            {Object.keys(GESCHWINDIGKEITEN).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <span className="chip" style={{ background: bot.laeuft ? '#16a34a' : undefined }}>{bot.laeuft ? 'läuft …' : 'gestoppt'}</span>
      </div>

      {/* Dashboard */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Kachel titel="Kontostand" wert={euro(spielstand.balance)} farbe={spielstand.balance < 0 ? '#dc2626' : undefined} />
        <Kachel titel="Einnahmen" wert={euro(statistik?.einnahmen ?? 0)} farbe="#16a34a" />
        <Kachel titel="Ausgaben" wert={euro(statistik?.ausgaben ?? 0)} farbe="#dc2626" />
        <Kachel titel="Ruf" wert={String(Math.round(statistik?.ruf ?? spielstand.ruf ?? 50))} />
        <Kachel titel="Einsätze erledigt" wert={String(statistik?.einsaetzeAbgeschlossen ?? 0)} />
        <Kachel titel="Wachen" wert={String(stationen.length)} />
        <Kachel titel="Fahrzeuge" wert={String(spielstand.vehicles.length)} />
        <Kachel titel="Spielzeit" wert={spielzeit(statistik?.simulierteDauerMs ?? 0)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Besitz */}
        <div>
          <strong>Besitz</strong>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '6px 0 2px' }}>Wachen</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 2, fontSize: 13 }}>
            {stationen.map((station) => (
              <li key={station.id}>{station.name} · {spielstand.vehicles.filter((v) => v.stationId === station.id).length} Fz.</li>
            ))}
            {stationen.length === 0 && <li style={{ color: 'var(--color-text-muted)' }}>Noch keine Wache.</li>}
          </ul>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0 2px' }}>Fahrzeuge</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 2, fontSize: 13 }}>
            {Object.entries(fahrzeugeNachTyp).map(([typ, anzahl]) => (
              <li key={typ}>{anzahl}× {typ} <span style={{ color: 'var(--color-text-muted)' }}>({getFahrzeugTyp(typ)?.bezeichnung ?? typ})</span></li>
            ))}
            {spielstand.vehicles.length === 0 && <li style={{ color: 'var(--color-text-muted)' }}>Keine Fahrzeuge.</li>}
          </ul>
        </div>

        {/* Live-Protokoll */}
        <div>
          <strong>Was der Bot gerade macht</strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'grid', gap: 3, maxHeight: 280, overflow: 'auto', fontSize: 13 }}>
            {log.map((aktion, index) => (
              <li key={`${aktion.jetzt}-${index}`}>
                <span style={{ color: 'var(--color-text-muted)' }}>{new Date(aktion.jetzt).toLocaleTimeString('de-DE')}</span>{' '}
                <span style={{ opacity: 0.8 }}>[{aktion.art}]</span> {aktion.text}
              </li>
            ))}
            {log.length === 0 && <li style={{ color: 'var(--color-text-muted)' }}>Noch nichts – drück auf Start. </li>}
          </ul>
        </div>
      </div>

      {/* Fehlerwächter */}
      <div style={{ marginTop: 12 }}>
        <strong>Fehlerwächter</strong>{' '}
        {fehler.length === 0 && warnungen.length === 0 && <span style={{ color: '#16a34a' }}>✓ alles sauber</span>}
        {fehler.map((problem, index) => (
          <div key={`f-${index}`} style={{ color: '#dc2626', fontSize: 13 }}>✗ [{problem.code}] {problem.text}</div>
        ))}
        {warnungen.slice(0, 15).map((problem, index) => (
          <div key={`w-${index}`} style={{ color: '#d97706', fontSize: 13 }}>⚠ [{problem.code}] {problem.text}</div>
        ))}
      </div>

      {/* Härtetest */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border, rgba(255,255,255,0.1))' }}>
        <strong>Härtetest</strong>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '4px 0 8px' }}>
          Wirft dem Spiel kaputte/bösartige Daten hin (wie ein manipulierter Client gegen den Server) und prüft, ob etwas abstürzt. Rein lokal, ändert nichts.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => bot.starteHaertetest()}>Härtetest starten</button>
        {haertetest && (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            {haertetest.abstuerze.length === 0 ? (
              <span style={{ color: '#16a34a' }}>✓ {haertetest.sauberVerarbeitet} Eingaben sauber verarbeitet, kein Absturz.</span>
            ) : (
              <div style={{ color: '#dc2626' }}>
                ✗ {haertetest.abstuerze.length} Absturz/Abstürze:
                <ul style={{ margin: '4px 0 0' }}>
                  {haertetest.abstuerze.slice(0, 8).map((fund, index) => (
                    <li key={index} style={{ fontSize: 12 }}>{fund.bereich}: {fund.eingabe} → {fund.fehler}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
