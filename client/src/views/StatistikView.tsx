import { formatEinsatzTitel, formatEuro, getRufLabel, type AbgeschlossenerSpielEinsatz } from '@leitstellendispo/shared';

function Kachel({ titel, wert, hinweis }: { titel: string; wert: string; hinweis?: string }) {
  return (
    <div className="finanz-kachel">
      <span>{titel}</span>
      <strong>{wert}</strong>
      {hinweis && <small>{hinweis}</small>}
    </div>
  );
}

const durchschnitt = (werte: number[]) => (werte.length === 0 ? null : werte.reduce((s, w) => s + w, 0) / werte.length);

/**
 * Ruf nach jedem bewerteten Einsatz – feine Linie, die sich der Breite anpasst.
 * Je Einsatz eine unsichtbare Spalte als Trefferfläche: Drüberfahren/Antippen zeigt Ruf und Einsatz.
 */
function RufVerlauf({ punkte }: { punkte: Array<{ ruf: number; titel: string; zeit: number }> }) {
  if (punkte.length < 2) return <p className="einsatz-eintrag__zeile">Der Verlauf erscheint nach ein paar bewerteten Einsätzen.</p>;
  const x = (i: number) => (i / (punkte.length - 1)) * 100;
  const y = (ruf: number) => 100 - ruf;
  const linie = punkte.map((p, i) => `${x(i).toFixed(2)},${y(p.ruf).toFixed(2)}`).join(' ');
  const spalte = 100 / (punkte.length - 1);

  return (
    <div className="statistik-verlauf" role="img" aria-label={`Verlauf deines Rufs, zuletzt ${punkte[punkte.length - 1].ruf} von 100`}>
      {[100, 50, 0].map((wert) => (
        <span key={wert} className="statistik-verlauf__achse" style={{ top: `${y(wert)}%` }}>{wert}</span>
      ))}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {[100, 50, 0].map((wert) => (
          <line key={wert} x1={0} x2={100} y1={y(wert)} y2={y(wert)} className="statistik-verlauf__raster" />
        ))}
        <polyline points={linie} className="statistik-verlauf__linie" />
        {punkte.map((p, i) => (
          <rect key={i} x={x(i) - spalte / 2} y={0} width={spalte} height={100} className="statistik-verlauf__treffer">
            <title>{`Ruf ${p.ruf} – ${p.titel} (${new Date(p.zeit).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

export default function StatistikView({ verlauf, ruf }: { verlauf: AbgeschlossenerSpielEinsatz[]; ruf: number }) {
  // Der Verlauf ist neueste zuerst gespeichert – für Zeitreihen umdrehen
  const chronologisch = [...verlauf].sort((a, b) => a.completedAt - b.completedAt);
  const bewertet = chronologisch.filter((e) => e.bewertung);
  const rd = verlauf.filter((e) => e.organization === 'Rettungsdienst').length;
  const fw = verlauf.length - rd;
  const einnahmen = verlauf.reduce((s, e) => s + e.reward + (e.bewertung?.bonus ?? 0), 0);
  const punkte = durchschnitt(bewertet.map((e) => e.bewertung!.punkte));
  const anfahrt = durchschnitt(bewertet.map((e) => e.bewertung!.anfahrtSekunden));

  const rufPunkte = bewertet.map((e) => ({
    ruf: Math.round(e.bewertung!.rufVorher + e.bewertung!.rufAenderung),
    titel: formatEinsatzTitel(e),
    zeit: e.completedAt,
  }));

  const haeufigkeit = new Map<string, number>();
  for (const e of verlauf) haeufigkeit.set(formatEinsatzTitel(e), (haeufigkeit.get(formatEinsatzTitel(e)) ?? 0) + 1);
  const top = [...haeufigkeit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxAnzahl = top[0]?.[1] ?? 1;

  return (
    <div>
      <div className="wachen-kopf">
        <h2>Statistik</h2>
        {verlauf.length > 0 && <small className="einsatz-eintrag__zeile">Grundlage: deine letzten {verlauf.length} abgeschlossenen Einsätze</small>}
      </div>

      {verlauf.length === 0 ? (
        <div className="leerzustand">Noch keine abgeschlossenen Einsätze – die Statistik füllt sich, sobald du die ersten abarbeitest.</div>
      ) : (
        <>
          <div className="finanz-kacheln" style={{ marginTop: 12 }}>
            <Kachel titel="Einsätze abgeschlossen" wert={String(verlauf.length)} hinweis={`🚑 ${rd} Rettungsdienst · 🚒 ${fw} Feuerwehr`} />
            <Kachel titel="Ruf" wert={String(ruf)} hinweis={getRufLabel(ruf)} />
            <Kachel titel="Ø Bewertung" wert={punkte === null ? '–' : `${Math.round(punkte)} / 100`} />
            <Kachel titel="Ø Anfahrt" wert={anfahrt === null ? '–' : `${Math.floor(anfahrt / 60)}:${String(Math.round(anfahrt % 60)).padStart(2, '0')} min`} hinweis="Erstes Fahrzeug vor Ort" />
            <Kachel titel="Einnahmen aus Einsätzen" wert={formatEuro(einnahmen)} hinweis="inkl. Bonus" />
          </div>

          <section className="ausbau-karte" style={{ marginTop: 12 }}>
            <span className="ausbau-karte__kategorie">⭐ Ruf-Verlauf</span>
            <RufVerlauf punkte={rufPunkte} />
          </section>

          <section className="ausbau-karte" style={{ marginTop: 12 }}>
            <span className="ausbau-karte__kategorie">📋 Häufigste Einsatzarten</span>
            <ul className="statistik-balken">
              {top.map(([titel, anzahl]) => (
                <li key={titel} title={`${titel}: ${anzahl}×`}>
                  <span>{titel}</span>
                  <span className="statistik-balken__spur"><span style={{ width: `${(anzahl / maxAnzahl) * 100}%` }} /></span>
                  <strong>{anzahl}</strong>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
