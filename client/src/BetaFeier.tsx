import { useEffect, useRef, useState } from 'react';
import { ALPHA_ENDE, APP_VERSION, istGruendungsSpieler, type Konto } from '@leitstellendispo/shared';

const GESEHEN_KEY = 'leitstellendispo.beta-feier-gesehen';
/** So lange nach dem Beta-Start wird gefeiert – danach erscheint das Fenster nicht mehr */
const FEIER_DAUER_MS = 7 * 24 * 60 * 60 * 1000;

const wirdGefeiert = (jetzt = Date.now()) => {
  if (!ALPHA_ENDE) return false;
  const start = Date.parse(ALPHA_ENDE);
  return jetzt >= start && jetzt < start + FEIER_DAUER_MS;
};

const schonGesehen = () => {
  try {
    return localStorage.getItem(GESEHEN_KEY) === APP_VERSION;
  } catch {
    return false;
  }
};

interface Funke {
  x: number;
  y: number;
  vx: number;
  vy: number;
  leben: number;
  farbe: string;
}

interface Rakete {
  x: number;
  y: number;
  vy: number;
  zielY: number;
  farbe: string;
}

const FARBEN = ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#22d3ee', '#3b82f6', '#a855f7', '#f472b6', '#ffffff'];
const zufall = (min: number, max: number) => min + Math.random() * (max - min);
const zufallsFarbe = () => FARBEN[Math.floor(Math.random() * FARBEN.length)];

/** Feuerwerk auf einem Canvas: Raketen steigen auf und zerplatzen in bunte Funken */
function Feuerwerk() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let breite = 0;
    let hoehe = 0;
    const groesseAnpassen = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      breite = window.innerWidth;
      hoehe = window.innerHeight;
      canvas.width = breite * dpr;
      canvas.height = hoehe * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    groesseAnpassen();
    window.addEventListener('resize', groesseAnpassen);

    const raketen: Rakete[] = [];
    const funken: Funke[] = [];
    let naechsteRakete = 0;
    let letzteZeit = performance.now();
    let frame = 0;

    const zerplatzen = (x: number, y: number, farbe: string) => {
      const anzahl = Math.round(zufall(50, 90));
      for (let i = 0; i < anzahl; i++) {
        const winkel = (Math.PI * 2 * i) / anzahl;
        const tempo = zufall(1.5, 5.5);
        funken.push({
          x, y,
          vx: Math.cos(winkel) * tempo,
          vy: Math.sin(winkel) * tempo,
          leben: zufall(0.8, 1.4),
          farbe: Math.random() < 0.25 ? zufallsFarbe() : farbe,
        });
      }
    };

    const schritt = (zeit: number) => {
      const dt = Math.min((zeit - letzteZeit) / 16.67, 3); // in „Frames“ bei 60 fps
      letzteZeit = zeit;

      if (zeit >= naechsteRakete) {
        raketen.push({ x: zufall(breite * 0.1, breite * 0.9), y: hoehe, vy: zufall(-13, -9), zielY: zufall(hoehe * 0.12, hoehe * 0.45), farbe: zufallsFarbe() });
        naechsteRakete = zeit + zufall(250, 700);
      }

      // Leichte Spur: alte Pixel verblassen statt hart gelöscht zu werden
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, breite, hoehe);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = raketen.length - 1; i >= 0; i--) {
        const r = raketen[i];
        r.y += r.vy * dt;
        r.vy += 0.12 * dt;
        ctx.fillStyle = r.farbe;
        ctx.fillRect(r.x - 1.5, r.y, 3, 8);
        if (r.y <= r.zielY || r.vy >= 0) {
          zerplatzen(r.x, r.y, r.farbe);
          raketen.splice(i, 1);
        }
      }

      for (let i = funken.length - 1; i >= 0; i--) {
        const f = funken[i];
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vx *= 0.985;
        f.vy = f.vy * 0.985 + 0.06 * dt;
        f.leben -= 0.012 * dt;
        if (f.leben <= 0) {
          funken.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(f.leben, 1);
        ctx.fillStyle = f.farbe;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      frame = requestAnimationFrame(schritt);
    };
    frame = requestAnimationFrame(schritt);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', groesseAnpassen);
    };
  }, []);

  return <canvas ref={canvasRef} className="beta-feier__feuerwerk" aria-hidden />;
}

/** Großes Fenster mit Feuerwerk zum Beta-Start – einmal pro Gerät, nur in der ersten Woche nach dem Start. */
export default function BetaFeier({ konto, gast }: { konto: Konto; gast: boolean }) {
  const [offen, setOffen] = useState(() => wirdGefeiert() && !schonGesehen());
  const [ruhig] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') schliessen(); };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  });

  if (!offen) return null;

  function schliessen() {
    try {
      localStorage.setItem(GESEHEN_KEY, APP_VERSION);
    } catch {
      // Dann erscheint es beim nächsten Laden noch einmal
    }
    setOffen(false);
  }

  const gruender = !gast && istGruendungsSpieler(konto);

  return (
    <div className="beta-feier" role="dialog" aria-modal="true" aria-labelledby="beta-feier-titel">
      {!ruhig && <Feuerwerk />}
      <div className="beta-feier__karte">
        <div className="beta-feier__eyebrow">🎉 Version {APP_VERSION}</div>
        <h2 id="beta-feier-titel">Die Beta ist da!</h2>
        <p>
          Die Alpha ist abgeschlossen – ab jetzt läuft LeitstellenDispo als Beta.
          Danke an alle, die bis hierhin mitgespielt, getestet und Fehler gemeldet haben!
        </p>
        {gruender && (
          <p className="beta-feier__gruender">
            🎖️ Du warst schon in der Alpha dabei – das <strong>Gründungs-Abzeichen</strong> gehört dir. Für immer.
          </p>
        )}
        <p className="beta-feier__klein">Fehler gefunden? Meldet sie im Menü unter „Fehler melden“ oder per /bug auf Discord.</p>
        <button type="button" className="btn btn--primary beta-feier__los" onClick={schliessen} autoFocus>
          Los geht's! 🚒
        </button>
      </div>
    </div>
  );
}
