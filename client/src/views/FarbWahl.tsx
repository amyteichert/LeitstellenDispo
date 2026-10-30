import { FAHRZEUG_FARBEN, istLogoFarbe } from '@leitstellendispo/shared';

/** Lackfarbe wählen: Vorschläge, eigene Farbe oder Standard (`undefined`) */
export default function FarbWahl({ farbe, setFarbe, standardText }: {
  farbe: string | undefined;
  setFarbe: (farbe: string | undefined) => void;
  /** Beschriftung für „keine eigene Farbe“, z. B. „Standard“ oder „Wie die Wache“ */
  standardText: string;
}) {
  return (
    <div className="wache-anpassen__farben">
      <button
        type="button"
        className={`btn btn--klein ${farbe === undefined ? 'btn--primary' : ''}`}
        aria-pressed={farbe === undefined}
        onClick={() => setFarbe(undefined)}
      >
        {standardText}
      </button>
      {FAHRZEUG_FARBEN.map((vorschlag) => (
        <button
          key={vorschlag.farbe}
          type="button"
          className={`wache-anpassen__farbe ${farbe === vorschlag.farbe ? 'wache-anpassen__farbe--aktiv' : ''}`}
          style={{ background: vorschlag.farbe }}
          aria-label={vorschlag.name}
          aria-pressed={farbe === vorschlag.farbe}
          title={vorschlag.name}
          onClick={() => setFarbe(vorschlag.farbe)}
        />
      ))}
      <label className="wache-anpassen__eigene" title="Eigene Farbe">
        <input type="color" value={istLogoFarbe(farbe) ? farbe : '#c62828'} onChange={(e) => setFarbe(e.target.value)} aria-label="Eigene Fahrzeugfarbe" />
      </label>
    </div>
  );
}
