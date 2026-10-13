// Chart.js einmal einrichten: nur die gebrauchten Teile, ruhige Voreinstellungen.
import {
  Chart,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
} from 'chart.js';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
);

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
if (reducedMotion) {
  Chart.defaults.animation = false;
} else if (Chart.defaults.animation) {
  Chart.defaults.animation.duration = 500;
}

/** Schriftgröße der Achsen in Pixeln. */
export function axisPx(): number {
  return Math.max(18, window.innerHeight * 0.0167);
}

/** Schriftgröße der Beschriftungen in Pixeln. */
export function labelPx(): number {
  return Math.max(20, window.innerHeight * 0.0185);
}

/** Strichstärken und Radien wachsen mit dem Bildschirm (Bezug: 1080 Zeilen). */
export function scalePx(px: number): number {
  return px * Math.max(1, window.innerHeight / 1080);
}

export { Chart };
