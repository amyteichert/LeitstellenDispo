/**
 * Zählt, wie oft beim Einsatz eine echte Adresse gefunden wurde bzw. die Adresssuche scheiterte,
 * und meldet das gesammelt an den Server (höchstens einmal pro Minute und beim Verlassen der Seite).
 * Nur Zahlen – keine Orte, keine Adressen. Geht das Melden schief, ist das egal: es ist nur eine Statistik.
 */
const SENDE_ABSTAND_MS = 60_000;

let echt = 0;
let fehlgeschlagen = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function senden(beimVerlassen = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (echt + fehlgeschlagen === 0) return;
  const body = JSON.stringify({ echt, fehlgeschlagen });
  echt = 0;
  fehlgeschlagen = 0;
  void fetch('/api/spielstand/adressen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: beimVerlassen,
  }).catch(() => {});
}

export function zaehleAdressSuche(erfolgreich: boolean) {
  if (erfolgreich) echt++;
  else fehlgeschlagen++;
  if (!timer) timer = setTimeout(() => senden(), SENDE_ABSTAND_MS);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => senden(true));
