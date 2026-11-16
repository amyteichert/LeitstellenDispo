import { Component, type ErrorInfo, type ReactNode } from 'react';
import { spielstandSpeicher } from './spielstand';

/**
 * Fängt Abstürze der Oberfläche ab: statt einer weißen Seite gibt es eine Meldung
 * mit „Neu laden“ und – falls der Spielstand die Ursache ist – „Spielstand zurücksetzen“.
 */
export default class Fehlergrenze extends Component<{ children: ReactNode }, { fehler: Error | null }> {
  state = { fehler: null as Error | null };

  static getDerivedStateFromError(fehler: Error) {
    return { fehler };
  }

  componentDidCatch(fehler: Error, info: ErrorInfo) {
    console.error('LeitstellenDispo ist abgestürzt:', fehler, info.componentStack);
  }

  private zuruecksetzen = async () => {
    if (!confirm('Spielstand wirklich löschen und ein neues Spiel starten?')) return;
    await spielstandSpeicher.loeschen();
    window.location.reload();
  };

  render() {
    if (!this.state.fehler) return this.props.children;
    return (
      <div className="leerzustand" role="alert" style={{ maxWidth: 560, margin: '48px auto' }}>
        <strong>Ups – hier ist etwas schiefgelaufen.</strong>
        <p>Die Leitstelle konnte nicht angezeigt werden. Lade die Seite neu. Hilft das nicht, ist vermutlich der gespeicherte Spielstand beschädigt.</p>
        <p style={{ fontSize: 12 }}>Fehler: {this.state.fehler.message}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>Neu laden</button>
          <button type="button" className="btn btn--danger" onClick={this.zuruecksetzen}>Spielstand zurücksetzen</button>
        </div>
      </div>
    );
  }
}
