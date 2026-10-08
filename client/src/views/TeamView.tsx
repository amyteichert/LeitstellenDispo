import { useCallback, useEffect, useState } from 'react';
import {
  ROLLEN_LABELS,
  VERGEBBARE_ROLLEN,
  darfKontoVerwalten,
  darfRolleVergeben,
  type Konto,
  type SpielstandZusammenfassung,
  type TeamKonto,
  type TeamUebersicht,
  type UserRole,
} from '@leitstellendispo/shared';
import { teamApi } from '../konto';

type Reiter = 'Übersicht' | 'Konten' | 'Dev-Werkzeuge';
const REITER: Reiter[] = ['Übersicht', 'Konten', 'Dev-Werkzeuge'];

const datum = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '–');
const euro = (betrag: number) => `${betrag.toLocaleString('de-DE')} €`;

export interface DevAktionen {
  testEinsatz: () => string | null;
  geld: (betrag: number) => void;
  rufSetzen: (wert: number) => void;
  lehrgaengeBeenden: () => void;
  ruf: number;
}

/** Team-Bereich: nur für Owner, Co-Owner und Admin sichtbar. Jede Aktion prüft zusätzlich der Server. */
export default function TeamView({ konto, dev }: { konto: Konto; dev: DevAktionen }) {
  const [reiter, setReiter] = useState<Reiter>('Übersicht');
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);

  useEffect(() => {
    if (!meldung) return;
    const timeout = setTimeout(() => setMeldung(null), 5000);
    return () => clearTimeout(timeout);
  }, [meldung]);

  const melde = (art: 'ok' | 'fehler', text: string) => setMeldung({ art, text });

  return (
    <div>
      <h2>🛠 Team</h2>
      <p className="einsatz-eintrag__zeile">Angemeldet als <strong>{konto.name}</strong> ({ROLLEN_LABELS[konto.rolle]})</p>

      <div className="verwalten-reiter" role="tablist">
        {REITER.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={reiter === name} className={`btn ${reiter === name ? 'btn--primary' : ''}`} onClick={() => setReiter(name)}>
            {name}
          </button>
        ))}
      </div>

      {meldung && (
        <div className={meldung.art === 'ok' ? 'aktion-rueckmeldung' : 'versorgung-hinweis versorgung-hinweis--fehlt'} role="status">{meldung.text}</div>
      )}

      {reiter === 'Übersicht' && <Uebersicht melde={melde} />}
      {reiter === 'Konten' && <Konten ich={konto} melde={melde} />}
      {reiter === 'Dev-Werkzeuge' && <DevWerkzeuge dev={dev} melde={melde} />}
    </div>
  );
}

type Melde = (art: 'ok' | 'fehler', text: string) => void;
const fehlerText = (e: unknown) => (e instanceof Error ? e.message : 'Unbekannter Fehler.');

function Uebersicht({ melde }: { melde: Melde }) {
  const [daten, setDaten] = useState<TeamUebersicht | null>(null);
  const laden = useCallback(() => {
    teamApi.uebersicht().then(setDaten).catch((e) => melde('fehler', fehlerText(e)));
  }, []);
  useEffect(laden, [laden]);

  if (!daten) return <p className="einsatz-eintrag__zeile">Lade …</p>;
  const kacheln: Array<[string, number, string?]> = [
    ['Konten gesamt', daten.konten],
    ['Neu (7 Tage)', daten.neuLetzte7Tage],
    ['Aktiv (24 Std.)', daten.aktivHeute, 'Spielstand gespeichert'],
    ['Aktiv (7 Tage)', daten.aktivLetzte7Tage],
    ['Mit Spielstand', daten.mitSpielstand],
    ['Team-Konten', daten.team],
    ['Gesperrt', daten.gesperrt],
  ];
  return (
    <>
      <div className="verwalten-kacheln">
        {kacheln.map(([titel, wert, info]) => (
          <div key={titel} className="verwalten-kachel">
            <small>{titel}</small>
            <strong>{wert}</strong>
            {info && <small>{info}</small>}
          </div>
        ))}
      </div>
      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={laden}>↻ Aktualisieren</button>
    </>
  );
}

function Konten({ ich, melde }: { ich: Konto; melde: Melde }) {
  const [suche, setSuche] = useState('');
  const [konten, setKonten] = useState<TeamKonto[]>([]);
  const [offen, setOffen] = useState<number | null>(null);

  const laden = useCallback((text: string) => {
    teamApi.konten(text).then(setKonten).catch((e) => melde('fehler', fehlerText(e)));
  }, []);

  // Suche leicht verzögert, damit nicht bei jedem Tastendruck angefragt wird
  useEffect(() => {
    const timeout = setTimeout(() => laden(suche), 250);
    return () => clearTimeout(timeout);
  }, [suche, laden]);

  const ersetze = (neu: TeamKonto) => setKonten((liste) => liste.map((k) => (k.id === neu.id ? neu : k)));

  return (
    <>
      <label className="field" style={{ maxWidth: 360 }}>
        <input type="search" placeholder="Benutzername suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} aria-label="Konten durchsuchen" />
      </label>
      <ul className="team-konten">
        {konten.map((k) => (
          <KontoZeile
            key={k.id}
            konto={k}
            ich={ich}
            offen={offen === k.id}
            umschalten={() => setOffen(offen === k.id ? null : k.id)}
            melde={melde}
            ersetze={ersetze}
            entferne={() => setKonten((liste) => liste.filter((x) => x.id !== k.id))}
          />
        ))}
        {konten.length === 0 && <li className="einsatz-eintrag__zeile">Keine Konten gefunden.</li>}
      </ul>
    </>
  );
}

function KontoZeile({ konto, ich, offen, umschalten, melde, ersetze, entferne }: {
  konto: TeamKonto;
  ich: Konto;
  offen: boolean;
  umschalten: () => void;
  melde: Melde;
  ersetze: (k: TeamKonto) => void;
  entferne: () => void;
}) {
  const [stand, setStand] = useState<SpielstandZusammenfassung | null | undefined>(undefined);
  const [passwortLink, setPasswortLink] = useState<string | null>(null);
  const verwaltbar = darfKontoVerwalten(ich, konto);
  const rollenVergabe = ich.rolle === 'owner' && ich.id !== konto.id;

  useEffect(() => {
    if (offen && stand === undefined) teamApi.spielstand(konto.id).then(setStand).catch((e) => melde('fehler', fehlerText(e)));
  }, [offen]);

  const aktion = async (ausfuehren: () => Promise<unknown>, ok: string) => {
    try {
      await ausfuehren();
      melde('ok', ok);
    } catch (e) {
      melde('fehler', fehlerText(e));
    }
  };

  return (
    <li className={`team-konto ${konto.gesperrt ? 'team-konto--gesperrt' : ''}`}>
      <button type="button" className="team-konto__kopf" onClick={umschalten} aria-expanded={offen}>
        <strong>{konto.name}</strong>
        {konto.id === ich.id && <span className="quali-chip">Du</span>}
        <span className="quali-chip">{ROLLEN_LABELS[konto.rolle]}</span>
        {konto.gesperrt && <span className="quali-chip team-chip--warnung">Gesperrt</span>}
        {konto.devMarkiert && <span className="quali-chip quali-chip--keine" title="Hat Dev-Werkzeuge benutzt – zählt nicht für die Bestenliste">Dev</span>}
        <small>
          {konto.email ?? 'keine E-Mail'} · seit {datum(konto.erstellt)} · zuletzt gespielt {datum(konto.zuletztGespielt)}
        </small>
      </button>

      {offen && (
        <div className="team-konto__details">
          {stand === undefined ? (
            <small>Lade Spielstand …</small>
          ) : stand === null ? (
            <small>Noch kein Spielstand gespeichert.</small>
          ) : (
            <dl className="einsatz-infos">
              <div><dt>Guthaben</dt><dd>{euro(stand.guthaben)}</dd></div>
              <div><dt>Ruf</dt><dd>{stand.ruf ?? '–'}</dd></div>
              <div><dt>Wachen</dt><dd>{stand.wachen}</dd></div>
              <div><dt>Fahrzeuge</dt><dd>{stand.fahrzeuge}</dd></div>
              <div><dt>Personal</dt><dd>{stand.personal}</dd></div>
              <div><dt>Laufende Einsätze</dt><dd>{stand.laufendeEinsaetze}</dd></div>
              <div><dt>Abgeschlossen (letzte 100)</dt><dd>{stand.abgeschlosseneEinsaetze}</dd></div>
              <div><dt>Gespeichert</dt><dd>{datum(stand.gespeichertAm)}</dd></div>
            </dl>
          )}

          {passwortLink && (
            <label className="field">
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Passwort-Link für {konto.name} (nur an diese Person weitergeben):</span>
              <input readOnly value={passwortLink} onFocus={(e) => e.target.select()} />
            </label>
          )}

          <div className="team-konto__aktionen">
            {rollenVergabe && (
              <label className="field" style={{ margin: 0 }}>
                <select
                  value={konto.rolle}
                  aria-label={`Rolle von ${konto.name}`}
                  disabled={konto.rolle === 'owner'}
                  onChange={(e) => {
                    const rolle = e.target.value as UserRole;
                    if (!darfRolleVergeben(ich, konto, rolle)) return;
                    void aktion(async () => ersetze(await teamApi.rolle(konto.id, rolle)), `${konto.name} ist jetzt ${ROLLEN_LABELS[rolle]}.`);
                  }}
                >
                  {(konto.rolle === 'owner' ? ['owner' as UserRole] : VERGEBBARE_ROLLEN).map((r) => <option key={r} value={r}>{ROLLEN_LABELS[r]}</option>)}
                </select>
              </label>
            )}
            {verwaltbar ? (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void aktion(async () => ersetze(await teamApi.sperren(konto.id, !konto.gesperrt)), konto.gesperrt ? `${konto.name} ist entsperrt.` : `${konto.name} ist gesperrt und abgemeldet.`)}
                >
                  {konto.gesperrt ? 'Entsperren' : 'Sperren'}
                </button>
                <button
                  type="button"
                  className="btn"
                  title="Link, mit dem die Person ein neues Passwort festlegt (1 Stunde gültig) – z. B. im Discord weitergeben"
                  onClick={() => void aktion(async () => {
                    const { link } = await teamApi.passwortLink(konto.id);
                    setPasswortLink(link);
                    await navigator.clipboard?.writeText(link).catch(() => undefined);
                  }, 'Link erzeugt (1 Stunde gültig) und – falls möglich – in die Zwischenablage kopiert.')}
                >
                  Passwort-Link erzeugen
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!stand}
                  onClick={() => {
                    if (!window.confirm(`Spielstand von ${konto.name} wirklich zurücksetzen? Das lässt sich nicht rückgängig machen.`)) return;
                    void aktion(async () => { await teamApi.spielstandZuruecksetzen(konto.id); setStand(null); }, `Spielstand von ${konto.name} zurückgesetzt.`);
                  }}
                >
                  Spielstand zurücksetzen
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    if (!window.confirm(`Konto ${konto.name} samt Spielstand endgültig löschen?`)) return;
                    void aktion(async () => { await teamApi.loeschen(konto.id); entferne(); }, `Konto ${konto.name} gelöscht.`);
                  }}
                >
                  Konto löschen
                </button>
              </>
            ) : (
              konto.id !== ich.id && <small>Dieses Konto hat einen gleichen oder höheren Rang – du kannst es nicht verwalten.</small>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function DevWerkzeuge({ dev, melde }: { dev: DevAktionen; melde: Melde }) {
  const [ruf, setRuf] = useState(String(dev.ruf));

  /** Erst die Dev-Markierung auf dem Server setzen, dann das Werkzeug ausführen. */
  const mitMarkierung = async (ausfuehren: () => string | null | void, ok: string) => {
    try {
      await teamApi.devMarkierung();
    } catch (e) {
      melde('fehler', `Dev-Markierung fehlgeschlagen – Werkzeug nicht ausgeführt: ${fehlerText(e)}`);
      return;
    }
    const fehler = ausfuehren();
    melde(fehler ? 'fehler' : 'ok', fehler || ok);
  };

  return (
    <>
      <div className="versorgung-hinweis versorgung-hinweis--unterwegs">
        Diese Werkzeuge wirken <strong>nur auf dein eigenes Spiel</strong>. Wer sie benutzt, wird dauerhaft als
        „mit Dev-Werkzeugen gespielt“ markiert und zählt nicht für die Bestenliste.
      </div>
      <div className="ausbau-raster">
        <article className="ausbau-karte">
          <span className="ausbau-karte__kategorie">Einsätze</span>
          <h3>Test-Einsatz</h3>
          <p>Erzeugt sofort einen Einsatz an einer deiner Wachen.</p>
          <button type="button" className="btn btn--primary" onClick={() => void mitMarkierung(dev.testEinsatz, '✓ Test-Einsatz erzeugt.')}>Erzeugen</button>
        </article>
        <article className="ausbau-karte">
          <span className="ausbau-karte__kategorie">Finanzen</span>
          <h3>Guthaben</h3>
          <p>Geld zum Testen von Ausbauten und Käufen.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[10000, 100000, -10000].map((betrag) => (
              <button key={betrag} type="button" className="btn" onClick={() => void mitMarkierung(() => dev.geld(betrag), `✓ ${betrag > 0 ? '+' : ''}${euro(betrag)}.`)}>
                {betrag > 0 ? '+' : ''}{euro(betrag)}
              </button>
            ))}
          </div>
          <GeldEingabe onBuchen={(betrag) => void mitMarkierung(() => dev.geld(betrag), `✓ ${betrag > 0 ? '+' : ''}${euro(betrag)}.`)} />
        </article>
        <article className="ausbau-karte">
          <span className="ausbau-karte__kategorie">Ruf</span>
          <h3>Ruf setzen</h3>
          <p>Aktuell {dev.ruf}. Zum Testen des Leistungsbonus (0–100).</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <label className="field" style={{ margin: 0, flex: 1 }}>
              <input type="number" min={0} max={100} value={ruf} onChange={(e) => setRuf(e.target.value)} aria-label="Neuer Ruf" />
            </label>
            <button type="button" className="btn" disabled={ruf.trim() === '' || Number.isNaN(Number(ruf))} onClick={() => void mitMarkierung(() => dev.rufSetzen(Number(ruf)), '✓ Ruf gesetzt.')}>Setzen</button>
          </div>
        </article>
        <article className="ausbau-karte">
          <span className="ausbau-karte__kategorie">Ausbildung</span>
          <h3>Lehrgänge beenden</h3>
          <p>Alle laufenden Lehrgänge sind sofort fertig – die Teilnehmer kommen mit Qualifikation in die Reserve.</p>
          <button type="button" className="btn" onClick={() => void mitMarkierung(dev.lehrgaengeBeenden, '✓ Alle Lehrgänge beendet.')}>Sofort beenden</button>
        </article>
      </div>
    </>
  );
}

/** Freier Betrag: „+“ bucht dazu, „−“ zieht ab */
function GeldEingabe({ onBuchen }: { onBuchen: (betrag: number) => void }) {
  const [eingabe, setEingabe] = useState('');
  const betrag = Math.round(Number(eingabe.replace(/[.s€]/g, '').replace(',', '.')));
  const gueltig = Number.isFinite(betrag) && betrag > 0;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      <input
        type="text"
        inputMode="numeric"
        value={eingabe}
        onChange={(event) => setEingabe(event.target.value)}
        placeholder="Betrag, z. B. 1.000.000"
        aria-label="Eigener Betrag"
        style={{ flex: '1 1 140px', minWidth: 0 }}
      />
      <button type="button" className="btn" disabled={!gueltig} onClick={() => onBuchen(betrag)}>＋</button>
      <button type="button" className="btn" disabled={!gueltig} onClick={() => onBuchen(-betrag)}>−</button>
    </div>
  );
}
