import { formatBedarfsListe, getFehlendenBedarf, type SpielEinsatz } from '@leitstellendispo/shared';
import type { Vehicle } from '../types';

/**
 * Hinweis bei Einsätzen, für die dem Spieler grundsätzlich Fahrzeuge fehlen (Einsatzdruck).
 * Solche Einsätze verschwinden von selbst ohne Folgen – alarmierte Fahrzeuge lassen sich rückalarmieren.
 */
export default function FehlendeKraefte({ incident, vehicles }: { incident: SpielEinsatz; vehicles: Vehicle[] }) {
  if (!incident.fehlendeKraefte || (incident.status !== 'offen' && incident.status !== 'alarmiert')) return null;

  // Was fehlt dem Spieler grundsätzlich – egal ob die eigenen Fahrzeuge gerade frei sind?
  const fehlt = getFehlendenBedarf(incident.requiredVehicles, vehicles.filter((vehicle) => vehicle.stationId));
  if (fehlt.length === 0) return null;

  return (
    <div className="versorgung-hinweis versorgung-hinweis--fehlt">
      ⚠ Dafür hast du noch keine passenden Fahrzeuge: <strong>{formatBedarfsListe(fehlt)}</strong>.
      Kauf sie an einer deiner Wachen – oder lass den Einsatz liegen, er verschwindet ohne Folgen von selbst.
    </div>
  );
}
