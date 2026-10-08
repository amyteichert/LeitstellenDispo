import { useId, useState, type FormEvent } from 'react';
import { KONTO_REGELN, pruefePasswort } from '@leitstellendispo/shared';
import { KontoFehler, passwortZuruecksetzen } from './konto';
import { RechtlicheLinks } from './Rechtliches';

export const PASSWORT_SEITE = '/passwort-zuruecksetzen';

/** Seite hinter dem Link aus der Mail (oder vom Team): neues Passwort festlegen – ohne Anmeldung erreichbar. */
export default function PasswortZuruecksetzen() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [passwort, setPasswort] = useState('');
  const [wiederholt, setWiederholt] = useState('');
  const [fehler, setFehler] = useState<string | null>(token ? null : 'Der Link ist unvollständig. Fordere bitte einen neuen an.');
  const [fertig, setFertig] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const id = useId();

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    const eingabeFehler = pruefePasswort(passwort) ?? (passwort !== wiederholt ? 'Die Passwörter stimmen nicht überein.' : null);
    if (eingabeFehler) return setFehler(eingabeFehler);
    setSendet(true);
    setFehler(null);
    try {
      setFertig(await passwortZuruecksetzen(token, passwort));
    } catch (error) {
      setFehler(error instanceof KontoFehler ? error.message : 'Unerwarteter Fehler. Bitte erneut versuchen.');
    } finally {
      setSendet(false);
    }
  };

  return (
    <div className="rechtliches">
      <article className="rechtliches__karte" style={{ maxWidth: 460 }}>
        <h1>Neues Passwort</h1>
        {fertig ? (
          <>
            <p role="status">✓ Das Passwort für <strong>{fertig}</strong> ist geändert. Alle bisherigen Anmeldungen wurden beendet.</p>
            <a className="btn btn--primary" href="/">Zur Anmeldung</a>
          </>
        ) : (
          <form onSubmit={absenden} noValidate style={{ display: 'grid', gap: 12 }}>
            <label htmlFor={`${id}-pw`}>Neues Passwort (mindestens {KONTO_REGELN.passwortMinLaenge} Zeichen)</label>
            <input id={`${id}-pw`} type="password" value={passwort} onChange={(e) => { setPasswort(e.target.value); setFehler(null); }} autoComplete="new-password" autoFocus disabled={!token} />
            <label htmlFor={`${id}-wdh`}>Passwort wiederholen</label>
            <input id={`${id}-wdh`} type="password" value={wiederholt} onChange={(e) => { setWiederholt(e.target.value); setFehler(null); }} autoComplete="new-password" disabled={!token} />
            {fehler && <p className="anmeldung__fehler" role="alert">{fehler}</p>}
            <button type="submit" className="btn btn--primary" disabled={sendet || !token}>{sendet ? 'Bitte warten …' : 'Passwort speichern'}</button>
            <a href="/">← Zur Anmeldung</a>
          </form>
        )}
        <RechtlicheLinks />
      </article>
    </div>
  );
}
