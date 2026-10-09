import { useEffect, useRef, useState } from 'react';
import { formatEinsatzTitel, istWichtigeMeldung, type SpielEinsatz } from '@leitstellendispo/shared';
import { getEinstellungen } from './einstellungen';
import { spieleGong } from './ton';

export interface EinsatzHinweis {
  id: string;
  einsatzId: string;
  art: 'neu' | 'meldung';
  titel: string;
  text: string;
}

const MAX_HINWEISE = 3;

/** Nur wichtige Meldungen (Eskalation, Nachforderung) lösen Hinweis und Gong aus – nicht jede Statusmeldung. */
const wichtigeMeldungen = (incident: SpielEinsatz) => incident.meldungen.filter(istWichtigeMeldung);

/**
 * Erkennt neue Einsätze und neue Lagemeldungen, spielt (abschaltbar) einen Gong und liefert Einblendungen.
 * Was eingeblendet wird und wie lange, steht in den Geräte-Einstellungen.
 * Erst ab `aktiv` (Spielstand geladen) – damit beim Laden nicht alle gespeicherten Einsätze gemeldet werden.
 */
export function useEinsatzHinweise(incidents: SpielEinsatz[], aktiv: boolean) {
  const [hinweise, setHinweise] = useState<EinsatzHinweis[]>([]);
  const bekannt = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    if (!aktiv) return;

    // Erster Durchlauf nach dem Laden: aktuellen Stand nur merken
    if (!bekannt.current) {
      bekannt.current = new Map(incidents.map((incident) => [incident.id, wichtigeMeldungen(incident).length]));
      return;
    }

    const neue: EinsatzHinweis[] = [];
    for (const incident of incidents) {
      const meldungen = wichtigeMeldungen(incident);
      const bisherigeMeldungen = bekannt.current.get(incident.id);
      if (bisherigeMeldungen === undefined) {
        neue.push({ id: `${incident.id}-neu`, einsatzId: incident.id, art: 'neu', titel: 'Neuer Einsatz', text: formatEinsatzTitel(incident) });
      } else if (meldungen.length > bisherigeMeldungen) {
        // Meldungen von Fahrzeugen vor Ort kommen als Sprechwunsch – Inhalt erst nach der Sprechaufforderung
        const sprechwunsch = incident.alarmedVehicles.some((a) => a.arrivalAt <= Date.now());
        neue.push({
          id: `${incident.id}-m${meldungen.length}`,
          einsatzId: incident.id,
          art: 'meldung',
          titel: sprechwunsch ? `📻 Sprechwunsch – ${formatEinsatzTitel(incident)}` : `Neue Meldung – ${formatEinsatzTitel(incident)}`,
          text: sprechwunsch ? 'Ein Fahrzeug an der Einsatzstelle möchte dich sprechen (Status 5).' : meldungen[meldungen.length - 1].text,
        });
      }
    }
    bekannt.current = new Map(incidents.map((incident) => [incident.id, wichtigeMeldungen(incident).length]));

    if (neue.length === 0) return;
    spieleGong(neue.some((hinweis) => hinweis.art === 'meldung'));
    const { hinweise: modus, hinweisDauerSekunden } = getEinstellungen();
    const anzeigen = modus === 'aus' ? [] : modus === 'wichtig' ? neue.filter((hinweis) => hinweis.art === 'meldung') : neue;
    if (anzeigen.length === 0) return;
    setHinweise((current) => [...anzeigen, ...current].slice(0, MAX_HINWEISE));
    const ids = anzeigen.map((hinweis) => hinweis.id);
    setTimeout(() => setHinweise((current) => current.filter((hinweis) => !ids.includes(hinweis.id))), hinweisDauerSekunden * 1000);
  }, [incidents, aktiv]);

  const schliesseHinweis = (id: string) => setHinweise((current) => current.filter((hinweis) => hinweis.id !== id));

  return { hinweise, schliesseHinweis };
}
