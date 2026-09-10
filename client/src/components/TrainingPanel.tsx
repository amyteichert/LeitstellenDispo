import { useState } from 'react';
import type { MapLocation } from '../types';

const TRAINING_COURSES = [
  { id: 'Basic', label: 'Grundausbildung', durationMinutes: 30, cost: 1000 },
  { id: 'Advanced', label: 'Fortgeschrittene', durationMinutes: 45, cost: 3000 },
  { id: 'Leadership', label: 'Führung', durationMinutes: 60, cost: 5000 },
];

interface TrainingPanelProps {
  station: MapLocation;
  onStartTraining: (stationId: string, staffIds: string[], courseType: string, durationMinutes: number) => void;
  onCompleteTraining: (stationId: string, trainingId: string) => void;
}

export function TrainingPanel({ station, onStartTraining, onCompleteTraining }: TrainingPanelProps) {
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [selectedCourse, setSelectedCourse] = useState<string>('Basic');

  const availableStaff = (station.staffMembers ?? []).filter((s) => !s.inTraining && !s.assignedVehicleId);
  const activeTrainings = station.activeTrainings ?? [];

  const handleToggleStaff = (staffId: string) => {
    const newSelected = new Set(selectedStaff);
    if (newSelected.has(staffId)) {
      newSelected.delete(staffId);
    } else {
      newSelected.add(staffId);
    }
    setSelectedStaff(newSelected);
  };

  const handleStartTraining = () => {
    if (selectedStaff.size === 0) {
      alert('Bitte mindestens eine Person auswählen.');
      return;
    }
    const course = TRAINING_COURSES.find((c) => c.id === selectedCourse);
    if (course) {
      onStartTraining(station.id, Array.from(selectedStaff), course.id, course.durationMinutes);
      setSelectedStaff(new Set());
    }
  };

  return (
    <div style={{ padding: 16, backgroundColor: '#f9f9f9', borderRadius: 8, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Ausbildung</h3>

      {activeTrainings.length > 0 && (
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#e3f2fd', borderRadius: 4 }}>
          <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#1976D2', fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
            Laufende Ausbildungen
          </label>
          {activeTrainings.map((training) => (
            <div key={training.id} style={{ marginBottom: 8, padding: 8, backgroundColor: '#fff', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {training.courseType} ({training.participants.length} Personen)
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Endet: {new Date(training.endsAt).toLocaleTimeString('de-DE')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCompleteTraining(station.id, training.id)}
                style={{
                  padding: '6px 12px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Abschließen
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#666', marginBottom: 4, display: 'block' }}>
          Ausbildungskurs
        </label>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          style={{
            width: '100%',
            padding: 8,
            border: '1px solid #ddd',
            borderRadius: 4,
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          {TRAINING_COURSES.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label} ({course.durationMinutes}min, ${course.cost})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#666', marginBottom: 8, display: 'block' }}>
          Personal auswählen ({selectedStaff.size} / {availableStaff.length})
        </label>
        {availableStaff.length === 0 ? (
          <div style={{ color: '#999', fontSize: 14 }}>Kein verfügbares Personal</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {availableStaff.map((staff) => (
              <label
                key={staff.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 8,
                  backgroundColor: selectedStaff.has(staff.id) ? '#e8f5e9' : '#f5f5f5',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: selectedStaff.has(staff.id) ? '2px solid #4CAF50' : '1px solid #ddd',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedStaff.has(staff.id)}
                  onChange={() => handleToggleStaff(staff.id)}
                  style={{ marginRight: 8, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold' }}>{staff.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {staff.qualifications?.length ? staff.qualifications.join(', ') : 'Keine Qualifikationen'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleStartTraining}
        disabled={selectedStaff.size === 0}
        style={{
          width: '100%',
          padding: 10,
          background: selectedStaff.size === 0 ? '#ccc' : '#2196F3',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: selectedStaff.size === 0 ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        Ausbildung starten
      </button>
    </div>
  );
}
