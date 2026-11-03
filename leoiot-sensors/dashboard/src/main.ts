import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-500.css';
import '@fontsource/lexend/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';
import { startApp } from './app';
import { liveUrl } from './core/live';
import { createQuery } from './data/api';
import type { MqttLike } from './data/feed';

const dark = window.matchMedia('(prefers-color-scheme: dark)');
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}

const app = startApp({
  doc: document,
  search: location.search,
  storage,
  prefersDark: () => dark.matches,
  query: createQuery(),
  // Anonymous, read-only access to the room messages through the platform's /mqtt route.
  connect: async () => {
    const { default: mqtt } = await import('mqtt');
    return mqtt.connect(liveUrl(location), {
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
      clientId: `leoiot-sensors-${Math.random().toString(16).slice(2, 10)}`,
    }) as unknown as MqttLike;
  },
  charts: async () => (await import('./ui/echartsApi')).echartsApi,
  now: () => Date.now(),
  onSchemeChange: (listener) => dark.addEventListener('change', listener),
});

addEventListener('pagehide', () => app.dispose());
