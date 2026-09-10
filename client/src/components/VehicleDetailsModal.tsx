import { useState } from 'react';

interface VehicleDetailsModalProps {
  vehicle: any;
  stations: any[];
  staff: any[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateCallsign?: (vehicleId: string, callsign: string) => void;
}

export function VehicleDetailsModal({
  vehicle,
  stations,
  staff,
  isOpen,
  onClose,
  onUpdateCallsign,
}: VehicleDetailsModalProps) {
  const [isEditingCallsign, setIsEditingCallsign] = useState(false);
  const [editingCallsignValue, setEditingCallsignValue] = useState(vehicle?.callsign || vehicle?.name || '');

  if (!isOpen || !vehicle) {
    return null;
  }

  const station = stations.find((s) => s.id === vehicle.stationId);
  const assignedStaff = staff.filter((s) => vehicle.assignedStaffIds?.includes(s.id));

  const handleSaveCallsign = () => {
    if (onUpdateCallsign && editingCallsignValue.trim()) {
      onUpdateCallsign(vehicle.id, editingCallsignValue.trim());
      setIsEditingCallsign(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 24,
          maxWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Fahrzeugdetails</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#666', marginBottom: 4, display: 'block' }}>
            Funk rufzeichen
          </label>
          {isEditingCallsign ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                type="text"
                value={editingCallsignValue}
                onChange={(e) => setEditingCallsignValue(e.target.value)}
                style={{
                  flex: 1,
                  padding: 8,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              />
              <button
                type="button"
                onClick={handleSaveCallsign}
                style={{
                  padding: '8px 12px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={() => setIsEditingCallsign(false)}
                style={{
                  padding: '8px 12px',
                  background: '#999',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingCallsign(true)}
              style={{
                padding: 8,
                backgroundColor: '#f5f5f5',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 'bold',
              }}
            >
              {vehicle.callsign || vehicle.name}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#666', marginBottom: 4, display: 'block' }}>
              Typ
            </label>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>{vehicle.type || '–'}</div>
          </div>
          <div>
            <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#666', marginBottom: 4, display: 'block' }}>
              FMS Status
            </label>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>FMS {vehicle.fmsStatus || 2}</div>
          </div>
          <div>
            <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#666', marginBottom: 4, display: 'block' }}>
              Wache
            </label>
            <div style={{ fontSize: 14 }}>{station?.name || '–'}</div>
          </div>
          <div>
            <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#666', marginBottom: 4, display: 'block' }}>
              Status
            </label>
            <div style={{ fontSize: 14 }}>{vehicle.status || 'Einsatzbereit'}</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#666', marginBottom: 8, display: 'block' }}>
            Besetzung ({assignedStaff.length} / {vehicle.crewCapacity || 0})
          </label>
          {assignedStaff.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {assignedStaff.map((s) => (
                <li key={s.id} style={{ padding: 8, backgroundColor: '#f0f0f0', marginBottom: 4, borderRadius: 4 }}>
                  <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {s.qualifications && s.qualifications.length > 0
                      ? s.qualifications.join(', ')
                      : 'Keine Qualifikationen'}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#999' }}>Keine Besatzung zugewiesen</div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: 12,
            background: '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 'bold',
          }}
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
