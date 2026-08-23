export type Vehicle = {
  id: string;
  name: string;
  type?: string;
  stationId?: string;
  price: number;
  callsign?: string; // Funkrufname
  status?: 'Einsatzbereit' | 'Alarmiert / auf Anfahrt' | 'Im Einsatz';
};

export default function FahrzeugeView({ vehicles, stations }: { vehicles: Vehicle[]; addVehicle: (v: Omit<Vehicle, 'id'>) => void; stations: any[] }) {
  return (
    <div>
      <h2>Fahrzeuge</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <h3>Bestehende Fahrzeuge</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {vehicles.map((v) => (
              <li key={v.id} style={{ marginBottom: 8 }}>
                <div style={{ padding: 10, borderRadius: 8, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
                  <strong>{v.callsign ? `${v.callsign} (${v.name})` : v.name}</strong>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Typ: {v.type ?? '–'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Station: {v.stationId ? (stations.find((s) => s.id === v.stationId)?.name ?? v.stationId) : 'Nicht zugeordnet'}
                  </div>
                </div>
              </li>
            ))}
            {vehicles.length === 0 && <li>Keine Fahrzeuge vorhanden.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
