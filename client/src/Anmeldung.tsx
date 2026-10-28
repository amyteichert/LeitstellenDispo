import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
  anzeigeName,
  getBegruessung,
  getRufLabel,
  istGruendungsSpieler,
  RUF_CONFIG,
  ROLLEN_LABELS,
  type Konto,
  type Spielstand,
} from '@leitstellendispo/shared';
import ProfilBild from './ProfilBild';
import { KontoFehler, SITZUNG_ABGELAUFEN, abmelden, anmelden, holeFunktionen, holeKonto, passwortVergessen, registrieren } from './konto';
import { serverSpeicher, setzeGastmodus, uebernimmBrowserSpielstand } from './spielstand';
import { RechtlicheLinks } from './Rechtliches';
import { Marke, Piktogramm, type SymbolName } from './Symbole';
import { merkeBesuchsZiel } from './besuchsMessung';
import './App.css';

type Zustand =
  | { art: 'pruefen' }
  | { art: 'abgemeldet'; hinweis?: string }
  | { art: 'fehler'; meldung: string }
  /** Noch angemeldet (Sitzung gilt): Begrüßung mit „Los geht’s“ statt direkt ins Spiel */
  | { art: 'startklar'; konto: Konto }
  | { art: 'angemeldet'; konto: Konto; gast: boolean };

/** sessionStorage gilt nur für diesen Tab und übersteht das Neuladen – ein neuer Tab startet ohne */
const TAB_GESTARTET_KEY = 'leitstellendispo.tab-gestartet';

const istTabGestartet = () => {
  try {
    return sessionStorage.getItem(TAB_GESTARTET_KEY) === '1';
  } catch {
    return false;
  }
};

const merkeTabGestartet = (gestartet: boolean) => {
  try {
    if (gestartet) sessionStorage.setItem(TAB_GESTARTET_KEY, '1');
    else sessionStorage.removeItem(TAB_GESTARTET_KEY);
  } catch {
    // Dann kommt der Startbildschirm eben auch beim Neuladen
  }
};

/** Platzhalter-Konto für den Gastmodus – existiert nicht auf dem Server */
const gastKonto = (): Konto => ({ id: 0, name: 'Gast', rolle: 'player', erstellt: new Date().toISOString() });

/**
 * Zeigt das Spiel erst nach der Anmeldung. Prüft beim Start, ob noch eine Sitzung besteht,
 * und kehrt zur Anmeldeseite zurück, wenn die Sitzung abläuft.
 */
export default function Anmeldung({ children }: {
  children: (konto: Konto, onAbmelden: () => Promise<void>, gast: boolean, setKonto: (konto: Konto) => void) => ReactNode;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'pruefen' });
  const istGast = useRef(false);

  const angemeldet = useCallback(async (konto: Konto) => {
    istGast.current = false;
    setzeGastmodus(false);
    merkeTabGestartet(true);
    await uebernimmBrowserSpielstand();
    setZustand({ art: 'angemeldet', konto, gast: false });
  }, []);

  /** Ohne Konto spielen: nichts wird gespeichert, nach Neuladen ist alles weg */
  const alsGast = useCallback(() => {
    istGast.current = true;
    setzeGastmodus(true);
    setZustand({ art: 'angemeldet', konto: gastKonto(), gast: true });
  }, []);

  const pruefeSitzung = useCallback(() => {
    setZustand({ art: 'pruefen' });
    holeKonto().then(
      (konto) => {
        if (!konto) return setZustand({ art: 'abgemeldet' });
        // Neu geladen im selben Tab: direkt weiter – der Startbildschirm kommt nur in einem neuen Tab
        if (istTabGestartet()) return void angemeldet(konto);
        setZustand({ art: 'startklar', konto });
      },
      (error: unknown) => setZustand({ art: 'fehler', meldung: error instanceof Error ? error.message : String(error) }),
    );
  }, [angemeldet]);

  useEffect(pruefeSitzung, [pruefeSitzung]);

  /** Profil geändert (Spitzname, Bild, Name) – das Spiel läuft weiter */
  const setKonto = useCallback((konto: Konto) => {
    setZustand((alt) => (alt.art === 'angemeldet' ? { ...alt, konto } : alt));
  }, []);

  /** „Nicht du?“ auf dem Startbildschirm: abmelden und das Anmeldeformular zeigen */
  const wechsleKonto = useCallback(async () => {
    await abmelden();
    setZustand({ art: 'abgemeldet' });
  }, []);

  useEffect(() => {
    const abgelaufen = () => !istGast.current && setZustand({ art: 'abgemeldet', hinweis: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' });
    window.addEventListener(SITZUNG_ABGELAUFEN, abgelaufen);
    return () => window.removeEventListener(SITZUNG_ABGELAUFEN, abgelaufen);
  }, []);

  const onAbmelden = useCallback(async () => {
    if (istGast.current) {
      // Gast: zurück zur Anmeldung, das Gast-Spiel verfällt
      istGast.current = false;
      setzeGastmodus(false);
      return setZustand({ art: 'abgemeldet' });
    }
    await serverSpeicher.sofortSpeichern();
    await abmelden();
    setZustand({ art: 'abgemeldet' });
  }, []);

  if (zustand.art === 'angemeldet') return <>{children(zustand.konto, onAbmelden, zustand.gast, setKonto)}</>;

  return (
    <div className="anmeldung">
      <div className="anmeldung__leiste">
        <Marke untertitel="Leitstellen-Simulation im Browser" />
      </div>

      <header className="anmeldung__kopf">
        <h1>Bereit für deine Schicht?</h1>
        <p>{APP_SUBTITLE}</p>
      </header>

      <div className="anmeldung__mitte">
        {zustand.art === 'startklar' ? <LeitstellenStand /> : <Merkmale />}

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
          {zustand.art === 'startklar' && <StartBildschirm konto={zustand.konto} onStart={angemeldet} onAndererNutzer={wechsleKonto} />}
          {zustand.art === 'abgemeldet' && <AnmeldeFormular hinweis={zustand.hinweis} onErfolg={angemeldet} onGast={alsGast} />}
        </main>

        {zustand.art === 'startklar' ? (
          <SchichtInfo konto={zustand.konto} />
        ) : (
          <aside className="anmeldung__seite">
            <EinsatzTicker />
            <p className="anmeldung__fakten">
              {FAKTEN.map((fakt) => (
                <span key={fakt.text}><strong>{fakt.zahl}</strong> {fakt.text}</span>
              ))}
            </p>
          </aside>
        )}
      </div>

      <footer className="anmeldung__fuss">
        LeitstellenDispo · V{APP_VERSION} · Läuft im Browser – am PC, Tablet und Handy
        <RechtlicheLinks />
      </footer>
    </div>
  );
}

const MERKMALE: Array<{ icon: SymbolName; titel: string; text: string }> = [
  { icon: 'einsatz', titel: 'Einsätze disponieren', text: 'Notrufe kommen rein – du schickst die richtigen Fahrzeuge los.' },
  { icon: 'karte', titel: 'Rettungsdienst & Feuerwehr', text: 'Von der Schnittverletzung bis zum Gebäudebrand – auf echten Karten.' },
  { icon: 'wache', titel: 'Wachen ausbauen', text: 'Neue Standorte, mehr Stellplätze, Personal und Ausbildung.' },
  { icon: 'geld', titel: 'Haushalten', text: 'Einsätze bringen Geld ein – Gehälter und Unterhalt wollen bezahlt werden.' },
];

// Echte Zahlen aus dem Spiel – keine Fantasiewerte
const FAKTEN = [
  { zahl: ALLE_EINSATZ_VORLAGEN.length, text: 'Einsatzarten' },
  { zahl: FAHRZEUG_TYPEN.length, text: 'Fahrzeugtypen' },
  { zahl: LEHRGAENGE.length, text: 'Lehrgänge' },
];

/** Startbildschirm links: Stand der eigenen Leitstelle (aus dem gespeicherten Spielstand) */
function LeitstellenStand() {
  const [stand, setStand] = useState<Spielstand | null | undefined>(undefined);

  useEffect(() => {
    let aktiv = true;
    serverSpeicher.laden().then((s) => aktiv && setStand(s), () => aktiv && setStand(null));
    return () => {
      aktiv = false;
    };
  }, []);

  const eintraege: Array<{ icon: SymbolName; titel: string; text: string }> = stand
    ? [
        { icon: 'geld', titel: `${stand.balance.toLocaleString('de-DE')} €`, text: 'Guthaben' },
        { icon: 'stern', titel: `Ruf ${stand.ruf ?? RUF_CONFIG.start}`, text: getRufLabel(stand.ruf ?? RUF_CONFIG.start) },
        {
          icon: 'wache',
          titel: `${stand.locations.filter((l) => l.type === 'station').length} Wachen · ${stand.vehicles.length} Fahrzeuge`,
          text: `${(stand.personal ?? []).length} Leute im Dienst`,
        },
        {
          icon: 'einsatz',
          titel: stand.incidents.length === 1 ? '1 laufender Einsatz' : `${stand.incidents.length} laufende Einsätze`,
          text: `Zuletzt gespielt ${zuletzt(stand.gespeichertAm)}`,
        },
      ]
    : [];

  return (
    <section className="anmeldung__seite" aria-label="Deine Leitstelle">
      <h3>Deine Leitstelle</h3>
      {stand === undefined && <p className="anmeldung__verbinde"><span className="anmeldung__spinner" aria-hidden /> Lade Spielstand …</p>}
      {stand === null && <p className="anmeldung__info">Noch kein Spielstand – nach dem Start baust du deine erste Wache.</p>}
      {stand && (
        <ul className="anmeldung__merkmale">
          {eintraege.map((eintrag) => (
            <li key={eintrag.text}>
              <span aria-hidden><Piktogramm name={eintrag.icon} groesse={18} /></span>
              <div><strong>{eintrag.titel}</strong><small>{eintrag.text}</small></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** „vor 5 Min.“, „vor 3 Std.“, „gestern“, „am 12.10.“ */
function zuletzt(iso: string): string {
  const minuten = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minuten)) return '–';
  if (minuten < 1) return 'gerade eben';
  if (minuten < 60) return `vor ${minuten} Min.`;
  if (minuten < 24 * 60) return `vor ${Math.round(minuten / 60)} Std.`;
  if (minuten < 48 * 60) return 'gestern';
  return `am ${new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
}

const SCHICHT_TIPPS = [
  'Mit eigenen AAO-Knöpfen alarmierst du ganze Züge mit einem Tipp.',
  'Zufriedenes Personal rückt schneller aus – Küche und Aufenthaltsraum helfen.',
  'Fahrzeuge mit Sprechwunsch (Status 5) warten im Funk auf dich.',
  'Mehr Stellplätze gibt es im Ausbau deiner Wache.',
  'Ausgebildetes Personal kündigt seltener.',
  'Über ✎ in der Wachenverwaltung gibst du jeder Wache Namen und Farbe.',
  'Unter Einstellungen → Design kannst du die Farben des Spiels ändern.',
  'Ein guter Ruf bringt dir mehr Geld pro Einsatz.',
];

/** Startbildschirm rechts: wer man ist und ein Tipp für die Schicht */
function SchichtInfo({ konto }: { konto: Konto }) {
  const [tipp] = useState(() => SCHICHT_TIPPS[Math.floor(Math.random() * SCHICHT_TIPPS.length)]);
  return (
    <aside className="anmeldung__seite" aria-label="Deine Schicht">
      <h3>Deine Schicht</h3>
      <ul className="anmeldung__merkmale">
        <li>
          <span aria-hidden><Piktogramm name="karte" groesse={18} /></span>
          <div>
            <strong>{ROLLEN_LABELS[konto.rolle]}</strong>
            <small>Dabei seit {new Date(konto.erstellt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</small>
          </div>
        </li>
        {istGruendungsSpieler(konto) && (
          <li>
            <span aria-hidden>🎖️</span>
            <div><strong>Gründungs-Spieler</strong><small>Schon in der Alpha dabei</small></div>
          </li>
        )}
        <li>
          <span aria-hidden><Piktogramm name="funk" groesse={18} /></span>
          <div><strong>Tipp für deine Schicht</strong><small>{tipp}</small></div>
        </li>
      </ul>
    </aside>
  );
}

function Merkmale() {
  return (
    <section className="anmeldung__seite" aria-label="Was dich erwartet">
      <h3>Was dich erwartet</h3>
      <ul className="anmeldung__merkmale">
        {MERKMALE.map((merkmal) => (
          <li key={merkmal.titel}>
            <span aria-hidden><Piktogramm name={merkmal.icon} groesse={18} /></span>
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

/** Drei echte Einsatzarten aus dem Spiel als Beispiel (einmal ausgewählt – kein Laufband) */
function EinsatzTicker() {
  const [eintraege] = useState<TickerEintrag[]>(() =>
    Array.from({ length: 3 }).reduce<TickerEintrag[]>((liste, _, nr) => [...liste, { nr, vorlage: zufallsVorlage(liste) }], []),
  );

  return (
    <section aria-label="Beispiel-Einsätze aus dem Spiel">
      <h3>Beispiel-Einsätze</h3>
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

/** Wer noch angemeldet ist, wird persönlich begrüßt und startet mit einem Tipp – samt Ladebalken wie beim Anmelden */
function StartBildschirm({ konto, onStart, onAndererNutzer }: {
  konto: Konto;
  onStart: (konto: Konto) => Promise<void>;
  onAndererNutzer: () => void;
}) {
  const [laedt, setLaedt] = useState(false);
  const [geschafft, setGeschafft] = useState(false);

  const starten = async () => {
    setLaedt(true);
    // Ladebalken kurz laufen lassen – den Spielstand lädt danach das Spiel selbst
    await new Promise((fertig) => setTimeout(fertig, 1600));
    setGeschafft(true);
    await new Promise((fertig) => setTimeout(fertig, 700));
    await onStart(konto);
  };

  return (
    <div className={`anmeldung__formular startklar${laedt ? ' startklar--laedt' : ''}`}>
      <span className="startklar__status"><span aria-hidden /> Leitstelle online</span>
      <span className="startklar__ring">
        <ProfilBild konto={konto} groesse={112} />
      </span>
      <div>
        <p className="startklar__gruss">{getBegruessung(new Date().getHours())}</p>
        <h2 className="startklar__titel">
          Hey {anzeigeName(konto)},
          <span>bist du startklar?</span>
        </h2>
        <p className="anmeldung__info">Deine Leitstelle wartet schon auf dich.</p>
      </div>
      {laedt ? (
        <LadeBalken geschafft={geschafft} art="start" />
      ) : (
        <button type="button" className="btn btn--primary anmeldung__absenden startklar__los" onClick={() => void starten()} autoFocus>
          Los geht’s <span aria-hidden>→</span>
        </button>
      )}
      {!laedt && (
        <button type="button" className="anmeldung__link" onClick={onAndererNutzer}>
          Nicht {anzeigeName(konto)}? Mit anderem Konto anmelden
        </button>
      )}
    </div>
  );
}

function AnmeldeFormular({ hinweis, onErfolg, onGast }: { hinweis?: string; onErfolg: (konto: Konto) => Promise<void>; onGast: () => void }) {
  const [modus, setModus] = useState<'anmelden' | 'registrieren' | 'vergessen'>('anmelden');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [passwortWiederholt, setPasswortWiederholt] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const [geschafft, setGeschafft] = useState(false);
  /** Konto laut Server – zeigt beim Ladebalken das eigene Profilbild */
  const [ergebnisKonto, setErgebnisKonto] = useState<Konto | null>(null);
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
      merkeBesuchsZiel(istRegistrierung ? 'registriert' : 'angemeldet');
      setErgebnisKonto(konto);
      // Kurz „Du bist gleich drin“ zeigen, während der Spielstand geladen wird
      setGeschafft(true);
      await Promise.all([onErfolg(konto), new Promise((fertig) => setTimeout(fertig, 900))]);
    } catch (error) {
      setFehler(error instanceof KontoFehler ? error.message : 'Unerwarteter Fehler. Bitte erneut versuchen.');
      setSendet(false);
      setGeschafft(false);
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
            ⚠ <strong>Dein Benutzername ist öffentlich sichtbar</strong> (z. B. in der Bestenliste). Bitte nicht deine
            E-Mail-Adresse oder deinen vollen Namen verwenden.
          </small>
        )}
      </div>
      <div className="anmeldung__feld">
        <label htmlFor={`${id}-passwort`}>Passwort</label>
        <div className="anmeldung__eingabe">
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
            {passwortSichtbar ? 'Verbergen' : 'Zeigen'}
          </button>
        </div>
      </div>
      {istRegistrierung && (
        <div className="anmeldung__feld">
          <label htmlFor={`${id}-wiederholt`}>Passwort wiederholen</label>
          <div className="anmeldung__eingabe">
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

      {sendet ? (
        <div className="anmeldung__laden">
          {/* Bis der Server antwortet die Standardfigur, dann das eigene Bild */}
          <ProfilBild konto={ergebnisKonto ?? { id: 0, name: name.trim() || '?', avatar: null }} groesse={80} />
          <LadeBalken geschafft={geschafft} art={istRegistrierung ? 'registrieren' : 'anmelden'} />
        </div>
      ) : (
        <button type="submit" className="btn btn--primary anmeldung__absenden">
          {istRegistrierung ? 'Konto erstellen' : 'Anmelden'}
        </button>
      )}
      {!istRegistrierung && (
        <button type="button" className="anmeldung__link" onClick={() => setModus('vergessen')} disabled={sendet}>
          Passwort vergessen?
        </button>
      )}
      {!istRegistrierung && (
        <div className="anmeldung__gast">
          <span>Unsicher?</span>
          <button type="button" className="anmeldung__link" onClick={onGast} disabled={sendet}>
            Als Gast spielen
          </button>
          <small>Ohne Konto ausprobieren – es wird nichts gespeichert. Beim Neuladen oder Schließen der Seite ist alles zurückgesetzt.</small>
        </div>
      )}
    </form>
  );
}

/**
 * Ladebalken beim Anmelden: läuft von links nach rechts und nähert sich 90 %, bis der Server antwortet –
 * dann füllt er sich ganz. Der Text wechselt je nach Fortschritt.
 */
function LadeBalken({ geschafft, art }: { geschafft: boolean; art: 'anmelden' | 'registrieren' | 'start' }) {
  const [vergangen, setVergangen] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const takt = window.setInterval(() => setVergangen(performance.now() - start), 80);
    return () => window.clearInterval(takt);
  }, []);

  const prozent = geschafft ? 100 : 90 * (1 - Math.exp(-vergangen / 1400));
  const text = geschafft
    ? 'Du bist gleich drin – mach dich bereit!'
    : prozent < 35
      ? art === 'start' ? 'Leitstelle wird hochgefahren …' : 'Informationen werden geprüft …'
      : prozent < 70
        ? { start: 'Funk wird verbunden …', registrieren: 'Konto wird angelegt …', anmelden: 'Passwort wird geprüft …' }[art]
        : 'Gleich geschafft …';

  return (
    <div className={`anmeldung__ladebalken${geschafft ? ' fertig' : ''}`} role="status" aria-live="polite">
      <div className="anmeldung__ladebalken-kopf">
        {/* key: Text blendet bei jedem Wechsel neu ein */}
        <span key={text} className="anmeldung__ladebalken-text">{text}</span>
        <span className="anmeldung__ladebalken-prozent">{Math.round(prozent)} %</span>
      </div>
      <div className="anmeldung__ladebalken-spur">
        <div className="anmeldung__ladebalken-fuellung" style={{ width: `${prozent}%` }} />
      </div>
    </div>
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
            {sendet ? <><span className="anmeldung__spinner" aria-hidden /> Bitte warten …</> : 'Link anfordern'}
          </button>
        </>
      )}
      <button type="button" className="anmeldung__link" onClick={onZurueck}>← Zurück zur Anmeldung</button>
    </form>
  );
}
