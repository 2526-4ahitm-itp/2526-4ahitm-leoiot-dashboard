// The room list view (`/sensors/` without a room): every room that sends, grouped by floor, live.
// The same pieces as the room page, without charts: the rooms source, the frame (language, theme)
// and the list renderer. Ages are judged again every 5 seconds.
import { listEntries } from './core/roomList';
import { makeFormat } from './core/format';
import { isLang, type Lang } from './core/i18n';
import type { FeedMode, Timers } from './data/feed';
import { startRoomsSource } from './data/roomsSource';
import type { App, AppDeps } from './app';
import { effectiveTheme, KEY_LANG, KEY_THEME, loadPrefs, write, type Theme } from './ui/prefs';
import { bindDom, renderFrame } from './ui/render';
import { bindRoomListDom, renderRoomList } from './ui/roomList';

export type ListAppDeps = Pick<AppDeps, 'doc' | 'storage' | 'prefersDark' | 'query' | 'connect' | 'now' | 'timers' | 'onSchemeChange'>;

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

  const drawFrame = () => renderFrame(dom, { lang, room: null, range: '24h', theme: theme() });
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
    renderRoomList(listDom, { entries: listEntries(source.state, deps.now()), ready: source.ready(), feed: feedMode, failed: source.failed(), lastLoadAt: source.lastLoadAt(), lang }, makeFormat(lang));
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
    },
  };
}
