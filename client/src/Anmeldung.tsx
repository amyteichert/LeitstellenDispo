import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  ALLE_EINSATZ_VORLAGEN,
  APP_SUBTITLE,
  APP_VERSION,
  FAHRZEUG_TYPEN,
  KONTO_REGELN,
  LEHRGAENGE,
  formatBedarfsListe,
  pruefeBenutzername,
  pruefeEmail,
  pruefeNameGegenEmail,
  pruefePasswort,
  type Konto,
} from '@leitstellendispo/shared';
import { KontoFehler, SITZUNG_ABGELAUFEN, abmelden, anmelden, holeFunktionen, holeKonto, passwortVergessen, registrieren } from './konto';
import { serverSpeicher, uebernimmBrowserSpielstand } from './spielstand';
import { RechtlicheLinks } from './Rechtliches';
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
        <h1>Bereit für deine Schicht?</h1>
        <p>{APP_SUBTITLE}</p>
      </header>

      <div className="anmeldung__mitte">
        <Merkmale />

        <main className="anmeldung__karte">
          {zustand.art === 'pruefen' && (
            <p className="anmeldung__verbinde"><span className="anmeldung__spinner" aria-hidden /> Verbinde mit der Leitstelle …</p>
          )}
          {zustand.art === 'fehler' && (
            <div className="anmeldung__formular">
              <h2>Keine Verbindung</h2>
              <p className="anmeldung__fehler" role="alert">{zustand.meldung}</p>
              <button type="button" className="btn btn--primary anmeldung__absenden" onClick={pruefeSitzung}>Erneut versuchen</button>
            </div>
          )}
          {zustand.art === 'abgemeldet' && <AnmeldeFormular hinweis={zustand.hinweis} onErfolg={angemeldet} />}
        </main>

        <aside className="anmeldung__seite">
          <EinsatzTicker />
          <p className="anmeldung__fakten">
            {FAKTEN.map((fakt) => (
              <span key={fakt.text}><strong>{fakt.zahl}</strong> {fakt.text}</span>
            ))}
          </p>
        </aside>
      </div>

      <footer className="anmeldung__fuss">
        LeitstellenDispo · V{APP_VERSION} · Läuft im Browser – am PC, Tablet und Handy
        <RechtlicheLinks />
      </footer>
    </div>
  );
}

const MERKMALE = [
  { icon: '🚑', titel: 'Einsätze disponieren', text: 'Notrufe kommen rein – du schickst die richtigen Fahrzeuge los.' },
  { icon: '🚒', titel: 'Rettungsdienst & Feuerwehr', text: 'Von der Schnittverletzung bis zum Gebäudebrand.' },
  { icon: '🏥', titel: 'Wachen ausbauen', text: 'Neue Standorte, mehr Stellplätze, größere Flotte.' },
  { icon: '⭐', titel: 'Ruf aufbauen', text: 'Schnelle, richtige Entscheidungen bringen Ruf und Geld.' },
];

// Echte Zahlen aus dem Spiel – keine Fantasiewerte
const FAKTEN = [
  { zahl: ALLE_EINSATZ_VORLAGEN.length, text: 'Einsatzarten' },
  { zahl: FAHRZEUG_TYPEN.length, text: 'Fahrzeugtypen' },
  { zahl: LEHRGAENGE.length, text: 'Lehrgänge' },
];

function Merkmale() {
  return (
    <section className="anmeldung__seite" aria-label="Was dich erwartet">
      <h3>Was dich erwartet</h3>
      <ul className="anmeldung__merkmale">
        {MERKMALE.map((merkmal) => (
          <li key={merkmal.titel}>
            <span aria-hidden>{merkmal.icon}</span>
            <div><strong>{merkmal.titel}</strong><small>{merkmal.text}</small></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TickerEintrag {
  nr: number;
  vorlage: (typeof ALLE_EINSATZ_VORLAGEN)[number];
}

/** Zufällige Einsatzart, die gerade nicht im Ticker steht (keine Doppelten) */
function zufallsVorlage(sichtbar: TickerEintrag[]) {
  const frei = ALLE_EINSATZ_VORLAGEN.filter((vorlage) => !sichtbar.some((eintrag) => eintrag.vorlage.id === vorlage.id));
  return frei[Math.floor(Math.random() * frei.length)];
}

/** Werbe-Ticker: zeigt nacheinander echte Einsatzarten aus dem Spiel */
function EinsatzTicker() {
  const [eintraege, setEintraege] = useState<TickerEintrag[]>(() =>
    Array.from({ length: 3 }).reduce<TickerEintrag[]>((liste, _, nr) => [...liste, { nr, vorlage: zufallsVorlage(liste) }], []),
  );

  useEffect(() => {
    const intervall = setInterval(() => {
      setEintraege((aktuell) => [{ nr: Math.max(...aktuell.map((eintrag) => eintrag.nr)) + 1, vorlage: zufallsVorlage(aktuell) }, ...aktuell].slice(0, 4));
    }, 3500);
    return () => clearInterval(intervall);
  }, []);

  return (
    <section aria-label="Beispiel-Einsätze aus dem Spiel">
      <h3><span className="buehne__online" aria-hidden /> Diese Einsätze könnten dich erwarten</h3>
      <ul className="anmeldung__ticker">
        {eintraege.map(({ nr, vorlage }) => (
          <li key={nr} className={vorlage.organization === 'Feuerwehr' ? 'fw' : 'rd'}>
            <strong>{vorlage.stichwort} – {vorlage.meldebild}</strong>
            <small>
              Bedarf: {formatBedarfsListe(vorlage.requiredVehicles.map((bedarf) => ({ category: bedarf.category, anzahl: bedarf.amount })))}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnmeldeFormular({ hinweis, onErfolg }: { hinweis?: string; onErfolg: (konto: Konto) => Promise<void> }) {
  const [modus, setModus] = useState<'anmelden' | 'registrieren' | 'vergessen'>('anmelden');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [passwortWiederholt, setPasswortWiederholt] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const [passwortSichtbar, setPasswortSichtbar] = useState(false);
  const id = useId();
  const istRegistrierung = modus === 'registrieren';

  const wechsleModus = (neu: 'anmelden' | 'registrieren' = istRegistrierung ? 'anmelden' : 'registrieren') => {
    setModus(neu);
    setFehler(null);
    setPasswortWiederholt('');
  };

  if (modus === 'vergessen') return <PasswortVergessen email={email} setEmail={setEmail} onZurueck={() => wechsleModus('anmelden')} />;

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    if (istRegistrierung) {
      // Dieselben Regeln wie auf dem Server – so gibt es die Rückmeldung sofort
      const eingabeFehler = pruefeEmail(email) ?? pruefeBenutzername(name) ?? pruefeNameGegenEmail(name, email) ?? pruefePasswort(passwort)
        ?? (passwort !== passwortWiederholt ? 'Die Passwörter stimmen nicht überein.' : null);
      if (eingabeFehler) return setFehler(eingabeFehler);
    }
    setSendet(true);
    setFehler(null);
    try {
      const konto = istRegistrierung ? await registrieren(name.trim(), email.trim(), passwort) : await anmelden(name.trim(), passwort);
      await onErfolg(konto);
    } catch (error) {
      setFehler(error instanceof KontoFehler ? error.message : 'Unerwarteter Fehler. Bitte erneut versuchen.');
      setSendet(false);
    }
  };

  const regeln = [
    { ok: pruefeEmail(email) === null, text: 'Gültige E-Mail-Adresse (zum Zurücksetzen des Passworts)' },
    { ok: pruefeBenutzername(name) === null, text: `Name: ${KONTO_REGELN.nameMinLaenge}–${KONTO_REGELN.nameMaxLaenge} Zeichen, Buchstaben, Ziffern, _ . -` },
    { ok: pruefePasswort(passwort) === null, text: `Passwort: mindestens ${KONTO_REGELN.passwortMinLaenge} Zeichen` },
    { ok: passwort.length > 0 && passwort === passwortWiederholt, text: 'Passwörter stimmen überein' },
  ];

  return (
    <form className="anmeldung__formular" onSubmit={absenden} noValidate>
      <div className="anmeldung__reiter" role="tablist" aria-label="Anmelden oder registrieren">
        {(['anmelden', 'registrieren'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modus === m}
            className={modus === m ? 'aktiv' : undefined}
            onClick={() => modus !== m && wechsleModus(m)}
            disabled={sendet}
          >
            {m === 'anmelden' ? 'Anmelden' : 'Registrieren'}
          </button>
        ))}
      </div>

      <div>
        <h2>{istRegistrierung ? 'Neue Leitstelle eröffnen' : 'Willkommen zurück'}</h2>
        <p className="anmeldung__info">
          {istRegistrierung ? 'Erstelle dein Konto – dein Spielstand wird darin gespeichert.' : 'Melde dich an und übernimm deine Schicht.'}
        </p>
      </div>
      {hinweis && !fehler && <p className="anmeldung__hinweis">{hinweis}</p>}

      {istRegistrierung && (
        <div className="anmeldung__feld">
          <label htmlFor={`${id}-email`}>E-Mail-Adresse</label>
          <div className="anmeldung__eingabe">
            <span aria-hidden>✉️</span>
            <input
              id={`${id}-email`}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFehler(null); }}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={KONTO_REGELN.emailMaxLaenge}
              placeholder="name@beispiel.de"
              required
              autoFocus
            />
          </div>
        </div>
      )}
      <div className="anmeldung__feld">
        <label htmlFor={`${id}-name`}>Benutzername</label>
        <div className="anmeldung__eingabe">
          <span aria-hidden>👤</span>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => { setName(e.target.value); setFehler(null); }}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={KONTO_REGELN.nameMaxLaenge}
            placeholder="z. B. Disponent_112"
            required
            autoFocus={!istRegistrierung}
            aria-describedby={istRegistrierung ? `${id}-name-hinweis` : undefined}
          />
        </div>
        {istRegistrierung && (
          <small id={`${id}-name-hinweis`} className="anmeldung__feldhinweis">
            ⚠️ <strong>Dein Benutzername ist öffentlich sichtbar</strong> (z. B. in der Bestenliste). Bitte nicht deine
            E-Mail-Adresse oder deinen vollen Namen verwenden.
          </small>
        )}
      </div>
      <div className="anmeldung__feld">
        <label htmlFor={`${id}-passwort`}>Passwort</label>
        <div className="anmeldung__eingabe">
          <span aria-hidden>🔒</span>
          <input
            id={`${id}-passwort`}
            type={passwortSichtbar ? 'text' : 'password'}
            value={passwort}
            onChange={(e) => { setPasswort(e.target.value); setFehler(null); }}
            autoComplete={istRegistrierung ? 'new-password' : 'current-password'}
            required
          />
          <button
            type="button"
            className="anmeldung__auge"
            onClick={() => setPasswortSichtbar((sichtbar) => !sichtbar)}
            aria-label={passwortSichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
            title={passwortSichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
          >
            {passwortSichtbar ? '🙈' : '👁️'}
          </button>
        </div>
      </div>
      {istRegistrierung && (
        <div className="anmeldung__feld">
          <label htmlFor={`${id}-wiederholt`}>Passwort wiederholen</label>
          <div className="anmeldung__eingabe">
            <span aria-hidden>🔒</span>
            <input
              id={`${id}-wiederholt`}
              type={passwortSichtbar ? 'text' : 'password'}
              value={passwortWiederholt}
              onChange={(e) => { setPasswortWiederholt(e.target.value); setFehler(null); }}
              autoComplete="new-password"
              required
            />
          </div>
        </div>
      )}
      {istRegistrierung && (
        <ul className="anmeldung__regeln">
          {regeln.map((regel) => (
            <li key={regel.text} className={regel.ok ? 'ok' : undefined}>
              <span aria-hidden>{regel.ok ? '✓' : '○'}</span>{regel.text}
            </li>
          ))}
        </ul>
      )}

      {fehler && <p className="anmeldung__fehler" role="alert">{fehler}</p>}

      <button type="submit" className="btn btn--primary anmeldung__absenden" disabled={sendet}>
        {sendet ? <><span className="anmeldung__spinner" aria-hidden /> Bitte warten …</> : istRegistrierung ? 'Konto erstellen →' : 'Zum Dienst anmelden →'}
      </button>
      {!istRegistrierung && (
        <button type="button" className="anmeldung__link" onClick={() => setModus('vergessen')} disabled={sendet}>
          Passwort vergessen?
        </button>
      )}
    </form>
  );
}

/** „Passwort vergessen“: Link per E-Mail – solange der Server keinen Mailversand hat, nur ein Hinweis. */
function PasswortVergessen({ email, setEmail, onZurueck }: { email: string; setEmail: (e: string) => void; onZurueck: () => void }) {
  const [verfuegbar, setVerfuegbar] = useState<boolean | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erledigt, setErledigt] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const id = useId();

  useEffect(() => {
    void holeFunktionen().then((f) => setVerfuegbar(f.passwortVergessen));
  }, []);

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    const eingabeFehler = pruefeEmail(email);
    if (eingabeFehler) return setFehler(eingabeFehler);
    setSendet(true);
    setFehler(null);
    try {
      setErledigt(await passwortVergessen(email.trim()));
    } catch (error) {
      setFehler(error instanceof KontoFehler ? error.message : 'Unerwarteter Fehler. Bitte erneut versuchen.');
    } finally {
      setSendet(false);
    }
  };

  return (
    <form className="anmeldung__formular" onSubmit={absenden} noValidate>
      <div>
        <h2>Passwort vergessen?</h2>
        <p className="anmeldung__info">Gib die E-Mail-Adresse deines Kontos ein – du bekommst einen Link, mit dem du ein neues Passwort festlegst.</p>
      </div>

      {verfuegbar === false ? (
        <p className="anmeldung__hinweis">
          Das Zurücksetzen per E-Mail kommt bald. Bis dahin hilft dir das Team weiter – melde dich im Discord.
        </p>
      ) : erledigt ? (
        <p className="anmeldung__hinweis" role="status">✓ {erledigt} Schau auch im Spam-Ordner nach.</p>
      ) : (
        <>
          <div className="anmeldung__feld">
            <label htmlFor={`${id}-email`}>E-Mail-Adresse</label>
            <div className="anmeldung__eingabe">
              <span aria-hidden>✉️</span>
              <input
                id={`${id}-email`}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFehler(null); }}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
              />
            </div>
          </div>
          {fehler && <p className="anmeldung__fehler" role="alert">{fehler}</p>}
          <button type="submit" className="btn btn--primary anmeldung__absenden" disabled={sendet || verfuegbar === null}>
            {sendet ? <><span className="anmeldung__spinner" aria-hidden /> Bitte warten …</> : 'Link anfordern →'}
          </button>
        </>
      )}
      <button type="button" className="anmeldung__link" onClick={onZurueck}>← Zurück zur Anmeldung</button>
    </form>
  );
}
