// The hallway display (`/sensors/?kiosk`): every room of the school, paged by floor, with the rooms
// that need airing always in view. No controls; it runs for weeks without anyone touching it. It
// reads the same rooms source as the room list and never touches storage: language and theme come
// from the address.
import { filterEntries, listEntries, floorKey } from './core/roomList';
import { makeFormat } from './core/format';
import { kioskPages, kioskParams, nextReloadAt, type KioskPage } from './core/kiosk';
import type { FeedMode, Timers } from './data/feed';
import { startRoomsSource } from './data/roomsSource';
import type { App, AppDeps } from './app';
import { REJUDGE_MS } from './listApp';
import { bindKioskDom, measureLayout, renderClock, renderKiosk } from './ui/kiosk';

export type KioskAppDeps = Pick<AppDeps, 'doc' | 'query' | 'connect' | 'now' | 'timers'> & {
  /** The address's query string at start (`?kiosk&floor=1&lang=en`). */
  search?: string;
  /** Loads the page again (`location.reload`); called once a night. */
  reload: () => void;
};

/** The mouse pointer disappears after this long without movement. */
export const CURSOR_HIDE_MS = 3000;

export function startKioskApp(deps: KioskAppDeps): App {
  const timers: Timers = deps.timers ?? (globalThis as unknown as Timers);
  const doc = deps.doc;
  const dom = bindKioskDom(doc);
  const params = kioskParams(deps.search ?? '');
  const format = makeFormat(params.lang);
  const bar = doc.querySelector<HTMLElement>('header.bar');
  const room = doc.getElementById('app');
  let disposed = false;

  // This view replaces the page: no top bar, no room or list views.
  if (bar) bar.hidden = true;
  if (room) room.hidden = true;
  dom.root.hidden = false;
  doc.documentElement.dataset.theme = params.theme;
  doc.documentElement.lang = params.lang;

  let feedMode: FeedMode = 'connecting';
  let pages: KioskPage[] = [];
  let index = 0;
  let draw = () => {};

  /** The pages for the data and the screen now; the position stays on the same floor and part. */
  const layoutPages = () => {
    const layout = measureLayout(dom);
    const entries = listEntries(source.state, deps.now());
    const present = entries.some((g) => floorKey(g.floor) === params.floor);
    const shown = params.floor === 'all' || !present ? entries : filterEntries(entries, { floor: params.floor, query: '' });
    const next = kioskPages(shown, layout.cols * layout.rows);
    const current = pages[index];
    let at = -1;
    if (current) {
      at = next.findIndex((p) => p.floor === current.floor && p.part === current.part);
      if (at < 0) at = next.map((p) => p.floor).lastIndexOf(current.floor); // fewer parts now: the last one of that floor
      if (at < 0) at = index < next.length ? index : 0; // the floor is gone: the page that took its place
    }
    pages = next;
    index = Math.max(0, at);
    return { layout, entries, floors: [...new Set(next.map((p) => p.floor))] };
  };
  draw = () => {
    if (disposed) return;
    const { layout, entries, floors } = layoutPages();
    renderKiosk(
      dom,
      { lang: params.lang, now: deps.now(), ready: source.ready(), feed: feedMode, failed: source.failed(), lastLoadAt: source.lastLoadAt(), entries, page: pages[index] ?? null, pageCount: pages.length, floors, seconds: params.seconds, layout },
      format,
    );
  };

  const source = startRoomsSource({
    connect: deps.connect,
    query: deps.query,
    timers,
    now: deps.now,
    onChange: () => {
      feedMode = source.mode();
      draw();
    },
  });
  draw();

  // The next page every `seconds`; data changes redraw the page on screen without touching this timer.
  const pager = timers.setInterval(() => {
    if (pages.length < 2) return;
    index = (index + 1) % pages.length;
    draw();
  }, params.seconds * 1000);
  const rejudge = timers.setInterval(draw, REJUDGE_MS);
  const clock = timers.setInterval(() => renderClock(dom, deps.now(), format), 1000);

  // Once a night the page loads itself again, so that a screen that runs for weeks gets new releases.
  let reloadTimer: unknown = null;
  const scheduleReload = () => {
    const now = deps.now();
    reloadTimer = timers.setTimeout(() => {
      deps.reload();
      scheduleReload();
    }, nextReloadAt(now) - now);
  };
  scheduleReload();

  // The pointer disappears after a few seconds without movement.
  let hideTimer: unknown = null;
  const hideCursor = () => dom.root.classList.add('k-idle');
  const onMove = () => {
    dom.root.classList.remove('k-idle');
    if (hideTimer !== null) timers.clearTimeout(hideTimer);
    hideTimer = timers.setTimeout(hideCursor, CURSOR_HIDE_MS);
  };
  hideTimer = timers.setTimeout(hideCursor, CURSOR_HIDE_MS);
  doc.addEventListener('mousemove', onMove);
  doc.defaultView?.addEventListener('resize', draw);

  return {
    dispose() {
      disposed = true;
      source.stop();
      for (const h of [pager, rejudge, clock]) timers.clearInterval(h);
      timers.clearTimeout(reloadTimer);
      timers.clearTimeout(hideTimer);
      doc.removeEventListener('mousemove', onMove);
      doc.defaultView?.removeEventListener('resize', draw);
      dom.root.hidden = true;
      if (bar) bar.hidden = false;
      if (room) room.hidden = false;
    },
  };
}
