import { useState } from 'react';
import {
  AVATAR_VORLAGEN,
  KONTO_REGELN,
  NAME_AENDERN_ABSTAND_TAGE,
  ROLLEN_LABELS,
  SPITZNAME_MAX_LAENGE,
  getNameAenderbarAb,
  getRufLabel,
  istGruendungsSpieler,
  pruefeBenutzername,
  pruefeSpitzname,
  type Konto,
} from '@leitstellendispo/shared';
import SpielerName from '../SpielerName';
import ProfilBild, { AVATAR_FIGUREN, bereiteProfilbildVor } from '../ProfilBild';
import { KontoFehler, aendereName, entferneProfilbild, ladeProfilbildHoch, setzeProfil } from '../konto';

const euro = (betrag: number) => `${Math.round(betrag).toLocaleString('de-DE')} €`;

/** Eigenes Profil: wer man ist, seit wann dabei, Abzeichen und die wichtigsten Zahlen der eigenen Leitstelle */
export default function ProfilView({
  konto,
  gast,
  setKonto,
  stand,
  onFehlerMelden,
  onZurAnmeldung,
}: {
  konto: Konto;
  gast: boolean;
  setKonto: (konto: Konto) => void;
  stand: { wachen: number; fahrzeuge: number; personal: number; einsaetze: number; rd: number; fw: number; guthaben: number; ruf: number };
  onFehlerMelden: () => void;
  onZurAnmeldung: () => void;
}) {
  const [bildWaehlen, setBildWaehlen] = useState(false);
  const zahlen: Array<[string, string]> = [
    ['Guthaben', euro(stand.guthaben)],
    ['Ruf', `${stand.ruf} · ${getRufLabel(stand.ruf)}`],
    ['Wachen', String(stand.wachen)],
    ['Fahrzeuge', String(stand.fahrzeuge)],
    ['Personal', String(stand.personal)],
    ['Einsätze abgeschlossen', `${stand.einsaetze} (RD ${stand.rd} · FW ${stand.fw})`],
  ];

  return (
    <div className="profil">
      <h2>Profil</h2>

      <section className="ausbau-karte profil-kopf">
        {gast ? (
          <>
            <p><strong>Gast</strong> – ohne Konto wird nichts gespeichert.</p>
            <p>Mit einem Konto bleibt deine Leitstelle erhalten, und in der Alpha bekommst du das Abzeichen als Gründungs-Spieler.</p>
            <button type="button" className="btn btn--primary" onClick={onZurAnmeldung}>Anmelden / Registrieren</button>
          </>
        ) : (
          <>
            <div className="profil-avatar">
              <span className="profil-avatar__bild">
                <ProfilBild konto={konto} groesse={112} />
                <button
                  type="button"
                  className="profil-avatar__knopf"
                  aria-expanded={bildWaehlen}
                  aria-label={konto.avatar ? 'Profilbild ändern' : 'Profilbild hinzufügen'}
                  title={konto.avatar ? 'Profilbild ändern' : 'Profilbild hinzufügen'}
                  onClick={() => setBildWaehlen((offen) => !offen)}
                >
                  {konto.avatar ? '✎' : '+'}
                </button>
              </span>
              <p className="profil-name"><SpielerName konto={konto} /></p>
              {konto.spitzname && <small className="einsatz-eintrag__zeile">„{konto.spitzname}“</small>}
            </div>
            {bildWaehlen && <BildAuswahl konto={konto} setKonto={setKonto} onFertig={() => setBildWaehlen(false)} />}
            <small className="einsatz-eintrag__zeile">
              {ROLLEN_LABELS[konto.rolle]} · dabei seit {new Date(konto.erstellt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </small>
            <div>
              <span className="ausbau-karte__kategorie">Abzeichen</span>
              {istGruendungsSpieler(konto)
                ? <p>🎖️ <strong>Gründungs-Spieler</strong> – schon in der Alpha dabei.</p>
                : <p className="einsatz-eintrag__zeile">Noch keine Abzeichen.</p>}
            </div>
          </>
        )}
      </section>

      {!gast && <ProfilBearbeiten konto={konto} setKonto={setKonto} />}

      <section className="ausbau-karte">
        <span className="ausbau-karte__kategorie">Deine Leitstelle</span>
        <dl className="profil-zahlen">
          {zahlen.map(([titel, wert]) => (
            <div key={titel}>
              <dt>{titel}</dt>
              <dd>{wert}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="ausbau-karte">
        <span className="ausbau-karte__kategorie">Etwas stimmt nicht?</span>
        <p>Melde Fehler direkt aus dem Spiel – die wichtigsten Angaben zu Gerät und Spielstand werden automatisch mitgeschickt.</p>
        <button type="button" className="btn btn--secondary" onClick={onFehlerMelden} disabled={gast}>Fehler melden</button>
        {gast && <small className="einsatz-eintrag__zeile">Fehler melden geht mit einem Konto.</small>}
      </section>
    </div>
  );
}

const fehlerText = (e: unknown) => (e instanceof KontoFehler || e instanceof Error ? e.message : 'Unerwarteter Fehler.');

/** Profilbild (Figur oder eigenes Bild), Spitzname und Benutzername ändern */
function ProfilBearbeiten({ konto, setKonto }: { konto: Konto; setKonto: (konto: Konto) => void }) {
  const [spitzname, setSpitzname] = useState(konto.spitzname ?? '');
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [neuerName, setNeuerName] = useState(konto.name);
  const [passwort, setPasswort] = useState('');
  const aenderbarAb = getNameAenderbarAb(konto.nameGeaendert);
  const nameGesperrt = Date.now() < aenderbarAb;

  const ausfuehren = async (aktion: () => Promise<Konto>, ok: string) => {
    setLaedt(true);
    try {
      setKonto(await aktion());
      setMeldung({ art: 'ok', text: ok });
      return true;
    } catch (e) {
      setMeldung({ art: 'fehler', text: fehlerText(e) });
      return false;
    } finally {
      setLaedt(false);
    }
  };

  return (
    <section className="ausbau-karte profil-bearbeiten">
      <span className="ausbau-karte__kategorie">Profil anpassen</span>
      {meldung && (
        <div className={meldung.art === 'ok' ? 'aktion-rueckmeldung' : 'versorgung-hinweis versorgung-hinweis--fehlt'} role="status">{meldung.text}</div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fehler = pruefeSpitzname(spitzname);
          if (fehler) return setMeldung({ art: 'fehler', text: fehler });
          void ausfuehren(() => setzeProfil(spitzname, konto.avatar ?? null), spitzname.trim() ? `✓ Hallo ${spitzname.trim()}!` : 'Spitzname entfernt.');
        }}
      >
        <h4>Spitzname</h4>
        <p className="einsatz-eintrag__zeile">So begrüßt dich das Spiel. Leer lassen = Benutzername.</p>
        <div className="fahrzeug-bearbeiten__zeile">
          <label className="field" style={{ flex: '1 1 180px', margin: 0 }}>
            <input value={spitzname} maxLength={SPITZNAME_MAX_LAENGE * 2} placeholder={konto.name} onChange={(e) => setSpitzname(e.target.value)} aria-label="Spitzname" />
          </label>
          <button type="submit" className="btn" disabled={laedt || spitzname.trim() === (konto.spitzname ?? '')}>Speichern</button>
        </div>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fehler = pruefeBenutzername(neuerName);
          if (fehler) return setMeldung({ art: 'fehler', text: fehler });
          void ausfuehren(() => aendereName(neuerName.trim(), passwort), `✓ Du heißt jetzt ${neuerName.trim()}. Melde dich ab jetzt mit diesem Namen an.`)
            .then((ok) => ok && setPasswort(''));
        }}
      >
        <h4>Benutzername ändern</h4>
        <p className="einsatz-eintrag__zeile">
          Damit meldest du dich an, andere sehen ihn. Geht nur alle {NAME_AENDERN_ABSTAND_TAGE} Tage.
          {nameGesperrt && ` Wieder möglich ab ${new Date(aenderbarAb).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}.`}
        </p>
        <div className="fahrzeug-bearbeiten__zeile">
          <label className="field" style={{ flex: '1 1 160px', margin: 0 }}>
            <input value={neuerName} maxLength={KONTO_REGELN.nameMaxLaenge} disabled={nameGesperrt} autoComplete="username" onChange={(e) => setNeuerName(e.target.value)} aria-label="Neuer Benutzername" />
          </label>
          <label className="field" style={{ flex: '1 1 160px', margin: 0 }}>
            <input type="password" value={passwort} disabled={nameGesperrt} placeholder="Aktuelles Passwort" autoComplete="current-password" onChange={(e) => setPasswort(e.target.value)} aria-label="Aktuelles Passwort" />
          </label>
          <button type="submit" className="btn" disabled={laedt || nameGesperrt || !passwort || neuerName.trim() === konto.name}>Ändern</button>
        </div>
      </form>
    </section>
  );
}

/** Auswahl unter dem großen Profilbild: Figur, eigenes Bild oder keins */
function BildAuswahl({ konto, setKonto, onFertig }: { konto: Konto; setKonto: (konto: Konto) => void; onFertig: () => void }) {
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const ausfuehren = async (aktion: () => Promise<Konto>) => {
    setLaedt(true);
    setFehler(null);
    try {
      setKonto(await aktion());
      onFertig();
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  };

  const waehleVorlage = (avatar: string | null) => void ausfuehren(() => setzeProfil(konto.spitzname ?? '', avatar));

  return (
    <div className="profil-bildauswahl">
      {fehler && <div className="versorgung-hinweis versorgung-hinweis--fehlt" role="alert">{fehler}</div>}
      <div>
        <h4>Profilbild wählen</h4>
        <div className="profil-avatare">
          {AVATAR_VORLAGEN.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={konto.avatar === `vorlage:${id}`}
              disabled={laedt}
              onClick={() => waehleVorlage(`vorlage:${id}`)}
            >
              <ProfilBild konto={konto} avatar={`vorlage:${id}`} groesse={52} />
              {AVATAR_FIGUREN[id].name}
            </button>
          ))}
        </div>
        <div className="team-konto__aktionen" style={{ marginTop: 8 }}>
          <label className="btn">
            Eigenes Bild hochladen
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              disabled={laedt}
              onChange={(e) => {
                const datei = e.target.files?.[0];
                e.target.value = '';
                if (datei) void ausfuehren(async () => ladeProfilbildHoch(await bereiteProfilbildVor(datei)));
              }}
            />
          </label>
          {konto.avatar?.startsWith('bild:') && (
            <button type="button" className="btn" disabled={laedt} onClick={() => void ausfuehren(entferneProfilbild)}>Bild entfernen</button>
          )}
          {konto.avatar && !konto.avatar.startsWith('bild:') && (
            <button type="button" className="btn" disabled={laedt} onClick={() => waehleVorlage(null)}>Kein Bild</button>
          )}
        </div>
        <small className="einsatz-eintrag__zeile">Eigene Bilder prüft erst das Team – bis zur Freigabe sehen andere Spieler die Standardfigur. Bitte nichts Anstößiges.</small>
      </div>

    </div>
  );
}
