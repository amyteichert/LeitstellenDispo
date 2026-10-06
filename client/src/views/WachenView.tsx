import { useEffect, useState } from 'react';
import { getFahrzeugTypenFuerWache } from '@leitstellendispo/shared';
import type { MapLocation, Vehicle } from '../types';

export default function WachenView({
  locations,
  selectedId,
  setSelectedId,
  vehicles,
  buyVehicle,
}: {
  locations: MapLocation[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  vehicles: Vehicle[];
  buyVehicle: (stationId: string, typ: string) => void;
}) {
  const stations = locations.filter((l) => l.type === 'station');
  const selected = locations.find((l) => l.id === selectedId && l.type === 'station');
  const kaufbareTypen = getFahrzeugTypenFuerWache(selected?.stationKind ?? 'Rettungswache');
  const [kaufTyp, setKaufTyp] = useState('');

  // Beim Wechsel der Wache den ersten passenden Fahrzeugtyp vorauswählen
  useEffect(() => {
    setKaufTyp(kaufbareTypen[0]?.typ ?? '');
  }, [selected?.id]);

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
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.description}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 2 }}>
          {selected ? (
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
              <h3>{selected.name}</h3>
              <p>{selected.details}</p>
              <p>Typ: {selected.stationKind ?? 'Rettungswache'}</p>
              <p>Koordinaten: {selected.coords[0].toFixed(4)}, {selected.coords[1].toFixed(4)}</p>
              <p>Preis: {selected.price ? `${selected.price} €` : '0 €'}</p>

              <h4>Fahrzeuge</h4>
              <ul>
                {vehicles.filter(v => v.stationId === selected.id).map(v => (
                  <li key={v.id}>{v.callsign ? `${v.callsign} (${v.name})` : v.name} — Typ: {v.type ?? '–'}</li>
                ))}
                {vehicles.filter(v => v.stationId === selected.id).length === 0 && <li>Noch keine Fahrzeuge vorhanden.</li>}
              </ul>

              <h4>Fahrzeug kaufen</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="field" style={{ flex: '1 1 160px' }}>
                  <select value={kaufTyp} onChange={(e) => setKaufTyp(e.target.value)}>
                    {kaufbareTypen.map((fahrzeugTyp) => (
                      <option key={fahrzeugTyp.typ} value={fahrzeugTyp.typ}>
                        {fahrzeugTyp.typ} – {fahrzeugTyp.preis} €
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={!kaufTyp}
                  onClick={() => buyVehicle(selected.id, kaufTyp)}
                >
                  Kaufen
                </button>
              </div>
            </div>
          ) : (
            <p>Keine Wache ausgewählt.</p>
          )}
        </div>
      </div>
    </div>
  );
}
