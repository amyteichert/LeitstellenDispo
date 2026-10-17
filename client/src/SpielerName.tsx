import { istGruendungsSpieler, type Konto } from '@leitstellendispo/shared';

/**
 * Name eines Spielers mit seinen Abzeichen. Überall verwenden, wo andere Spieler einen Namen sehen
 * (Team, später Gruppen und Bestenliste) – so erscheinen Abzeichen einheitlich.
 */
export default function SpielerName({ konto }: { konto: Pick<Konto, 'name' | 'erstellt'> }) {
  return (
    <span className="spieler-name">
      <strong>{konto.name}</strong>
      {istGruendungsSpieler(konto) && (
        <span className="abzeichen" title="Gründungs-Spieler – schon in der Alpha dabei" aria-label="Gründungs-Spieler">
          🎖️
        </span>
      )}
    </span>
  );
}
