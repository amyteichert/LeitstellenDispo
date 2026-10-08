import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  EIGENES_KRANKENHAUS,
  FACHRICHTUNGEN,
  getBelegteBetten,
  getBetten,
  getFachrichtungen,
  haversineKm,
  pruefeBettenAusbau,
  pruefeFachrichtung,
  pruefeKrankenhausBau,
  type Fachrichtung,
  type Krankenhaus,
  type MapLocation,
} from '@leitstellendispo/shared';

const euro = (betrag: number) => `${betrag.toLocaleString('de-DE')} €`;

const punkt = (farbe: string) =>
  L.divIcon({ className: '', html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${farbe};border:2px solid #fff"></span>`, iconSize: [16, 16] });

function KlickAufKarte({ onKlick }: { onKlick: (coords: [number, number]) => void }) {
  useMapEvents({ click: (event) => onKlick([event.latlng.lat, event.latlng.lng]) });
  return null;
}

interface Aktionen {
  baueKrankenhaus: (name: string, coords: [number, number]) => string | null;
  schalteFachrichtungFrei: (krankenhausId: string, fachrichtung: Fachrichtung) => string | null;
  baueBettenAus: (krankenhausId: string) => string | null;
}

export default function KrankenhaeuserView({ krankenhaeuser, wachen, ruf, balance, nowMs, aktionen }: {
  krankenhaeuser: Krankenhaus[];
  wachen: MapLocation[];
  ruf: number;
  balance: number;
  nowMs: number;
  aktionen: Aktionen;
}) {
  const [bauOffen, setBauOffen] = useState(false);
  const [name, setName] = useState('');
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);

  const bauGrund = pruefeKrankenhausBau(wachen.length, ruf, balance);
  // Nur Häuser in der Nähe der eigenen Wachen zeigen (eigene immer)
  const relevant = krankenhaeuser
    .filter((kh) => kh.eigen || wachen.some((wache) => haversineKm(wache.coords, kh.coords) <= 50))
    .sort((a, b) => Number(Boolean(b.eigen)) - Number(Boolean(a.eigen)));

  const ergebnis = (grund: string | null, ok: string) => setMeldung(grund ? { art: 'fehler', text: grund } : { art: 'ok', text: ok });

  const bauen = () => {
    if (!coords) return;
    const titel = name.trim() || 'Eigenes Krankenhaus';
    if (!window.confirm(`„${titel}“ für ${euro(EIGENES_KRANKENHAUS.preis)} bauen?\n\nDein Guthaben: ${euro(balance)}`)) return;
    const grund = aktionen.baueKrankenhaus(titel, coords);
    ergebnis(grund, `✅ „${titel}“ gebaut – ${euro(EIGENES_KRANKENHAUS.preis)} bezahlt.`);
    if (!grund) {
      setBauOffen(false);
      setName('');
      setCoords(null);
    }
  };

  return (
    <div>
      <div className="wachen-kopf">
        <h2>Krankenhäuser</h2>
        <button type="button" className="btn btn--primary" onClick={() => setBauOffen((offen) => !offen)} disabled={Boolean(bauGrund) && !bauOffen}>
          ＋ Krankenhaus bauen
        </button>
      </div>
      <p className="map-hint">
        Patienten mit Fachbedarf (Herzinfarkt, Schlaganfall, Unfall) fahren ins nächste passende Haus – bis 40 km.
        Ohne Krankenhaus im Umkreis von 50 km werden Patienten vor Ort versorgt. Eigene Häuser bringen
        {' '}{euro(EIGENES_KRANKENHAUS.verguetungJePatient)} extra je Patient.
        {bauGrund && <> <strong>Bauen: {bauGrund}</strong> (ab {EIGENES_KRANKENHAUS.abWachen} Wachen, Ruf {EIGENES_KRANKENHAUS.abRuf}, {euro(EIGENES_KRANKENHAUS.preis)})</>}
      </p>

      {meldung && (
        <div className={meldung.art === 'ok' ? 'aktion-rueckmeldung' : 'versorgung-hinweis versorgung-hinweis--fehlt'} role="status">{meldung.text}</div>
      )}

      {bauOffen && (
        <div className="ausbau-karte" style={{ marginBottom: 16 }}>
          <h3>Neues Krankenhaus</h3>
          <label className="field">
            <span>Name</span>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. Klinikum Nord" />
          </label>
          <MapContainer center={coords ?? wachen[0]?.coords ?? [51.16, 10.45]} zoom={wachen.length ? 12 : 6} scrollWheelZoom className="wache-kaufen__karte">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="map-tiles--dunkel"
              maxZoom={19}
            />
            <KlickAufKarte onKlick={setCoords} />
            {wachen.map((wache) => <Marker key={wache.id} position={wache.coords} icon={punkt('#d92d2d')} />)}
            {krankenhaeuser.map((kh) => <Marker key={kh.id} position={kh.coords} icon={punkt('#16a34a')} />)}
            {coords && <Marker position={coords} icon={punkt('#2563eb')} />}
          </MapContainer>
          <p className="map-hint">Tippe auf die Karte (rot = Wachen, grün = Krankenhäuser, blau = neues Haus).</p>
          <p className="wache-kosten">Kosten: <strong>{euro(EIGENES_KRANKENHAUS.preis)}</strong> · startet mit Innerer Medizin und {EIGENES_KRANKENHAUS.startBetten} Betten</p>
          <button type="button" className="btn btn--primary" onClick={bauen} disabled={!coords || Boolean(bauGrund)}>Krankenhaus bauen</button>
        </div>
      )}

      {relevant.length === 0 && (
        <div className="leerzustand">
          <strong>Kein Krankenhaus in der Nähe</strong>
          Patienten werden vor Ort versorgt, bis du ein eigenes Krankenhaus baust.
        </div>
      )}

      <ul className="wachen-liste">
        {relevant.map((kh) => {
          const fach = getFachrichtungen(kh);
          return (
            <li key={kh.id} className="ausbau-karte">
              <span className="ausbau-karte__kategorie">{kh.eigen ? '⭐ Eigenes Haus' : 'Krankenhaus'}</span>
              <h3>🏥 {kh.name}</h3>
              <div className="notruf-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
                {fach.map((f) => <span key={f} className="chip">{FACHRICHTUNGEN[f].kurz}</span>)}
              </div>
              {kh.eigen && (
                <>
                  <p>Betten: <strong>{getBelegteBetten(kh, nowMs)} / {getBetten(kh)}</strong> belegt{getBelegteBetten(kh, nowMs) >= getBetten(kh) && ' – voll, nimmt gerade nicht auf'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(Object.keys(FACHRICHTUNGEN) as Fachrichtung[]).filter((f) => !fach.includes(f)).map((f) => {
                      const grund = pruefeFachrichtung(kh, f, ruf, balance);
                      return (
                        <button
                          key={f}
                          type="button"
                          className="btn"
                          disabled={Boolean(grund)}
                          title={grund ?? undefined}
                          onClick={() => {
                            if (!window.confirm(`${FACHRICHTUNGEN[f].label} für ${euro(FACHRICHTUNGEN[f].preis)} freischalten?`)) return;
                            ergebnis(aktionen.schalteFachrichtungFrei(kh.id, f), `✅ ${FACHRICHTUNGEN[f].label} freigeschaltet.`);
                          }}
                        >
                          {FACHRICHTUNGEN[f].kurz} · {euro(FACHRICHTUNGEN[f].preis)}{grund && grund.startsWith('Erst') ? ` (${grund.replace('Erst ab ', 'ab ').replace('.', '')})` : ''}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="btn"
                      disabled={Boolean(pruefeBettenAusbau(kh, balance))}
                      title={pruefeBettenAusbau(kh, balance) ?? undefined}
                      onClick={() => {
                        if (!window.confirm(`+${EIGENES_KRANKENHAUS.bettenJeAusbau} Betten für ${euro(EIGENES_KRANKENHAUS.bettenAusbauPreis)}?`)) return;
                        ergebnis(aktionen.baueBettenAus(kh.id), `✅ +${EIGENES_KRANKENHAUS.bettenJeAusbau} Betten.`);
                      }}
                    >
                      🛏️ +{EIGENES_KRANKENHAUS.bettenJeAusbau} Betten · {euro(EIGENES_KRANKENHAUS.bettenAusbauPreis)}
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
