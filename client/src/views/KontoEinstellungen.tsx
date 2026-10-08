import { useState, type FormEvent } from 'react';
import { KONTO_REGELN, pruefeEmail, pruefePasswort } from '@leitstellendispo/shared';
import { KontoFehler, aendereEmail, aenderePasswort } from '../konto';

type Meldung = { art: 'ok' | 'fehler'; text: string } | null;
const fehlerText = (e: unknown) => (e instanceof KontoFehler ? e.message : 'Unerwarteter Fehler. Bitte erneut versuchen.');

const Rueckmeldung = ({ meldung }: { meldung: Meldung }) => (meldung
  ? <p className={meldung.art === 'ok' ? 'aktion-rueckmeldung' : 'anmeldung__fehler'} role={meldung.art === 'ok' ? 'status' : 'alert'}>{meldung.text}</p>
  : null);

/** E-Mail nachtragen/ändern und Passwort ändern – beides nur mit dem aktuellen Passwort. */
export default function KontoEinstellungen({ email, onEmailGeaendert }: { email: string | null; onEmailGeaendert: (email: string) => void }) {
  return (
    <>
      <EmailAendern email={email} onEmailGeaendert={onEmailGeaendert} />
      <PasswortAendern />
    </>
  );
}

function EmailAendern({ email, onEmailGeaendert }: { email: string | null; onEmailGeaendert: (email: string) => void }) {
  const [offen, setOffen] = useState(!email);
  const [neu, setNeu] = useState(email ?? '');
  const [passwort, setPasswort] = useState('');
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [sendet, setSendet] = useState(false);

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    const fehler = pruefeEmail(neu) ?? (passwort ? null : 'Bitte dein aktuelles Passwort angeben.');
    if (fehler) return setMeldung({ art: 'fehler', text: fehler });
    setSendet(true);
    try {
      const konto = await aendereEmail(neu.trim(), passwort);
      onEmailGeaendert(konto.email ?? neu.trim());
      setMeldung({ art: 'ok', text: '✓ E-Mail-Adresse gespeichert.' });
      setPasswort('');
      setOffen(false);
    } catch (error) {
      setMeldung({ art: 'fehler', text: fehlerText(error) });
    } finally {
      setSendet(false);
    }
  };

  return (
    <div className="einstellungen-block">
      <h3>E-Mail-Adresse</h3>
      {!email && (
        <p className="versorgung-hinweis versorgung-hinweis--fehlt">
          Für dein Konto ist noch keine E-Mail-Adresse hinterlegt. Ohne sie kannst du ein vergessenes Passwort nicht selbst zurücksetzen.
        </p>
      )}
      {email && !offen && (
        <p>
          {email}{' '}
          <button type="button" className="btn" onClick={() => { setOffen(true); setMeldung(null); }}>Ändern</button>
        </p>
      )}
      {offen && (
        <form onSubmit={absenden} noValidate className="einstellungen-formular">
          <label className="field">
            <span>E-Mail-Adresse</span>
            <input type="email" value={neu} maxLength={KONTO_REGELN.emailMaxLaenge} onChange={(e) => { setNeu(e.target.value); setMeldung(null); }} autoComplete="email" />
          </label>
          <label className="field">
            <span>Aktuelles Passwort</span>
            <input type="password" value={passwort} onChange={(e) => { setPasswort(e.target.value); setMeldung(null); }} autoComplete="current-password" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn--primary" disabled={sendet}>{sendet ? 'Speichere …' : 'Speichern'}</button>
            {email && <button type="button" className="btn" onClick={() => setOffen(false)}>Abbrechen</button>}
          </div>
        </form>
      )}
      <Rueckmeldung meldung={meldung} />
    </div>
  );
}

function PasswortAendern() {
  const [offen, setOffen] = useState(false);
  const [alt, setAlt] = useState('');
  const [neu, setNeu] = useState('');
  const [wiederholt, setWiederholt] = useState('');
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [sendet, setSendet] = useState(false);

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    const fehler = (alt ? null : 'Bitte dein aktuelles Passwort angeben.') ?? pruefePasswort(neu)
      ?? (neu !== wiederholt ? 'Die neuen Passwörter stimmen nicht überein.' : null);
    if (fehler) return setMeldung({ art: 'fehler', text: fehler });
    setSendet(true);
    try {
      await aenderePasswort(alt, neu);
      setMeldung({ art: 'ok', text: '✓ Passwort geändert. Auf anderen Geräten musst du dich neu anmelden.' });
      setAlt(''); setNeu(''); setWiederholt('');
      setOffen(false);
    } catch (error) {
      setMeldung({ art: 'fehler', text: fehlerText(error) });
    } finally {
      setSendet(false);
    }
  };

  return (
    <div className="einstellungen-block">
      <h3>Passwort</h3>
      {!offen ? (
        <button type="button" className="btn" onClick={() => { setOffen(true); setMeldung(null); }}>Passwort ändern</button>
      ) : (
        <form onSubmit={absenden} noValidate className="einstellungen-formular">
          <label className="field">
            <span>Aktuelles Passwort</span>
            <input type="password" value={alt} onChange={(e) => { setAlt(e.target.value); setMeldung(null); }} autoComplete="current-password" />
          </label>
          <label className="field">
            <span>Neues Passwort (mindestens {KONTO_REGELN.passwortMinLaenge} Zeichen)</span>
            <input type="password" value={neu} onChange={(e) => { setNeu(e.target.value); setMeldung(null); }} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>Neues Passwort wiederholen</span>
            <input type="password" value={wiederholt} onChange={(e) => { setWiederholt(e.target.value); setMeldung(null); }} autoComplete="new-password" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn--primary" disabled={sendet}>{sendet ? 'Speichere …' : 'Passwort speichern'}</button>
            <button type="button" className="btn" onClick={() => setOffen(false)}>Abbrechen</button>
          </div>
        </form>
      )}
      <Rueckmeldung meldung={meldung} />
    </div>
  );
}
