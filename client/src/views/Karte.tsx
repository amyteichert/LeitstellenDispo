import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import {
  type Vehicle,
  formatAdresse,
  formatEinsatzTitel,
  getFahrzeugPosition,
  getFahrzeugTyp,
  getGrosslagenStaende,
  FMS_STATUS,
  istEskaliert,
  type FahrzeugFahrt,
  type Krankenhaus,
  type MapLocation,
  type SpielEinsatz,
} from '@leitstellendispo/shared';
import { einsatzMarkerHtml, fahrzeugSymbolHtml, krankenhausMarkerHtml, wachenMarkerHtml } from '../Kennzeichen';
import { getEinstellungen } from '../einstellungen';
import { BELOHNUNG_ANZEIGE_MS, type Belohnung } from '../useSpiel';

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<span style="display:block; width:16px; height:16px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.25);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const INCIDENT_MARKER_COLORS: Record<SpielEinsatz['status'], string> = {
  offen: 'var(--status-offen)',
  alarmiert: 'var(--status-alarmiert)',
  in_bearbeitung: 'var(--status-bearbeitung)',
  transport: 'var(--status-transport)',
  abgeschlossen: 'var(--status-abgeschlossen)',
};

/** Namensschild einer Großschadenslage (sitzt mittig auf dem oberen Rand des Kreises) */
const createGrosslagenSchild = (name: string) =>
  L.divIcon({
    className: 'grosslage-schild',
    html: `<span>⚠ ${name.replace(/[<>&]/g, '')}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

/**
 * Einsatz-Marker: Symbol der Einsatzart (Brand, Patient, Unfall …) auf Statusfarbe.
 * Offene Einsätze pulsieren, eskalierte sind rot umrandet, der gewählte ist größer.
 */
const createIncidentMarkerIcon = (incident: SpielEinsatz, selected: boolean) => {
  const { status } = incident;
  const size = selected ? 32 : 26;
  const organisation = incident.organization === 'Feuerwehr' ? 'fw' : 'rd';
  return L.divIcon({
    className: `custom-marker incident-marker incident-marker--${status} incident-marker--${organisation} ${istEskaliert(incident) ? 'incident-marker--eskaliert' : ''}`,
    html: einsatzMarkerHtml(incident, INCIDENT_MARKER_COLORS[status], size),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

/** Wache als Quadrat mit Symbol: Feuerwehrhelm (rot) bzw. Stern des Lebens (orange) */
const createWachenMarkerIcon = (location: Pick<MapLocation, 'stationKind' | 'logoFarbe' | 'logoSymbol'>, groesse = 32) =>
  L.divIcon({
    className: 'custom-marker',
    html: wachenMarkerHtml(location.stationKind, groesse, location.logoFarbe, location.logoSymbol),
    iconSize: [groesse, groesse],
    iconAnchor: [groesse / 2, groesse / 2],
  });

/** Krankenhaus als Ziel für Patiententransporte (blaues H wie das Verkehrsschild) */
const hospitalMarkerIcon = L.divIcon({
  className: 'custom-marker',
  html: krankenhausMarkerHtml(),
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const FAHRT_LINIEN_FARBEN: Record<FahrzeugFahrt['art'], string> = {
  anfahrt: '#1d6ff2',
  einsatzstelle: '#1d6ff2',
  transport: '#8b3ff0',
  krankenhaus: '#8b3ff0',
  rueckfahrt: '#6b7280',
};

/** Fahrzeug auf der Karte: nur das Fahrzeugbild, der Punkt zeigt den Fahrtstatus – Name und Details beim Antippen */
const createVehicleMarkerIcon = (art: FahrzeugFahrt['art'], organisation: 'fw' | 'rd', fahrzeug: Vehicle) => L.divIcon({
  className: `vehicle-marker vehicle-marker--${art} vehicle-marker--${organisation}`,
  html: `<span>${fahrzeugSymbolHtml(fahrzeug)}</span>`,
  iconSize: undefined,
  iconAnchor: [0, 0],
});

/** Kurz aufsteigendes „+ 1.240 €“ am Einsatzort, wenn ein Einsatz bezahlt wird */
const createBelohnungIcon = (belohnung: Belohnung) => L.divIcon({
  className: 'belohnung-marker',
  html: `<span>+${belohnung.betrag.toLocaleString('de-DE')} €<small>+${belohnung.xp} EP</small></span>`,
  iconSize: undefined,
  iconAnchor: [0, 0],
});

const FAHRT_TEXTE: Record<FahrzeugFahrt['art'], string> = {
  anfahrt: 'Anfahrt zum Einsatz',
  einsatzstelle: 'An der Einsatzstelle',
  transport: 'Transport ins Krankenhaus',
  krankenhaus: 'Im Krankenhaus',
  rueckfahrt: 'Rückfahrt zur Wache',
};

/** Neue Spieler: Karte auf die eigene Stadt setzen statt auf den Standard-Ausschnitt */
export function StartStadt({ onGefunden }: { onGefunden: (coords: [number, number]) => void }) {
  const [stadt, setStadt] = useState('');
  const [status, setStatus] = useState<'bereit' | 'sucht' | 'nicht_gefunden' | 'gefunden'>('bereit');
  const suchen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stadt.trim()) return;
    setStatus('sucht');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=de&limit=1&q=${encodeURIComponent(stadt.trim())}`);
      const treffer = res.ok ? ((await res.json()) as Array<{ lat: string; lon: string }>)[0] : undefined;
      if (!treffer) return setStatus('nicht_gefunden');
      onGefunden([parseFloat(treffer.lat), parseFloat(treffer.lon)]);
      setStatus('gefunden');
    } catch {
      setStatus('nicht_gefunden');
    }
  };
  return (
    <form className="start-stadt" onSubmit={suchen}>
      <label htmlFor="start-stadt">In welcher Stadt willst du starten?</label>
      <input id="start-stadt" value={stadt} onChange={(e) => { setStadt(e.target.value); setStatus('bereit'); }} placeholder="z. B. Hamburg" />
      <button type="submit" className="btn btn--primary" disabled={status === 'sucht'}>Zur Stadt</button>
      {status === 'nicht_gefunden' && <small>Nicht gefunden – anderer Name?</small>}
    </form>
  );
}

/** Kleine Karte folgt der gesuchten Position */
function KarteFolgt({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView(coords, Math.max(map.getZoom(), 13));
  }, [coords, map]);
  return null;
}


const KARTE_KEY = 'leitstellendispo.karte';

/** Zuletzt angezeigter Kartenausschnitt (nur wenn „Karte merken“ an ist) */
export const ladeKartenausschnitt = (): { center: [number, number]; zoom: number } | null => {
  if (!getEinstellungen().karteMerken) return null;
  try {
    const gespeichert = JSON.parse(localStorage.getItem(KARTE_KEY) ?? 'null');
    return gespeichert && Array.isArray(gespeichert.center) && typeof gespeichert.zoom === 'number' ? gespeichert : null;
  } catch {
    return null;
  }
};

/**
 * Merkt sich den Kartenausschnitt. Ohne gemerkten Ausschnitt springt die Karte einmal zur ersten Wache,
 * sobald der Spielstand geladen ist.
 */
function KarteMerken({ ersteWache, hatteAusschnitt }: { ersteWache?: [number, number]; hatteAusschnitt: boolean }) {
  const map = useMap();
  const gesprungen = useRef(hatteAusschnitt);
  useEffect(() => {
    if (gesprungen.current || !ersteWache) return;
    gesprungen.current = true;
    map.setView(ersteWache, Math.max(map.getZoom(), 13));
  }, [ersteWache, map]);
  useMapEvents({
    moveend: () => {
      if (!getEinstellungen().karteMerken) return;
      const mitte = map.getCenter();
      try {
        localStorage.setItem(KARTE_KEY, JSON.stringify({ center: [mitte.lat, mitte.lng], zoom: map.getZoom() }));
      } catch {
        // Nur Komfort
      }
    },
  });
  return null;
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (event: LeafletMouseEvent) => void;
}) {
  useMapEvents({
    click: (event) => onMapClick(event),
  });

  return null;
}

/** Knopf unten rechts auf der Karte, als echtes Leaflet-Bedienelement (stapelt sich über der Quellenangabe). */
function MapStyleToggle({
  mapStyle,
  onToggle,
}: {
  mapStyle: 'karte' | 'satellit';
  onToggle: () => void;
}) {
  const map = useMap();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const control = new L.Control({ position: 'bottomright' });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-control');
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    control.addTo(map);
    setContainer(control.getContainer() ?? null);
    return () => {
      control.remove();
    };
  }, [map]);

  if (!container) return null;

  return createPortal(
    <button type="button" className="map-style-toggle" onClick={onToggle}>
      {mapStyle === 'karte' ? 'Satellit' : 'Karte'}
    </button>,
    container,
  );
}

/** Die große Spielkarte: Wachen, Krankenhäuser, Einsätze, Belohnungen und Fahrzeuge unterwegs */
export function Hauptkarte({
  kartenStart,
  mapRef,
  mapStyle,
  setMapStyle,
  handleMapClick,
  tempCoords,
  locations,
  krankenhaeuser,
  incidents,
  vehicles,
  belohnungen,
  nowMs,
  mapIncidentId,
  setMapIncidentId,
  setSelectedId,
  onWacheVerwalten,
  onFahrzeugBearbeiten,
}: {
  kartenStart: ReturnType<typeof ladeKartenausschnitt>;
  mapRef: React.Ref<any>;
  mapStyle: 'karte' | 'satellit';
  setMapStyle: React.Dispatch<React.SetStateAction<'karte' | 'satellit'>>;
  handleMapClick: (event: LeafletMouseEvent) => void;
  tempCoords: [number, number] | null;
  locations: MapLocation[];
  krankenhaeuser: Krankenhaus[];
  incidents: SpielEinsatz[];
  vehicles: Vehicle[];
  belohnungen: Belohnung[];
  nowMs: number;
  mapIncidentId: string | null;
  setMapIncidentId: (id: string) => void;
  setSelectedId: (id: string) => void;
  onWacheVerwalten: (wacheId: string) => void;
  onFahrzeugBearbeiten: (fahrzeug: Vehicle) => void;
}) {
  return (
    <MapContainer center={kartenStart?.center ?? [48.775, 9.185]} zoom={kartenStart?.zoom ?? 13} scrollWheelZoom className="map-view" ref={mapRef}>
      <KarteMerken ersteWache={locations.find((location) => location.type === 'station')?.coords} hatteAusschnitt={Boolean(kartenStart)} />
      {mapStyle === 'karte' ? (
        <TileLayer
          key="karte"
          // Freie OSM-Kacheln (ohne API-Schlüssel), per CSS dunkel eingefärbt – CARTO verlangt inzwischen einen Schlüssel
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles--dunkel"
          maxZoom={19}
        />
      ) : (
        <TileLayer
          key="satellit"
          attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      )}

      <MapClickHandler onMapClick={handleMapClick} />
      <MapStyleToggle
        mapStyle={mapStyle}
        onToggle={() => setMapStyle((current) => (current === 'karte' ? 'satellit' : 'karte'))}
      />

      {tempCoords && (
        <Marker position={tempCoords} icon={createMarkerIcon('#2563eb')}>
          <Popup>
            <strong>Vorschau</strong>
            <br />
            Position prüfen. Drücke "Standort erstellen", um zu speichern.
          </Popup>
        </Marker>
      )}

      {locations.map((location) => {
        return (
          <Marker
            key={location.id}
            position={location.coords}
            icon={location.type === 'station' ? createWachenMarkerIcon(location) : createMarkerIcon('#f59e0b')}
            zIndexOffset={200}
            eventHandlers={{ click: () => setSelectedId(location.id) }}
          >
            <Popup>
              <strong>{location.name}</strong>
              <br />
              {location.adresse ? formatAdresse(location.adresse) : location.details}
              {location.type === 'station' && (
                <>
                  <br />
                  <button
                    type="button"
                    className="btn btn--primary btn--klein"
                    style={{ marginTop: 6 }}
                    onClick={() => {
                      onWacheVerwalten(location.id);
                    }}
                  >
                    Wache verwalten
                  </button>
                </>
              )}
            </Popup>
          </Marker>
        );
      })}

      {krankenhaeuser.map((krankenhaus) => (
        <Marker key={krankenhaus.id} position={krankenhaus.coords} icon={hospitalMarkerIcon} zIndexOffset={100}>
          <Popup>
            <strong>{krankenhaus.name}</strong>
            <br />
            {formatAdresse(krankenhaus.adresse)}
            <br />
            {krankenhaus.aufnahme ? 'Aufnahme möglich' : 'Keine Aufnahme'}
          </Popup>
        </Marker>
      ))}

      {/* Großschadenslage: gestrichelter Kreis um alle Abschnitte, darüber der Name der Lage */}
      {getGrosslagenStaende(incidents).map((lage) => (
        <Fragment key={lage.id}>
          <Circle
            center={lage.zentrum}
            radius={lage.radiusKm * 1000}
            interactive={false}
            pathOptions={{ color: '#ef4444', weight: 2, dashArray: '8 6', fillColor: '#ef4444', fillOpacity: 0.08 }}
          />
          {/* Schild am oberen Kreisrand – in der Mitte läge es auf dem ersten Abschnitt */}
          <Marker
            position={[lage.zentrum[0] + lage.radiusKm / 111.32, lage.zentrum[1]]}
            icon={createGrosslagenSchild(lage.name)}
            interactive={false}
            zIndexOffset={400}
          />
        </Fragment>
      ))}

      {incidents
        .filter((incident) => incident.status !== 'abgeschlossen')
        .map((incident) => (
          <Marker
            key={incident.id}
            position={incident.coords}
            icon={createIncidentMarkerIcon(incident, incident.id === mapIncidentId)}
            title={`${formatEinsatzTitel(incident)} – ${incident.address}`}
            zIndexOffset={incident.id === mapIncidentId ? 1000 : 500}
            eventHandlers={{ click: () => setMapIncidentId(incident.id) }}
          />
        ))}

      {belohnungen
        .filter((belohnung) => nowMs - belohnung.zeit < BELOHNUNG_ANZEIGE_MS)
        .map((belohnung) => (
          <Marker key={belohnung.id} position={belohnung.coords} icon={createBelohnungIcon(belohnung)} zIndexOffset={3000} interactive={false} />
        ))}

      {/* Fahrzeuge unterwegs: restliche Strecke zum Ziel (Straße, sonst Luftlinie) */}
      {vehicles.map((vehicle) => {
        const fahrt = getFahrzeugPosition(vehicle, incidents, locations, nowMs);
        if (!fahrt) return null;
        const organisation = getFahrzeugTyp(vehicle.type)?.organisation === 'Feuerwehr' ? 'fw' : 'rd';
        return (
          <Fragment key={vehicle.id}>
            {/* Wie beim Navi: kräftige Linie mit hellem Rand – auf heller wie dunkler Karte gut zu sehen.
                Anfahrt und Transport durchgezogen, Rückfahrt gestrichelt. */}
            {fahrt.unterwegs && (
              <>
                <Polyline
                  positions={fahrt.linie}
                  interactive={false}
                  pathOptions={{ color: '#ffffff', weight: fahrt.art === 'rueckfahrt' ? 5 : 8, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
                />
                <Polyline
                  positions={fahrt.linie}
                  interactive={false}
                  pathOptions={{
                    color: FAHRT_LINIEN_FARBEN[fahrt.art],
                    weight: fahrt.art === 'rueckfahrt' ? 3 : 5,
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: fahrt.art === 'rueckfahrt' ? '6 8' : undefined,
                  }}
                />
              </>
            )}
            <Marker
              position={fahrt.position}
              icon={createVehicleMarkerIcon(fahrt.art, organisation, vehicle)}
              zIndexOffset={2000}
              title={vehicle.callsign ?? vehicle.name}
            >
              <Popup>
                <div className="fahrzeug-popup">
                  <strong>{vehicle.callsign ?? vehicle.name}</strong>
                  <span>{getFahrzeugTyp(vehicle.type)?.bezeichnung ?? vehicle.type}</span>
                  <span>S{FMS_STATUS[vehicle.status ?? 'Einsatzbereit']} · {FAHRT_TEXTE[fahrt.art]}</span>
                  <span>{locations.find((location) => location.id === vehicle.stationId)?.name ?? 'Ohne Wache'} · {vehicle.besatzung ?? 0} Personen an Bord</span>
                  {vehicle.stationId && (
                    <button
                      type="button"
                      className="btn btn--primary btn--klein"
                      onClick={() => {
                        onFahrzeugBearbeiten(vehicle);
                      }}
                    >
                      ✎ Fahrzeug bearbeiten
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}

/** Kleine Karte im Fenster „Wache kaufen“ */
export function WacheKaufenKarte({ tempCoords, locations, handleMapClick }: {
  tempCoords: [number, number] | null;
  locations: MapLocation[];
  handleMapClick: (event: LeafletMouseEvent) => void;
}) {
  return (
    <MapContainer
      center={tempCoords ?? locations.find((location) => location.type === 'station')?.coords ?? [51.16, 10.45]}
      zoom={tempCoords || locations.length > 0 ? 13 : 6}
      scrollWheelZoom
      className="wache-kaufen__karte"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="map-tiles--dunkel"
        maxZoom={19}
      />
      <MapClickHandler onMapClick={handleMapClick} />
      <KarteFolgt coords={tempCoords} />
      {locations.filter((location) => location.type === 'station').map((location) => (
        <Marker key={location.id} position={location.coords} icon={createWachenMarkerIcon(location, 22)} />
      ))}
      {tempCoords && <Marker position={tempCoords} icon={createMarkerIcon('#2563eb')} />}
    </MapContainer>
  );
}
