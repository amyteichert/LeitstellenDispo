import { useEffect, useState } from 'react';
import { EINSATZ_STATUS_LABELS, formatEinsatzTitel, type Einsatz } from '@leitstellendispo/shared';

export function useServerEinsaetze() {
  const [einsaetze, setEinsaetze] = useState<Einsatz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/einsaetze')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Einsatz[]>;
      })
      .then((data) => {
        if (!cancelled) setEinsaetze(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { einsaetze, loading, error };
}

export default function ServerEinsaetzeList({
  einsaetze,
  loading,
  error,
  selectedId,
  onSelect,
}: {
  einsaetze: Einsatz[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Vom Server</div>
      {loading && <p>Lade Einsätze…</p>}
      {error && <p>Einsätze konnten nicht geladen werden: {error}</p>}
      {!loading && !error && einsaetze.length === 0 && <p>Keine Einsätze vom Server.</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {einsaetze.map((einsatz) => (
          <li key={einsatz.id}>
            <button
              type="button"
              className={`view-menu-item view-menu-item--light ${selectedId === einsatz.id ? 'active' : ''}`}
              onClick={() => onSelect(einsatz.id)}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <strong>{formatEinsatzTitel(einsatz)}</strong>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {einsatz.id} · {EINSATZ_STATUS_LABELS[einsatz.status]}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
