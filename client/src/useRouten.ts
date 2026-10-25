import { useEffect } from 'react';
import {
  haversineKm,
  merkeRoutenVor,
  nimmFehlendeRouten,
  speichereRoute,
  type Krankenhaus,
  type MapLocation,
  type Route,
  type RoutenAnfrage,
  type SpielEinsatz,
} from '@leitstellendispo/shared';

/** Wachen weiter weg als das fahren ohnehin nicht hin – keine Route vorab holen */
const MAX_VORAB_KM = 60;
/** Zu so vielen der nächsten Krankenhäuser wird die Transportroute vorab geholt */
const KRANKENHAEUSER_VORAB = 3;
const INTERVALL_MS = 1500;
/** Nach einem Fehler (kein Routing-Server) so lange Pause */
const PAUSE_NACH_FEHLER_MS = 5 * 60_000;

/**
 * Hält den Routen-Speicher gefüllt: merkt für offene Einsätze die Fahrten Wache → Einsatz, Einsatz → Wache und
 * Einsatz → Krankenhaus vor und lädt alles Fehlende vom Server nach. Ohne Routing-Server bleibt es bei der Luftlinie.
 */
export function useRouten(locations: MapLocation[], incidents: SpielEinsatz[], krankenhaeuser: Krankenhaus[]) {
  useEffect(() => {
    const wachen = locations.filter((location) => location.type === 'station');
    const aufnahme = krankenhaeuser.filter((kh) => kh.aufnahme);
    const anfragen: RoutenAnfrage[] = [];
    for (const einsatz of incidents) {
      if (einsatz.status === 'abgeschlossen') continue;
      for (const wache of wachen) {
        if (haversineKm(wache.coords, einsatz.coords) > MAX_VORAB_KM) continue;
        anfragen.push({ von: wache.coords, nach: einsatz.coords }, { von: einsatz.coords, nach: wache.coords });
      }
      const naechste = [...aufnahme]
        .sort((a, b) => haversineKm(a.coords, einsatz.coords) - haversineKm(b.coords, einsatz.coords))
        .slice(0, KRANKENHAEUSER_VORAB);
      for (const kh of naechste) anfragen.push({ von: einsatz.coords, nach: kh.coords });
    }
    merkeRoutenVor(anfragen);
  }, [locations, incidents, krankenhaeuser]);

  useEffect(() => {
    let pauseBis = 0;
    let laeuft = false;
    const lade = async () => {
      if (laeuft || Date.now() < pauseBis) return;
      const anfragen = nimmFehlendeRouten();
      if (anfragen.length === 0) return;
      laeuft = true;
      try {
        const res = await fetch('/api/routen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anfragen }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const { routen } = (await res.json()) as { routen: (Route | null)[] };
        anfragen.forEach((anfrage, i) => speichereRoute(anfrage, routen[i] ?? null));
      } catch {
        // Kein Routing-Server: später noch mal versuchen, bis dahin Luftlinie
        merkeRoutenVor(anfragen);
        pauseBis = Date.now() + PAUSE_NACH_FEHLER_MS;
      } finally {
        laeuft = false;
      }
    };
    const id = window.setInterval(lade, INTERVALL_MS);
    return () => window.clearInterval(id);
  }, []);
}
