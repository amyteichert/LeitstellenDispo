import { APP_VERSION } from '@leitstellendispo/shared';
import BotView from './views/BotView';
import { useBot } from './useBot';
import './index.css';
import './App.css';

/**
 * Eigenständige Bot-Seite (eigener Link `/bot.html`, eigener Browser-Tab).
 * Nutzt denselben Bot-Hook und dieselbe Ansicht wie im Spiel, läuft aber in einem
 * eigenen Fenster weiter – praktisch, um nebenbei zuzuschauen, während man spielt.
 */
export default function BotApp() {
  const bot = useBot();

  return (
    <div className="app-shell">
      <header className="topbar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <strong style={{ fontSize: 18 }}>🤖 LeitstellenDispo – Bot</strong>
        <span className="chip">V{APP_VERSION}</span>
        <a href="/" style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: 14 }}>← Zum Spiel</a>
      </header>
      <main style={{ padding: 16, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <BotView bot={bot} />
      </main>
    </div>
  );
}
