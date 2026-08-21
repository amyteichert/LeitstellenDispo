import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import { APP_NAME, APP_SUBTITLE, APP_VERSION } from '@leitstellendispo/shared';
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

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedId) ?? locations[0],
    [locations, selectedId],
  );

  const addLocationAtMapClick = (event: LeafletMouseEvent) => {
    const name = draftName.trim() || 'Neuer Standort';
    const locationId = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const nextLocation: MapLocation = {
      id: locationId,
      name,
      type: draftType,
      coords: [event.latlng.lat, event.latlng.lng],
      description: draftType === 'incident' ? 'Einsatzort' : 'Rettungsdienst',
      details:
        draftType === 'incident'
          ? 'Eigener Einsatzbereich / Ereignisort'
          : 'Frei platzierbarer Rettungsstandort',
    };

    setLocations((current) => [...current, nextLocation]);
    setSelectedId(locationId);
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
          <span className="chip">V{APP_VERSION}</span>
          <span className="chip chip--accent">Karte</span>
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

            <p className="map-hint">Klicke auf die Karte, um den Standort selbst zu setzen.</p>
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

        <section className="map-panel">
          <MapContainer center={[48.775, 9.185]} zoom={13} scrollWheelZoom className="map-view">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onMapClick={addLocationAtMapClick} />

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
      </main>
    </div>
  );
}

export default App;
