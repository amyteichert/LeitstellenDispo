import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Fängt Abstürze der Oberfläche ab: statt einer weißen Seite gibt es eine Meldung mit „Neu laden“.
 * Der Spielstand liegt im Konto auf dem Server – ein Neuladen holt ihn zurück, es geht nichts verloren.
 */
export default class Fehlergrenze extends Component<{ children: ReactNode }, { fehler: Error | null }> {
  state = { fehler: null as Error | null };

  static getDerivedStateFromError(fehler: Error) {
    return { fehler };
  }

  componentDidCatch(fehler: Error, info: ErrorInfo) {
    console.error('LeitstellenDispo ist abgestürzt:', fehler, info.componentStack);
  }

  render() {
    if (!this.state.fehler) return this.props.children;
    return (
      <div className="leerzustand" role="alert" style={{ maxWidth: 560, margin: '48px auto' }}>
        <strong>Ups – hier ist etwas schiefgelaufen.</strong>
        <p>
          Die Leitstelle konnte nicht angezeigt werden. Dein Spielstand liegt sicher in deinem Konto auf dem Server –
          lade die Seite neu, dann geht es weiter.
        </p>
        <p style={{ fontSize: 12, opacity: 0.8 }}>Fehler: {this.state.fehler.message}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>Neu laden</button>
        </div>
        <p style={{ fontSize: 12, marginTop: 12 }}>
          Bleibt der Fehler, melde ihn bitte dem Team – am besten mit dem, was du zuletzt gemacht hast.
        </p>
      </div>
    );
  }
}
