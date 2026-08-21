import type { MapLocation } from '../types';
import type { Vehicle } from './FahrzeugeView';

export default function WachenView({
  locations,
  selectedId,
  setSelectedId,
  vehicles,
}: {
  locations: MapLocation[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  vehicles: Vehicle[];
}) {
  const stations = locations.filter((l) => l.type === 'station');
  const selected = locations.find((l) => l.id === selectedId && l.type === 'station');

  return (
    <div>
      <h2>Wachen</h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {stations.map((s) => (
              <li key={s.id} style={{ marginBottom: 10 }}>
                <button
                  className={`btn btn--secondary ${selectedId === s.id ? 'location-item--active' : ''}`}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                >
                  <strong>{s.name}</strong>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{s.description}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 2 }}>
          {selected ? (
            <div style={{ padding: 12, borderRadius: 8, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
              <h3>{selected.name}</h3>
              <p>{selected.details}</p>
              <p>Koordinaten: {selected.coords[0].toFixed(4)}, {selected.coords[1].toFixed(4)}</p>
              <p>Preis: {selected.price ? `${selected.price} €` : '0 €'}</p>

              <h4>Fahrzeuge dieser Wache</h4>
              <ul>
                {vehicles.filter(v => v.stationId === selected.id).map(v => (
                  <li key={v.id}>{v.name} — Preis: {v.price} €</li>
                ))}
                {vehicles.filter(v => v.stationId === selected.id).length === 0 && <li>Keine Fahrzeuge für diese Wache.</li>}
              </ul>
            </div>
          ) : (
            <p>Keine Wache ausgewählt.</p>
          )}
        </div>
      </div>
    </div>
  );
}
