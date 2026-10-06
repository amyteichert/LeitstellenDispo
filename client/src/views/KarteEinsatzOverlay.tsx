import {
  EINSATZ_STATUS_LABELS,
  PATIENTEN_STATUS_LABELS,
  formatBedarfsListe,
  formatEinsatzTitel,
  getBedarfsLabel,
  getEinsatzVersorgung,
  istEskaliert,
  istWichtigeMeldung,
  type SpielEinsatz,
} from '@leitstellendispo/shared';
import type { Vehicle } from '../types';

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
  vehicles,
  nowMs,
  onClose,
  onOpenInEinsaetze,
}: {
  incident: SpielEinsatz;
  vehicles: Vehicle[];
  nowMs: number;
  onClose: () => void;
  onOpenInEinsaetze: () => void;
}) {
  const { abdeckung, ausreichendAlarmiert, fehlendAlarmiert } = getEinsatzVersorgung(incident, vehicles, nowMs);
  const letzteMeldung = incident.meldungen[incident.meldungen.length - 1];
  const kannAlarmieren = incident.status === 'offen' || incident.status === 'alarmiert';

  return (
    <aside className="map-incident-panel">
      <div className="map-incident-panel__header">
        <h3>{formatEinsatzTitel(incident)}</h3>
        <button type="button" className="map-incident-panel__close" onClick={onClose} aria-label="Schließen">✕</button>
      </div>

      <p><strong>📍 {incident.address}</strong></p>

      {letzteMeldung && (
        <div className="einsatz-meldungen">
          <strong>{incident.neueMeldung && istWichtigeMeldung(letzteMeldung) ? '⚠ Neue Lagemeldung:' : 'Lagemeldung:'}</strong> {letzteMeldung.text}
        </div>
      )}

      <p><strong>Status:</strong> {EINSATZ_STATUS_LABELS[incident.status]}</p>
      <p><strong>Organisation:</strong> {incident.organization}</p>
      <p><strong>Belohnung:</strong> {incident.reward} €</p>

      {kannAlarmieren && !ausreichendAlarmiert && (
        <div className="versorgung-hinweis versorgung-hinweis--fehlt">Es fehlen: {formatBedarfsListe(fehlendAlarmiert)}</div>
      )}

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

      <button type="button" className="btn btn--primary map-incident-panel__open" onClick={onOpenInEinsaetze}>
        {kannAlarmieren ? 'Fahrzeuge alarmieren' : 'In Einsätze öffnen'}
      </button>
    </aside>
  );
}
