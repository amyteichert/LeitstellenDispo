import { formatBedarfsListe, getFehlendenBedarf, type SpielEinsatz } from '@leitstellendispo/shared';
import type { Vehicle } from '../types';

/**
 * Hinweis bei Einsätzen, für die dem Spieler Fahrzeuge fehlen, und Abgabe an die Nachbarleitstelle
 * (ohne Vergütung, ohne Ruf-Abzug). Nur solange der Einsatz noch nicht bearbeitet wird.
 */
export default function EinsatzAbgabe({
  incident,
  vehicles,
  onAbgeben,
}: {
  incident: SpielEinsatz;
  vehicles: Vehicle[];
  onAbgeben: () => void;
}) {
  if (incident.status !== 'offen' && incident.status !== 'alarmiert') return null;

  // Was fehlt dem Spieler grundsätzlich – egal ob die eigenen Fahrzeuge gerade frei sind?
  const fehlt = incident.fehlendeKraefte
    ? getFehlendenBedarf(incident.requiredVehicles, vehicles.filter((vehicle) => vehicle.stationId))
    : [];

  const abgeben = () => {
    if (!window.confirm('Einsatz an die Nachbarleitstelle abgeben?\n\nDu bekommst dafür keine Vergütung, verlierst aber auch keinen Ruf. Alarmierte Fahrzeuge rücken wieder ein.')) return;
    onAbgeben();
  };

  return (
    <>
      {fehlt.length > 0 && (
        <div className="versorgung-hinweis versorgung-hinweis--fehlt">
          ⚠ Dafür hast du noch keine passenden Fahrzeuge: <strong>{formatBedarfsListe(fehlt)}</strong>.
          Kauf sie an einer deiner Wachen – oder gib den Einsatz an die Nachbarleitstelle ab.
        </div>
      )}
      <button type="button" className="btn btn--secondary" onClick={abgeben}>
        ↪ An Nachbarleitstelle abgeben
      </button>
    </>
  );
}
