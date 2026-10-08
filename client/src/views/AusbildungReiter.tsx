import { useState } from 'react';
import {
  AUSBILDUNG_CONFIG,
  QUALIFIKATION_LABELS,
  getAusbildungsRaeume,
  getLehrgaengeFuerWache,
  getLehrgang,
  getNaechsterRaumPreis,
  getRaumPlaetze,
  getRaumUpgradePreis,
  hatAusbildungsbereich,
  pruefeTeilnehmer,
  type AbgeschlossenerLehrgang,
  type AusbildungsRaum,
  type Mitarbeiter,
  type Qualifikation,
  formatEuro,
} from '@leitstellendispo/shared';
import type { MapLocation, Vehicle } from '../types';

const euro = formatEuro;

/** z. B. „2 T 4 Std“ oder „35 Min“ */
export const formatDauer = (ms: number) => {
  const minuten = Math.max(0, Math.ceil(ms / 60000));
  const tage = Math.floor(minuten / 1440);
  const stunden = Math.floor((minuten % 1440) / 60);
  const rest = minuten % 60;
  if (tage > 0) return `${tage} T${stunden > 0 ? ` ${stunden} Std` : ''}`;
  if (stunden > 0) return `${stunden} Std${rest > 0 ? ` ${rest} Min` : ''}`;
  return `${rest} Min`;
};

export interface AusbildungAktionen {
  baueAusbildungsraum: (wacheId: string) => string | null;
  erweitereAusbildungsraum: (wacheId: string, raumId: string) => string | null;
  starteLehrgangAnWache: (wacheId: string, raumId: string, qualifikation: Qualifikation, teilnehmerIds: string[]) => string | null;
}

export default function AusbildungReiter({
  wache,
  personal,
  fahrzeuge,
  balance,
  nowMs,
  abschluesse,
  onMeldung,
  aktionen,
}: {
  wache: MapLocation;
  /** Nur das Personal dieser Wache */
  personal: Mitarbeiter[];
  fahrzeuge: Vehicle[];
  balance: number;
  nowMs: number;
  abschluesse: AbgeschlossenerLehrgang[];
  onMeldung: (meldung: { art: 'ok' | 'fehler'; text: string }) => void;
  aktionen: AusbildungAktionen;
}) {
  const raeume = getAusbildungsRaeume(wache);
  const raumPreis = getNaechsterRaumPreis(wache);
  const melde = (fehler: string | null, ok: string) => onMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: ok });
  const eigeneAbschluesse = abschluesse.filter((a) => a.wacheId === wache.id);

  if (!hatAusbildungsbereich(wache)) {
    return (
      <div className="ausbau-raster">
        <article className="ausbau-karte">
          <span className="ausbau-karte__kategorie">Ausbildung</span>
          <h3>Ausbildungsbereich bauen</h3>
          <p>
            Bilde dein Personal an der Wache weiter: {getLehrgaengeFuerWache(wache).map((l) => QUALIFIKATION_LABELS[l.qualifikation]).join(', ')}.
            Inklusive erstem Raum mit {AUSBILDUNG_CONFIG.plaetzeJeRaum} Plätzen.
          </p>
          <div className="ausbau-karte__preis">{euro(AUSBILDUNG_CONFIG.bereichPreis)}</div>
          <button
            type="button"
            className="btn btn--primary"
            disabled={balance < AUSBILDUNG_CONFIG.bereichPreis}
            onClick={() => melde(aktionen.baueAusbildungsraum(wache.id), '✓ Ausbildungsbereich gebaut.')}
          >
            {balance < AUSBILDUNG_CONFIG.bereichPreis ? `Es fehlen ${euro(AUSBILDUNG_CONFIG.bereichPreis - balance)}` : 'Bauen'}
          </button>
        </article>
      </div>
    );
  }

  return (
    <>
      <div className="besatzung-raster">
        {raeume.map((raum, index) => (
          <RaumKarte
            key={raum.id}
            nummer={index + 1}
            raum={raum}
            wache={wache}
            personal={personal}
            fahrzeuge={fahrzeuge}
            balance={balance}
            nowMs={nowMs}
            melde={melde}
            aktionen={aktionen}
          />
        ))}
        {raumPreis !== null && (
          <article className="ausbau-karte">
            <span className="ausbau-karte__kategorie">Ausbildung</span>
            <h3>Weiterer Raum</h3>
            <p>Ein zusätzlicher Lehrgang gleichzeitig ({AUSBILDUNG_CONFIG.plaetzeJeRaum} Plätze). {raeume.length}/{AUSBILDUNG_CONFIG.maxRaeume} Räume.</p>
            <div className="ausbau-karte__preis">{euro(raumPreis)}</div>
            <button
              type="button"
              className="btn btn--primary"
              disabled={balance < raumPreis}
              onClick={() => melde(aktionen.baueAusbildungsraum(wache.id), '✓ Neuer Ausbildungsraum gebaut.')}
            >
              {balance < raumPreis ? `Es fehlen ${euro(raumPreis - balance)}` : 'Bauen'}
            </button>
          </article>
        )}
      </div>

      {eigeneAbschluesse.length > 0 && (
        <section className="einsatz-abschnitt">
          <h4>Zuletzt abgeschlossen</h4>
          <ul className="besatzung-liste">
            {eigeneAbschluesse.map((a, index) => (
              <li key={`${a.qualifikation}-${index}`}>🎓 {QUALIFIKATION_LABELS[a.qualifikation]}: {a.namen.join(', ')} – jetzt in der Reserve</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function RaumKarte({
  nummer,
  raum,
  wache,
  personal,
  fahrzeuge,
  balance,
  nowMs,
  melde,
  aktionen,
}: {
  nummer: number;
  raum: AusbildungsRaum;
  wache: MapLocation;
  personal: Mitarbeiter[];
  fahrzeuge: Vehicle[];
  balance: number;
  nowMs: number;
  melde: (fehler: string | null, ok: string) => void;
  aktionen: AusbildungAktionen;
}) {
  const lehrgaenge = getLehrgaengeFuerWache(wache);
  const [kurs, setKurs] = useState<Qualifikation>(lehrgaenge[0]?.qualifikation ?? 'notfallsanitaeter');
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const plaetze = getRaumPlaetze(raum);
  const upgradePreis = getRaumUpgradePreis(raum);
  const lehrgang = getLehrgang(kurs);

  const kopf = (
    <div className="besatzung-karte__kopf">
      <strong>Raum {nummer}</strong>
      <span>{plaetze} Plätze</span>
    </div>
  );
  const upgrade = upgradePreis !== null && (
    <button
      type="button"
      className="btn"
      disabled={balance < upgradePreis}
      onClick={() => melde(aktionen.erweitereAusbildungsraum(wache.id, raum.id), `✓ Raum ${nummer} hat jetzt ${plaetze + AUSBILDUNG_CONFIG.plaetzeJeUpgrade} Plätze.`)}
    >
      +{AUSBILDUNG_CONFIG.plaetzeJeUpgrade} Plätze · {euro(upgradePreis)}
    </button>
  );

  if (raum.lehrgang) {
    const { qualifikation, teilnehmerIds, startAt, endeAt } = raum.lehrgang;
    const anteil = Math.min(100, Math.max(0, ((nowMs - startAt) / (endeAt - startAt)) * 100));
    return (
      <article className="besatzung-karte">
        {kopf}
        <strong>📚 {QUALIFIKATION_LABELS[qualifikation]}</strong>
        <small>Noch {formatDauer(endeAt - nowMs)} · fertig am {new Date(endeAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
        <div className="bearbeitung-fortschritt__balken"><span style={{ width: `${anteil}%` }} /></div>
        <small>Teilnehmer: {teilnehmerIds.map((id) => personal.find((p) => p.id === id)?.name ?? '?').join(', ')}</small>
        {upgrade}
      </article>
    );
  }

  const fahrzeugName = (person: Mitarbeiter) => {
    const f = fahrzeuge.find((v) => v.id === person.fahrzeugId);
    return f ? f.callsign ?? f.name : 'Reserve';
  };
  const kandidaten = lehrgang ? personal.filter((p) => pruefeTeilnehmer(p, lehrgang) === null) : [];
  const kosten = (lehrgang?.kosten ?? 0) * auswahl.length;

  const toggle = (id: string) => setAuswahl((current) => (
    current.includes(id) ? current.filter((x) => x !== id) : current.length < plaetze ? [...current, id] : current
  ));

  return (
    <article className="besatzung-karte">
      {kopf}
      <label className="field" style={{ margin: 0 }}>
        <select value={kurs} onChange={(e) => { setKurs(e.target.value as Qualifikation); setAuswahl([]); }}>
          {lehrgaenge.map((l) => (
            <option key={l.qualifikation} value={l.qualifikation}>
              {QUALIFIKATION_LABELS[l.qualifikation]} – {formatDauer(l.dauerMs)} · {euro(l.kosten)}/Person
            </option>
          ))}
        </select>
      </label>
      {lehrgang?.voraussetzung && <small>Voraussetzung: {QUALIFIKATION_LABELS[lehrgang.voraussetzung]}</small>}
      {kandidaten.length === 0 ? (
        <small>Niemand an dieser Wache kann diesen Lehrgang gerade besuchen.</small>
      ) : (
        <ul className="fahrzeug-auswahl">
          {kandidaten.map((person) => (
            <li key={person.id}>
              <label>
                <input
                  type="checkbox"
                  checked={auswahl.includes(person.id)}
                  disabled={!auswahl.includes(person.id) && auswahl.length >= plaetze}
                  onChange={() => toggle(person.id)}
                />
                <span>
                  <strong>{person.name}</strong>
                  <small>{fahrzeugName(person)}{person.fahrzeugId ? ' – fehlt dort während des Lehrgangs' : ''}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn btn--primary"
        disabled={auswahl.length === 0 || balance < kosten}
        onClick={() => {
          const fehler = aktionen.starteLehrgangAnWache(wache.id, raum.id, kurs, auswahl);
          melde(fehler, `✓ Lehrgang ${QUALIFIKATION_LABELS[kurs]} gestartet (${auswahl.length} Teilnehmer).`);
          if (!fehler) setAuswahl([]);
        }}
      >
        Lehrgang starten ({auswahl.length}/{plaetze}){kosten > 0 ? ` · ${euro(kosten)}` : ''}
      </button>
      {upgrade}
    </article>
  );
}
