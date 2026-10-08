import { useState } from 'react';
import {
  QUALIFIKATION_LABELS,
  ZUFRIEDENHEIT_CONFIG,
  erzeugeBewerber,
  getBewerberFaktor,
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

const QualiChips = ({ qualifikationen }: { qualifikationen: Qualifikation[] }) => (
  qualifikationen.length === 0
    ? <span className="quali-chip quali-chip--keine">Grundausbildung</span>
    : <>{qualifikationen.map((q) => <span key={q} className="quali-chip">{QUALIFIKATION_LABELS[q]}</span>)}</>
);

/** Reiter „Personal“ einer Wache: Besatzung der Fahrzeuge, Reserve und Bewerber. */
export default function PersonalReiter({
  wache,
  fahrzeuge,
  personal,
  balance,
  zufriedenheit,
  kuendigungen,
  onMeldung,
  stellePersonalEin,
  entlassePersonal,
  weisePersonalZu,
  besetzeFahrzeugAutomatisch,
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
  entlassePersonal: (personId: string) => string | null;
  weisePersonalZu: (personId: string, fahrzeugId?: string) => string | null;
  besetzeFahrzeugAutomatisch: (fahrzeugId: string) => string | null;
}) {
  // Zufriedenes Personal spricht sich herum: mehr qualifizierte Bewerber
  const neueBewerber = (anzahl?: number) => erzeugeBewerber(wache, anzahl, Math.random, getBewerberFaktor(zufriedenheit));
  const [bewerber, setBewerber] = useState<Bewerber[]>(() => neueBewerber());
  const limit = getPersonalLimit(wache);
  const voll = personal.length >= limit;
  const reserve = personal.filter((person) => !person.fahrzeugId && !istInAusbildung(person));
  const imLehrgang = personal.filter(istInAusbildung);

  const melde = (fehler: string | null, ok: string) => onMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: ok });

  const einstellen = (kandidat: Bewerber) => {
    const fehler = stellePersonalEin(wache.id, kandidat);
    melde(fehler, `✓ ${kandidat.name} eingestellt – jetzt einem Fahrzeug zuweisen.`);
    if (!fehler) setBewerber((current) => [...current.filter((b) => b.id !== kandidat.id), ...neueBewerber(1)]);
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
          <small>In Reserve (keinem Fahrzeug zugewiesen)</small>
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
        <h4>Besatzung der Fahrzeuge</h4>
        {fahrzeuge.length === 0 && <p className="einsatz-eintrag__zeile">Noch keine Fahrzeuge an dieser Wache.</p>}
        <div className="besatzung-raster">
          {fahrzeuge.map((fahrzeug) => {
            const typ = getFahrzeugTyp(fahrzeug.type);
            const soll = typ?.besatzung ?? 0;
            const besatzung = personal.filter((person) => person.fahrzeugId === fahrzeug.id);
            const einsatzbereit = besatzung.length >= soll && !fahrzeug.fehlendeQualifikation;
            const umbesetzbar = kannUmbesetzen(fahrzeug);
            return (
              <article key={fahrzeug.id} className={`besatzung-karte ${einsatzbereit ? '' : 'besatzung-karte--fehlt'}`}>
                <div className="besatzung-karte__kopf">
                  <strong>{fahrzeug.callsign ?? fahrzeug.name}</strong>
                  <span>{besatzung.length} / {soll}</span>
                </div>
                {typ?.pflichtQualifikation && (
                  <small className={fahrzeug.fehlendeQualifikation ? 'ruf-minus' : 'ruf-plus'}>
                    {fahrzeug.fehlendeQualifikation ? '✗' : '✓'} {QUALIFIKATION_LABELS[typ.pflichtQualifikation]}
                  </small>
                )}
                {!einsatzbereit && (
                  <small className="ruf-minus">
                    Nicht alarmierbar:{' '}
                    {[
                      besatzung.length < soll && `${soll - besatzung.length} Person(en) fehlen`,
                      fahrzeug.fehlendeQualifikation && `${QUALIFIKATION_LABELS[fahrzeug.fehlendeQualifikation]} fehlt`,
                    ].filter(Boolean).join(', ')}
                  </small>
                )}
                {!umbesetzbar && <small>Unterwegs – Umbesetzen erst nach der Rückkehr.</small>}
                <ul className="besatzung-liste">
                  {besatzung.map((person) => (
                    <li key={person.id}>
                      <span>{person.name} <QualiChips qualifikationen={person.qualifikationen} /></span>
                      <button
                        type="button"
                        className="btn"
                        disabled={!umbesetzbar}
                        title="In die Reserve"
                        onClick={() => melde(weisePersonalZu(person.id), `✓ ${person.name} ist in der Reserve.`)}
                      >
                        ↓ Reserve
                      </button>
                    </li>
                  ))}
                </ul>
                {besatzung.length < soll || fahrzeug.fehlendeQualifikation ? (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={!umbesetzbar || reserve.length === 0}
                    onClick={() => melde(besetzeFahrzeugAutomatisch(fahrzeug.id), `✓ ${fahrzeug.callsign ?? fahrzeug.name} mit Reserve besetzt.`)}
                  >
                    Automatisch besetzen
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="einsatz-abschnitt">
        <h4>Reserve ({reserve.length})</h4>
        {reserve.length === 0 ? (
          <p className="einsatz-eintrag__zeile">Alle sind einem Fahrzeug zugewiesen.</p>
        ) : (
          <ul className="besatzung-liste">
            {reserve.map((person) => (
              <li key={person.id}>
                <span>{person.name} <QualiChips qualifikationen={person.qualifikationen} /></span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <label className="field" style={{ margin: 0 }}>
                    <select
                      value=""
                      aria-label={`${person.name} einem Fahrzeug zuweisen`}
                      onChange={(event) => {
                        const ziel = fahrzeuge.find((f) => f.id === event.target.value);
                        if (ziel) melde(weisePersonalZu(person.id, ziel.id), `✓ ${person.name} → ${ziel.callsign ?? ziel.name}.`);
                      }}
                    >
                      <option value="">Zuweisen …</option>
                      {fahrzeuge.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.callsign ?? f.name} ({personal.filter((p) => p.fahrzeugId === f.id).length}/{getFahrzeugTyp(f.type)?.besatzung ?? 0})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (window.confirm(`${person.name} wirklich entlassen? Die Einstellungskosten werden nicht erstattet.`)) {
                        melde(entlassePersonal(person.id), `${person.name} wurde entlassen.`);
                      }
                    }}
                  >
                    Entlassen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {imLehrgang.length > 0 && (
        <section className="einsatz-abschnitt">
          <h4>Auf Lehrgang ({imLehrgang.length})</h4>
          <ul className="besatzung-liste">
            {imLehrgang.map((person) => (
              <li key={person.id}>
                <span>📚 {person.name} <QualiChips qualifikationen={person.qualifikationen} /></span>
                <small>zurück am {new Date(person.inAusbildungBis!).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="einsatz-abschnitt">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0 }}>Bewerber</h4>
          <button type="button" className="btn" onClick={() => setBewerber(neueBewerber())}>↻ Neue Bewerber</button>
        </div>
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
