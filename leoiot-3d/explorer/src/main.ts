import './ui/styles.css';
import { App } from './app';
import { roomFromAddress } from './core/roomAddress';
import { RoomStore } from './core/store';
import { connectBroker } from './live/broker';
import { LoadError, loadModels, type Model, type ViewId } from './scene/models';
import { Viewer } from './scene/viewer';
import { Controls } from './ui/controls';
import { el } from './ui/dom';
import { LoadingScreen } from './ui/loading';
import { Navigation } from './ui/navigation';
import { InfoPanel } from './ui/panel';
import { RouteLegend } from './ui/routeLegend';
import { strings } from './ui/strings';

document.title = strings.title;
const root = document.getElementById('app')!;
const stage = el('main', 'stage');
const controls = new Controls();
const panel = new InfoPanel();
const navigation = new Navigation();
const routeLegend = new RouteLegend();
const loading = new LoadingScreen();
root.append(stage, panel.element, controls.element, navigation.element, routeLegend.element, loading.element);

const viewer = new Viewer(stage);
const store = new RoomStore();
// Live data is collected while the models load
connectBroker(store);

const models = new Map<ViewId, Model>();

async function load(): Promise<void> {
  loading.show();
  try {
    await loadModels(models, (done, total, bytes) => loading.loading(done, total, bytes));
  } catch (err) {
    loading.failed(err instanceof LoadError ? strings.loadErrorDetail(err.failed, err.total) : '');
    console.error(err);
    return;
  }
  loading.hide();
  const app = new App(viewer, models, store, controls, panel, navigation, routeLegend);
  // `/3d/?room=<id>` opens that room once the models are there (spec platform/room-links)
  const room = roomFromAddress(location.search);
  if (room !== null) app.openRoom(room);
}

loading.onRetry = () => void load();
void load();
