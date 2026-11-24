// The room list view (`/sensors/` without a room): every room that sends, grouped by floor, live.
// The same pieces as the room page, without charts: the rooms source, the frame (language, theme)
// and the list renderer. Ages are judged again every 5 seconds.
import { floorFromParam, listEntries, NO_FILTER, type FloorFilter, type ListFilter } from './core/roomList';
import { makeFormat } from './core/format';
import { isLang, type Lang } from './core/i18n';
import type { FeedMode, Timers } from './data/feed';
import { startRoomsSource } from './data/roomsSource';
import type { App, AppDeps } from './app';
import { effectiveTheme, KEY_LANG, KEY_THEME, loadPrefs, write, type Theme } from './ui/prefs';
import { bindDom, renderFrame } from './ui/render';
import { bindRoomListDom, renderRoomList } from './ui/roomList';

export type ListAppDeps = Pick<AppDeps, 'doc' | 'storage' | 'prefersDark' | 'query' | 'connect' | 'now' | 'timers' | 'onSchemeChange'> & {
  /** The address's query string at start (`?floor=1&q=10`): the filter the list starts with. */
  search?: string;
  /** Writes the query string into the address without a new history entry (`history.replaceState`). */
  replaceSearch?: (search: string) => void;
};

/** How often the list judges the age of its rooms again. */
export const REJUDGE_MS = 5000;

export function startListApp(deps: ListAppDeps): App {
  const timers: Timers = deps.timers ?? (globalThis as unknown as Timers);
  const dom = bindDom(deps.doc);
  const listDom = bindRoomListDom(deps.doc);
  const prefs = loadPrefs(deps.storage);
  let lang: Lang = prefs.lang;
  let savedTheme: Theme | null = prefs.theme;
  let disposed = false;
  if (savedTheme) deps.doc.documentElement.dataset.theme = savedTheme;
  const theme = (): Theme => effectiveTheme(savedTheme, deps.prefersDark());

  // The filter: the address says what to start with and follows every change.
  const params = new URLSearchParams(deps.search ?? '');
  let filter: ListFilter = { floor: floorFromParam(params.get('floor')), query: params.get('q') ?? '' };
  listDom.search.value = filter.query;
  const setFilter = (next: ListFilter) => {
    filter = next;
    // Floor first, then the search; empty values are left out, other parameters stay.
    params.delete('floor');
    params.delete('q');
    if (next.floor !== 'all') params.set('floor', next.floor);
    if (next.query.trim() !== '') params.set('q', next.query.trim());
    const search = params.toString();
    deps.replaceSearch?.(search === '' ? '' : `?${search}`);
    draw();
  };
  const isTyping = (target: EventTarget | null) => {
    const e = target as HTMLElement | null;
    return !!e && (/^(input|textarea|select)$/i.test(e.tagName) || e.isContentEditable);
  };

  const drawFrame = () => renderFrame(dom, { lang, room: null, selection: { kind: '24h' }, now: deps.now(), theme: theme() });
  let feedMode: FeedMode = 'connecting';
  let draw = () => {};

  const onClick = (e: Event) => {
    const target = (e.target as Element | null)?.closest<HTMLElement>('button');
    if (!target) return;
    if (target.dataset.lang && isLang(target.dataset.lang)) {
      lang = target.dataset.lang;
      write(deps.storage, KEY_LANG, lang);
      drawFrame();
      draw();
    } else if (target.id === 'theme') {
      savedTheme = theme() === 'dark' ? 'light' : 'dark';
      deps.doc.documentElement.dataset.theme = savedTheme;
      write(deps.storage, KEY_THEME, savedTheme);
      drawFrame();
    }
  };
  deps.doc.querySelector('header')?.addEventListener('click', onClick);
  const onInput = () => setFilter({ ...filter, query: listDom.search.value });
  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && listDom.search.value !== '') {
      e.preventDefault();
      listDom.search.value = '';
      setFilter({ ...filter, query: '' });
    }
  };
  const onListClick = (e: Event) => {
    const target = (e.target as Element | null)?.closest<HTMLElement>('button');
    if (!target) return;
    if (target.dataset.floor) setFilter({ ...filter, floor: target.dataset.floor as FloorFilter });
    else if (target === listDom.reset) {
      listDom.search.value = '';
      setFilter(NO_FILTER);
      listDom.search.focus();
    }
  };
  // "/" jumps to the search field, unless the visitor is typing somewhere.
  const onSlash = (e: KeyboardEvent) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || listDom.tools.hidden) return;
    e.preventDefault();
    listDom.search.focus();
  };
  listDom.search.addEventListener('input', onInput);
  listDom.search.addEventListener('keydown', onSearchKey);
  listDom.section.addEventListener('click', onListClick);
  deps.doc.addEventListener('keydown', onSlash);
  deps.onSchemeChange?.(drawFrame);

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
  draw = () => {
    if (disposed) return;
    renderRoomList(listDom, { entries: listEntries(source.state, deps.now()), ready: source.ready(), feed: feedMode, failed: source.failed(), lastLoadAt: source.lastLoadAt(), lang, filter }, makeFormat(lang));
  };
  drawFrame();
  draw();
  const clock = timers.setInterval(draw, REJUDGE_MS);

  return {
    dispose() {
      disposed = true;
      source.stop();
      timers.clearInterval(clock);
      deps.doc.querySelector('header')?.removeEventListener('click', onClick);
      listDom.search.removeEventListener('input', onInput);
      listDom.search.removeEventListener('keydown', onSearchKey);
      listDom.section.removeEventListener('click', onListClick);
      deps.doc.removeEventListener('keydown', onSlash);
    },
  };
}
