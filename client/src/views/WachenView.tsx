import { useEffect, useState } from 'react';
import {
  FAEHIGKEIT_LABELS,
  FMS_STATUS,
  STELLPLATZ_CONFIG,
  WACHENNAME_MAX_LAENGE,
  WACHEN_LOGO_FARBEN,
  formatAdresse,
  getBelegteStellplaetze,
  getWachenKostenJeStunde,
  getFahrzeugTyp,
  getFahrzeugTypenFuerWache,
  getKaufSperre,
  getMindestBesatzung,
  getSonderErweiterung,
  getSonderErweiterungenFuerWache,
  hatSonderErweiterung,
  getStellplaetze,
  getStellplatzErweiterungen,
  getStellplatzPreis,
  RUHERAUM_CONFIG,
  getPersonalDerWache,
  getPersonalLimit,
  getRuheraumPreis,
  getRuheraumStufe,
  istAusreichendBesetzt,
  ZUFRIEDENHEIT_CONFIG,
  ZUFRIEDENHEITS_AUSBAUTEN,
  getAusbauStufe,
  getAusrueckVerzoegerung,
  getGrundZufriedenheit,
  getStress,
  getZufriedenheit,
  getZufriedenheitsAusbauPreis,
  type Kuendigung,
  type ZufriedenheitsAusbau,
  type AbgeschlossenerLehrgang,
  type Bewerber,
  type Mitarbeiter,
  formatEuro,
} from '@leitstellendispo/shared';
import type { MapLocation, Vehicle } from '../types';
import PersonalReiter from './PersonalReiter';
import FahrzeugBearbeiten from './FahrzeugBearbeiten';
import AusbildungReiter, { type AusbildungAktionen } from './AusbildungReiter';
import { Kennzeichen } from '../Kennzeichen';
import { FahrzeugBild } from '../fahrzeugGrafik';
import FarbWahl from './FarbWahl';

type Reiter = 'Übersicht' | 'Fahrzeuge' | 'Personal' | 'Ausbildung' | 'Ausbau';
const REITER: Reiter[] = ['Übersicht', 'Fahrzeuge', 'Personal', 'Ausbildung', 'Ausbau'];

/** Ausbauten, die noch folgen – damit sichtbar ist, was geplant ist */
const GEPLANTE_AUSBAUTEN = [
  { name: 'Werkstatt', text: 'Wartung und Reparatur der Fahrzeuge vor Ort.' },
  { name: 'Tankstelle', text: 'Fahrzeuge tanken günstiger und schneller an der eigenen Wache.' },
];

const euro = formatEuro;

export interface PersonalAktionen extends AusbildungAktionen {
  ausbildungsAbschluesse: AbgeschlossenerLehrgang[];
  kuendigungen: Kuendigung[];
  baueZufriedenheitsAusbau: (wacheId: string, ausbauId: ZufriedenheitsAusbau['id']) => string | null;
  baueSonderErweiterung: (wacheId: string, erweiterungId: string) => string | null;
  waehleFahrzeugGrafik: (fahrzeugId: string, grafikId: number | undefined) => void;
  waehleFahrzeugFarbe: (fahrzeugId: string, farbe: string | undefined) => void;
  stellePersonalEin: (wacheId: string, bewerber: Bewerber) => string | null;
  wuerfleBewerberNeu: (wacheId: string) => string | null;
  entlassePersonal: (personId: string) => string | null;
  weisePersonalZu: (personId: string, fahrzeugId?: string) => string | null;
  besetzeFahrzeugAutomatisch: (fahrzeugId: string) => string | null;
  baueRuheraum: (wacheId: string) => string | null;
}

type WacheAnpassen = (wacheId: string, aenderung: { name?: string; logoFarbe?: string | null; fahrzeugFarbe?: string | null }) => string | null;

export default function WachenView({
  locations,
  selectedId,
  setSelectedId,
  vehicles,
  personal,
  balance,
  nowMs,
  buyVehicle,
  eigenesKrankenhaus,
  xp,
  benenneFahrzeugUm,
  erweitereStellplaetze,
  passeWacheAn,
  personalAktionen,
  onWacheKaufen,
  verwaltenId,
  setVerwaltenId,
  startFahrzeugId,
}: {
  locations: MapLocation[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  vehicles: Vehicle[];
  personal: Mitarbeiter[];
  balance: number;
  nowMs: number;
  buyVehicle: (stationId: string, typ: string) => string | null;
  /** KTW gibt es erst mit eigenem Krankenhaus */
  eigenesKrankenhaus: boolean;
  /** Erfahrungspunkte – bestimmen, welche Fahrzeuge der Rang schon kaufen darf */
  xp: number;
  benenneFahrzeugUm: (fahrzeugId: string, name: string) => string | null;
  erweitereStellplaetze: (stationId: string) => string | null;
  passeWacheAn: WacheAnpassen;
  personalAktionen: PersonalAktionen;
  onWacheKaufen: () => void;
  /** Gerade verwaltete Wache – liegt in App, damit die Karte direkt eine Wache öffnen kann */
  verwaltenId: string | null;
  setVerwaltenId: (id: string | null) => void;
  /** Von der Karte aus: dieses Fahrzeug gleich aufgeklappt zeigen */
  startFahrzeugId?: string | null;
}) {
  const stations = locations.filter((l) => l.type === 'station');
  const verwaltet = stations.find((s) => s.id === verwaltenId);

  if (verwaltet) {
    return (
      <WacheVerwalten
        key={`${verwaltet.id}|${startFahrzeugId ?? ""}`}
        wache={verwaltet}
        vehicles={vehicles}
        personal={personal}
        personalAktionen={personalAktionen}
        balance={balance}
        nowMs={nowMs}
        buyVehicle={buyVehicle}
        eigenesKrankenhaus={eigenesKrankenhaus}
        xp={xp}
        benenneFahrzeugUm={benenneFahrzeugUm}
        erweitereStellplaetze={erweitereStellplaetze}
        passeWacheAn={passeWacheAn}
        startFahrzeugId={startFahrzeugId ?? null}
        onZurueck={() => setVerwaltenId(null)}
      />
    );
  }

  return (
    <div>
      <div className="wachen-kopf">
        <h2>Wachen</h2>
        <button type="button" className="btn btn--primary" data-tour="wache-kaufen" onClick={onWacheKaufen}>＋ Wache kaufen</button>
      </div>
      {stations.length === 0 && (
        <div className="leerzustand">
          <strong>Noch keine Wache</strong>
          Tippe auf „＋ Wache kaufen“ und such dir einen Standort aus.
        </div>
      )}
      <ul className="wachen-liste">
        {stations.map((s, index) => {
          const belegt = getBelegteStellplaetze(s.id, vehicles);
          const plaetze = getStellplaetze(s);
          return (
            <li key={s.id} className={`wachen-karte ${selectedId === s.id ? 'wachen-karte--aktiv' : ''}`}>
              <Kennzeichen art="wache" wachenArt={s.stationKind} logoFarbe={s.logoFarbe} groesse={40} />
              <button type="button" className="wachen-karte__info" onClick={() => setSelectedId(s.id)}>
                <strong>{s.name}</strong>
                <small>{s.adresse ? formatAdresse(s.adresse) : s.details}</small>
                <small>{s.stationKind ?? 'Rettungswache'} · Stellplätze {belegt}/{plaetze} · Kosten {formatEuro(getWachenKostenJeStunde(s, { vehicles, personal }))}/Std.</small>
              </button>
              <button type="button" className="btn btn--primary" data-tour={index === 0 ? "wache-verwalten" : undefined} onClick={() => setVerwaltenId(s.id)}>
                Verwalten
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Name und Logo-Farbe einer Wache – Vorschau zeigt die Farbe sofort */
function WacheAnpassenFormular({
  wache,
  passeWacheAn,
  onFertig,
  onFehler,
}: {
  wache: MapLocation;
  passeWacheAn: WacheAnpassen;
  onFertig: (text: string) => void;
  onFehler: (text: string) => void;
}) {
  const standard = WACHEN_LOGO_FARBEN[0].farbe;
  const [name, setName] = useState(wache.name);
  const [farbe, setFarbe] = useState<string>(wache.logoFarbe ?? standard);
  const [fahrzeugFarbe, setFahrzeugFarbe] = useState<string | undefined>(wache.fahrzeugFarbe);

  return (
    <form
      className="einsatz-abschnitt wache-anpassen"
      onSubmit={(event) => {
        event.preventDefault();
        const fehler = passeWacheAn(wache.id, { name, logoFarbe: farbe, fahrzeugFarbe: fahrzeugFarbe ?? null });
        if (fehler) onFehler(fehler);
        else onFertig('✓ Wache angepasst.');
      }}
    >
      <h4>Name, Logo und Fahrzeugfarbe</h4>
      <label className="field">
        <span>Name</span>
        <input value={name} maxLength={WACHENNAME_MAX_LAENGE} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field">
        <span>Logo-Farbe</span>
        <div className="wache-anpassen__farben">
          <Kennzeichen art="wache" wachenArt={wache.stationKind} logoFarbe={farbe} groesse={40} />
          {WACHEN_LOGO_FARBEN.map((vorschlag) => (
            <button
              key={vorschlag.farbe}
              type="button"
              className={`wache-anpassen__farbe ${farbe === vorschlag.farbe ? 'wache-anpassen__farbe--aktiv' : ''}`}
              style={{ background: vorschlag.farbe }}
              aria-label={vorschlag.name}
              aria-pressed={farbe === vorschlag.farbe}
              title={vorschlag.name}
              onClick={() => setFarbe(vorschlag.farbe)}
            />
          ))}
          <label className="wache-anpassen__eigene" title="Eigene Farbe">
            <input type="color" value={farbe} onChange={(e) => setFarbe(e.target.value)} aria-label="Eigene Farbe" />
          </label>
        </div>
      </div>
      <div className="field">
        <span>Fahrzeugfarbe (alle Fahrzeuge der Wache)</span>
        <FahrzeugBild typ={wache.stationKind === 'Feuerwache' ? 'HLF 20' : 'RTW'} farbe={fahrzeugFarbe} hoehe={44} />
        <FarbWahl farbe={fahrzeugFarbe} setFarbe={setFahrzeugFarbe} standardText="Standard" />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>Speichern</button>
      </div>
    </form>
  );
}

function WacheVerwalten({
  wache,
  vehicles,
  personal,
  personalAktionen,
  balance,
  nowMs,
  buyVehicle,
  eigenesKrankenhaus,
  xp,
  benenneFahrzeugUm,
  erweitereStellplaetze,
  passeWacheAn,
  startFahrzeugId,
  onZurueck,
}: {
  wache: MapLocation;
  vehicles: Vehicle[];
  personal: Mitarbeiter[];
  personalAktionen: PersonalAktionen;
  balance: number;
  nowMs: number;
  buyVehicle: (stationId: string, typ: string) => string | null;
  /** KTW gibt es erst mit eigenem Krankenhaus */
  eigenesKrankenhaus: boolean;
  /** Erfahrungspunkte – bestimmen, welche Fahrzeuge der Rang schon kaufen darf */
  xp: number;
  benenneFahrzeugUm: (fahrzeugId: string, name: string) => string | null;
  erweitereStellplaetze: (stationId: string) => string | null;
  passeWacheAn: WacheAnpassen;
  startFahrzeugId: string | null;
  onZurueck: () => void;
}) {
  const [reiter, setReiter] = useState<Reiter>(startFahrzeugId ? 'Fahrzeuge' : 'Übersicht');
  const [anpassenOffen, setAnpassenOffen] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [offenesFahrzeug, setOffenesFahrzeug] = useState<string | null>(startFahrzeugId);
  const kaufbareTypen = getFahrzeugTypenFuerWache(wache.stationKind ?? 'Rettungswache');
  const [kaufTyp, setKaufTyp] = useState(kaufbareTypen[0]?.typ ?? '');

  useEffect(() => {
    if (!meldung) return;
    const timeout = setTimeout(() => setMeldung(null), 5000);
    return () => clearTimeout(timeout);
  }, [meldung]);

  const wachenFahrzeuge = vehicles.filter((v) => v.stationId === wache.id);
  const belegt = wachenFahrzeuge.length;
  const plaetze = getStellplaetze(wache);
  const voll = belegt >= plaetze;
  const erweiterungen = getStellplatzErweiterungen(wache);
  const stellplatzPreis = getStellplatzPreis(wache);
  const gewaehlterTyp = getFahrzeugTyp(kaufTyp);
  const kaufSperre = gewaehlterTyp ? getKaufSperre(gewaehlterTyp, wache, eigenesKrankenhaus, xp) : null;
  const sonderErweiterungen = getSonderErweiterungenFuerWache(wache);
  const wachenPersonal = getPersonalDerWache(wache.id, personal);
  const personalLimit = getPersonalLimit(wache);
  const ruheraumStufe = getRuheraumStufe(wache);
  const ruheraumPreis = getRuheraumPreis(wache);
  const nichtBesetzt = wachenFahrzeuge.filter((v) => !istAusreichendBesetzt(v));
  const zufriedenheit = getZufriedenheit(wache, nowMs);
  const stress = Math.round(getStress(wache, nowMs));
  const verzoegerung = getAusrueckVerzoegerung(wache, nowMs);
  const wachenKuendigungen = personalAktionen.kuendigungen.filter((k) => k.wacheId === wache.id);

  const kaufen = () => {
    const fehler = buyVehicle(wache.id, kaufTyp);
    setMeldung(fehler
      ? { art: 'fehler', text: fehler }
      : { art: 'ok', text: `✓ ${kaufTyp} gekauft. Das Fahrzeug ist noch unbesetzt – unter „Personal“ Besatzung zuweisen.` });
  };
  const erweitern = () => {
    const fehler = erweitereStellplaetze(wache.id);
    setMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: '✓ Stellplatz gebaut.' });
  };

  return (
    <div>
      <div className="verwalten-kopf">
        <button type="button" className="btn" onClick={onZurueck}>← Zurück</button>
        <div>
          <h2 className="mit-kennzeichen" style={{ margin: 0 }}>
            <Kennzeichen art="wache" wachenArt={wache.stationKind} logoFarbe={wache.logoFarbe} groesse={32} />{wache.name}
            <button
              type="button"
              className="btn btn--klein"
              aria-expanded={anpassenOffen}
              aria-label="Name und Logo anpassen"
              title="Name und Logo anpassen"
              onClick={() => setAnpassenOffen((offen) => !offen)}
            >
              ✎
            </button>
          </h2>
          <small>{wache.stationKind ?? 'Rettungswache'} · {wache.adresse ? formatAdresse(wache.adresse) : wache.details}</small>
        </div>
      </div>

      {anpassenOffen && (
        <WacheAnpassenFormular
          wache={wache}
          passeWacheAn={passeWacheAn}
          onFertig={(text) => {
            setMeldung({ art: 'ok', text });
            setAnpassenOffen(false);
          }}
          onFehler={(text) => setMeldung({ art: 'fehler', text })}
        />
      )}

      <div className="verwalten-reiter" role="tablist" data-tour="wache-reiter">
        {REITER.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            data-tour={`reiter-${name}`}
            aria-selected={reiter === name}
            className={`btn ${reiter === name ? 'btn--primary' : ''}`}
            onClick={() => setReiter(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {meldung && (
        <div className={meldung.art === 'ok' ? 'aktion-rueckmeldung' : 'versorgung-hinweis versorgung-hinweis--fehlt'} role="status">
          {meldung.text}
        </div>
      )}

      {reiter === 'Übersicht' && (
        <div className="verwalten-kacheln">
          <div className="verwalten-kachel" style={{ gridColumn: '1 / -1' }}>
            <small>Zufriedenheit des Personals</small>
            <strong className={zufriedenheit < ZUFRIEDENHEIT_CONFIG.kuendigungUnter ? 'ruf-minus' : zufriedenheit >= 80 ? 'ruf-plus' : ''}>
              {zufriedenheit} %
            </strong>
            <div className="ruf-fenster__balken" style={{ margin: '4px 0' }} aria-hidden><span style={{ width: `${zufriedenheit}%` }} /></div>
            <small>
              Grundniveau {getGrundZufriedenheit(wache)} % (Aufenthaltsraum, Küche, Fitnessraum unter „Ausbau“)
              {' · '}Stress {stress} {stress > ZUFRIEDENHEIT_CONFIG.stressSchwelle ? '– Dauerstress!' : '(unkritisch)'}
            </small>
            {verzoegerung > 0 && <small className="ruf-minus">Personal rückt {verzoegerung} Sek. langsamer aus.</small>}
            {zufriedenheit < ZUFRIEDENHEIT_CONFIG.kuendigungUnter && (
              <small className="ruf-minus">⚠ Unter {ZUFRIEDENHEIT_CONFIG.kuendigungUnter} %: Es kann zu Kündigungen kommen (selbst Ausgebildete sind treuer).</small>
            )}
          </div>
          <div className="verwalten-kachel">
            <small>Stellplätze</small>
            <strong>{belegt} / {plaetze}</strong>
            {voll && <small>Voll – unter „Ausbau“ erweitern</small>}
          </div>
          <div className="verwalten-kachel">
            <small>Fahrzeuge einsatzbereit</small>
            <strong>{wachenFahrzeuge.filter((v) => (v.status ?? 'Einsatzbereit') === 'Einsatzbereit').length} / {belegt}</strong>
          </div>
          <div className="verwalten-kachel">
            <small>Ausbaustufe Stellplätze</small>
            <strong>{erweiterungen} / {STELLPLATZ_CONFIG.maxErweiterungen}</strong>
          </div>
          <div className="verwalten-kachel">
            <small>Personal</small>
            <strong>{wachenPersonal.length} / {personalLimit}</strong>
          </div>
          <div className="verwalten-kachel">
            <small>Laufende Kosten</small>
            <strong>{formatEuro(getWachenKostenJeStunde(wache, { vehicles, personal }))} / Std.</strong>
            <small>Gehälter, Fahrzeuge und Unterhalt</small>
          </div>
          <div className="verwalten-kachel">
            <small>Fahrzeuge nicht alarmierbar</small>
            <strong>{nichtBesetzt.length}</strong>
            {nichtBesetzt.length > 0 && <small>Besatzung fehlt – siehe „Personal“</small>}
          </div>
        </div>
      )}

      {reiter === 'Fahrzeuge' && (
        <>
          <section className="einsatz-abschnitt">
            <h4>Fahrzeuge der Wache ({belegt}/{plaetze} Stellplätze)</h4>
            {wachenFahrzeuge.length === 0 ? (
              <p className="einsatz-eintrag__zeile">Noch keine Fahrzeuge vorhanden.</p>
            ) : (
              <>
              <ul className="fahrzeug-liste">
                {wachenFahrzeuge.map((v) => (
                  <li key={v.id} className={offenesFahrzeug === v.id ? 'fahrzeug-liste__eintrag--offen' : undefined}>
                    <button
                      type="button"
                      className="fahrzeug-liste__kopf"
                      aria-expanded={offenesFahrzeug === v.id}
                      onClick={() => setOffenesFahrzeug(offenesFahrzeug === v.id ? null : v.id)}
                    >
                      <span>
                        <strong className="mit-kennzeichen"><Kennzeichen art="fahrzeug" typ={v.type} fahrzeug={v} groesse={24} />{v.callsign ?? v.name}</strong> – {v.type ?? '–'} · S{FMS_STATUS[v.status ?? 'Einsatzbereit']} {v.status ?? 'Einsatzbereit'}
                        {!istAusreichendBesetzt(v) && <span className="ruf-minus"> · nicht besetzt</span>}
                      </span>
                      <span aria-hidden>{offenesFahrzeug === v.id ? '▴' : '✎'}</span>
                    </button>
                    {offenesFahrzeug === v.id && (
                      <FahrzeugBearbeiten
                        fahrzeug={v}
                        wachenPersonal={wachenPersonal}
                        benenneFahrzeugUm={benenneFahrzeugUm}
                        weisePersonalZu={personalAktionen.weisePersonalZu}
                        besetzeFahrzeugAutomatisch={personalAktionen.besetzeFahrzeugAutomatisch}
                        waehleFahrzeugGrafik={personalAktionen.waehleFahrzeugGrafik}
                        waehleFahrzeugFarbe={personalAktionen.waehleFahrzeugFarbe}
                        onMeldung={setMeldung}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <small className="einsatz-eintrag__zeile">Tippe auf ein Fahrzeug, um es zu bearbeiten (Name, Besatzung).</small>
              </>
            )}
          </section>

          <section className="einsatz-abschnitt">
            <h4>Fahrzeug kaufen</h4>
            {voll ? (
              <div className="versorgung-hinweis versorgung-hinweis--fehlt">
                Alle Stellplätze sind belegt.{' '}
                <button type="button" className="btn btn--secondary" onClick={() => setReiter('Ausbau')}>Zum Ausbau</button>
              </div>
            ) : (
              <>
                <ul className="kauf-raster">
                  {kaufbareTypen.map((fahrzeugTyp) => {
                    const sperre = getKaufSperre(fahrzeugTyp, wache, eigenesKrankenhaus, xp);
                    const erweiterung = fahrzeugTyp.brauchtErweiterung ? getSonderErweiterung(fahrzeugTyp.brauchtErweiterung) : undefined;
                    return (
                      <li key={fahrzeugTyp.typ}>
                        <button
                          type="button"
                          className={`kauf-karte ${kaufTyp === fahrzeugTyp.typ ? 'kauf-karte--gewaehlt' : ''} ${sperre ? 'kauf-karte--gesperrt' : ''}`}
                          aria-pressed={kaufTyp === fahrzeugTyp.typ}
                          onClick={() => setKaufTyp(fahrzeugTyp.typ)}
                        >
                          <FahrzeugBild typ={fahrzeugTyp.typ} hoehe={40} />
                          <strong>{fahrzeugTyp.typ}</strong>
                          <small>{euro(fahrzeugTyp.preis)}</small>
                          {sperre && <small className="kauf-karte__sperre">🔒 {erweiterung && !sperre.startsWith('ab Rang') ? erweiterung.name : sperre}</small>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {gewaehlterTyp && (
                  <div className="kauf-auswahl">
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, flex: '1 1 240px' }}>
                      <strong style={{ color: 'var(--color-text)' }}>{gewaehlterTyp.bezeichnung}</strong> – {gewaehlterTyp.beschreibung}
                      <br />
                      {gewaehlterTyp.besatzung} Sitze (ausrücken ab {getMindestBesatzung(gewaehlterTyp.typ)}) · {gewaehlterTyp.geschwindigkeitKmh} km/h
                      {' · '}{gewaehlterTyp.faehigkeiten.map((f) => FAEHIGKEIT_LABELS[f]).join(', ')}
                    </p>
                    {kaufSperre ? (
                      kaufSperre.startsWith('ab Rang') ? (
                        <button type="button" className="btn btn--secondary" disabled>🔒 {kaufSperre[0].toUpperCase()}{kaufSperre.slice(1)}</button>
                      ) : (
                        <button type="button" className="btn btn--secondary" onClick={() => setReiter('Ausbau')} disabled={!gewaehlterTyp.brauchtErweiterung}>
                          {gewaehlterTyp.brauchtErweiterung ? `Erst „${getSonderErweiterung(gewaehlterTyp.brauchtErweiterung)?.name}“ bauen` : 'Erst mit eigenem Krankenhaus'}
                        </button>
                      )
                    ) : (
                      <button className="btn btn--primary" type="button" disabled={balance < gewaehlterTyp.preis} onClick={kaufen}>
                        {balance < gewaehlterTyp.preis ? `Es fehlen ${euro(gewaehlterTyp.preis - balance)}` : `${gewaehlterTyp.typ} kaufen · ${euro(gewaehlterTyp.preis)}`}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {reiter === 'Ausbau' && (
        <div className="ausbau-raster">
          <article className="ausbau-karte">
            <span className="ausbau-karte__kategorie">Stellplätze</span>
            <h3>Stellplatz erweitern</h3>
            <p>Schafft Platz für ein weiteres Einsatzfahrzeug. Aktuell {plaetze} Stellplätze ({erweiterungen}/{STELLPLATZ_CONFIG.maxErweiterungen} Erweiterungen).</p>
            {stellplatzPreis === null ? (
              <div className="aktion-rueckmeldung">Voll ausgebaut</div>
            ) : (
              <>
                <div className="ausbau-karte__preis">{euro(stellplatzPreis)}</div>
                <button type="button" className="btn btn--primary" disabled={balance < stellplatzPreis} onClick={erweitern}>
                  {balance < stellplatzPreis ? `Es fehlen ${euro(stellplatzPreis - balance)}` : 'Erweitern'}
                </button>
              </>
            )}
          </article>
          <article className="ausbau-karte">
            <span className="ausbau-karte__kategorie">Aufenthalt & Personal</span>
            <h3>Ruheräume</h3>
            <p>
              +{RUHERAUM_CONFIG.plaetzeJeStufe[wache.stationKind ?? 'Rettungswache']} Personal-Plätze je Stufe.
              Aktuell {personalLimit} Plätze ({ruheraumStufe}/{RUHERAUM_CONFIG.maxStufe} Stufen).
            </p>
            {ruheraumPreis === null ? (
              <div className="aktion-rueckmeldung">Voll ausgebaut</div>
            ) : (
              <>
                <div className="ausbau-karte__preis">{euro(ruheraumPreis)}</div>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={balance < ruheraumPreis}
                  onClick={() => {
                    const fehler = personalAktionen.baueRuheraum(wache.id);
                    setMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: '✓ Ruheräume ausgebaut.' });
                  }}
                >
                  {balance < ruheraumPreis ? `Es fehlen ${euro(ruheraumPreis - balance)}` : 'Ausbauen'}
                </button>
              </>
            )}
          </article>
          {ZUFRIEDENHEITS_AUSBAUTEN.map((ausbau) => {
            const stufe = getAusbauStufe(wache, ausbau.id);
            const preis = getZufriedenheitsAusbauPreis(wache, ausbau);
            return (
              <article key={ausbau.id} className="ausbau-karte">
                <span className="ausbau-karte__kategorie">Zufriedenheit</span>
                <h3>{ausbau.name}</h3>
                <p>{ausbau.text} +{ausbau.bonusJeStufe} % Zufriedenheit je Stufe ({stufe}/{ausbau.maxStufe}).</p>
                {preis === null ? (
                  <div className="aktion-rueckmeldung">Voll ausgebaut</div>
                ) : (
                  <>
                    <div className="ausbau-karte__preis">{euro(preis)}</div>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={balance < preis}
                      onClick={() => {
                        const fehler = personalAktionen.baueZufriedenheitsAusbau(wache.id, ausbau.id);
                        setMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: `✓ ${ausbau.name} ausgebaut.` });
                      }}
                    >
                      {balance < preis ? `Es fehlen ${euro(preis - balance)}` : stufe === 0 ? 'Bauen' : 'Ausbauen'}
                    </button>
                  </>
                )}
              </article>
            );
          })}
          {sonderErweiterungen.map((erweiterung) => {
            const gebaut = hatSonderErweiterung(wache, erweiterung.id);
            const fahrzeuge = kaufbareTypen.filter((t) => t.brauchtErweiterung === erweiterung.id);
            return (
              <article key={erweiterung.id} className="ausbau-karte">
                <span className="ausbau-karte__kategorie">Sonderfahrzeuge</span>
                <h3>{erweiterung.name}</h3>
                <p>{erweiterung.text}</p>
                <div className="ausbau-karte__fahrzeuge">
                  {fahrzeuge.map((t) => (
                    <span key={t.typ} className="mit-kennzeichen"><FahrzeugBild typ={t.typ} hoehe={22} /><small>{t.typ}</small></span>
                  ))}
                </div>
                {gebaut ? (
                  <div className="aktion-rueckmeldung">✓ Gebaut</div>
                ) : (
                  <>
                    <div className="ausbau-karte__preis">{euro(erweiterung.preis)}</div>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={balance < erweiterung.preis}
                      onClick={() => {
                        const fehler = personalAktionen.baueSonderErweiterung(wache.id, erweiterung.id);
                        setMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: `✓ ${erweiterung.name} gebaut – neue Fahrzeuge unter „Fahrzeuge“.` });
                      }}
                    >
                      {balance < erweiterung.preis ? `Es fehlen ${euro(erweiterung.preis - balance)}` : 'Bauen'}
                    </button>
                  </>
                )}
              </article>
            );
          })}
          {GEPLANTE_AUSBAUTEN.map((ausbau) => (
            <article key={ausbau.name} className="ausbau-karte ausbau-karte--gesperrt">
              <span className="ausbau-karte__kategorie">Folgt</span>
              <h3>{ausbau.name}</h3>
              <p>{ausbau.text}</p>
            </article>
          ))}
        </div>
      )}

      {reiter === 'Ausbildung' && (
        <AusbildungReiter
          wache={wache}
          personal={wachenPersonal}
          fahrzeuge={wachenFahrzeuge}
          balance={balance}
          nowMs={nowMs}
          abschluesse={personalAktionen.ausbildungsAbschluesse}
          onMeldung={setMeldung}
          aktionen={personalAktionen}
        />
      )}

      {reiter === 'Personal' && (
        <PersonalReiter
          wache={wache}
          fahrzeuge={wachenFahrzeuge}
          personal={wachenPersonal}
          balance={balance}
          {...personalAktionen}
          zufriedenheit={zufriedenheit}
          kuendigungen={wachenKuendigungen}
          onMeldung={setMeldung}
        />
      )}
    </div>
  );
}
