import { FMS_STATUS_LABELS, type FmsStatus, type OperationalFmsStatus } from '@leitstellendispo/shared';

export type Vehicle = {
  id: string;
  name: string;
  type?: string;
  stationId?: string;
  price: number;
  callsign?: string; // Funkrufname
  status?: 'Einsatzbereit' | 'Alarmiert / auf Anfahrt' | 'Im Einsatz' | 'Nicht einsatzbereit';
  fmsStatus?: FmsStatus;
  speechRequest?: boolean;
  previousOperationalStatus?: OperationalFmsStatus;
  returnAt?: number;
  crewRequired?: number;
  crewCapacity?: number;
  assignedStaffIds?: string[];
};

export const getFmsStatus = (vehicle: Vehicle): FmsStatus => vehicle.fmsStatus ?? 2;
export const getFmsStatusLabel = (vehicle: Vehicle) => FMS_STATUS_LABELS[getFmsStatus(vehicle)];

import { useState } from 'react';

export default function FahrzeugeView({ vehicles, stations, onAcknowledgeSpeechRequest, onToggleAvailability, onUpdateCallsign }: { vehicles: any[]; addVehicle: (v: Omit<any, 'id'>) => void; stations: any[]; onAcknowledgeSpeechRequest?: (vehicleId: string) => void; onToggleAvailability?: (vehicleId: string) => void; onUpdateCallsign?: (vehicleId: string, callsign: string) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  return (
    <div className="view-screen">
      <div className="screen-heading"><div><span className="eyebrow">Fuhrpark</span><h2>Fahrzeuge</h2></div><span className="screen-count">{vehicles.length} Einheiten</span></div>
      <div className="section-panel fleet-panel">
        <div>
          <h3>Bestehende Fahrzeuge</h3>
          <ul className="vehicle-grid">
            {vehicles.map((v) => (
              <li key={v.id}>
                <div className={`vehicle-card ${v.type === 'RTW' ? 'vehicle-card--rescue' : 'vehicle-card--fire'}${v.speechRequest ? ' vehicle-card--speech-request' : ''}`}>
                  <div className="vehicle-card__header">
                    {editingId === v.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => {
                            if (onUpdateCallsign && editingValue.trim()) {
                              onUpdateCallsign(v.id, editingValue.trim());
                            }
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (onUpdateCallsign && editingValue.trim()) {
                                onUpdateCallsign(v.id, editingValue.trim());
                              }
                              setEditingId(null);
                            }
                            if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          style={{
                            padding: 4,
                            fontSize: 14,
                            fontWeight: 'bold',
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            flex: 1,
                          }}
                        />
                      </div>
                    ) : (
                      <strong
                        className="vehicle-callsign"
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                        onClick={() => {
                          setEditingId(v.id);
                          setEditingValue(v.callsign ?? v.name ?? '');
                        }}
                        title="Klick zum Bearbeiten"
                      >
                        {v.callsign ?? v.name}
                      </strong>
                    )}
                    <span className={`vehicle-status vehicle-status--fms-${getFmsStatus(v)}`}>
                      [{getFmsStatus(v)}] {getFmsStatusLabel(v)}
                    </span>
                  </div>
                  <div className="vehicle-type">{v.type ?? '–'}</div>
                  {v.speechRequest && onAcknowledgeSpeechRequest && (
                    <div className="vehicle-speech-request">
                      <span>Fahrzeug fordert Funkkontakt an</span>
                      <button className="vehicle-speech-button" type="button" onClick={() => onAcknowledgeSpeechRequest(v.id)}>
                        Sprechwunsch annehmen
                      </button>
                    </div>
                  )}
                  {onToggleAvailability && (
                    <button className="vehicle-availability-button" type="button" onClick={() => onToggleAvailability(v.id)}>
                      {getFmsStatus(v) === 6 ? 'Einsatzbereit setzen' : 'Status 6 setzen'}
                    </button>
                  )}
                  <div className="vehicle-meta">
                    {v.stationId ? (stations.find((s) => s.id === v.stationId)?.name ?? v.stationId) : 'Nicht zugeordnet'}
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
