import { useEffect, useState } from 'react';
import {
  FAEHIGKEIT_LABELS,
  FMS_STATUS,
  STELLPLATZ_CONFIG,
  formatAdresse,
  getBelegteStellplaetze,
  getFahrzeugTyp,
  getFahrzeugTypenFuerWache,
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
  stellePersonalEin: (wacheId: string, bewerber: Bewerber) => string | null;
  wuerfleBewerberNeu: (wacheId: string) => string | null;
  entlassePersonal: (personId: string) => string | null;
  weisePersonalZu: (personId: string, fahrzeugId?: string) => string | null;
  besetzeFahrzeugAutomatisch: (fahrzeugId: string) => string | null;
  baueRuheraum: (wacheId: string) => string | null;
}

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
  benenneFahrzeugUm,
  erweitereStellplaetze,
  personalAktionen,
  onWacheKaufen,
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
  benenneFahrzeugUm: (fahrzeugId: string, name: string) => string | null;
  erweitereStellplaetze: (stationId: string) => string | null;
  personalAktionen: PersonalAktionen;
  onWacheKaufen: () => void;
}) {
  const stations = locations.filter((l) => l.type === 'station');
  const [verwaltenId, setVerwaltenId] = useState<string | null>(null);
  const verwaltet = stations.find((s) => s.id === verwaltenId);

  if (verwaltet) {
    return (
      <WacheVerwalten
        wache={verwaltet}
        vehicles={vehicles}
        personal={personal}
        personalAktionen={personalAktionen}
        balance={balance}
        nowMs={nowMs}
        buyVehicle={buyVehicle}
        eigenesKrankenhaus={eigenesKrankenhaus}
        benenneFahrzeugUm={benenneFahrzeugUm}
        erweitereStellplaetze={erweitereStellplaetze}
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
              <button type="button" className="wachen-karte__info" onClick={() => setSelectedId(s.id)}>
                <strong>{s.stationKind === 'Feuerwache' ? '🚒' : '🚑'} {s.name}</strong>
                <small>{s.adresse ? formatAdresse(s.adresse) : s.details}</small>
                <small>{s.stationKind ?? 'Rettungswache'} · Stellplätze {belegt}/{plaetze}</small>
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

function WacheVerwalten({
  wache,
  vehicles,
  personal,
  personalAktionen,
  balance,
  nowMs,
  buyVehicle,
  eigenesKrankenhaus,
  benenneFahrzeugUm,
  erweitereStellplaetze,
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
  benenneFahrzeugUm: (fahrzeugId: string, name: string) => string | null;
  erweitereStellplaetze: (stationId: string) => string | null;
  onZurueck: () => void;
}) {
  const [reiter, setReiter] = useState<Reiter>('Übersicht');
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [offenesFahrzeug, setOffenesFahrzeug] = useState<string | null>(null);
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
          <h2 style={{ margin: 0 }}>{wache.stationKind === 'Feuerwache' ? '🚒' : '🚑'} {wache.name}</h2>
          <small>{wache.stationKind ?? 'Rettungswache'} · {wache.adresse ? formatAdresse(wache.adresse) : wache.details}</small>
        </div>
      </div>

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
                        <strong>{v.callsign ?? v.name}</strong> – {v.type ?? '–'} · S{FMS_STATUS[v.status ?? 'Einsatzbereit']} {v.status ?? 'Einsatzbereit'}
                        {!istAusreichendBesetzt(v) && <span className="ruf-minus"> · nicht besetzt</span>}
                      </span>
                      <span aria-hidden>{offenesFahrzeug === v.id ? '▴' : '✏️'}</span>
                    </button>
                    {offenesFahrzeug === v.id && (
                      <FahrzeugBearbeiten
                        fahrzeug={v}
                        wachenPersonal={wachenPersonal}
                        benenneFahrzeugUm={benenneFahrzeugUm}
                        weisePersonalZu={personalAktionen.weisePersonalZu}
                        besetzeFahrzeugAutomatisch={personalAktionen.besetzeFahrzeugAutomatisch}
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="field" style={{ flex: '1 1 160px' }}>
                    <select value={kaufTyp} onChange={(e) => setKaufTyp(e.target.value)}>
                      {kaufbareTypen.map((fahrzeugTyp) => {
                        const gesperrt = fahrzeugTyp.brauchtEigenesKrankenhaus && !eigenesKrankenhaus;
                        return (
                          <option key={fahrzeugTyp.typ} value={fahrzeugTyp.typ} disabled={gesperrt}>
                            {fahrzeugTyp.typ} – {euro(fahrzeugTyp.preis)}{gesperrt ? ' (erst mit eigenem Krankenhaus)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <button
                    className="btn btn--primary"
                    type="button"
                    disabled={!gewaehlterTyp || balance < gewaehlterTyp.preis}
                    onClick={kaufen}
                  >
                    Kaufen
                  </button>
                </div>
                {gewaehlterTyp && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {gewaehlterTyp.bezeichnung} · {gewaehlterTyp.besatzung} Personen · {gewaehlterTyp.geschwindigkeitKmh} km/h
                    {' · '}{gewaehlterTyp.faehigkeiten.map((f) => FAEHIGKEIT_LABELS[f]).join(', ')}
                  </p>
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
