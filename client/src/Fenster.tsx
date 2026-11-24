import type { ReactNode } from 'react';

/** Fenster in der Bildschirmmitte mit Titel und ✕ – ein Klick auf den abgedunkelten Hintergrund schließt es. */
export default function Fenster({ titel, label, onClose, className, modal = false, children }: {
  titel: ReactNode;
  label: string;
  onClose: () => void;
  className?: string;
  modal?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ruf-fenster__hintergrund" onClick={onClose}>
      <div className={className ? `ruf-fenster ${className}` : 'ruf-fenster'} role="dialog" aria-modal={modal ? 'true' : undefined} aria-label={label} onClick={(event) => event.stopPropagation()}>
        <div className="ruf-fenster__kopf">
          <h3>{titel}</h3>
          <button type="button" className="btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
