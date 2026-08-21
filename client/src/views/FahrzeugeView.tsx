export type Vehicle = {
  id: string;
  name: string;
  stationId?: string;
  price: number;
};

export default function FahrzeugeView({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <div>
      <h2>Fahrzeuge</h2>
      <p>Globale Fahrzeugübersicht.</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {vehicles.map((v) => (
          <li key={v.id} style={{ marginBottom: 8 }}>
            <div style={{ padding: 10, borderRadius: 8, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
              <strong>{v.name}</strong>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Preis: {v.price} €</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Station: {v.stationId ?? 'Nicht zugeordnet'}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
