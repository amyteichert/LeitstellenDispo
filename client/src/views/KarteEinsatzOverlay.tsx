import {
  EINSATZ_STATUS_LABELS,
  formatEinsatzTitel,
  getBedarfsAbdeckung,
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
      {incidents.map((incident) => (
        <button
          key={incident.id}
          type="button"
          className={`map-incident-chip map-incident-chip--${incident.status} ${selectedId === incident.id ? 'map-incident-chip--active' : ''}`}
          onClick={() => onSelect(incident)}
        >
          <span className="map-incident-chip__dot" />
          {incident.neueMeldung && '⚠ '}
          {formatEinsatzTitel(incident)}
        </button>
      ))}
    </div>
  );
}

/** Schwebendes Fenster rechts mit einer Kurzinfo zum gewählten Einsatz. */
export function KarteEinsatzPanel({
  incident,
  vehicles,
  onClose,
  onOpenInEinsaetze,
}: {
  incident: SpielEinsatz;
  vehicles: Vehicle[];
  onClose: () => void;
  onOpenInEinsaetze: () => void;
}) {
  const abdeckung = getBedarfsAbdeckung(incident, vehicles);

  return (
    <aside className="map-incident-panel">
      <div className="map-incident-panel__header">
        <h3>{formatEinsatzTitel(incident)}</h3>
        <button type="button" className="map-incident-panel__close" onClick={onClose} aria-label="Schließen">✕</button>
      </div>

      {incident.meldungen.length > 0 && (
        <div className="einsatz-meldungen">
          <strong>⚠ Neue Meldung:</strong> {incident.meldungen[incident.meldungen.length - 1].text}
        </div>
      )}

      <p><strong>Status:</strong> {EINSATZ_STATUS_LABELS[incident.status]}</p>
      <p><strong>Organisation:</strong> {incident.organization}</p>
      <p><strong>Adresse:</strong> {incident.address}</p>
      <p><strong>Belohnung:</strong> {incident.reward} €</p>

      <h4>Fahrzeuge</h4>
      <ul>
        {abdeckung.map((eintrag) => (
          <li key={eintrag.category}>
            {eintrag.category}: {Math.min(eintrag.alarmiert, eintrag.amount)}/{eintrag.amount} {eintrag.alarmiert >= eintrag.amount ? '✓' : ''}
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn--primary map-incident-panel__open" onClick={onOpenInEinsaetze}>
        In Einsätze öffnen
      </button>
    </aside>
  );
}
