import { getVehicleTypeSpec } from '@leitstellendispo/shared';

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
            {vehicles.map((v) => {
              const spec = getVehicleTypeSpec(v.type);

              return (
                <li key={v.id} style={{ marginBottom: 8 }}>
                  <div style={{ padding: 10, borderRadius: 8, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
                    <strong>{v.callsign ? `${v.callsign} (${v.name})` : v.name}</strong>
                    <div style={{ fontSize: 12, color: '#6b7280', display: 'grid', gap: 4, marginTop: 4 }}>
                      <div>Typ: {v.type ?? '–'}</div>
                      <div>
                        {spec ? (
                          <>
                            Besatzung: {spec.regularCrew}/{spec.maxCrew} · Wasser: {spec.waterLiters.toLocaleString('de-DE')} L
                            {typeof spec.foamLiters === 'number' ? ` · Schaum: ${spec.foamLiters.toLocaleString('de-DE')} L` : ''}
                            {' · '}
                            Pumpe: {spec.pumpOutputLitersPerMinute.toLocaleString('de-DE')} l/min
                          </>
                        ) : (
                          'Technische Stammdaten noch nicht hinterlegt.'
                        )}
                      </div>
                      {spec && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {spec.tags.map((tag) => (
                            <span key={tag} style={{ padding: '2px 6px', borderRadius: 999, background: '#eef2ff', color: '#3730a3' }}>{tag}</span>
                          ))}
                        </div>
                      )}
                      <div>
                        Station: {v.stationId ? (stations.find((s) => s.id === v.stationId)?.name ?? v.stationId) : 'Nicht zugeordnet'}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            {vehicles.length === 0 && <li>Keine Fahrzeuge vorhanden.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
