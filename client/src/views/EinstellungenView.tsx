import { useState } from 'react';

export default function EinstellungenView({ defaultView }: { defaultView?: string }) {
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
    </div>
  );
}
