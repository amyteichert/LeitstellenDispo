/**
 * Töne (Alarmgong, Funkpiep) und Vibration.
 *
 * Handy-Browser spielen Töne nur über einen AudioContext ab, der nach einer Berührung durch den Spieler
 * gestartet wurde. Deshalb gibt es einen gemeinsamen AudioContext, der bei der ersten Berührung/Taste
 * freigeschaltet wird – danach klappt der Gong auch, wenn ein Einsatz „von selbst“ reinkommt.
 */
import { getEinstellungen } from './einstellungen';

type AudioContextKlasse = typeof AudioContext;

let kontext: AudioContext | null = null;

const holeKontext = (): AudioContext | null => {
  if (kontext) return kontext;
  const Klasse: AudioContextKlasse | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextKlasse }).webkitAudioContext;
  if (!Klasse) return null;
  try {
    // iPhone: Töne auch bei eingeschaltetem Stummschalter abspielen (Safari 16.4+, sonst ohne Wirkung)
    const audioSession = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (audioSession) audioSession.type = 'playback';
    kontext = new Klasse();
  } catch {
    return null;
  }
  return kontext;
};

/** Schaltet den Ton frei – muss aus einer Berührung/einem Klick heraus aufgerufen werden. */
export function entsperreTon() {
  const ctx = holeKontext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  // Ein unhörbar kurzer, stiller Ton „weckt“ die Audioausgabe auf iOS
  try {
    const puffer = ctx.createBuffer(1, 1, 22050);
    const quelle = ctx.createBufferSource();
    quelle.buffer = puffer;
    quelle.connect(ctx.destination);
    quelle.start(0);
  } catch {
    // Nicht schlimm – resume() reicht in den meisten Browsern
  }
}

let entsperrenAktiv = false;
/** Einmal beim Start aufrufen: Die nächsten Berührungen/Tasten schalten den Ton frei. */
export function richteTonFreischaltungEin() {
  if (entsperrenAktiv || typeof window === 'undefined') return;
  entsperrenAktiv = true;
  const freischalten = () => {
    entsperreTon();
    if (kontext?.state === 'running') {
      window.removeEventListener('pointerdown', freischalten);
      window.removeEventListener('keydown', freischalten);
      window.removeEventListener('touchend', freischalten);
    }
  };
  window.addEventListener('pointerdown', freischalten);
  window.addEventListener('keydown', freischalten);
  window.addEventListener('touchend', freischalten);
}

/** Spielt Töne als Folge kurzer Pieps (keine Audiodatei nötig). */
const spieleToene = (frequenzen: number[], optionen: { abstand: number; dauer: number; form: OscillatorType; pegel: number }) => {
  const ctx = holeKontext();
  if (!ctx) return;
  const lautstaerke = getEinstellungen().lautstaerke;
  if (lautstaerke <= 0) return;
  const abspielen = () => {
    frequenzen.forEach((frequenz, index) => {
      const start = ctx.currentTime + index * optionen.abstand;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = optionen.form;
      osc.frequency.value = frequenz;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, optionen.pegel * lautstaerke), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + optionen.dauer);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + optionen.dauer + 0.01);
    });
  };
  try {
    if (ctx.state === 'suspended') void ctx.resume().then(abspielen).catch(() => undefined);
    else abspielen();
  } catch {
    // Ton ist nur Komfort
  }
};

/** Vibriert (nur wenn eingeschaltet und vom Gerät unterstützt – iPhones können das im Browser nicht). */
export function vibriere(muster: number | number[]) {
  if (!getEinstellungen().vibration) return;
  try {
    navigator.vibrate?.(muster);
  } catch {
    // Nicht unterstützt
  }
}

/** Alarmgong bei neuen Einsätzen; dringend (Lagemeldung) = drei Töne. */
export function spieleGong(dringend: boolean) {
  if (!getEinstellungen().ton) return;
  spieleToene(dringend ? [880, 660, 880] : [660, 880], { abstand: 0.18, dauer: 0.16, form: 'sine', pegel: 0.35 });
  vibriere(dringend ? [200, 100, 200, 100, 200] : [200, 100, 200]);
}

/** Kurzer, leiser Funk-Doppelpiep (Sprechwunsch) – dezenter als der Alarmgong. */
export function spieleFunkPiep() {
  if (!getEinstellungen().ton) return;
  spieleToene([1320, 1320], { abstand: 0.12, dauer: 0.07, form: 'square', pegel: 0.08 });
}

/** Für „Ton testen“ in den Einstellungen – aus einem Klick heraus, schaltet den Ton also gleich frei. */
export function testeTon() {
  entsperreTon();
  spieleToene([660, 880], { abstand: 0.18, dauer: 0.16, form: 'sine', pegel: 0.35 });
  vibriere([200, 100, 200]);
}
