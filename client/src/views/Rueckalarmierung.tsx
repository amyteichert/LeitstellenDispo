import { useEffect, useState } from 'react';
import {
  formatBedarfsListe,
  getAktiveZuteilungen,
  getWarteLage,
  kannRueckalarmieren,
  type MapLocation,
  type SpielEinsatz,
} from '@leitstellendispo/shared';
import type { Vehicle } from '../types';

/** Ab dieser Wartezeit vor Ort weisen wir auf die Rückalarmierung hin */
const HINWEIS_AB_MS = 2 * 60_000;

const minuten = (ms: number) => Math.max(1, Math.round(ms / 60_000));

/**
 * Rückalarmierung: Fahrzeuge vom Einsatz zurückholen – z. B. wenn ein RTW vor Ort auf ein NEF wartet,
 * das gerade nirgends frei ist, oder um ein Fahrzeug auf der Anfahrt umzudisponieren.
 * Zurückgeholte Fahrzeuge sind auf der Rückfahrt sofort wieder alarmierbar.
 */
export default function Rueckalarmierung({
  incident,
  incidents,
  vehicles,
  locations,
  nowMs,
  onRueckalarmieren,
}: {
  incident: SpielEinsatz;
  incidents: SpielEinsatz[];
  vehicles: Vehicle[];
  locations: MapLocation[];
  nowMs: number;
  onRueckalarmieren: (vehicleId: string) => void;
}) {
  // Zweistufig: erster Tipp merkt das Fahrzeug vor, zweiter bestätigt (kein Popup)
  const [vorgemerkt, setVorgemerkt] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    if (!vorgemerkt) return;
    const timer = window.setTimeout(() => setVorgemerkt(null), 4000);
    return () => window.clearTimeout(timer);
  }, [vorgemerkt]);

  const aktiv = getAktiveZuteilungen(incident).filter((a) => kannRueckalarmieren(incident, a.vehicleId));
  if (aktiv.length === 0) return null;

  const name = (id: string) => {
    const vehicle = vehicles.find((v) => v.id === id);
    return vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug';
  };
  const lage = getWarteLage(incident, { incidents, vehicles, locations }, nowMs);
  const laengsteWartezeit = lage ? Math.max(...lage.wartende.map((w) => nowMs - w.wartetSeit)) : 0;
  const zeigeHinweis = lage && laengsteWartezeit >= HINWEIS_AB_MS;
  // Zurückholen lohnt sich vor allem, wenn für das Fehlende gerade nichts frei ist
  const empfohlen = zeigeHinweis && lage.fehlt.length > 0 && !lage.freiesFahrzeugFuerFehlendes;

  const knopf = (vehicleId: string, vorOrt: boolean) => (
    <button
      key={vehicleId}
      type="button"
      className={`btn ${vorgemerkt === vehicleId ? 'btn--danger' : 'btn--secondary'}`}
      onClick={() => {
        if (vorgemerkt !== vehicleId) return setVorgemerkt(vehicleId);
        setVorgemerkt(null);
        onRueckalarmieren(vehicleId);
      }}
    >
      {vorgemerkt === vehicleId ? `Sicher? ${name(vehicleId)} zurückholen` : `↩ ${name(vehicleId)} ${vorOrt ? 'zurückholen' : 'umdisponieren'}`}
    </button>
  );

  return (
    <div className="rueckalarmierung">
      {zeigeHinweis && (
        <div className={`versorgung-hinweis ${empfohlen ? 'versorgung-hinweis--fehlt' : 'versorgung-hinweis--unterwegs'}`}>
          ⏳ <strong>{lage.wartende.map((w) => name(w.vehicleId)).join(', ')}</strong>{' '}
          {lage.wartende.length > 1 ? 'warten' : 'wartet'} seit {minuten(laengsteWartezeit)} Min. vor Ort
          {lage.fehlt.length > 0 && <> auf <strong>{formatBedarfsListe(lage.fehlt)}</strong></>}.
          {' '}
          {lage.fehlt.length === 0 && lage.letzteAnkunftAt !== undefined && <>Der Rest ist in ca. {minuten(lage.letzteAnkunftAt - nowMs)} Min. da.</>}
          {lage.fehlt.length > 0 && lage.freiesFahrzeugFuerFehlendes && <>Ein passendes Fahrzeug ist frei – nachalarmieren!</>}
          {empfohlen && <>Gerade ist nichts Passendes frei. Du kannst Fahrzeuge zurückholen – der Einsatz bleibt offen und du alarmierst später neu.</>}
          {empfohlen && <div className="rueckalarmierung__knoepfe">{lage.wartende.map((w) => knopf(w.vehicleId, true))}</div>}
        </div>
      )}

      {!empfohlen && (
        <>
          <button type="button" className="rueckalarmierung__aufklapper" aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
            ↩ Fahrzeug zurückholen {offen ? '▴' : '▾'}
          </button>
          {offen && (
            <div className="rueckalarmierung__knoepfe">
              <small className="einsatz-eintrag__zeile">
                Das Fahrzeug fährt zur Wache und ist unterwegs sofort wieder alarmierbar. Ohne Fahrzeuge ist der Einsatz wieder offen.
              </small>
              {aktiv.map((a) => knopf(a.vehicleId, a.arrivalAt <= nowMs))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
