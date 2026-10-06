import { FAEHIGKEIT_LABELS, FMS_STATUS, getFahrzeugTyp } from '@leitstellendispo/shared';
import type { Vehicle } from '../types';

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
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
                  <strong>{v.callsign ? `${v.callsign} (${v.name})` : v.name}</strong>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Typ: {v.type ?? '–'} · Status {FMS_STATUS[v.status ?? 'Einsatzbereit']}: {v.status ?? 'Einsatzbereit'}
                  </div>
                  {getFahrzeugTyp(v.type) && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      Besatzung: {v.besatzung ?? getFahrzeugTyp(v.type)!.besatzung}/{getFahrzeugTyp(v.type)!.besatzung}
                      {' · '}{getFahrzeugTyp(v.type)!.faehigkeiten.map((f) => FAEHIGKEIT_LABELS[f]).join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
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
