import { BOT_ZIEL_LABELS, getFahrzeugTyp, type BotZiel } from '@leitstellendispo/shared';
import { GESCHWINDIGKEITEN, type useBot } from '../useBot';

type Bot = ReturnType<typeof useBot>;

const euro = (betrag: number) => `${Math.round(betrag).toLocaleString('de-DE')} €`;
const spielzeit = (ms: number) => {
  const stunden = Math.floor(ms / 3_600_000);
  const tage = Math.floor(stunden / 24);
  return tage > 0 ? `${tage} Tg ${stunden % 24} h` : `${stunden} h`;
};

const ZIELE = Object.keys(BOT_ZIEL_LABELS) as BotZiel[];

function Kachel({ titel, wert, farbe }: { titel: string; wert: string; farbe?: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', padding: 12, borderRadius: 10, boxShadow: 'var(--shadow-card)', minWidth: 130 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{titel}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: farbe }}>{wert}</div>
    </div>
  );
}

export default function BotView({ bot }: { bot: Bot }) {
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
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>🤖 Bot</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>
          Der Bot spielt auf einem <strong>eigenen Spielstand</strong> – dein echtes Spiel bleibt unberührt.
          Er arbeitet Einsätze ab, kauft nach Bedarf und baut (je nach Ziel) Wachen. Alles im Zeitraffer.
        </p>
      </div>

      {/* Steuerung */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {bot.laeuft ? (
          <button type="button" className="btn btn--danger" onClick={bot.stopp}>■ Stopp</button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
            onClick={bot.start}
          >
            ▶ Start
          </button>
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

        <span className="chip" style={{ background: bot.laeuft ? '#16a34a' : undefined }}>
          {bot.laeuft ? 'läuft …' : 'gestoppt'}
        </span>
      </div>

      {/* Besitz-Dashboard */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Kachel titel="Kontostand" wert={euro(spielstand.balance)} farbe={spielstand.balance < 0 ? '#dc2626' : undefined} />
        <Kachel titel="Einnahmen" wert={euro(statistik?.einnahmen ?? 0)} farbe="#16a34a" />
        <Kachel titel="Ausgaben" wert={euro(statistik?.ausgaben ?? 0)} farbe="#dc2626" />
        <Kachel titel="Einsätze erledigt" wert={String(statistik?.einsaetzeAbgeschlossen ?? 0)} />
        <Kachel titel="Wachen" wert={String(stationen.length)} />
        <Kachel titel="Fahrzeuge" wert={String(spielstand.vehicles.length)} />
        <Kachel titel="Spielzeit" wert={spielzeit(statistik?.simulierteDauerMs ?? 0)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {/* Besitz */}
        <div>
          <h3>Besitz</h3>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>Wachen</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
            {stationen.map((station) => (
              <li key={station.id}>
                {station.name} · {spielstand.vehicles.filter((v) => v.stationId === station.id).length} Fahrzeuge
              </li>
            ))}
          </ul>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '10px 0 6px' }}>Fahrzeuge</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
            {Object.entries(fahrzeugeNachTyp).map(([typ, anzahl]) => (
              <li key={typ}>{anzahl}× {typ} <span style={{ color: 'var(--color-text-muted)' }}>({getFahrzeugTyp(typ)?.bezeichnung ?? typ})</span></li>
            ))}
            {spielstand.vehicles.length === 0 && <li>Keine Fahrzeuge.</li>}
          </ul>
        </div>

        {/* Live-Protokoll */}
        <div>
          <h3>Was der Bot gerade macht</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4, maxHeight: 320, overflow: 'auto' }}>
            {log.map((aktion, index) => (
              <li key={`${aktion.jetzt}-${index}`} style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{new Date(aktion.jetzt).toLocaleTimeString('de-DE')}</span>{' '}
                <span style={{ opacity: 0.8 }}>[{aktion.art}]</span> {aktion.text}
              </li>
            ))}
            {log.length === 0 && <li style={{ color: 'var(--color-text-muted)' }}>Noch nichts – drück auf Start. 🚦</li>}
          </ul>
        </div>
      </div>

      {/* Fehlerwächter */}
      <div>
        <h3>Fehlerwächter</h3>
        {fehler.length === 0 && warnungen.length === 0 && (
          <p style={{ color: '#16a34a' }}>✅ Alles sauber – keine Invariante verletzt.</p>
        )}
        {fehler.map((problem, index) => (
          <div key={`f-${index}`} style={{ color: '#dc2626', fontSize: 13 }}>❌ [{problem.code}] {problem.text}</div>
        ))}
        {warnungen.slice(0, 20).map((problem, index) => (
          <div key={`w-${index}`} style={{ color: '#d97706', fontSize: 13 }}>⚠ [{problem.code}] {problem.text}</div>
        ))}
      </div>

      {/* Härtetest */}
      <div style={{ background: 'var(--color-surface)', padding: 12, borderRadius: 10, boxShadow: 'var(--shadow-card)' }}>
        <h3 style={{ marginTop: 0 }}>🛡️ Härtetest</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
          Wirft dem Spiel kaputte und bösartige Daten hin – so wie es jemand gegen einen späteren Server versuchen könnte –
          und prüft, ob etwas abstürzt. Läuft rein lokal, verändert nichts.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => bot.starteHaertetest()}>Härtetest starten</button>
        {haertetest && (
          <div style={{ marginTop: 10, fontSize: 14 }}>
            {haertetest.abstuerze.length === 0 ? (
              <span style={{ color: '#16a34a' }}>✅ {haertetest.sauberVerarbeitet} Eingaben sauber verarbeitet, kein Absturz.</span>
            ) : (
              <div style={{ color: '#dc2626' }}>
                ❌ {haertetest.abstuerze.length} Absturz/Abstürze gefunden:
                <ul style={{ margin: '6px 0 0' }}>
                  {haertetest.abstuerze.slice(0, 10).map((fund, index) => (
                    <li key={index} style={{ fontSize: 12 }}>{fund.bereich}: {fund.eingabe} → {fund.fehler}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
