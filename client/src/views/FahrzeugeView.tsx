import { useMemo, useState } from 'react';
import {
  ALLE_EINSATZ_VORLAGEN,
  FAEHIGKEIT_LABELS,
  FAHRZEUGGRAFIK_NAME_MAX_LAENGE,
  FMS_STATUS,
  QUALIFIKATION_LABELS,
  FAHRZEUG_TYPEN,
  fahrzeugErfuelltBedarf,
  formatEuro,
  getFahrzeugTyp,
  getKaufSperre,
  getMindestBesatzung,
  getSonderErweiterung,
  istTeamRolle,
  type FahrzeugTyp,
  type Fahrzeuggrafik,
  type GrafikAuswahl,
  type Konto,
} from '@leitstellendispo/shared';
import type { MapLocation, Vehicle } from '../types';
import { FahrzeugBild, bereiteFahrzeuggrafikVor, useFahrzeuggrafiken } from '../fahrzeugGrafik';

type Filter = 'Alle' | 'Feuerwehr' | 'Rettungsdienst';

/** Einsätze, bei denen dieser Typ einen angeforderten Platz füllen kann */
const einsaetzeFuer = (typ: string) =>
  ALLE_EINSATZ_VORLAGEN.filter((vorlage) => vorlage.requiredVehicles.some((bedarf) => fahrzeugErfuelltBedarf(typ, bedarf.category)));

/** Zwei Menüpunkte: „Fahrzeuge“ (eigene Flotte) und „Fahrzeugkatalog“ (alle Typen mit Grafiken) */
/** Ob der Spieler diesen Typ jetzt kaufen kann: an welchen Wachen, sonst was noch fehlt */
function getKaufStatus(typ: FahrzeugTyp, stations: MapLocation[], eigenesKrankenhaus: boolean): { kaufbarAn: string[]; fehlt: string[] } {
  const passende = stations.filter((s) => (s.stationKind ?? 'Rettungswache') === typ.wachenArt);
  const kaufbarAn = passende.filter((s) => !getKaufSperre(typ, s, eigenesKrankenhaus)).map((s) => s.name);
  if (kaufbarAn.length > 0) return { kaufbarAn, fehlt: [] };
  const fehlt: string[] = [];
  if (passende.length === 0) fehlt.push(`eine ${typ.wachenArt}`);
  if (typ.brauchtEigenesKrankenhaus && !eigenesKrankenhaus) fehlt.push('ein eigenes Krankenhaus');
  const erweiterung = typ.brauchtErweiterung ? getSonderErweiterung(typ.brauchtErweiterung) : undefined;
  if (erweiterung) fehlt.push(`die Erweiterung „${erweiterung.name}“ an einer ${typ.wachenArt} (${formatEuro(erweiterung.preis)}, unter Wachen → Ausbau)`);
  return { kaufbarAn, fehlt };
}

export default function FahrzeugeView({
  bereich,
  eigenesKrankenhaus,
  vehicles,
  stations,
  grafiken: auswahl,
  waehleTypGrafik,
  konto,
  gast,
}: {
  bereich: 'Fahrzeuge' | 'Fahrzeugkatalog';
  eigenesKrankenhaus: boolean;
  vehicles: Vehicle[];
  stations: MapLocation[];
  grafiken: GrafikAuswahl;
  waehleTypGrafik: (typ: string, grafikId: number | undefined) => void;
  konto: Konto;
  gast: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('Alle');
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const katalog = useFahrzeuggrafiken();

  const anzahlGrafiken = useMemo(() => {
    const zaehler = new Map<string, number>();
    katalog.grafiken?.forEach((g) => zaehler.set(g.fahrzeugTyp, (zaehler.get(g.fahrzeugTyp) ?? 0) + 1));
    return zaehler;
  }, [katalog.grafiken]);

  const begriff = suche.trim().toLowerCase();
  const typen = FAHRZEUG_TYPEN.filter((typ) => (filter === 'Alle' || typ.organisation === filter)
    && (!begriff || `${typ.typ} ${typ.bezeichnung}`.toLowerCase().includes(begriff)));
  const offenerTyp = offen ? getFahrzeugTyp(offen) : undefined;

  return (
    <div>
      <h2>{bereich === 'Fahrzeuge' ? `Meine Fahrzeuge (${vehicles.length})` : 'Fahrzeugkatalog'}</h2>

      {bereich === 'Fahrzeugkatalog' && (
        <>
          <p className="einsatz-eintrag__zeile" style={{ marginTop: 0 }}>
            Alle {FAHRZEUG_TYPEN.length} Fahrzeugtypen mit ihren Daten. Tippe auf ein Fahrzeug, um zu sehen, was es kann, wofür es
            alarmiert wird und was du zum Kaufen brauchst – und um seine Grafik zu wählen.
          </p>
          <div className="katalog-filter">
            {(['Alle', 'Feuerwehr', 'Rettungsdienst'] as Filter[]).map((f) => (
              <button key={f} type="button" className={`btn btn--klein ${filter === f ? 'btn--primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
            <label className="field" style={{ margin: 0, flex: '1 1 160px' }}>
              <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen, z. B. HLF" aria-label="Fahrzeug suchen" />
            </label>
          </div>

          {offenerTyp && (
            <FahrzeugDetail
              typ={offenerTyp}
              kaufStatus={getKaufStatus(offenerTyp, stations, eigenesKrankenhaus)}
              gewaehlt={auswahl[offenerTyp.typ]}
              waehle={(id) => waehleTypGrafik(offenerTyp.typ, id)}
              grafiken={(katalog.grafiken ?? []).filter((g) => g.fahrzeugTyp === offenerTyp.typ)}
              ladeFehler={katalog.fehler}
              hochladen={katalog.hochladen}
              loeschen={katalog.loeschen}
              konto={konto}
              gast={gast}
              onSchliessen={() => setOffen(null)}
            />
          )}

          <ul className="katalog-raster">
            {typen.map((typ) => (
              <li key={typ.typ}>
                <button
                  type="button"
                  className={`katalog-karte ${offen === typ.typ ? 'katalog-karte--offen' : ''}`}
                  onClick={() => { setOffen(offen === typ.typ ? null : typ.typ); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <FahrzeugBild typ={typ.typ} hoehe={56} />
                  <strong>{typ.typ}</strong>
                  <small>{typ.bezeichnung}</small>
                  <span className="katalog-karte__daten">
                    {formatEuro(typ.preis)} · {getMindestBesatzung(typ.typ)}–{typ.besatzung} Pers. · {typ.geschwindigkeitKmh} km/h
                  </span>
                  <span className="katalog-karte__marken">
                    {getKaufStatus(typ, stations, eigenesKrankenhaus).kaufbarAn.length > 0
                      ? <span className="katalog-marke katalog-marke--kaufbar">✓ Kaufbar</span>
                      : <span className="katalog-marke katalog-marke--gesperrt">🔒 Gesperrt</span>}
                    {typ.brauchtErweiterung && <span className="katalog-marke">{getSonderErweiterung(typ.brauchtErweiterung)?.name}</span>}
                    {typ.brauchtEigenesKrankenhaus && <span className="katalog-marke">Eigenes Krankenhaus</span>}
                    {(anzahlGrafiken.get(typ.typ) ?? 0) > 0 && <span className="katalog-marke katalog-marke--grafik">{anzahlGrafiken.get(typ.typ)} Grafiken</span>}
                  </span>
                </button>
              </li>
            ))}
            {typen.length === 0 && <li className="einsatz-eintrag__zeile">Kein Fahrzeug gefunden.</li>}
          </ul>
        </>
      )}

      {bereich === 'Fahrzeuge' && (
        <ul className="meine-fahrzeuge">
          {vehicles.map((v) => {
            const typ = getFahrzeugTyp(v.type);
            return (
              <li key={v.id} className="meine-fahrzeuge__eintrag">
                <FahrzeugBild fahrzeug={v} hoehe={40} />
                <div>
                  <strong>{v.callsign ?? v.name}</strong> <small>{typ?.bezeichnung ?? v.type ?? '–'}</small>
                  <div className="einsatz-eintrag__zeile">
                    S{FMS_STATUS[v.status ?? 'Einsatzbereit']} {v.status ?? 'Einsatzbereit'}
                    {typ && ` · Besatzung ${v.besatzung ?? typ.besatzung}/${typ.besatzung}`}
                    {' · '}{v.stationId ? (stations.find((s) => s.id === v.stationId)?.name ?? v.stationId) : 'Nicht zugeordnet'}
                  </div>
                </div>
              </li>
            );
          })}
          {vehicles.length === 0 && <li className="einsatz-eintrag__zeile">Keine Fahrzeuge vorhanden.</li>}
        </ul>
      )}
    </div>
  );
}

function FahrzeugDetail({
  typ,
  kaufStatus,
  gewaehlt,
  waehle,
  grafiken,
  ladeFehler,
  hochladen,
  loeschen,
  konto,
  gast,
  onSchliessen,
}: {
  typ: FahrzeugTyp;
  kaufStatus: { kaufbarAn: string[]; fehlt: string[] };
  gewaehlt: number | undefined;
  waehle: (id: number | undefined) => void;
  grafiken: Fahrzeuggrafik[];
  ladeFehler: string | null;
  hochladen: (name: string, fahrzeugTyp: string, daten: string) => Promise<Fahrzeuggrafik>;
  loeschen: (id: number) => Promise<void>;
  konto: Konto;
  gast: boolean;
  onSchliessen: () => void;
}) {
  const [name, setName] = useState('');
  const [datei, setDatei] = useState<File | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [alleEinsaetze, setAlleEinsaetze] = useState(false);
  const einsaetze = einsaetzeFuer(typ.typ);
  const erweiterung = typ.brauchtErweiterung ? getSonderErweiterung(typ.brauchtErweiterung) : undefined;
  const team = istTeamRolle(konto.rolle);

  const senden = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!datei) return;
    setLaeuft(true);
    setMeldung(null);
    try {
      const grafik = await hochladen(name.trim(), typ.typ, await bereiteFahrzeuggrafikVor(datei));
      waehle(grafik.id);
      setName('');
      setDatei(null);
      setMeldung({ art: 'ok', text: '✓ Hochgeladen und für deine Fahrzeuge gewählt. Andere Spieler sehen die Grafik, sobald das Team sie freigegeben hat.' });
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : 'Hochladen fehlgeschlagen.' });
    } finally {
      setLaeuft(false);
    }
  };

  const entfernen = async (grafik: Fahrzeuggrafik) => {
    if (!window.confirm(`Grafik „${grafik.name}“ wirklich löschen? Sie verschwindet für alle Spieler.`)) return;
    try {
      await loeschen(grafik.id);
      if (gewaehlt === grafik.id) waehle(undefined);
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : 'Löschen fehlgeschlagen.' });
    }
  };

  return (
    <section className="einsatz-abschnitt fahrzeug-detail">
      <div className="fahrzeug-detail__kopf">
        <FahrzeugBild typ={typ.typ} hoehe={84} />
        <div>
          <h3 style={{ margin: 0 }}>{typ.typ} <small>{typ.bezeichnung}</small></h3>
          <p style={{ margin: '4px 0' }}>{typ.beschreibung}</p>
          <small className="einsatz-eintrag__zeile">
            {typ.organisation} · {formatEuro(typ.preis)} · Besatzung {typ.besatzung} (ausrücken ab {getMindestBesatzung(typ.typ)}) · {typ.geschwindigkeitKmh} km/h
          </small>
        </div>
        <button type="button" className="btn btn--klein" onClick={onSchliessen} aria-label="Schließen">✕</button>
      </div>

      <dl className="fahrzeug-detail__daten">
        <dt>Kann</dt>
        <dd>{typ.faehigkeiten.map((f) => FAEHIGKEIT_LABELS[f]).join(', ')}</dd>
        <dt>Pflicht an Bord</dt>
        <dd>{typ.pflichtQualifikationen?.length ? typ.pflichtQualifikationen.map((q) => QUALIFIKATION_LABELS[q]).join(', ') : 'Keine besondere Ausbildung'}</dd>
        <dt>Kaufen</dt>
        <dd>
          an einer {typ.wachenArt}
          {erweiterung && <> mit der Erweiterung „{erweiterung.name}“ ({formatEuro(erweiterung.preis)})</>}
          {typ.brauchtEigenesKrankenhaus && ' – erst mit eigenem Krankenhaus'}
          {typ.keinStartfahrzeug ? '' : ' · auch als Startfahrzeug'}
        </dd>
        <dt>Für dich</dt>
        <dd>
          {kaufStatus.kaufbarAn.length > 0
            ? <span className="ruf-plus">✓ Kaufbar an: {kaufStatus.kaufbarAn.join(', ')} (unter Wachen → Fahrzeuge)</span>
            : <span className="ruf-minus">🔒 Noch gesperrt – dir fehlt {kaufStatus.fehlt.join(' und ')}</span>}
        </dd>
        <dt>Alarmiert bei ({einsaetze.length})</dt>
        <dd>
          {einsaetze.length === 0 ? '–' : (alleEinsaetze ? einsaetze : einsaetze.slice(0, 8)).map((v) => v.meldebild).join(', ')}
          {einsaetze.length > 8 && (
            <>
              {' '}
              <button type="button" className="btn btn--klein" onClick={() => setAlleEinsaetze(!alleEinsaetze)}>
                {alleEinsaetze ? 'Weniger' : `Alle ${einsaetze.length} zeigen`}
              </button>
            </>
          )}
        </dd>
      </dl>

      <h4>Grafik wählen</h4>
      {ladeFehler && <small className="ruf-minus">Grafiken konnten nicht geladen werden: {ladeFehler}</small>}
      <ul className="grafik-galerie">
        <li>
          <GrafikKarte titel="Standard" von="LeitstellenDispo" aktiv={gewaehlt === undefined} onWaehlen={() => waehle(undefined)}>
            <FahrzeugBild typ={typ.typ} standard hoehe={64} />
          </GrafikKarte>
        </li>
        {grafiken.map((grafik) => (
          <li key={grafik.id}>
            <GrafikKarte
              titel={grafik.name}
              von={grafik.geprueft ? grafik.vonName : `${grafik.vonName} · wartet auf Freigabe`}
              aktiv={gewaehlt === grafik.id}
              onWaehlen={() => waehle(grafik.id)}
              onLoeschen={(grafik.vonId === konto.id && !gast) || team ? () => entfernen(grafik) : undefined}
            >
              <FahrzeugBild typ={typ.typ} grafikId={grafik.id} hoehe={64} />
            </GrafikKarte>
          </li>
        ))}
      </ul>

      <h4>Eigene Grafik hochladen</h4>
      {gast ? (
        <small className="einsatz-eintrag__zeile">Zum Hochladen brauchst du ein Konto.</small>
      ) : (
        <form className="grafik-hochladen" onSubmit={senden}>
          <label className="field" style={{ margin: 0, flex: '1 1 180px' }}>
            <input
              value={name}
              maxLength={FAHRZEUGGRAFIK_NAME_MAX_LAENGE}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Name, z. B. „${typ.typ} Wache Nord“`}
              aria-label="Name der Grafik"
              required
            />
          </label>
          <label className="field" style={{ margin: 0, flex: '1 1 180px' }}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} aria-label="Bilddatei" />
          </label>
          <button type="submit" className="btn btn--primary" disabled={!datei || !name.trim() || laeuft}>{laeuft ? 'Lädt …' : 'Hochladen'}</button>
          <small className="einsatz-eintrag__zeile" style={{ flexBasis: '100%' }}>
            Am besten eine Seitenansicht mit transparentem Hintergrund (PNG/WebP). Die Grafik ist für alle Spieler sichtbar – lade nur Bilder hoch,
            die du selbst gemacht hast oder verwenden darfst. Unpassende Bilder entfernt das Team.
          </small>
        </form>
      )}
      {meldung && <div className={`aktion-rueckmeldung ${meldung.art === 'fehler' ? 'ruf-minus' : ''}`}>{meldung.text}</div>}
    </section>
  );
}

function GrafikKarte({ titel, von, aktiv, onWaehlen, onLoeschen, children }: {
  titel: string;
  von: string;
  aktiv: boolean;
  onWaehlen: () => void;
  onLoeschen?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`grafik-karte ${aktiv ? 'grafik-karte--aktiv' : ''}`}>
      <strong className="grafik-karte__titel">{titel}</strong>
      {children}
      <small className="grafik-karte__von">von {von}</small>
      <div className="grafik-karte__knoepfe">
        <button type="button" className={`btn btn--klein ${aktiv ? '' : 'btn--primary'}`} disabled={aktiv} onClick={onWaehlen}>
          {aktiv ? '✓ Aktiv' : 'Verwenden'}
        </button>
        {onLoeschen && <button type="button" className="btn btn--klein" onClick={onLoeschen} aria-label={`${titel} löschen`} title="Löschen">🗑</button>}
      </div>
    </div>
  );
}
