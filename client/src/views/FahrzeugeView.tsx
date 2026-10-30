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

type Reiter = 'Katalog' | 'Meine Fahrzeuge';
type Filter = 'Alle' | 'Feuerwehr' | 'Rettungsdienst';

/** Einsätze, bei denen dieser Typ einen angeforderten Platz füllen kann */
const einsaetzeFuer = (typ: string) =>
  ALLE_EINSATZ_VORLAGEN.filter((vorlage) => vorlage.requiredVehicles.some((bedarf) => fahrzeugErfuelltBedarf(typ, bedarf.category)));

export default function FahrzeugeView({
  vehicles,
  stations,
  grafiken: auswahl,
  waehleTypGrafik,
  konto,
  gast,
}: {
  vehicles: Vehicle[];
  stations: MapLocation[];
  grafiken: GrafikAuswahl;
  waehleTypGrafik: (typ: string, grafikId: number | undefined) => void;
  konto: Konto;
  gast: boolean;
}) {
  const [reiter, setReiter] = useState<Reiter>('Katalog');
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
      <h2>Fahrzeuge</h2>
      <div className="aao-reiter" role="tablist" style={{ marginBottom: 12 }}>
        {(['Katalog', 'Meine Fahrzeuge'] as Reiter[]).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={reiter === r} className={`btn ${reiter === r ? 'btn--primary' : ''}`} onClick={() => setReiter(r)}>
            {r}{r === 'Meine Fahrzeuge' ? ` (${vehicles.length})` : ''}
          </button>
        ))}
      </div>

      {reiter === 'Katalog' && (
        <>
          <p className="einsatz-eintrag__zeile" style={{ marginTop: 0 }}>
            Alle {FAHRZEUG_TYPEN.length} Fahrzeugtypen mit ihren Daten. Tippe auf ein Fahrzeug, um seine Grafik zu wählen –
            die Grafiken laden Spieler hoch und alle können sie verwenden.
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

      {reiter === 'Meine Fahrzeuge' && (
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
      setMeldung({ art: 'ok', text: '✓ Hochgeladen und für deine Fahrzeuge gewählt.' });
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
        <dt>Gebraucht bei</dt>
        <dd>
          {einsaetze.length === 0 ? '–' : einsaetze.slice(0, 8).map((v) => v.meldebild).join(', ')}
          {einsaetze.length > 8 && ` und ${einsaetze.length - 8} weiteren`}
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
              von={grafik.vonName}
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
