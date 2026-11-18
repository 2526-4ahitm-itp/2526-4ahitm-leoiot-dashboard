import './ui/styles.css';
import { App } from './app';
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
import { RoomWatermark } from './ui/watermark';

document.title = strings.title;
const root = document.getElementById('app')!;
const watermark = new RoomWatermark();
const stage = el('main', 'stage');
const controls = new Controls();
const panel = new InfoPanel();
const navigation = new Navigation();
const routeLegend = new RouteLegend();
const loading = new LoadingScreen();
const dock = el('div', 'dock');
dock.append(controls.element, controls.overlaysElement, navigation.element);
// watermark comes before stage: the canvas is transparent (see Viewer) where the
// scene shows no geometry, so the watermark shows through there and is otherwise
// occluded by the opaque building, painted on top of it in DOM order.
root.append(watermark.element, stage, panel.element, dock, navigation.nextFloorElement, routeLegend.element, loading.element);

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
  new App(viewer, models, store, controls, panel, navigation, routeLegend, watermark);
}

loading.onRetry = () => void load();
void load();
