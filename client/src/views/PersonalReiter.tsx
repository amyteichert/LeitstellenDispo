import { useState } from 'react';
import {
  QUALIFIKATION_LABELS,
  ZUFRIEDENHEIT_CONFIG,
  BEWERBER_CONFIG,
  getNeuWuerfelnAb,
  type Kuendigung,
  getFahrzeugTyp,
  getPersonalLimit,
  istInAusbildung,
  kannUmbesetzen,
  type Bewerber,
  type Mitarbeiter,
  type Qualifikation,
  formatEuro,
} from '@leitstellendispo/shared';
import type { MapLocation, Vehicle } from '../types';

const euro = formatEuro;

export const QualiChips = ({ qualifikationen }: { qualifikationen: Qualifikation[] }) => (
  qualifikationen.length === 0
    ? <span className="quali-chip quali-chip--keine">Grundausbildung</span>
    : <>{qualifikationen.map((q) => <span key={q} className="quali-chip">{QUALIFIKATION_LABELS[q]}</span>)}</>
);

type Filter = 'alle' | 'reserve' | 'fahrzeug' | 'lehrgang';
const FILTER: Array<{ id: Filter; text: string; passt: (person: Mitarbeiter) => boolean }> = [
  { id: 'alle', text: 'Alle', passt: () => true },
  { id: 'reserve', text: 'Ohne Fahrzeug', passt: (p) => !p.fahrzeugId && !istInAusbildung(p) },
  { id: 'fahrzeug', text: 'Auf Fahrzeug', passt: (p) => Boolean(p.fahrzeugId) && !istInAusbildung(p) },
  { id: 'lehrgang', text: 'Im Lehrgang', passt: istInAusbildung },
];

const formatZeitpunkt = (zeit: number) =>
  new Date(zeit).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Reiter „Personal“ einer Wache: Liste aller Leute der Wache und Bewerber. */
export default function PersonalReiter({
  wache,
  fahrzeuge,
  personal,
  balance,
  zufriedenheit,
  kuendigungen,
  onMeldung,
  stellePersonalEin,
  wuerfleBewerberNeu,
  entlassePersonal,
  weisePersonalZu,
}: {
  wache: MapLocation;
  fahrzeuge: Vehicle[];
  /** Nur das Personal dieser Wache */
  personal: Mitarbeiter[];
  balance: number;
  /** Aktuelle Zufriedenheit der Wache (0–100) */
  zufriedenheit: number;
  /** Kündigungen an dieser Wache (neueste zuerst) */
  kuendigungen: Kuendigung[];
  onMeldung: (meldung: { art: 'ok' | 'fehler'; text: string }) => void;
  stellePersonalEin: (wacheId: string, bewerber: Bewerber) => string | null;
  wuerfleBewerberNeu: (wacheId: string) => string | null;
  entlassePersonal: (personId: string) => string | null;
  weisePersonalZu: (personId: string, fahrzeugId?: string) => string | null;
  besetzeFahrzeugAutomatisch: (fahrzeugId: string) => string | null;
}) {
  // Bewerber sind im Spielstand der Wache gespeichert (neu alle 24 Std., selbst neu würfeln alle 12 Std.)
  const bewerber = wache.bewerber?.liste ?? [];
  const jetzt = Date.now();
  const neuWuerfelnAb = getNeuWuerfelnAb(wache);
  const darfNeuWuerfeln = jetzt >= neuWuerfelnAb;
  const naechsteAutomatisch = (wache.bewerber?.erzeugtAm ?? jetzt) + BEWERBER_CONFIG.automatischAlleMs;
  const limit = getPersonalLimit(wache);
  const voll = personal.length >= limit;
  const reserve = personal.filter((person) => !person.fahrzeugId && !istInAusbildung(person));
  const [filter, setFilter] = useState<Filter>('alle');
  const gefiltert = personal.filter(FILTER.find((f) => f.id === filter)!.passt);

  const melde = (fehler: string | null, ok: string) => onMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: ok });

  const einstellen = (kandidat: Bewerber) => {
    const fehler = stellePersonalEin(wache.id, kandidat);
    melde(fehler, `✓ ${kandidat.name} eingestellt – jetzt einem Fahrzeug zuweisen.`);
  };

  return (
    <>
      <div className="verwalten-kacheln" style={{ marginBottom: 12 }}>
        <div className="verwalten-kachel">
          <small>Personal</small>
          <strong>{personal.length} / {limit}</strong>
          {voll && <small>Voll – Ruheräume unter „Ausbau“ bauen</small>}
        </div>
        <div className="verwalten-kachel">
          <small>Ohne Fahrzeug</small>
          <strong>{reserve.length}</strong>
        </div>
      </div>

      {zufriedenheit < ZUFRIEDENHEIT_CONFIG.kuendigungUnter && (
        <div className="versorgung-hinweis versorgung-hinweis--fehlt">
          ⚠ <strong>Zufriedenheit {zufriedenheit} %</strong> – unter {ZUFRIEDENHEIT_CONFIG.kuendigungUnter} % kann jede Stunde jemand kündigen.
          Weniger Dauerstress (Einsätze auf mehrere Wachen verteilen) oder Aufenthaltsraum, Küche und Fitnessraum ausbauen.
        </div>
      )}
      {kuendigungen.length > 0 && (
        <section className="einsatz-abschnitt">
          <h4>Kündigungen</h4>
          <ul className="besatzung-liste">
            {kuendigungen.map((k) => (
              <li key={k.personId} className="ruf-minus">
                ✗ {k.name} hat gekündigt ({new Date(k.zeit).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="einsatz-abschnitt">
        <h4>Personal der Wache ({personal.length})</h4>
        <div className="verwalten-reiter" role="tablist" aria-label="Personal filtern">
          {FILTER.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`btn ${filter === f.id ? 'btn--primary' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.text} ({personal.filter(f.passt).length})
            </button>
          ))}
        </div>
        {gefiltert.length === 0 ? (
          <p className="einsatz-eintrag__zeile">Hier ist gerade niemand.</p>
        ) : (
          <ul className="personal-liste">
            {gefiltert.map((person) => {
              const fahrzeug = fahrzeuge.find((f) => f.id === person.fahrzeugId);
              const lehrgang = istInAusbildung(person);
              const gesperrt = lehrgang || (fahrzeug !== undefined && !kannUmbesetzen(fahrzeug));
              return (
                <li key={person.id}>
                  <span className="personal-liste__name">
                    <strong>{person.name}</strong>
                    <small><QualiChips qualifikationen={person.qualifikationen} /></small>
                  </span>
                  <span className="personal-liste__ort">
                    {lehrgang
                      ? `📚 Lehrgang bis ${formatZeitpunkt(person.inAusbildungBis!)}`
                      : fahrzeug ? `🚒 ${fahrzeug.callsign ?? fahrzeug.name}${kannUmbesetzen(fahrzeug) ? '' : ' (unterwegs)'}` : '🛋️ Ohne Fahrzeug'}
                  </span>
                  <span className="personal-liste__aktionen">
                    <label className="field" style={{ margin: 0 }}>
                      <select
                        value={person.fahrzeugId ?? ''}
                        disabled={gesperrt}
                        aria-label={`Einteilung von ${person.name}`}
                        onChange={(event) => {
                          const ziel = fahrzeuge.find((f) => f.id === event.target.value);
                          melde(weisePersonalZu(person.id, ziel?.id), ziel ? `✓ ${person.name} → ${ziel.callsign ?? ziel.name}.` : `✓ ${person.name} ist jetzt ohne Fahrzeug.`);
                        }}
                      >
                        <option value="">Ohne Fahrzeug</option>
                        {fahrzeuge.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.callsign ?? f.name} ({personal.filter((p) => p.fahrzeugId === f.id).length}/{getFahrzeugTyp(f.type)?.besatzung ?? 0})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn btn--klein"
                      disabled={gesperrt}
                      title="Entlassen"
                      aria-label={`${person.name} entlassen`}
                      onClick={() => {
                        if (window.confirm(`${person.name} wirklich entlassen? Die Einstellungskosten werden nicht erstattet.`)) {
                          melde(entlassePersonal(person.id), `${person.name} wurde entlassen.`);
                        }
                      }}
                    >
                      🗑️
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="einsatz-abschnitt">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0 }}>Bewerber</h4>
          <button
            type="button"
            className="btn"
            disabled={!darfNeuWuerfeln}
            title={darfNeuWuerfeln ? 'Einmal alle 12 Stunden möglich' : undefined}
            onClick={() => {
              if (!window.confirm('Neue Bewerber anfordern? Das geht nur einmal alle 12 Stunden – die aktuellen Bewerber sind dann weg.')) return;
              melde(wuerfleBewerberNeu(wache.id), '✓ Neue Bewerber sind da.');
            }}
          >
            ↻ Neue Bewerber
          </button>
        </div>
        <p className="einsatz-eintrag__zeile">
          Neue Bewerber kommen von selbst am {formatZeitpunkt(naechsteAutomatisch)} Uhr.
          {!darfNeuWuerfeln && ` Selbst anfordern geht wieder am ${formatZeitpunkt(neuWuerfelnAb)} Uhr.`}
        </p>
        {bewerber.length === 0 && <p className="einsatz-eintrag__zeile">Gerade keine Bewerber – warte auf die nächsten.</p>}
        <ul className="besatzung-liste" style={{ marginTop: 8 }}>
          {bewerber.map((kandidat) => (
            <li key={kandidat.id}>
              <span>{kandidat.name} <QualiChips qualifikationen={kandidat.qualifikationen} /></span>
              <button
                type="button"
                className="btn btn--primary"
                disabled={voll || balance < kandidat.preis}
                onClick={() => einstellen(kandidat)}
              >
                Einstellen · {euro(kandidat.preis)}
              </button>
            </li>
          ))}
        </ul>
        {voll && <p className="einsatz-eintrag__zeile">Kein Platz mehr – baue Ruheräume, um mehr Personal einzustellen.</p>}
      </section>
    </>
  );
}
