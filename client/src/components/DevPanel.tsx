import { useState } from 'react';

export interface DevPanelProps {
  balance: number;
  onSetBalance: (balance: number) => void;
  onTriggerTestIncident: () => void;
  onResetGameState: () => void;
  onSetTimeMultiplier: (multiplier: number) => void;
  timeMultiplier: number;
}

export function DevPanel({
  balance,
  onSetBalance,
  onTriggerTestIncident,
  onResetGameState,
  onSetTimeMultiplier,
  timeMultiplier,
}: DevPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [nextBalance, setNextBalance] = useState<number | string>(balance);

  const handleSetBalance = () => {
    const val = Number(nextBalance);
    if (Number.isFinite(val) && val >= 0) {
      onSetBalance(val);
      setNextBalance(val);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          padding: '8px 12px',
          background: '#666',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          zIndex: 9999,
        }}
      >
        🔧 Dev
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        width: 300,
        maxHeight: '80vh',
        overflow: 'auto',
        background: '#1a1a1a',
        border: '2px solid #666',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 12,
        zIndex: 9999,
        fontFamily: 'monospace',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong>DEV PANEL</strong>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #444' }}>
        <label style={{ display: 'block', marginBottom: 6 }}>
          <strong>Guthaben:</strong>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="number"
            value={nextBalance}
            onChange={(e) => setNextBalance(e.target.value)}
            style={{ flex: 1, padding: 6, background: '#333', color: '#fff', border: '1px solid #555' }}
            min="0"
          />
          <button
            type="button"
            onClick={handleSetBalance}
            style={{ padding: '6px 12px', background: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            SET
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#aaa' }}>
          Aktuell: {balance.toLocaleString('de-DE')} €
        </div>
      </div>

      <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #444' }}>
        <label style={{ display: 'block', marginBottom: 6 }}>
          <strong>Zeit-Multiplikator:</strong>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0.1, 0.5, 1, 2, 5].map((mult) => (
            <button
              key={mult}
              type="button"
              onClick={() => onSetTimeMultiplier(mult)}
              style={{
                flex: 1,
                padding: 6,
                background: timeMultiplier === mult ? '#2196F3' : '#444',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 4,
              }}
            >
              {mult}x
            </button>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#aaa' }}>
          Wartezeiten werden mit diesem Faktor verkürzt
        </div>
      </div>

      <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #444' }}>
        <button
          type="button"
          onClick={onTriggerTestIncident}
          style={{
            width: '100%',
            padding: 8,
            background: '#FF9800',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 4,
            marginBottom: 6,
          }}
        >
          📍 Test-Einsatz JETZT
        </button>
      </div>

      <div>
        <button
          type="button"
          onClick={() => {
            if (confirm('Spielstand wirklich zurücksetzen?')) {
              onResetGameState();
            }
          }}
          style={{
            width: '100%',
            padding: 8,
            background: '#f44336',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          🔴 RESET
        </button>
      </div>
    </div>
  );
}
