import { useState } from 'react';

export default function EinstellungenView({
  defaultView,
  onNeuesSpiel,
  tonAn,
  setTonAn,
}: {
  defaultView?: string;
  onNeuesSpiel: () => void;
  tonAn: boolean;
  setTonAn: (an: boolean) => void;
}) {
  const [local, setLocal] = useState(defaultView ?? 'Karte');

  return (
    <div>
      <h2>Einstellungen</h2>
      <div style={{ padding: 8, background: 'var(--color-surface)', borderRadius: 8 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Standardansicht beim Start
        </label>
        <select value={local} onChange={(e) => setLocal(e.target.value)}>
          <option>Karte</option>
          <option>Wachen</option>
          <option>Fahrzeuge</option>
          <option>Einsätze</option>
        </select>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>Hinweis: Diese Einstellung ist derzeit nur UI-seitig vorbereitet.</p>
      </div>

      <div style={{ padding: 8, background: 'var(--color-surface)', borderRadius: 8, marginTop: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Alarmton</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={tonAn} onChange={(e) => setTonAn(e.target.checked)} />
          Gong bei neuen Einsätzen und Lagemeldungen
        </label>
      </div>

      <div style={{ padding: 8, background: 'var(--color-surface)', borderRadius: 8, marginTop: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Spielstand</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Dein Spiel wird automatisch gespeichert. Ein neues Spiel löscht den aktuellen Spielstand.
        </p>
        <button className="btn btn--danger" type="button" onClick={onNeuesSpiel}>Neues Spiel starten</button>
      </div>
    </div>
  );
}
