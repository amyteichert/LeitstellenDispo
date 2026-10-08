import { useState } from 'react';
import type { Konto, UserRole } from '@leitstellendispo/shared';
import { STARTANSICHTEN, ladeStartansicht, speichereStartansicht, type Ansicht } from '../startansicht';
import { RechtlicheLinks } from '../Rechtliches';

const ROLLEN_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-Owner',
  admin: 'Admin',
  player: 'Spieler',
};

export default function EinstellungenView({
  onNeuesSpiel,
  tonAn,
  setTonAn,
  konto,
  onAbmelden,
}: {
  onNeuesSpiel: () => void;
  tonAn: boolean;
  setTonAn: (an: boolean) => void;
  konto: Konto;
  onAbmelden: () => Promise<void>;
}) {
  const [startansicht, setStartansicht] = useState<Ansicht>(ladeStartansicht);
  const [meldetAb, setMeldetAb] = useState(false);

  return (
    <div>
      <h2>Einstellungen</h2>
      <div style={{ padding: 8, background: 'var(--color-surface)', borderRadius: 8 }}>
        <h3 style={{ marginBottom: 6 }}>Ansicht beim Start</h3>
        <label className="field" style={{ maxWidth: 260 }}>
          <select
            value={startansicht}
            onChange={(e) => {
              const ansicht = e.target.value as Ansicht;
              setStartansicht(ansicht);
              speichereStartansicht(ansicht);
            }}
          >
            {STARTANSICHTEN.map((ansicht) => <option key={ansicht}>{ansicht}</option>)}
          </select>
        </label>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>Wird auf diesem Gerät gemerkt.</p>
      </div>

      <div style={{ padding: 8, background: 'var(--color-surface)', borderRadius: 8, marginTop: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Alarmton</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={tonAn} onChange={(e) => setTonAn(e.target.checked)} />
          Gong bei neuen Einsätzen und Lagemeldungen
        </label>
      </div>

      <div style={{ padding: 8, background: 'var(--color-surface)', borderRadius: 8, marginTop: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Konto</h3>
        <p style={{ marginBottom: 8 }}>
          Angemeldet als <strong>{konto.name}</strong> ({ROLLEN_LABELS[konto.rolle]})
        </p>
        <button
          className="btn btn--secondary"
          type="button"
          disabled={meldetAb}
          onClick={() => {
            setMeldetAb(true);
            void onAbmelden();
          }}
        >
          {meldetAb ? 'Speichere und melde ab …' : 'Abmelden'}
        </button>
      </div>

      <div style={{ padding: 8, background: 'var(--color-surface)', borderRadius: 8, marginTop: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Spielstand</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Dein Spiel wird automatisch in deinem Konto gespeichert – so kannst du auf jedem Gerät weiterspielen. Ein neues Spiel löscht den aktuellen Spielstand.
        </p>
        <button className="btn btn--danger" type="button" onClick={onNeuesSpiel}>Neues Spiel starten</button>
      </div>

      <RechtlicheLinks />
    </div>
  );
}
