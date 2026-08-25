import { useState } from 'react';

export default function EinstellungenView({ defaultView }: { defaultView?: string }) {
  const [local, setLocal] = useState(defaultView ?? 'Karte');

  return (
    <div className="view-screen settings-screen">
      <div className="screen-heading"><div><span className="eyebrow">System</span><h2>Einstellungen</h2></div></div>
      <div className="section-panel settings-card">
        <label style={{ display: 'block', marginBottom: 8 }}>
          Standardansicht beim Start
        </label>
        <select value={local} onChange={(e) => setLocal(e.target.value)}>
          <option>Leitstelle</option>
          <option>Karte</option>
          <option>Wachen</option>
          <option>Fahrzeuge</option>
          <option>Einsätze</option>
        </select>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Hinweis: Diese Einstellung ist derzeit nur UI-seitig vorbereitet.</p>
      </div>
    </div>
  );
}
