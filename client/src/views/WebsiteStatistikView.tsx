import { useEffect, useState } from 'react';
import {
  BEREICH_LABELS,
  QUELLEN_LABELS,
  VERHALTEN_LABELS,
  type BesuchsVerhalten,
  type BesuchsZiel,
  type WebsiteBereich,
  type WebsiteStatistik,
} from '@leitstellendispo/shared';
import { teamApi } from '../konto';

type Zeitraum = 7 | 30 | 90 | 365 | 'alle';
const ZEITRAEUME: Array<[Zeitraum, string]> = [[7, '7 Tage'], [30, '30 Tage'], [90, '90 Tage'], [365, '1 Jahr'], ['alle', 'Alles']];

const ZIEL_LABELS: Record<BesuchsZiel, string> = {
  spielen: '„Spielen“ geklickt',
  discord: 'Discord geöffnet',
  intern: 'Weitergeklickt (andere Seite)',
  extern: 'Externer Link',
  registriert: 'Neu registriert',
  angemeldet: 'Angemeldet',
  gespielt: 'Mit Konto gespielt',
};

type Auswahl = WebsiteBereich | 'beide';
const BEREICHE: Array<[Auswahl, string]> = [['info', BEREICH_LABELS.info], ['spiel', BEREICH_LABELS.spiel], ['beide', 'Beides zusammen']];

const LINK_BASIS: Record<WebsiteBereich, string> = { info: 'https://leitstellendispo.de', spiel: 'https://spiel.leitstellendispo.de' };

const prozent = (teil: number, ganz: number) => (ganz === 0 ? 0 : Math.round((teil / ganz) * 100));
const kurzesDatum = (tag: string) => new Date(`${tag}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

/** Waagerechter Balken mit Beschriftung und Wert */
function Balken({ label, wert, max, zusatz }: { label: string; wert: number; max: number; zusatz?: string }) {
  return (
    <li className="statistik-balken">
      <span className="statistik-balken__label">{label}</span>
      <span className="statistik-balken__spur"><span style={{ width: `${prozent(wert, max)}%` }} /></span>
      <span className="statistik-balken__wert">{wert}{zusatz && <small> {zusatz}</small>}</span>
    </li>
  );
}

/** Besucherstatistik der Website – nur für den Owner (der Server prüft das zusätzlich). */
export default function WebsiteStatistikView() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>(30);
  const [bereich, setBereich] = useState<Auswahl>('info');
  const [daten, setDaten] = useState<WebsiteStatistik | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [beispiel, setBeispiel] = useState('whatsapp-gruppe1');

  useEffect(() => {
    setDaten(null);
    setFehler(null);
    teamApi.website(zeitraum, bereich).then(setDaten).catch((e) => setFehler(e instanceof Error ? e.message : 'Laden fehlgeschlagen.'));
  }, [zeitraum, bereich]);

  const anzahlZiel = (z: BesuchsZiel) => daten?.ziele.find((eintrag) => eintrag.ziel === z)?.besucher ?? 0;
  // Wichtigste Kennzahl je Bereich: auf der Info-Website der Klick ins Spiel, im Spiel die Registrierung
  const hauptZiel: BesuchsZiel = bereich === 'info' ? 'spielen' : 'registriert';

  const link = `${LINK_BASIS[bereich === 'spiel' ? 'spiel' : 'info']}/?von=${beispiel.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;

  return (
    <div className="website-statistik">
      <div className="verwalten-reiter" role="group" aria-label="Welche Seite">
        {BEREICHE.map(([wert, label]) => (
          <button key={wert} type="button" className={`btn ${bereich === wert ? 'btn--primary' : ''}`} onClick={() => setBereich(wert)}>{label}</button>
        ))}
      </div>
      {bereich === 'beide' && (
        <small className="einsatz-eintrag__zeile" style={{ display: 'block', marginBottom: 8 }}>
          Wer am selben Tag erst die Info-Website und dann das Spiel besucht, zählt hier als eine Person. Herkunft ist der erste Einstieg.
        </small>
      )}
      <div className="verwalten-reiter" role="group" aria-label="Zeitraum">
        {ZEITRAEUME.map(([wert, label]) => (
          <button key={label} type="button" className={`btn ${zeitraum === wert ? 'btn--primary' : ''}`} onClick={() => setZeitraum(wert)}>{label}</button>
        ))}
      </div>

      {fehler && <div className="versorgung-hinweis versorgung-hinweis--fehlt">{fehler}</div>}
      {!daten && !fehler && <p className="einsatz-eintrag__zeile">Lade …</p>}

      {daten && (
        <>
          <div className="verwalten-kacheln">
            <div className="verwalten-kachel"><small>Besucher</small><strong>{daten.besucher}</strong><small>verschiedene Personen pro Tag</small></div>
            <div className="verwalten-kachel"><small>Seitenaufrufe</small><strong>{daten.aufrufe}</strong></div>
            <div className="verwalten-kachel">
              <small>Seiten je Besuch</small>
              <strong>{daten.besucher === 0 ? '–' : (daten.aufrufe / daten.besucher).toLocaleString('de-DE', { maximumFractionDigits: 1 })}</strong>
            </div>
            <div className="verwalten-kachel">
              <small>{hauptZiel === 'spielen' ? 'Zum Spiel gewechselt' : 'Neu registriert'}</small>
              <strong>{anzahlZiel(hauptZiel)}</strong>
              <small>{prozent(anzahlZiel(hauptZiel), daten.besucher)} % der Besucher</small>
            </div>
          </div>

          {daten.besucher === 0 ? (
            <div className="leerzustand" style={{ marginTop: 16 }}>
              <strong>Noch keine Besuche in diesem Zeitraum</strong>
              Sobald jemand die Website öffnet, erscheint er hier (Aufrufe von Bots werden nicht gezählt).
            </div>
          ) : (
            <div className="statistik-raster">
              <section className="einsatz-abschnitt">
                <h4>Verhalten</h4>
                <ul className="statistik-liste">
                  {(Object.keys(VERHALTEN_LABELS) as BesuchsVerhalten[]).map((art) => (
                    <Balken key={art} label={VERHALTEN_LABELS[art]} wert={daten.verhalten[art]} max={daten.besucher} zusatz={`(${prozent(daten.verhalten[art], daten.besucher)} %)`} />
                  ))}
                </ul>
                <small className="einsatz-eintrag__zeile">
                  „Gelesen“: mindestens 30 Sekunden da oder die halbe Seite gescrollt. „Interagiert“: etwas angeklickt.
                </small>
              </section>

              <section className="einsatz-abschnitt">
                <h4>Wie sie dich gefunden haben</h4>
                <ul className="statistik-liste">
                  {daten.quellen.map((q) => (
                    <Balken key={q.art} label={QUELLEN_LABELS[q.art]} wert={q.besucher} max={daten.besucher} zusatz={`(${prozent(q.besucher, daten.besucher)} %)`} />
                  ))}
                </ul>
                {daten.herkuenfte.length > 0 && (
                  <ul className="statistik-liste statistik-liste--klein">
                    {daten.herkuenfte.map((h) => (
                      <Balken key={`${h.art}-${h.name}`} label={h.art === 'kampagne' ? `?von=${h.name}` : h.name} wert={h.besucher} max={daten.herkuenfte[0].besucher} />
                    ))}
                  </ul>
                )}
              </section>

              <section className="einsatz-abschnitt">
                <h4>Besucher pro Tag</h4>
                <div className="statistik-verlauf" role="img" aria-label="Besucher pro Tag">
                  {daten.tage.map((t) => (
                    <span key={t.tag} title={`${kurzesDatum(t.tag)}: ${t.besucher} Besucher, ${t.aufrufe} Aufrufe`}>
                      <span style={{ height: `${Math.max(4, prozent(t.besucher, Math.max(...daten.tage.map((x) => x.besucher))))}%` }} />
                    </span>
                  ))}
                </div>
                <small className="einsatz-eintrag__zeile">
                  {kurzesDatum(daten.tage[0].tag)} – {kurzesDatum(daten.tage[daten.tage.length - 1].tag)} · Balken antippen bzw. darüberfahren für Details
                </small>
              </section>

              <section className="einsatz-abschnitt">
                <h4>Beliebteste Seiten</h4>
                <ul className="statistik-liste">
                  {daten.seiten.slice(0, 10).map((s) => (
                    <Balken key={s.seite} label={s.seite} wert={s.aufrufe} max={daten.seiten[0].aufrufe} />
                  ))}
                </ul>
                {daten.ziele.length > 0 && (
                  <ul className="statistik-liste statistik-liste--klein">
                    {daten.ziele.map((z) => <Balken key={z.ziel} label={ZIEL_LABELS[z.ziel]} wert={z.besucher} max={daten.besucher} />)}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}

      <section className="ausbau-karte" style={{ marginTop: 16 }}>
        <span className="ausbau-karte__kategorie">Tipp: geteilte Links erkennen</span>
        <p>
          WhatsApp und viele Apps verraten nicht, woher ein Besucher kommt – er landet dann unter „Direkt / unbekannt“.
          Hängst du an geteilte Links <strong>?von=…</strong> an, siehst du hier genau, welche Gruppe wie viele Besucher gebracht hat.
        </p>
        <label className="field">
          <span>Name für den Link (z. B. die Gruppe)</span>
          <input value={beispiel} maxLength={40} onChange={(e) => setBeispiel(e.target.value)} />
        </label>
        <label className="field">
          <span>Dein Link zum Teilen</span>
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
        </label>
        <button type="button" className="btn" onClick={() => void navigator.clipboard?.writeText(link)}>Link kopieren</button>
      </section>

      <small className="einsatz-eintrag__zeile" style={{ display: 'block', marginTop: 12 }}>
        Datenschutz: keine Cookies, keine IP-Adressen. Besucher werden nur über einen täglich wechselnden, nicht umkehrbaren Code
        gezählt – dieselbe Person an zwei Tagen zählt also zweimal. Einträge werden nach etwa 13 Monaten gelöscht.
      </small>
    </div>
  );
}
