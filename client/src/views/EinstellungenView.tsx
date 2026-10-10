import { useState } from 'react';
import type { Konto, UserRole } from '@leitstellendispo/shared';
import { STARTANSICHTEN, ladeStartansicht, speichereStartansicht, type Ansicht } from '../startansicht';
import { RechtlicheLinks } from '../Rechtliches';
import { EINSATZ_TEMPI, setEinstellungen, useEinstellungen, type GeraeteEinstellungen } from '../einstellungen';
import { testeTon } from '../ton';
import KontoEinstellungen from './KontoEinstellungen';

const ROLLEN_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-Owner',
  admin: 'Admin',
  player: 'Spieler',
};

const HINWEIS_MODI: Array<{ wert: GeraeteEinstellungen['hinweise']; text: string }> = [
  { wert: 'alle', text: 'Alle neuen Einsätze und wichtigen Meldungen' },
  { wert: 'wichtig', text: 'Nur wichtige Meldungen (Eskalation, Nachforderung)' },
  { wert: 'aus', text: 'Keine Einblendungen' },
];

/** Schalter-Zeile: Text links, Häkchen rechts – gut mit dem Finger zu treffen */
function Schalter({ text, info, an, onChange }: { text: string; info?: string; an: boolean; onChange: (an: boolean) => void }) {
  return (
    <label className="einstellung-schalter">
      <span>
        {text}
        {info && <small>{info}</small>}
      </span>
      <input type="checkbox" checked={an} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function EinstellungenView({
  onNeuesSpiel,
  konto,
  onAbmelden,
  email,
  onEmailGeaendert,
  onTourStarten,
}: {
  email: string | null;
  onEmailGeaendert: (email: string) => void;
  /** Startet die geführte Tour erneut */
  onTourStarten: () => void;
  onNeuesSpiel: () => void;
  konto: Konto;
  onAbmelden: () => Promise<void>;
}) {
  const einstellungen = useEinstellungen();
  const [startansicht, setStartansicht] = useState<Ansicht>(ladeStartansicht);
  const [meldetAb, setMeldetAb] = useState(false);
  const vibrationMoeglich = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  return (
    <div>
      <div className="wachen-kopf">
        <h2>Einstellungen</h2>
        <small className="einsatz-eintrag__zeile">Ton, Ansicht und Karte gelten nur auf diesem Gerät.</small>
      </div>

      <div className="einstellungen-raster">
        <section className="ausbau-karte">
          <span className="ausbau-karte__kategorie">🔔 Ton & Hinweise</span>
          <Schalter text="Alarmgong" info="Bei neuen Einsätzen und Lagemeldungen" an={einstellungen.ton} onChange={(ton) => setEinstellungen({ ton })} />
          <label className="einstellung-regler">
            <span>Lautstärke <small>{Math.round(einstellungen.lautstaerke * 100)} %</small></span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={einstellungen.lautstaerke}
              disabled={!einstellungen.ton}
              onChange={(e) => setEinstellungen({ lautstaerke: Number(e.target.value) })}
            />
          </label>
          <button type="button" className="btn btn--secondary" onClick={testeTon}>🔊 Ton testen</button>
          <p>Am Handy: einmal „Ton testen“ antippen, dann hörst du den Gong auch bei neuen Einsätzen. Ist das Handy stumm geschaltet, bleibt es eventuell still.</p>
          <Schalter
            text="Vibration"
            info={vibrationMoeglich ? 'Bei neuen Einsätzen (Handy)' : 'Wird von diesem Gerät/Browser nicht unterstützt (z. B. iPhone)'}
            an={einstellungen.vibration}
            onChange={(vibration) => setEinstellungen({ vibration })}
          />
        </section>

        <section className="ausbau-karte">
          <span className="ausbau-karte__kategorie">💬 Einblendungen</span>
          <label className="field">
            <span>Einblenden bei</span>
            <select value={einstellungen.hinweise} onChange={(e) => setEinstellungen({ hinweise: e.target.value as GeraeteEinstellungen['hinweise'] })}>
              {HINWEIS_MODI.map((modus) => <option key={modus.wert} value={modus.wert}>{modus.text}</option>)}
            </select>
          </label>
          <label className="einstellung-regler">
            <span>Anzeigedauer <small>{einstellungen.hinweisDauerSekunden} Sek.</small></span>
            <input
              type="range"
              min={3}
              max={20}
              step={1}
              value={einstellungen.hinweisDauerSekunden}
              disabled={einstellungen.hinweise === 'aus'}
              onChange={(e) => setEinstellungen({ hinweisDauerSekunden: Number(e.target.value) })}
            />
          </label>
          <p>Der Gong kommt trotzdem – den schaltest du oben aus.</p>
        </section>

        <section className="ausbau-karte">
          <span className="ausbau-karte__kategorie">🖥️ Ansicht</span>
          <label className="field">
            <span>Ansicht beim Start</span>
            <select
              value={startansicht}
              onChange={(e) => {
                const ansicht = e.target.value as Ansicht;
                setStartansicht(ansicht);
                speichereStartansicht(ansicht);
              }}
            >
              {STARTANSICHTEN.map((ansicht) => <option key={ansicht}>{ansicht}</option>)}
            </select>
          </label>
          <Schalter text="Kompakte Ansicht" info="Kleinere Schrift und Abstände – mehr Platz am Handy" an={einstellungen.kompakt} onChange={(kompakt) => setEinstellungen({ kompakt })} />
          <Schalter text="Karte merken" info="Die Karte startet da, wo du zuletzt warst" an={einstellungen.karteMerken} onChange={(karteMerken) => setEinstellungen({ karteMerken })} />
        </section>

        <section className="ausbau-karte">
          <span className="ausbau-karte__kategorie">🚨 Einsatztempo</span>
          <p>Wie oft neue Einsätze reinkommen. Uhrzeit, Wochentag und Wetter wirken zusätzlich.</p>
          <div className="einsatztempo">
            {EINSATZ_TEMPI.map((tempo) => (
              <button
                key={tempo.wert}
                type="button"
                className={`btn ${einstellungen.einsatzTempo === tempo.wert ? 'btn--primary' : ''}`}
                aria-pressed={einstellungen.einsatzTempo === tempo.wert}
                onClick={() => setEinstellungen({ einsatzTempo: tempo.wert })}
              >
                {tempo.text}
              </button>
            ))}
          </div>
          <small className="einsatz-eintrag__zeile">{EINSATZ_TEMPI.find((t) => t.wert === einstellungen.einsatzTempo)?.info}</small>
        </section>

        <section className="ausbau-karte">
          <span className="ausbau-karte__kategorie">ℹ️ Gut zu wissen</span>
          <p>
            <strong>Anfahrtszeiten:</strong> Die Fahrzeiten sind realistisch angelegt – mit Ausrückzeit, typischen Geschwindigkeiten
            bei Einsatzfahrten und dem Umweg über die Straße. Auf der Karte fahren die Fahrzeuge aber vorerst auf direktem Weg.
          </p>
          <p>
            Echte Routenführung über das Straßennetz ist in nächster Zeit nicht geplant, haben wir aber für später im Hinterkopf.
          </p>
        </section>

        <section className="ausbau-karte">
          <span className="ausbau-karte__kategorie">🎓 Tour durchs Spiel</span>
          <p>Zeigt dir Schritt für Schritt die wichtigsten Bereiche – jederzeit wiederholbar.</p>
          <button className="btn btn--secondary" type="button" onClick={onTourStarten}>Tour starten</button>
        </section>

        <section className="ausbau-karte">
          <span className="ausbau-karte__kategorie">👤 Konto</span>
          <p>Angemeldet als <strong>{konto.name}</strong> ({ROLLEN_LABELS[konto.rolle]})</p>
          <KontoEinstellungen email={email} onEmailGeaendert={onEmailGeaendert} />
          <button
            className="btn btn--secondary"
            type="button"
            disabled={meldetAb}
            onClick={() => {
              setMeldetAb(true);
              void onAbmelden();
            }}
          >
            {meldetAb ? 'Speichere und melde ab …' : 'Abmelden'}
          </button>
        </section>

        <section className="ausbau-karte">
          <span className="ausbau-karte__kategorie">💾 Spielstand</span>
          <p>Dein Spiel wird automatisch in deinem Konto gespeichert – so kannst du auf jedem Gerät weiterspielen. Ein neues Spiel löscht den aktuellen Spielstand.</p>
          <button className="btn btn--danger" type="button" onClick={onNeuesSpiel}>Neues Spiel starten</button>
        </section>
      </div>

      <RechtlicheLinks />
    </div>
  );
}
