// Texte über dem Bild. Jede Beschriftung sitzt an dem Punkt der Welt, den sie nennt.
import * as THREE from 'three';
import type { FilmState } from '../core/film';
import { COLS } from '../core/yearData';
import { WIDTH, xOfU, zOf } from '../core/world';
import type { Moment } from '../core/moments';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

export interface Texts {
  date: string;
  counter: string;
  stand: string;
  moment: Moment | null;
  isTail: boolean;
  penKw: string;
  penClock: string;
  bestDate: string;
  bestValue: string;
  tagValue: string;
  mile: string;
  gap: string;
}

export function createOverlay(camera: THREE.Camera): { update(s: FilmState, x: Texts): void } {
  const el = {
    hud: $('.hud'), date: $('.date'), kwh: $('.kwh'), count: $('.count'), stand: $('.stand'), months: $('.months'),
    axis: [...document.querySelectorAll<HTMLElement>('.axis span')], pen: $('.pen'), kw: $('.pen .kw'), clock: $('.pen .clock'),
    day: $('.flag--day'), dayV: $('.flag--day .v'), best: $('.flag--best'), bestD: $('.flag--best .d'), bestV: $('.flag--best .v'),
    mile: $('.milestone'), gap: $('.gap'), moment: $('.moment'), kicker: $('.moment .kicker'), value: $('.moment .value'),
    unit: $('.moment .unit'), caption: $('.moment .caption'), source: $('.moment .source'),
  };
  const monthEls = new Map<string, HTMLElement>();
  const v = new THREE.Vector3();
  const screen = (x: number, y: number, z: number): [number, number, boolean] => {
    v.set(x, y, z).project(camera);
    return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight, v.z < 1];
  };
  const place = (e: HTMLElement, x: number, y: number) => { e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; };
  const text = (e: HTMLElement, t: string) => { if (e.textContent !== t) e.textContent = t; };
  let shownMoment: Moment | null = null;

  return {
    update(s, x) {
      el.hud.classList.toggle('quiet', s.hudQuiet);
      text(el.date, x.date);
      text(el.kwh, x.counter);
      text(el.stand, x.stand);
      el.stand.hidden = x.stand === '';
      el.count.classList.toggle('hit', s.mile !== null);
      text(el.mile, x.mile);
      el.mile.classList.toggle('on', s.mile !== null);
      text(el.gap, x.gap);
      el.gap.classList.toggle('on', s.gap !== null);

      // Monate am Fuß ihres Grats
      const seen = new Set<string>();
      for (const m of s.months) {
        let e = monthEls.get(m.label);
        if (!e) { e = document.createElement('span'); e.textContent = m.label; el.months.append(e); monthEls.set(m.label, e); }
        const [mx, my, front] = screen(WIDTH * 0.3, 0.1, zOf(m.row));
        e.style.opacity = front ? String(m.alpha) : '0';
        place(e, mx, my);
        seen.add(m.label);
      }
      for (const [label, e] of monthEls) if (!seen.has(label)) e.style.opacity = '0';

      // Zeitachse am Fuß des jüngsten Grats; nahe am Rand ausblenden statt abschneiden
      const row = Math.floor(s.day);
      el.axis.forEach((e, i) => {
        const [ax, ay] = screen(xOfU([0.12, 0.48, 0.84][i]), 0.1, zOf(row) - 3.2);
        place(e, ax, ay);
        e.style.opacity = s.axisOn && ax > innerWidth * 0.04 && ax < innerWidth * 0.93 && ay < innerHeight * 0.93 ? '1' : '0';
      });

      // Lichtpunkt, der den Tag zeichnet
      el.pen.classList.toggle('on', !!s.pen?.on);
      el.pen.classList.toggle('still', !!s.pen?.still);
      if (s.pen) {
        const [px, py] = screen(xOfU(s.pen.u), s.pen.h, zOf(s.pen.row));
        place(el.pen, px, py);
        text(el.kw, x.penKw);
        text(el.clock, x.penClock);
      }

      // Gipfel-Fahnen
      el.best.classList.toggle('on', !!s.best?.on);
      if (s.best) {
        const [bx, by] = screen(xOfU(s.best.u), s.best.h, zOf(s.best.row));
        place(el.best, bx, by);
        text(el.bestD, x.bestDate);
        text(el.bestV, x.bestValue);
      }
      el.day.classList.toggle('on', s.tag !== null);
      if (s.tag) {
        const [tx, ty] = screen(xOfU(s.tag.u), s.tag.h, zOf(s.tag.row));
        place(el.day, tx, ty);
        text(el.dayV, x.tagValue);
      }

      // Große Momente
      if (x.moment !== shownMoment) {
        shownMoment = x.moment;
        el.moment.classList.remove('on');
        el.moment.classList.toggle('tail', x.isTail);
        if (x.moment) {
          text(el.kicker, x.moment.kicker);
          text(el.value, x.moment.value);
          text(el.unit, x.moment.unit);
          text(el.caption, x.moment.caption);
          text(el.source, x.moment.source ?? '');
          void el.moment.offsetWidth;
          el.moment.classList.add('on');
        }
      }
    },
  };
}

/** Spalte zu einer Stelle u entlang des Grats. */
export const colOf = (u: number): number => Math.round(u * (COLS - 1));
