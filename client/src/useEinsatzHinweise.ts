import { useEffect, useRef, useState } from 'react';
import { formatEinsatzTitel, type SpielEinsatz } from '@leitstellendispo/shared';

export interface EinsatzHinweis {
  id: string;
  einsatzId: string;
  art: 'neu' | 'meldung';
  titel: string;
  text: string;
}

const TON_KEY = 'leitstellendispo.ton';
const HINWEIS_DAUER_MS = 7000;
const MAX_HINWEISE = 3;

const leseTonEinstellung = () => {
  try {
    return localStorage.getItem(TON_KEY) !== 'aus';
  } catch {
    return true;
  }
};

/** Kurzer Alarmgong über die Web Audio API (keine Audiodatei nötig). */
const spieleGong = (dringend: boolean) => {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const toene = dringend ? [880, 660, 880] : [660, 880];
    toene.forEach((frequenz, index) => {
      const start = ctx.currentTime + index * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequenz;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
    setTimeout(() => ctx.close(), toene.length * 180 + 300);
  } catch {
    // Ton ist nur Komfort – Fehler (z. B. Autoplay-Sperre des Browsers) ignorieren
  }
};

/**
 * Erkennt neue Einsätze und neue Lagemeldungen, spielt (abschaltbar) einen Gong und liefert Einblendungen.
 * Erst ab `aktiv` (Spielstand geladen) – damit beim Laden nicht alle gespeicherten Einsätze gemeldet werden.
 */
export function useEinsatzHinweise(incidents: SpielEinsatz[], aktiv: boolean) {
  const [hinweise, setHinweise] = useState<EinsatzHinweis[]>([]);
  const [tonAn, setTonAnState] = useState(leseTonEinstellung);
  const bekannt = useRef<Map<string, number> | null>(null);

  const setTonAn = (an: boolean) => {
    setTonAnState(an);
    try {
      localStorage.setItem(TON_KEY, an ? 'an' : 'aus');
    } catch {
      // Einstellung gilt dann nur bis zum Neuladen
    }
  };

  useEffect(() => {
    if (!aktiv) return;

    // Erster Durchlauf nach dem Laden: aktuellen Stand nur merken
    if (!bekannt.current) {
      bekannt.current = new Map(incidents.map((incident) => [incident.id, incident.meldungen.length]));
      return;
    }

    const neue: EinsatzHinweis[] = [];
    for (const incident of incidents) {
      const bisherigeMeldungen = bekannt.current.get(incident.id);
      if (bisherigeMeldungen === undefined) {
        neue.push({ id: `${incident.id}-neu`, einsatzId: incident.id, art: 'neu', titel: 'Neuer Einsatz', text: formatEinsatzTitel(incident) });
      } else if (incident.meldungen.length > bisherigeMeldungen) {
        neue.push({
          id: `${incident.id}-m${incident.meldungen.length}`,
          einsatzId: incident.id,
          art: 'meldung',
          titel: `Neue Meldung – ${formatEinsatzTitel(incident)}`,
          text: incident.meldungen[incident.meldungen.length - 1].text,
        });
      }
    }
    bekannt.current = new Map(incidents.map((incident) => [incident.id, incident.meldungen.length]));

    if (neue.length === 0) return;
    if (tonAn) spieleGong(neue.some((hinweis) => hinweis.art === 'meldung'));
    setHinweise((current) => [...neue, ...current].slice(0, MAX_HINWEISE));
    const ids = neue.map((hinweis) => hinweis.id);
    setTimeout(() => setHinweise((current) => current.filter((hinweis) => !ids.includes(hinweis.id))), HINWEIS_DAUER_MS);
  }, [incidents, aktiv]);

  const schliesseHinweis = (id: string) => setHinweise((current) => current.filter((hinweis) => hinweis.id !== id));

  return { hinweise, schliesseHinweis, tonAn, setTonAn };
}
