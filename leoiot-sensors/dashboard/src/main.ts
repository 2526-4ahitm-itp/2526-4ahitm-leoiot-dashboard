import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-500.css';
import '@fontsource/lexend/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';
import { startApp } from './app';
import { startListApp } from './listApp';
import { roomFromSearch } from './core/room';
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

const connect = async () => {
  // Anonymous, read-only access to the room messages through the platform's /mqtt route.
  const { default: mqtt } = await import('mqtt');
  return mqtt.connect(liveUrl(location), {
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    clientId: `leoiot-sensors-${Math.random().toString(16).slice(2, 10)}`,
  }) as unknown as MqttLike;
};
const shared = {
  doc: document,
  storage,
  prefersDark: () => dark.matches,
  query: createQuery(),
  connect,
  now: () => Date.now(),
  onSchemeChange: (listener: () => void) => dark.addEventListener('change', listener),
};

// A room in the address starts the room page, no room starts the room list.
const app = roomFromSearch(location.search)
  ? startApp({ ...shared, search: location.search, charts: async () => (await import('./ui/echartsApi')).echartsApi, navigate: (href) => location.assign(href) })
  : startListApp({ ...shared, search: location.search, replaceSearch: (search) => history.replaceState(history.state, '', `${location.pathname}${search}${location.hash}`) });

addEventListener('pagehide', () => app.dispose());
