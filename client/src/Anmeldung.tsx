import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { APP_SUBTITLE, KONTO_REGELN, pruefeBenutzername, pruefePasswort, type Konto } from '@leitstellendispo/shared';
import { KontoFehler, SITZUNG_ABGELAUFEN, abmelden, anmelden, holeKonto, registrieren } from './konto';
import { serverSpeicher, uebernimmBrowserSpielstand } from './spielstand';
import './App.css';

type Zustand =
  | { art: 'pruefen' }
  | { art: 'abgemeldet'; hinweis?: string }
  | { art: 'fehler'; meldung: string }
  | { art: 'angemeldet'; konto: Konto };

/**
 * Zeigt das Spiel erst nach der Anmeldung. Prüft beim Start, ob noch eine Sitzung besteht,
 * und kehrt zur Anmeldeseite zurück, wenn die Sitzung abläuft.
 */
export default function Anmeldung({ children }: { children: (konto: Konto, onAbmelden: () => Promise<void>) => ReactNode }) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'pruefen' });

  const angemeldet = useCallback(async (konto: Konto) => {
    await uebernimmBrowserSpielstand();
    setZustand({ art: 'angemeldet', konto });
  }, []);

  const pruefeSitzung = useCallback(() => {
    setZustand({ art: 'pruefen' });
    holeKonto().then(
      (konto) => (konto ? angemeldet(konto) : setZustand({ art: 'abgemeldet' })),
      (error: unknown) => setZustand({ art: 'fehler', meldung: error instanceof Error ? error.message : String(error) }),
    );
  }, [angemeldet]);

  useEffect(pruefeSitzung, [pruefeSitzung]);

  useEffect(() => {
    const abgelaufen = () => setZustand({ art: 'abgemeldet', hinweis: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' });
    window.addEventListener(SITZUNG_ABGELAUFEN, abgelaufen);
    return () => window.removeEventListener(SITZUNG_ABGELAUFEN, abgelaufen);
  }, []);

  const onAbmelden = useCallback(async () => {
    await serverSpeicher.sofortSpeichern();
    await abmelden();
    setZustand({ art: 'abgemeldet' });
  }, []);

  if (zustand.art === 'angemeldet') return <>{children(zustand.konto, onAbmelden)}</>;

  return (
    <div className="app-shell anmeldung">
      <div className="anmeldung__karte">
        <img className="anmeldung__banner" src="/brand-banner.png" alt="LeitstellenDispo" />
        <p className="anmeldung__untertitel">{APP_SUBTITLE}</p>
        {zustand.art === 'pruefen' && <p className="anmeldung__info">Verbinde …</p>}
        {zustand.art === 'fehler' && (
          <>
            <p className="anmeldung__fehler" role="alert">{zustand.meldung}</p>
            <button type="button" className="btn btn--secondary" onClick={pruefeSitzung}>Erneut versuchen</button>
          </>
        )}
        {zustand.art === 'abgemeldet' && <AnmeldeFormular hinweis={zustand.hinweis} onErfolg={angemeldet} />}
      </div>
    </div>
  );
}

function AnmeldeFormular({ hinweis, onErfolg }: { hinweis?: string; onErfolg: (konto: Konto) => Promise<void> }) {
  const [modus, setModus] = useState<'anmelden' | 'registrieren'>('anmelden');
  const [name, setName] = useState('');
  const [passwort, setPasswort] = useState('');
  const [passwortWiederholt, setPasswortWiederholt] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const istRegistrierung = modus === 'registrieren';

  const wechsleModus = () => {
    setModus(istRegistrierung ? 'anmelden' : 'registrieren');
    setFehler(null);
    setPasswortWiederholt('');
  };

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    if (istRegistrierung) {
      // Dieselben Regeln wie auf dem Server – so gibt es die Rückmeldung sofort
      const eingabeFehler = pruefeBenutzername(name) ?? pruefePasswort(passwort)
        ?? (passwort !== passwortWiederholt ? 'Die Passwörter stimmen nicht überein.' : null);
      if (eingabeFehler) return setFehler(eingabeFehler);
    }
    setSendet(true);
    setFehler(null);
    try {
      const konto = await (istRegistrierung ? registrieren : anmelden)(name.trim(), passwort);
      await onErfolg(konto);
    } catch (error) {
      setFehler(error instanceof KontoFehler ? error.message : 'Unerwarteter Fehler. Bitte erneut versuchen.');
      setSendet(false);
    }
  };

  return (
    <form className="anmeldung__formular" onSubmit={absenden} noValidate>
      <h2>{istRegistrierung ? 'Konto erstellen' : 'Anmelden'}</h2>
      {hinweis && !fehler && <p className="anmeldung__info">{hinweis}</p>}

      <label className="field">
        <span>Benutzername</span>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setFehler(null); }}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={KONTO_REGELN.nameMaxLaenge}
          required
          autoFocus
        />
      </label>
      <label className="field">
        <span>Passwort</span>
        <input
          type="password"
          value={passwort}
          onChange={(e) => { setPasswort(e.target.value); setFehler(null); }}
          autoComplete={istRegistrierung ? 'new-password' : 'current-password'}
          required
        />
      </label>
      {istRegistrierung && (
        <label className="field">
          <span>Passwort wiederholen</span>
          <input
            type="password"
            value={passwortWiederholt}
            onChange={(e) => { setPasswortWiederholt(e.target.value); setFehler(null); }}
            autoComplete="new-password"
            required
          />
        </label>
      )}
      {istRegistrierung && (
        <small className="anmeldung__info">
          {KONTO_REGELN.nameMinLaenge}–{KONTO_REGELN.nameMaxLaenge} Zeichen für den Namen, mindestens {KONTO_REGELN.passwortMinLaenge} für das Passwort.
        </small>
      )}

      {fehler && <p className="anmeldung__fehler" role="alert">{fehler}</p>}

      <button type="submit" className="btn btn--primary anmeldung__absenden" disabled={sendet}>
        {sendet ? 'Bitte warten …' : istRegistrierung ? 'Konto erstellen' : 'Anmelden'}
      </button>
      <button type="button" className="btn btn--ghost anmeldung__wechsel" onClick={wechsleModus} disabled={sendet}>
        {istRegistrierung ? 'Schon ein Konto? Anmelden' : 'Noch kein Konto? Registrieren'}
      </button>
    </form>
  );
}
