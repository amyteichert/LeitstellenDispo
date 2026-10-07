import { useEffect, useState } from 'react';
import {
  EINSATZ_STATUS_LABELS,
  erstelleAlarmVorschlag,
  getVerfuegbareFahrzeugeFuerEinsatz,
  getMeldungKey,
  getVerborgeneMeldungen,
  type FunkSpruch,
  PATIENTEN_STATUS_LABELS,
  formatBedarfsListe,
  formatEinsatzTitel,
  getBedarfsLabel,
  getEinsatzVersorgung,
  istEskaliert,
  istWichtigeMeldung,
  type SpielEinsatz,
} from '@leitstellendispo/shared';
import type { MapLocation, Vehicle } from '../types';

/** Leiste oben auf der Karte mit allen laufenden Einsätzen. */
export function KarteEinsatzLeiste({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: SpielEinsatz[];
  selectedId: string | null;
  onSelect: (incident: SpielEinsatz) => void;
}) {
  if (incidents.length === 0) return null;

  return (
    <div className="map-incident-bar">
      <span className="map-incident-bar__count">Einsätze: {incidents.length}</span>
      {incidents.map((incident) => {
        const eskaliert = istEskaliert(incident);
        return (
          <button
            key={incident.id}
            type="button"
            className={`map-incident-chip map-incident-chip--${incident.status} ${eskaliert ? 'map-incident-chip--eskaliert' : ''} ${selectedId === incident.id ? 'map-incident-chip--active' : ''}`}
            onClick={() => onSelect(incident)}
            title={incident.address}
          >
            <span className="map-incident-chip__dot" />
            {eskaliert && '⚠ '}
            {formatEinsatzTitel(incident)}
          </button>
        );
      })}
    </div>
  );
}

/** Schwebendes Fenster rechts mit einer Kurzinfo zum gewählten Einsatz. */
export function KarteEinsatzPanel({
  incident,
  incidents,
  vehicles,
  locations,
  nowMs,
  onClose,
  onOpenInEinsaetze,
  onAlarmieren,
  funk,
  onSprechaufforderung,
}: {
  funk: FunkSpruch[];
  onSprechaufforderung: (sprechwunschId: string) => void;
  incident: SpielEinsatz;
  incidents: SpielEinsatz[];
  vehicles: Vehicle[];
  locations: MapLocation[];
  nowMs: number;
  onClose: () => void;
  onOpenInEinsaetze: () => void;
  /** Alarmiert die übergebenen Fahrzeuge direkt von der Karte aus */
  onAlarmieren: (vehicleIds: string[]) => void;
}) {
  const { abdeckung, ausreichendAlarmiert, fehlendAlarmiert } = getEinsatzVersorgung(incident, vehicles, nowMs);
  const vorschlag = erstelleAlarmVorschlag(incident, { incidents, vehicles, locations });
  const vorschlagNamen = vorschlag.fahrzeugIds.map((id) => {
    const vehicle = vehicles.find((item) => item.id === id);
    return vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug';
  });
  const [rueckmeldung, setRueckmeldung] = useState<string | null>(null);
  const letzteMeldung = incident.meldungen[incident.meldungen.length - 1];
  const letzterSprechwunsch = letzteMeldung ? getVerborgeneMeldungen(funk).get(getMeldungKey(incident.id, letzteMeldung)) : undefined;
  const kannAlarmieren = incident.status === 'offen' || incident.status === 'alarmiert';
  const passende = kannAlarmieren ? getVerfuegbareFahrzeugeFuerEinsatz(incident, { incidents, vehicles, locations }) : [];
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const toggle = (vehicleId: string) =>
    setAuswahl((current) => (current.includes(vehicleId) ? current.filter((id) => id !== vehicleId) : [...current, vehicleId]));

  // Anderer Einsatz gewählt → Auswahl zurücksetzen; nicht mehr verfügbare Fahrzeuge abwählen
  useEffect(() => setAuswahl([]), [incident.id]);
  const verfuegbareIds = passende.map((p) => p.vehicle.id).join(',');
  useEffect(() => {
    setAuswahl((current) => {
      const noch = current.filter((id) => verfuegbareIds.split(',').includes(id));
      return noch.length === current.length ? current : noch;
    });
  }, [verfuegbareIds]);

  return (
    <aside className="map-incident-panel">
      <div className="map-incident-panel__header">
        <h3>{formatEinsatzTitel(incident)}</h3>
        <button type="button" className="map-incident-panel__close" onClick={onClose} aria-label="Schließen">✕</button>
      </div>

      <p><strong>📍 {incident.address}</strong></p>

      {letzteMeldung && (letzterSprechwunsch ? (
        <div className="einsatz-meldungen">
          📻 <strong>{letzterSprechwunsch.von}</strong> hat Sprechwunsch (Status 5).{' '}
          <button type="button" className="btn btn--primary" onClick={() => onSprechaufforderung(letzterSprechwunsch.id)}>Sprechaufforderung</button>
        </div>
      ) : (
        <div className="einsatz-meldungen">
          <strong>{incident.neueMeldung && istWichtigeMeldung(letzteMeldung) ? '⚠ Neue Lagemeldung:' : 'Lagemeldung:'}</strong> {letzteMeldung.text}
        </div>
      ))}

      <p><strong>Status:</strong> {EINSATZ_STATUS_LABELS[incident.status]}</p>
      <p><strong>Organisation:</strong> {incident.organization}</p>
      <p><strong>Belohnung:</strong> {incident.reward} €</p>

      {kannAlarmieren && !ausreichendAlarmiert && (
        <div className="versorgung-hinweis versorgung-hinweis--fehlt">Es fehlen: {formatBedarfsListe(fehlendAlarmiert)}</div>
      )}

      {/* Vorschlag ist nur ein Hinweis – die Fahrzeuge wählt der Disponent selbst aus */}
      {kannAlarmieren && vorschlag.fahrzeugIds.length > 0 && (
        <div className="versorgung-hinweis versorgung-hinweis--unterwegs">
          💡 <strong>Vorschlag:</strong> {vorschlagNamen.join(', ')}
        </div>
      )}
      {kannAlarmieren && passende.length > 0 && (
        <>
          <ul className="fahrzeug-auswahl">
            {passende.map(({ vehicle, distanzKm, anfahrtSekunden, passend }) => (
              <li key={vehicle.id} style={passend ? undefined : { opacity: 0.75 }}>
                <label>
                  <input type="checkbox" checked={auswahl.includes(vehicle.id)} onChange={() => toggle(vehicle.id)} />
                  <span>
                    <strong>{vehicle.callsign ?? vehicle.name}</strong> – {vehicle.type}
                    <small>{distanzKm.toFixed(1)} km · ca. {Math.round(anfahrtSekunden)} Sek.{!passend && ' · zählt nicht zum Bedarf'}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn--primary map-incident-panel__open"
            disabled={auswahl.length === 0}
            onClick={() => {
              const namen = auswahl.map((id) => {
                const vehicle = vehicles.find((item) => item.id === id);
                return vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug';
              });
              onAlarmieren(auswahl);
              setAuswahl([]);
              setRueckmeldung(`✓ ${namen.join(', ')} alarmiert.`);
            }}
          >
            🚨 {incident.status === 'alarmiert' ? 'Nachalarmieren' : 'Alarmieren'}{auswahl.length > 0 ? ` (${auswahl.length})` : ''}
          </button>
        </>
      )}
      {kannAlarmieren && vorschlag.nichtVerfuegbar.length > 0 && (
        <p className="einsatz-eintrag__zeile">Kein freies Fahrzeug für: {formatBedarfsListe(vorschlag.nichtVerfuegbar)}</p>
      )}
      {rueckmeldung && <div className="aktion-rueckmeldung" role="status">{rueckmeldung}</div>}

      <h4>Fahrzeuge</h4>
      <ul>
        {abdeckung.map((eintrag, index) => (
          <li key={`${eintrag.category}-${index}`}>
            {getBedarfsLabel(eintrag.category)}: {eintrag.alarmiert}/{eintrag.amount} alarmiert, {eintrag.vorOrt} vor Ort {eintrag.vorOrt >= eintrag.amount ? '✓' : ''}
          </li>
        ))}
      </ul>

      {incident.patienten && incident.patienten.length > 0 && (
        <>
          <h4>Patienten</h4>
          <ul>
            {incident.patienten.map((patient, index) => (
              <li key={patient.id}>
                Patient {index + 1}: {PATIENTEN_STATUS_LABELS[patient.status]}
                {patient.transport ? ` → ${patient.transport.krankenhausName}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}

      <button type="button" className="btn btn--secondary map-incident-panel__open" onClick={onOpenInEinsaetze}>
        {kannAlarmieren ? 'Details & Fahrzeugauswahl' : 'In Einsätze öffnen'}
      </button>
    </aside>
  );
}
