import { useState } from 'react';
import {
  FAEHIGKEIT_LABELS,
  FMS_STATUS,
  FUNKRUFNAME_MAX_LAENGE,
  QUALIFIKATION_LABELS,
  besitztQualifikation,
  getFahrzeugTyp,
  getFehlendeQualifikationen,
  istInAusbildung,
  kannUmbesetzen,
  type Mitarbeiter,
} from '@leitstellendispo/shared';
import type { Vehicle } from '../types';

type Melde = (meldung: { art: 'ok' | 'fehler'; text: string }) => void;

/**
 * Bearbeiten eines Fahrzeugs an der Wache: Funkrufname, Besatzung (manuell oder automatisch).
 * Ausbauten (z. B. größerer Wassertank) kommen später hier dazu.
 */
export default function FahrzeugBearbeiten({
  fahrzeug,
  wachenPersonal,
  benenneFahrzeugUm,
  weisePersonalZu,
  besetzeFahrzeugAutomatisch,
  onMeldung,
}: {
  fahrzeug: Vehicle;
  /** Personal dieser Wache */
  wachenPersonal: Mitarbeiter[];
  benenneFahrzeugUm: (fahrzeugId: string, name: string) => string | null;
  weisePersonalZu: (personId: string, fahrzeugId?: string) => string | null;
  besetzeFahrzeugAutomatisch: (fahrzeugId: string) => string | null;
  onMeldung: Melde;
}) {
  const [name, setName] = useState(fahrzeug.callsign ?? fahrzeug.name);
  const typ = getFahrzeugTyp(fahrzeug.type);
  const soll = typ?.besatzung ?? 0;
  const besatzung = wachenPersonal.filter((person) => person.fahrzeugId === fahrzeug.id);
  const fehlend = getFehlendeQualifikationen(fahrzeug.type, besatzung);
  const umbesetzbar = kannUmbesetzen(fahrzeug);
  // Reserve: wer passt, steht oben (hat eine fehlende Pflicht-Qualifikation)
  const reserve = wachenPersonal
    .filter((person) => !person.fahrzeugId && !istInAusbildung(person))
    .sort((a, b) => Number(fehlend.some((q) => besitztQualifikation(b.qualifikationen, q)))
      - Number(fehlend.some((q) => besitztQualifikation(a.qualifikationen, q))));
  const voll = besatzung.length >= soll;

  const melde = (fehler: string | null, ok: string) => onMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: ok });

  return (
    <div className="fahrzeug-bearbeiten">
      <section className="einsatz-abschnitt">
        <h4>Funkrufname</h4>
        <form
          className="fahrzeug-bearbeiten__zeile"
          onSubmit={(event) => {
            event.preventDefault();
            melde(benenneFahrzeugUm(fahrzeug.id, name), `✓ Umbenannt in „${name.trim()}“.`);
          }}
        >
          <label className="field" style={{ flex: '1 1 180px', margin: 0 }}>
            <input value={name} maxLength={FUNKRUFNAME_MAX_LAENGE} onChange={(e) => setName(e.target.value)} aria-label="Funkrufname" />
          </label>
          <button type="submit" className="btn" disabled={!name.trim() || name.trim() === fahrzeug.callsign}>Speichern</button>
        </form>
        {typ && (
          <small className="einsatz-eintrag__zeile">
            {typ.bezeichnung} · S{FMS_STATUS[fahrzeug.status ?? 'Einsatzbereit']} {fahrzeug.status ?? 'Einsatzbereit'} · {typ.geschwindigkeitKmh} km/h
            {' · '}{typ.faehigkeiten.map((f) => FAEHIGKEIT_LABELS[f]).join(', ')}
          </small>
        )}
      </section>

      <section className="einsatz-abschnitt">
        <h4>Besatzung ({besatzung.length}/{soll})</h4>
        <div className="fahrzeug-bearbeiten__zeile">
          {typ?.pflichtQualifikationen?.map((pflicht) => (
            <small key={pflicht} className={fehlend.includes(pflicht) ? 'ruf-minus' : 'ruf-plus'}>
              {fehlend.includes(pflicht) ? '✗' : '✓'} {QUALIFIKATION_LABELS[pflicht]}
            </small>
          ))}
        </div>
        {!umbesetzbar && <small className="einsatz-eintrag__zeile">Unterwegs – Umbesetzen erst nach der Rückkehr.</small>}

        {/* Sitzplätze: belegte Plätze als kleine Kacheln, freie Plätze gestrichelt */}
        <ul className="sitzplaetze">
          {besatzung.map((person) => (
            <li key={person.id} className="sitzplatz">
              <span className="sitzplatz__name">{person.name}</span>
              <span className="sitzplatz__quali">
                {person.qualifikationen.length === 0 ? 'Grundausbildung' : person.qualifikationen.map((q) => QUALIFIKATION_LABELS[q]).join(', ')}
              </span>
              <button
                type="button"
                className="sitzplatz__raus"
                disabled={!umbesetzbar}
                aria-label={`${person.name} in die Reserve`}
                title="In die Reserve"
                onClick={() => melde(weisePersonalZu(person.id), `✓ ${person.name} ist in der Reserve.`)}
              >
                ✕
              </button>
            </li>
          ))}
          {Array.from({ length: Math.max(0, soll - besatzung.length) }, (_, i) => (
            <li key={`frei-${i}`} className="sitzplatz sitzplatz--frei">frei</li>
          ))}
        </ul>

        <div className="fahrzeug-bearbeiten__zeile">
          <label className="field" style={{ flex: '1 1 200px', margin: 0 }}>
            <select
              value=""
              disabled={!umbesetzbar || voll || reserve.length === 0}
              aria-label="Person aus der Reserve aufs Fahrzeug setzen"
              onChange={(event) => {
                const person = reserve.find((p) => p.id === event.target.value);
                if (person) melde(weisePersonalZu(person.id, fahrzeug.id), `✓ ${person.name} → ${fahrzeug.callsign ?? fahrzeug.name}.`);
              }}
            >
              <option value="">
                {voll ? 'Fahrzeug ist voll besetzt' : reserve.length === 0 ? 'Niemand in der Reserve' : 'Aus der Reserve hinzufügen …'}
              </option>
              {reserve.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}{person.qualifikationen.length > 0 ? ` (${person.qualifikationen.map((q) => QUALIFIKATION_LABELS[q]).join(', ')})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!umbesetzbar || reserve.length === 0 || (voll && fehlend.length === 0)}
            onClick={() => melde(besetzeFahrzeugAutomatisch(fahrzeug.id), `✓ ${fahrzeug.callsign ?? fahrzeug.name} mit Reserve besetzt.`)}
          >
            Automatisch besetzen
          </button>
        </div>
      </section>

      <section className="einsatz-abschnitt">
        <h4>Ausbau</h4>
        <small className="einsatz-eintrag__zeile">🔧 Kommt bald: Fahrzeuge verbessern, z. B. größerer Wassertank für Löschfahrzeuge.</small>
      </section>
    </div>
  );
}
