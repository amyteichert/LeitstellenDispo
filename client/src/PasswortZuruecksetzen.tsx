import { useId, useState, type FormEvent } from 'react';
import { APP_VERSION, KONTO_REGELN, pruefePasswort } from '@leitstellendispo/shared';
import { KontoFehler, passwortZuruecksetzen } from './konto';
import { RechtlicheLinks } from './Rechtliches';

export const PASSWORT_SEITE = '/passwort-zuruecksetzen';

/** Seite hinter dem Link aus der Mail (oder vom Team): neues Passwort festlegen – ohne Anmeldung erreichbar. */
export default function PasswortZuruecksetzen() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [passwort, setPasswort] = useState('');
  const [wiederholt, setWiederholt] = useState('');
  const [sichtbar, setSichtbar] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const id = useId();

  const regeln = [
    { ok: pruefePasswort(passwort) === null, text: `Mindestens ${KONTO_REGELN.passwortMinLaenge} Zeichen` },
    { ok: passwort.length > 0 && passwort === wiederholt, text: 'Passwörter stimmen überein' },
  ];

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

  const passwortFeld = (feldId: string, label: string, wert: string, setzen: (wert: string) => void, autoFocus = false) => (
    <div className="anmeldung__feld">
      <label htmlFor={feldId}>{label}</label>
      <div className="anmeldung__eingabe">
        <span aria-hidden>🔒</span>
        <input
          id={feldId}
          type={sichtbar ? 'text' : 'password'}
          value={wert}
          onChange={(e) => { setzen(e.target.value); setFehler(null); }}
          autoComplete="new-password"
          autoFocus={autoFocus}
          required
        />
        {autoFocus && (
          <button
            type="button"
            className="anmeldung__auge"
            onClick={() => setSichtbar((s) => !s)}
            aria-label={sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
            title={sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
          >
            {sichtbar ? '🙈' : '👁️'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="anmeldung">
      <div className="anmeldung__hintergrund" aria-hidden>
        <div className="buehne__radar">
          <span className="buehne__sweep" />
        </div>
      </div>

      <header className="anmeldung__kopf">
        <div className="anmeldung__banner">
          <img src="/brand-banner.png" alt="LeitstellenDispo" />
        </div>
      </header>

      <div className="anmeldung__mitte anmeldung__mitte--einzeln">
        <main className="anmeldung__karte">
          {!token ? (
            <div className="anmeldung__formular">
              <h2>🔗 Link unvollständig</h2>
              <p className="anmeldung__info">
                Dieser Link funktioniert leider nicht. Fordere auf der Anmeldeseite über „Passwort vergessen?“ einfach einen neuen an.
              </p>
              <a className="btn btn--primary anmeldung__absenden" href="/">Zur Anmeldung →</a>
            </div>
          ) : fertig ? (
            <div className="anmeldung__formular">
              <h2>✅ Passwort geändert</h2>
              <p className="anmeldung__hinweis" role="status">
                Das Passwort für <strong>{fertig}</strong> ist jetzt neu. Aus Sicherheitsgründen wurden alle bisherigen Anmeldungen beendet.
              </p>
              <a className="btn btn--primary anmeldung__absenden" href="/">Zum Dienst anmelden →</a>
            </div>
          ) : (
            <form className="anmeldung__formular" onSubmit={absenden} noValidate>
              <h2>🔑 Neues Passwort</h2>
              <p className="anmeldung__info">Leg ein neues Passwort für dein Konto fest – danach meldest du dich ganz normal an.</p>
              {passwortFeld(`${id}-pw`, 'Neues Passwort', passwort, setPasswort, true)}
              {passwortFeld(`${id}-wdh`, 'Passwort wiederholen', wiederholt, setWiederholt)}
              <ul className="anmeldung__regeln">
                {regeln.map((regel) => (
                  <li key={regel.text} className={regel.ok ? 'ok' : undefined}>
                    <span aria-hidden>{regel.ok ? '✓' : '○'}</span>{regel.text}
                  </li>
                ))}
              </ul>
              {fehler && <p className="anmeldung__fehler" role="alert">{fehler}</p>}
              <button type="submit" className="btn btn--primary anmeldung__absenden" disabled={sendet}>
                {sendet ? <><span className="anmeldung__spinner" aria-hidden /> Bitte warten …</> : 'Passwort speichern →'}
              </button>
              <a className="anmeldung__link" href="/">← Zurück zur Anmeldung</a>
            </form>
          )}
        </main>
      </div>

      <footer className="anmeldung__fuss">
        LeitstellenDispo · V{APP_VERSION}
        <RechtlicheLinks />
      </footer>
    </div>
  );
}
