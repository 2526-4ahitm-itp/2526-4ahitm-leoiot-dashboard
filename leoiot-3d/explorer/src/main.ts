import './ui/styles.css';
import { App } from './app';
import { RoomStore } from './core/store';
import { connectBroker } from './live/broker';
import { LoadError, loadModels, type Model, type ViewId } from './scene/models';
import { Viewer } from './scene/viewer';
import { Controls } from './ui/controls';
import { el } from './ui/dom';
import { FloorStepper } from './ui/floorStepper';
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
const floorStepper = new FloorStepper();
const panel = new InfoPanel();
const navigation = new Navigation();
const routeLegend = new RouteLegend();
const loading = new LoadingScreen();
// "The rest of the menu" (view reset, overlays, search): one dock, left-aligned.
const dock = el('div', 'dock');
// Largest group first: Overlays (two buttons), then Search, then Reset View (one each).
dock.append(controls.overlaysElement, navigation.element, controls.resetElement);
// watermark comes before stage: the canvas is transparent (see Viewer) where the
// scene shows no geometry, so the watermark shows through there and is otherwise
// occluded by the opaque building, painted on top of it in DOM order.
root.append(
  watermark.element,
  stage,
  panel.element,
  routeLegend.element,
  // The gym arrow sits at the same vertical centre as .route-legend (on
  // request), so it can overlap the legend during a route; appending it
  // (and the other floor arrows) after the legend keeps it painted on
  // top, so it stays visible and clickable rather than hidden underneath.
  floorStepper.upElement,
  floorStepper.downElement,
  floorStepper.gymElement,
  floorStepper.backElement,
  dock,
  navigation.nextFloorElement,
  loading.element,
);

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
  new App(viewer, models, store, controls, floorStepper, panel, navigation, routeLegend, watermark);
}

loading.onRetry = () => void load();
void load();
