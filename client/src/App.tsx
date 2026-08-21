import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import { APP_VERSION } from '@leitstellendispo/shared';
import 'leaflet/dist/leaflet.css';
import './App.css';

type LocationType = 'station' | 'incident';

type MapLocation = {
  id: string;
  name: string;
  type: LocationType;
  coords: [number, number];
  description: string;
  details: string;
};

const initialLocations: MapLocation[] = [
  {
    id: 'rettungswache-zentrum',
    name: 'Rettungswache Zentrum',
    type: 'station',
    coords: [48.775, 9.1771],
    description: 'Rettungsdienst',
    details: 'Frei platzierbarer Standort',
  },
  {
    id: 'rettungswache-sued',
    name: 'Rettungswache Süd',
    type: 'station',
    coords: [48.7692, 9.1931],
    description: 'Rettungsdienst',
    details: 'Frei platzierbarer Standort',
  },
  {
    id: 'einsatzort-beispiel',
    name: 'Einsatzort Beispiel',
    type: 'incident',
    coords: [48.7813, 9.1819],
    description: 'Einsatzort',
    details: 'Beispiel für einen Einsatzbereich',
  },
];

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<span style="display:block; width:16px; height:16px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.25);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

function App() {
  const [locations, setLocations] = useState<MapLocation[]>(initialLocations);
  const [selectedId, setSelectedId] = useState<string>(initialLocations[0].id);
  const [draftName, setDraftName] = useState('Neue Rettungswache');
  const [draftType, setDraftType] = useState<LocationType>('station');

  // New states for address search and preview behavior
  const [address, setAddress] = useState('');
  const [geocodeResults, setGeocodeResults] = useState<Array<any>>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [tempCoords, setTempCoords] = useState<[number, number] | null>(null);
  const [selectedGeocodeIndex, setSelectedGeocodeIndex] = useState<number | null>(null);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedId) ?? locations[0],
    [locations, selectedId],
  );

  // Navigation / view state (default: Karte)
  const [currentView, setCurrentView] = useState<'Karte'|'Wachen'|'Fahrzeuge'|'Einsätze'|'Finanzen'|'Einstellungen'>('Karte');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectView = (v: typeof currentView) => {
    setCurrentView(v);
  };

  const handleMapClick = (event: LeafletMouseEvent) => {
    // Move temporary preview marker to clicked position; do NOT create a location
    const coords: [number, number] = [event.latlng.lat, event.latlng.lng];
    setTempCoords(coords);
    setSelectedGeocodeIndex(null);
    setGeocodeResults([]);
    setGeocodeError(null);
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
      setTempCoords([parseFloat(first.lat), parseFloat(first.lon)]);
      setSelectedGeocodeIndex(0);
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
    const name = draftName.trim() || 'Neuer Standort';
    const locationId = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const nextLocation: MapLocation = {
      id: locationId,
      name,
      type: draftType,
      coords,
      description: draftType === 'incident' ? 'Einsatzort' : 'Rettungsdienst',
      details: address.trim() || (draftType === 'incident' ? 'Eigener Einsatzbereich / Ereignisort' : 'Frei platzierbarer Rettungsstandort'),
    };

    setLocations((current) => [...current, nextLocation]);
    setSelectedId(locationId);
    // clear temp preview and address/choices
    setTempCoords(null);
    setAddress('');
    setGeocodeResults([]);
    setSelectedGeocodeIndex(null);
  };

  const deleteLocation = (id: string) => {
    if (!confirm('Standort wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;

    setLocations((current) => {
      const next = current.filter((loc) => loc.id !== id);
      // Wenn die gelöschte Location aktuell ausgewählt war, wähle die erste verbleibende
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? '');
      }
      return next;
    });
  };

  return (
    <div className="app-shell">
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

          <div className="view-dropdown" style={{ position: 'relative', display: 'inline-block', marginLeft: 8 }}>
            {/* Trigger button */}
            <button
              type="button"
              className="chip chip--accent view-trigger"
              onClick={() => setDropdownOpen((s) => !s)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              {currentView} ▼
            </button>

            {dropdownOpen && (
              <div className="view-dropdown__menu" style={{ position: 'absolute', right: 0, marginTop: 6, background: '#2b0a0a', color: '#fff', borderRadius: 4, boxShadow: '0 6px 18px rgba(0,0,0,0.3)', zIndex: 1000 }}>
                <ul style={{ listStyle: 'none', padding: 8, margin: 0 }}>
                  {['Karte', 'Wachen', 'Fahrzeuge', 'Einsätze', 'Finanzen', 'Einstellungen'].map((view) => (
                    <li key={view} style={{ marginBottom: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          selectView(view as any);
                          setDropdownOpen(false);
                        }}
                        style={{ background: 'transparent', color: '#fff', border: 'none', padding: '6px 12px', textAlign: 'left', width: '100%' }}
                      >
                        {view}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard">
        <aside className="sidebar">
          <div className="panel-header">
            <h2>Standorte</h2>
            <span>{locations.length}</span>
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
                <option value="station">Rettungswache</option>
                <option value="incident">Einsatzort</option>
              </select>
            </label>

            <label className="field">
              <span>Adresse</span>
              <input
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Musterstraße 12, 14467 Potsdam"
              />

              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={() => geocodeAddress(address)} disabled={geocodeLoading}>
                  {geocodeLoading ? 'Suche...' : 'Adresse suchen'}
                </button>
              </div>

              {geocodeError && <div className="field-error">{geocodeError}</div>}

              {geocodeResults.length > 0 && (
                <div className="geocode-results">
                  <small>Gefundene Adressen — Auswahl zur Prüfung:</small>
                  <ul>
                    {geocodeResults.map((r, idx) => (
                      <li key={r.place_id}>
                        <button
                          type="button"
                          className={selectedGeocodeIndex === idx ? 'selected' : ''}
                          onClick={() => {
                            setTempCoords([parseFloat(r.lat), parseFloat(r.lon)]);
                            setSelectedGeocodeIndex(idx);
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

            <p className="map-hint">Adresse eingeben → Adresse suchen → Karte zeigt Position (Vorschau). Klicke auf die Karte, um Vorschau zu verschieben. Anschließend auf „Standort erstellen“ klicken.</p>

            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={createLocationFromTemp} disabled={!tempCoords}>
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
                    className="delete-button"
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

          <div className="detail-card">
            <div className="detail-card__label">Ausgewählt</div>
            <h3>{selectedLocation.name}</h3>
            <p>{selectedLocation.details}</p>
            <ul>
              <li>Typ: {selectedLocation.type}</li>
              <li>
                Koordinaten: {selectedLocation.coords[0].toFixed(4)}, {selectedLocation.coords[1].toFixed(4)}
              </li>
            </ul>
          </div>
        </aside>

        {currentView === 'Karte' ? (
          <section className="map-panel">
            <MapContainer center={[48.775, 9.185]} zoom={13} scrollWheelZoom className="map-view">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapClickHandler onMapClick={handleMapClick} />

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
                      {location.details}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </section>
        ) : (
          <section className="panel--secondary" style={{ padding: 16 }}>
            <h2>{currentView}</h2>

            {currentView === 'Wachen' && (
              <div>
                <p>Übersicht aller Wachen:</p>
                <ul>
                  {locations.filter(l => l.type === 'station').map(w => (
                    <li key={w.id} style={{ marginBottom: 8 }}>
                      <strong>{w.name}</strong> — {w.description}
                      <div>
                        <button type="button" onClick={() => { setSelectedId(w.id); selectView('Wachen'); }} style={{ marginTop: 6 }}>Details anzeigen</button>
                      </div>
                    </li>
                  ))}
                </ul>

                {locations.filter(l => l.type === 'station').length === 0 && <p>Keine Wachen vorhanden.</p>}

                {/* Simple details area for the currently selected station (if it is a station) */}
                {selectedLocation && selectedLocation.type === 'station' && (
                  <div style={{ marginTop: 16, padding: 12, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 6 }}>
                    <h3>{selectedLocation.name}</h3>
                    <p>{selectedLocation.details}</p>
                    <p>Koordinaten: {selectedLocation.coords[0].toFixed(4)}, {selectedLocation.coords[1].toFixed(4)}</p>
                  </div>
                )}
              </div>
            )}

            {currentView === 'Fahrzeuge' && (
              <div>
                <p>Globale Fahrzeugübersicht (vorbereitet).</p>
                <p>Noch keine Fahrzeuge implementiert — Platzhalteransicht.</p>
              </div>
            )}

            {currentView === 'Einsätze' && (
              <div>
                <p>Noch keine Einsätze vorhanden.</p>
              <p>Diese Ansicht ist vorbereitet.</p>
              </div>
            )}

            {currentView === 'Finanzen' && (
              <div>
                <p>Guthaben: <strong>0 €</strong></p>
                <p>Wachen und Fahrzeuge haben vorerst den Preis 0 €.</p>
              </div>
            )}

            {currentView === 'Einstellungen' && (
              <div>
                <p>Grundlegende Einstellungsansicht (Platzhalter).</p>
                <p>Später kann hier die Standard-Startansicht gewählt werden.</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
