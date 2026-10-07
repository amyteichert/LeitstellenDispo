import { useMemo, useState } from 'react';
import { LEITSTELLE, getOffeneSprechwuensche, type FunkSpruch } from '@leitstellendispo/shared';

type Filter = 'Alle' | 'Status' | 'Lage' | 'Alarm';
const FILTER: Filter[] = ['Alle', 'Status', 'Lage', 'Alarm'];
const PASST: Record<Filter, (spruch: FunkSpruch) => boolean> = {
  Alle: () => true,
  Status: (s) => s.art === 'status' || s.art === 'sprechwunsch',
  Lage: (s) => s.art === 'lage' || s.art === 'sprechaufforderung',
  Alarm: (s) => s.art === 'alarm',
};

const uhrzeit = (zeit: number) => new Date(zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Funkverkehr der Leitstelle mit Sprechwünschen (Status 5) zum Beantworten. */
export default function FunkView({
  funk,
  onSprechaufforderung,
  onEinsatzOeffnen,
}: {
  funk: FunkSpruch[];
  onSprechaufforderung: (sprechwunschId: string) => void;
  onEinsatzOeffnen: (einsatzId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('Alle');
  const offen = getOffeneSprechwuensche(funk);
  const liste = useMemo(() => funk.filter(PASST[filter]).slice(0, 150), [funk, filter]);

  return (
    <div>
      <h2>📻 Funk</h2>

      {offen.length > 0 && (
        <section className="einsatz-abschnitt">
          <h4>Sprechwünsche ({offen.length})</h4>
          <ul className="funk-liste">
            {offen.map((wunsch) => (
              <li key={wunsch.id} className="funk-zeile funk-zeile--sprechwunsch">
                <span className="funk-zeile__zeit">{uhrzeit(wunsch.zeit)}</span>
                <span className="funk-status">S5</span>
                <span className="funk-zeile__text"><strong>{wunsch.von}</strong> {wunsch.text}</span>
                <button type="button" className="btn btn--primary" onClick={() => onSprechaufforderung(wunsch.id)}>
                  Sprechaufforderung
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="verwalten-reiter" role="tablist">
        {FILTER.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={filter === name} className={`btn ${filter === name ? 'btn--primary' : ''}`} onClick={() => setFilter(name)}>
            {name}
          </button>
        ))}
      </div>

      {liste.length === 0 ? (
        <div className="leerzustand">
          <strong>Noch kein Funkverkehr</strong>
          Sobald Fahrzeuge alarmiert werden, erscheinen hier Statusmeldungen und Funksprüche.
        </div>
      ) : (
        <ul className="funk-liste">
          {liste.map((spruch) => (
            <li key={spruch.id} className={`funk-zeile funk-zeile--${spruch.art} ${spruch.von === LEITSTELLE ? 'funk-zeile--leitstelle' : ''}`}>
              <span className="funk-zeile__zeit">{uhrzeit(spruch.zeit)}</span>
              {spruch.status !== undefined ? <span className={`funk-status funk-status--${spruch.status}`}>S{spruch.status}</span> : <span className="funk-status funk-status--leer">📻</span>}
              <span className="funk-zeile__text">
                <strong>{spruch.von}</strong> → {spruch.an}: {spruch.art === 'sprechwunsch' && !spruch.offen ? `${spruch.text} – beantwortet` : spruch.text}
              </span>
              {spruch.einsatzId && (
                <button type="button" className="btn" onClick={() => onEinsatzOeffnen(spruch.einsatzId!)} aria-label="Einsatz öffnen">↗</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
