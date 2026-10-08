import { useEffect, useState } from 'react';
import { wetterAusMessung, type Koordinaten, type Wetter } from '@leitstellendispo/shared';

const ABRUF_INTERVALL_MS = 30 * 60 * 1000;

/**
 * Echtes Wetter am Ort der ersten Wache (Open-Meteo, ohne Schlüssel), alle 30 Minuten.
 * Koordinaten werden auf ~10 km gerundet; bei Fehlern gilt ruhiges Wetter.
 */
export function useWetter(coords: Koordinaten | undefined): Wetter {
  const [wetter, setWetter] = useState<Wetter>('klar');
  const lat = coords ? coords[0].toFixed(1) : null;
  const lng = coords ? coords[1].toFixed(1) : null;

  useEffect(() => {
    if (lat === null || lng === null) return;
    let abgebrochen = false;
    const abrufen = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,temperature_2m,wind_gusts_10m`);
        if (!res.ok) return;
        const { current } = (await res.json()) as { current: { weather_code: number; temperature_2m: number; wind_gusts_10m: number } };
        if (!abgebrochen) setWetter(wetterAusMessung(current.weather_code, current.temperature_2m, current.wind_gusts_10m));
      } catch {
        // Kein Wetter verfügbar: Spiel läuft mit ruhigem Wetter weiter
      }
    };
    void abrufen();
    const interval = setInterval(abrufen, ABRUF_INTERVALL_MS);
    return () => {
      abgebrochen = true;
      clearInterval(interval);
    };
  }, [lat, lng]);

  return wetter;
}
