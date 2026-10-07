import { Fragment, useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import {
  APP_VERSION,
  getRufLabel,
  adresseAusOsm,
  formatAdresse,
  formatEinsatzTitel,
  getFahrzeugPosition,
  getFahrzeugTyp,
  getFahrzeugTypenFuerWache,
  istEskaliert,
  type Adresse,
  type FahrzeugFahrt,
  type SpielEinsatz,
} from '@leitstellendispo/shared';
import 'leaflet/dist/leaflet.css';
import './App.css';

import ViewDropdown from './ViewDropdown';

import type { LocationType } from './types';
import { useSpiel } from './useSpiel';
import { useEinsatzHinweise } from './useEinsatzHinweise';
import FahrzeugeView from './views/FahrzeugeView';
import WachenView from './views/WachenView';
import EinsaetzeView from './views/EinsaetzeView';
import { KarteEinsatzLeiste, KarteEinsatzPanel } from './views/KarteEinsatzOverlay';
import RufFenster from './views/RufFenster';
import FinanzenView from './views/FinanzenView';
import EinstellungenView from './views/EinstellungenView';

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<span style="display:block; width:16px; height:16px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.25);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const INCIDENT_MARKER_COLORS: Record<SpielEinsatz['status'], string> = {
  offen: '#f59e0b',
  alarmiert: '#3b82f6',
  in_bearbeitung: '#c41e3a',
  transport: '#8b5cf6',
  abgeschlossen: '#6b7280',
};

/** Einsatz-Marker in Statusfarbe; offene Einsätze pulsieren, eskalierte sind rot umrandet, der gewählte ist größer. */
const createIncidentMarkerIcon = (incident: SpielEinsatz, selected: boolean) => {
  const { status } = incident;
  const size = selected ? 22 : 16;
  const organisation = incident.organization === 'Feuerwehr' ? 'fw' : 'rd';
  return L.divIcon({
    className: `custom-marker incident-marker incident-marker--${status} incident-marker--${organisation} ${istEskaliert(incident) ? 'incident-marker--eskaliert' : ''}`,
    html: `<span style="display:block; width:${size}px; height:${size}px; border-radius:50%; background:${INCIDENT_MARKER_COLORS[status]}; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.25);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

/** Krankenhaus als Ziel für Patiententransporte */
const hospitalMarkerIcon = L.divIcon({
  className: 'hospital-marker',
  html: '<span>H</span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const FAHRT_LINIEN_FARBEN: Record<FahrzeugFahrt['art'], string> = {
  anfahrt: '#3b82f6',
  einsatzstelle: '#3b82f6',
  transport: '#a78bfa',
  krankenhaus: '#a78bfa',
  rueckfahrt: '#9ca3af',
};

const createVehicleMarkerIcon = (label: string, art: FahrzeugFahrt['art'], organisation: 'fw' | 'rd') =>
  L.divIcon({
    className: `vehicle-marker vehicle-marker--${art} vehicle-marker--${organisation}`,
    html: `<span>${label}</span>`,
    iconSize: undefined,
    iconAnchor: [0, 0],
  });

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
      {mapStyle === 'karte' ? '🛰️ Satellit' : '🗺️ Karte'}
    </button>,
    container,
  );
}
function App() {
  // Navigation / view state (default: Karte)
  const [currentView, setCurrentView] = useState<'Karte'|'Wachen'|'Fahrzeuge'|'Einsätze'|'Finanzen'|'Einstellungen'>('Karte');
  const [selectedId, setSelectedId] = useState<string>('rettungswache-zentrum');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  // Einsatz, dessen Kurzinfo gerade als schwebendes Fenster auf der Karte angezeigt wird
  const [mapIncidentId, setMapIncidentId] = useState<string | null>(null);
  const [rufFensterOffen, setRufFensterOffen] = useState(false);

  const spiel = useSpiel({
    onSpielstandAngewendet: (spielstand) => {
      setSelectedId(spielstand.locations[0]?.id ?? '');
      setSelectedIncidentId(null);
      setMapIncidentId(null);
    },
    onEinsaetzeAbgeschlossen: (einsatzIds) => {
      setSelectedIncidentId((current) => (current && einsatzIds.includes(current) ? null : current));
    },
    onEinsaetzeVerfallen: (einsatzIds) => {
      setSelectedIncidentId((current) => (current && einsatzIds.includes(current) ? null : current));
      setMapIncidentId((current) => (current && einsatzIds.includes(current) ? null : current));
    },
  });
  const {
    locations,
    vehicles,
    balance,
    transactions,
    incidents,
    completedIncidentHistory,
    completedIncidentStats,
    nowMs,
    addVehicle,
    markiereMeldungGelesen,
  } = spiel;

  const { hinweise, schliesseHinweis, tonAn, setTonAn } = useEinsatzHinweise(incidents, spiel.spielstandGeladen);
  const oeffneHinweis = (einsatzId: string, hinweisId: string) => {
    schliesseHinweis(hinweisId);
    setSelectedIncidentId(einsatzId);
    setCurrentView('Einsätze');
  };

  const [draftName, setDraftName] = useState('Neue Rettungswache');
  const [draftType, setDraftType] = useState<LocationType>('station');

  // New states for address search and preview behavior
  const [address, setAddress] = useState('');
  const [geocodeResults, setGeocodeResults] = useState<Array<any>>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [tempCoords, setTempCoords] = useState<[number, number] | null>(null);
  // Strukturierte Adresse des gewählten Suchergebnisses (für PLZ/Ort der Einsätze rund um die neue Wache)
  const [tempAdresse, setTempAdresse] = useState<Adresse | null>(null);
  const [selectedGeocodeIndex, setSelectedGeocodeIndex] = useState<number | null>(null);
  // map reference to allow programmatic centering when selecting geocode results
  const mapRef = useRef<any>(null);
  const [mapStyle, setMapStyle] = useState<'karte' | 'satellit'>('karte');
  // Standorte-Leiste auf dem Handy ein-/ausgeklappt (am PC immer sichtbar)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // new state: choose station kind when creating a station
  const [draftStationKind, setDraftStationKind] = useState<'Rettungswache' | 'Feuerwache'>('Rettungswache');
  // start vehicle selection (exactly one) and callsign
  const [draftStartVehicleType, setDraftStartVehicleType] = useState<string>('RTW');
  const [draftStartVehicleCallsign, setDraftStartVehicleCallsign] = useState<string>('');

  useEffect(() => {
    setDraftStartVehicleType(getFahrzeugTypenFuerWache(draftStationKind)[0]?.typ ?? '');
  }, [draftStationKind]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedId) ?? locations[0],
    [locations, selectedId],
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);

  const selectView = (v: typeof currentView) => {
    setCurrentView(v);
  };

  const handleMapClick = (event: LeafletMouseEvent) => {
    // Move temporary preview marker to clicked position; do NOT create a location
    const coords: [number, number] = [event.latlng.lat, event.latlng.lng];
    setTempCoords(coords);
    setTempAdresse(null);
    setSelectedGeocodeIndex(null);
    setGeocodeResults([]);
    setGeocodeError(null);
    sucheAdresseZuPosition(coords);
  };

  // Adresse zur angeklickten Position (OSM). Ohne Netz bleibt es bei der Position – PLZ/Ort werden dann geschätzt.
  const letzteRueckwaertsSuche = useRef(0);
  const sucheAdresseZuPosition = async (coords: [number, number]) => {
    const anfrage = ++letzteRueckwaertsSuche.current;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords[0]}&lon=${coords[1]}&addressdetails=1&zoom=18`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (anfrage !== letzteRueckwaertsSuche.current) return; // inzwischen woanders geklickt
      const adresse = adresseAusOsm(data?.address);
      if (adresse) {
        setTempAdresse(adresse);
        setAddress(formatAdresse(adresse));
      }
    } catch {
      // Adresse ist nur Komfort
    }
  };

  const geocodeAddress = async (q: string) => {
      if (!q.trim()) {
        setGeocodeError('Bitte eine Adresse eingeben.');
        return;
      }
      setGeocodeLoading(true);
      setGeocodeError(null);
      setGeocodeResults([]);
      setSelectedGeocodeIndex(null);

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Geocoding konnte nicht durchgeführt werden (Netzwerkfehler).');
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setGeocodeError('Adresse nicht gefunden.');
          setGeocodeLoading(false);
          return;
        }
        setGeocodeResults(data);
        // Choose the first sensible result as preview
        const first = data[0];
        const coords: [number, number] = [parseFloat(first.lat), parseFloat(first.lon)];
        setTempCoords(coords);
        setTempAdresse(adresseAusOsm(first.address));
        setSelectedGeocodeIndex(0);
        // center map on the preview if map is available
        try {
          mapRef.current?.setView(coords, mapRef.current.getZoom?.() ?? 13);
        } catch (e) {
          // ignore if mapRef not ready
        }
      } catch (err: any) {
        setGeocodeError(err?.message ?? 'Unbekannter Fehler bei der Adresssuche.');
      } finally {
        setGeocodeLoading(false);
      }
    };

  const createLocationFromTemp = () => {
    const coords = tempCoords;
    if (!coords) {
      alert('Keine Position ausgewählt. Bitte Adresse suchen oder auf die Karte klicken, um eine Vorschau zu setzen.');
      return;
    }

    const ergebnis = spiel.erstelleWache({
      name: draftName,
      stationKind: draftStationKind,
      coords,
      details: address,
      startFahrzeugTyp: draftStartVehicleType,
      funkrufname: draftStartVehicleCallsign,
      adresse: tempAdresse ?? undefined,
    });
    if ('fehler' in ergebnis) {
      alert(ergebnis.fehler);
      return;
    }

    setSelectedId(ergebnis.id);
    setDraftStartVehicleCallsign('');
    // clear temp preview and address/choices
    setTempCoords(null);
    setTempAdresse(null);
    setAddress('');
    setGeocodeResults([]);
    setSelectedGeocodeIndex(null);
  };

  const deleteLocation = (id: string) => {
    const stationVehicles = vehicles.filter((vehicle) => vehicle.stationId === id);
    if (stationVehicles.length > 0) {
      alert('Dieser Standort kann nicht gelöscht werden, solange ihm noch Fahrzeuge zugewiesen sind.');
      return;
    }

    if (!confirm('Standort wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;

    spiel.loescheWache(id);
    // Wenn die gelöschte Location aktuell ausgewählt war, wähle die erste verbleibende
    if (selectedId === id) {
      setSelectedId(locations.find((location) => location.id !== id)?.id ?? '');
    }
  };

  const triggerTestIncident = () => {
    const ergebnis = spiel.erzeugeTestEinsatz();
    if ('fehler' in ergebnis) {
      alert(ergebnis.fehler);
      return;
    }
    setSelectedIncidentId(ergebnis.id);
    setCurrentView('Einsätze');
  };

  const alarmIncidentVehicles = (incidentId: string, selectedVehicleIds: string[]) => {
    spiel.alarmieren(incidentId, selectedVehicleIds);
  };

  const neuesSpiel = () => {
    if (!confirm('Wirklich ein neues Spiel starten? Der aktuelle Spielstand wird gelöscht.')) return;
    spiel.neuesSpiel();
    setCurrentView('Karte');
  };

  return (
    <div className="app-shell">
      {hinweise.length > 0 && (
        <div className="einsatz-hinweise" role="status" aria-live="polite">
          {hinweise.map((hinweis) => (
            <div key={hinweis.id} className={`einsatz-hinweis einsatz-hinweis--${hinweis.art}`}>
              <button type="button" className="einsatz-hinweis__inhalt" onClick={() => oeffneHinweis(hinweis.einsatzId, hinweis.id)}>
                <strong>{hinweis.art === 'meldung' ? '⚠ ' : '🚨 '}{hinweis.titel}</strong>
                <span>{hinweis.text}</span>
              </button>
              <button type="button" className="einsatz-hinweis__schliessen" onClick={() => schliesseHinweis(hinweis.id)} aria-label="Schließen">✕</button>
            </div>
          ))}
        </div>
      )}
      <header className="topbar">
        {/* banner image fills the header */}
        <img className="topbar__banner" src="/brand-banner.png" alt="LeitstellenDispo Banner" />

        <div className="brand">
          <div className="brand__text">
            {/* Title and subtitle intentionally removed as requested (empty space reserved) */}
          </div>
        </div>

        <div className="topbar__meta">
          {/* Single dropdown trigger showing the currently active main view */}
          {/* Will render current view and open a small dropdown when clicked. */}
          { /* Version chip kept for visibility */ }
          <span className="chip">V{APP_VERSION}</span>
          <span className="chip" title="Guthaben">💶 {balance.toLocaleString('de-DE')} €</span>
          <button
            type="button"
            className="chip ruf-chip"
            title="Ruf der Leitstelle – antippen für deine Bewertungen und Fehler"
            onClick={() => setRufFensterOffen(true)}
          >
            ⭐ Ruf {spiel.ruf} · {getRufLabel(spiel.ruf)}
          </button>

          <div className="view-dropdown">
            {/* Trigger button */}
            <button
              ref={(node) => {
                triggerRef.current = node;
              }}
              type="button"
              className="chip chip--accent view-trigger"
              onClick={() => setDropdownOpen((s) => !s)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
            {currentView} <span className="chev" aria-hidden></span>
            </button>

            {/* portal-based dropdown */}
            <ViewDropdown
              anchorRef={triggerRef}
              isOpen={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
              currentView={currentView}
              onSelect={(v) => {
                selectView(v as any);
              }}
            />

          </div>
        </div>
      </header>

      {rufFensterOffen && (
        <RufFenster
          ruf={spiel.ruf}
          completedIncidentHistory={completedIncidentHistory}
          onClose={() => setRufFensterOffen(false)}
          onEinsatzOeffnen={(einsatzId) => {
            setRufFensterOffen(false);
            setSelectedIncidentId(einsatzId);
            setCurrentView('Einsätze');
          }}
        />
      )}

      <main className={`dashboard ${currentView === 'Karte' ? '' : 'dashboard--full'}`}>
        {currentView === 'Karte' && (
          <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar--collapsed'}`}>
            <div className="panel-header">
              <h2>Standorte</h2>
              <span>{locations.length}</span>
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? 'Einklappen ▴' : 'Anzeigen ▾'}
              </button>
            </div>

            <div className="location-form">
              <label className="field">
                <span>Name</span>
                <input
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="z. B. Rettungswache Nord"
                />
              </label>

              <label className="field">
                <span>Typ</span>
                <select value={draftType} onChange={(event) => setDraftType(event.target.value as LocationType)}>
                  <option value="station">Standort (station)</option>
                </select>
              </label>

              <label className="field">
                <span>Wachentyp</span>
                <select value={draftStationKind} onChange={(event) => setDraftStationKind(event.target.value as any)}>
                  <option value="Rettungswache">Rettungswache</option>
                  <option value="Feuerwache">Feuerwache</option>
                </select>
              </label>

              <label className="field field--address">
                <span>Adresse</span>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Musterstraße 12, 14467 Potsdam"
                />

                <div style={{ marginTop: 8 }}>
                  <button className="btn btn--primary" type="button" onClick={() => geocodeAddress(address)} disabled={geocodeLoading}>
                    {geocodeLoading ? 'Suche...' : 'Adresse suchen'}
                  </button>
                </div>

                {geocodeError && <div className="field-error">{geocodeError}</div>}

                {geocodeResults.length > 0 && (
                  <div className="geocode-results">
                    <small style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Gefundene Adressen — Auswahl zur Prüfung:</small>
                    <ul>
                      {geocodeResults.map((r, idx) => (
                        <li key={r.place_id}>
                          <button
                            type="button"
                            className={`view-menu-item ${selectedGeocodeIndex === idx ? 'active' : ''}`}
                            onClick={() => {
                                                                      const coords: [number, number] = [parseFloat(r.lat), parseFloat(r.lon)];
                                                                      // Übernommenes Ergebnis im Adressfeld anzeigen
                                                                      setAddress(r.display_name);
                                                                      // Preview-Marker und Auswahl setzen
                                                                      setTempCoords(coords);
                                                                      setTempAdresse(adresseAusOsm(r.address));
                                                                      setSelectedGeocodeIndex(idx);
                                                                      // Liste der Suchergebnisse schließen
                                                                      setGeocodeResults([]);
                                                                      setGeocodeError(null);
                                                                      // Karte zur Position zentrieren
                                                                      try {
                                                                        mapRef.current?.setView(coords, mapRef.current.getZoom?.() ?? 13);
                                                                      } catch (e) { }
                                                                    }}
                                                              >
                                                                    {r.display_name}
                                                              </button>
                                                            </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
              </label>

              <p className="map-hint">Adresse eingeben → Adresse suchen → Karte zeigt Position (Vorschau). Klicke auf die Karte, um Vorschau zu verschieben.</p>

              {/* Startfahrzeug Auswahl (genau EIN Fahrzeug) */}
              <label className="field">
                <span>Startfahrzeug</span>
                <select value={draftStartVehicleType} onChange={(e) => setDraftStartVehicleType(e.target.value)}>
                  {getFahrzeugTypenFuerWache(draftStationKind).map((fahrzeugTyp) => (
                    <option key={fahrzeugTyp.typ} value={fahrzeugTyp.typ}>{fahrzeugTyp.typ}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Funkrufname (z. B. "Wache-1")</span>
                <input type="text" value={draftStartVehicleCallsign} onChange={(e) => setDraftStartVehicleCallsign(e.target.value)} placeholder="z. B. RTW-1" />
              </label>

              <p className="map-hint">Anschließend auf „Standort erstellen“ klicken — Wache und das ausgewählte Startfahrzeug werden gemeinsam erstellt.</p>

              <div style={{ marginTop: 8 }}>
                <button className="btn btn--primary" type="button" onClick={createLocationFromTemp} disabled={!tempCoords}>
                  Standort erstellen
                </button>
              </div>
            </div>

            <div className="location-list">
              {locations.map((location) => (
                <div key={location.id} className={`location-item-wrapper`}>
                  <button
                    className={`location-item${selectedId === location.id ? ' location-item--active' : ''}`}
                    onClick={() => setSelectedId(location.id)}
                    type="button"
                  >
                    <span className={`color-dot color-dot--${location.type}`} aria-hidden="true" />
                    <span className="location-copy">
                      <strong>{location.name}</strong>
                      <small>{location.description}</small>
                    </span>
                  </button>

                  {/* Lösch-Button nur für Wachen (station) anzeigen */}
                  {location.type === 'station' && (
                    <button
                    className="btn btn--danger delete-button"
                      title={`Standort ${location.name} löschen`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLocation(location.id);
                      }}
                      type="button"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              ))}
            </div>

            {selectedLocation && (
              <div className="detail-card">
                <div className="detail-card__label">Ausgewählt</div>
                <h3>{selectedLocation.name}</h3>
                <p>{selectedLocation.adresse ? formatAdresse(selectedLocation.adresse) : selectedLocation.details}</p>
                <ul>
                  <li>Typ: {selectedLocation.stationKind ?? selectedLocation.type}</li>
                  <li>
                    Koordinaten: {selectedLocation.coords[0].toFixed(4)}, {selectedLocation.coords[1].toFixed(4)}
                  </li>
                </ul>
              </div>
            )}
          </aside>
        )}

        {currentView === 'Karte' ? (
          <section className="map-panel">
            <KarteEinsatzLeiste
              incidents={incidents.filter((incident) => incident.status !== 'abgeschlossen')}
              selectedId={mapIncidentId}
              onSelect={(incident) => {
                setMapIncidentId(incident.id);
                mapRef.current?.setView(incident.coords, Math.max(mapRef.current.getZoom(), 14));
              }}
            />

            {(() => {
              const mapIncident = incidents.find((incident) => incident.id === mapIncidentId && incident.status !== 'abgeschlossen');
              return mapIncident ? (
                <KarteEinsatzPanel
                  key={mapIncident.id}
                  incident={mapIncident}
                  incidents={incidents}
                  vehicles={vehicles}
                  locations={locations}
                  nowMs={nowMs}
                  onAlarmieren={(vehicleIds) => spiel.alarmieren(mapIncident.id, vehicleIds)}
                  onClose={() => setMapIncidentId(null)}
                  onOpenInEinsaetze={() => {
                    setSelectedIncidentId(mapIncident.id);
                    setMapIncidentId(null);
                    setCurrentView('Einsätze');
                  }}
                />
              ) : null;
            })()}

            <MapContainer center={[48.775, 9.185]} zoom={13} scrollWheelZoom className="map-view" ref={mapRef}>
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
                const iconColor = location.type === 'incident' ? '#f59e0b' : '#d92d2d';

                return (
                  <Marker
                    key={location.id}
                    position={location.coords}
                    icon={createMarkerIcon(iconColor)}
                    eventHandlers={{ click: () => setSelectedId(location.id) }}
                  >
                    <Popup>
                      <strong>{location.name}</strong>
                      <br />
                      {location.adresse ? formatAdresse(location.adresse) : location.details}
                    </Popup>
                  </Marker>
                );
              })}

              {spiel.krankenhaeuser.map((krankenhaus) => (
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

              {/* Fahrzeuge unterwegs: gerade Linie (Luftlinie) zum Ziel */}
              {vehicles.map((vehicle) => {
                const fahrt = getFahrzeugPosition(vehicle, incidents, locations, nowMs);
                if (!fahrt) return null;
                const organisation = getFahrzeugTyp(vehicle.type)?.organisation === 'Feuerwehr' ? 'fw' : 'rd';
                return (
                  <Fragment key={vehicle.id}>
                    {fahrt.unterwegs && (
                      <Polyline
                        positions={[fahrt.position, fahrt.ziel]}
                        pathOptions={{ color: FAHRT_LINIEN_FARBEN[fahrt.art], weight: 2, dashArray: '6 6', opacity: 0.8 }}
                      />
                    )}
                    <Marker
                      position={fahrt.position}
                      icon={createVehicleMarkerIcon(vehicle.callsign ?? vehicle.name, fahrt.art, organisation)}
                      zIndexOffset={2000}
                      interactive={false}
                    />
                  </Fragment>
                );
              })}
            </MapContainer>
          </section>
        ) : (
          <section className="panel--secondary" style={{ padding: 16 }}>
            {currentView === 'Wachen' && (
              <WachenView
                locations={locations}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                vehicles={vehicles}
                personal={spiel.personal}
                balance={balance}
                nowMs={nowMs}
                buyVehicle={spiel.buyVehicle}
                erweitereStellplaetze={spiel.erweitereStellplaetze}
                personalAktionen={spiel}
              />
            )}

            {currentView === 'Fahrzeuge' && (
              <FahrzeugeView vehicles={vehicles} addVehicle={addVehicle} stations={locations.filter(l => l.type === 'station')} />
            )}

            {currentView === 'Einsätze' && (
              <EinsaetzeView
                incidents={incidents}
                completedIncidentHistory={completedIncidentHistory}
                vehicles={vehicles}
                locations={locations}
                selectedIncidentId={selectedIncidentId}
                setSelectedIncidentId={setSelectedIncidentId}
                alarmIncidentVehicles={alarmIncidentVehicles}
                markiereMeldungGelesen={markiereMeldungGelesen}
                triggerTestIncident={triggerTestIncident}
                nowMs={nowMs}
                stats={completedIncidentStats}
              />
            )}

            {currentView === 'Finanzen' && (
              <FinanzenView balance={balance} locations={locations} vehicles={vehicles} transactions={transactions} />
            )}

            {currentView === 'Einstellungen' && (
              <EinstellungenView defaultView={currentView} onNeuesSpiel={neuesSpiel} tonAn={tonAn} setTonAn={setTonAn} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
