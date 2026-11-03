// Sonnenauf- und -untergang für Leonding, ohne fremden Server (Näherung nach NOAA, auf wenige Minuten genau).

const LAT = 48.267;
const LON = 14.253;
const RAD = Math.PI / 180;

/** Auf- oder Untergang (UTC) am Kalendertag von `at` (UTC-Datum). */
function event(at: Date, rise: boolean): Date {
  const y = at.getUTCFullYear(), m = at.getUTCMonth(), d = at.getUTCDate();
  const doy = Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 86_400_000);
  const g = ((2 * Math.PI) / 365) * (doy - 1 + 0.5);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl)) - Math.tan(LAT * RAD) * Math.tan(decl)) / RAD;
  const minutes = 720 - 4 * (LON + (rise ? ha : -ha)) - eq;
  return new Date(Date.UTC(y, m, d) + minutes * 60_000);
}

export const sunrise = (at: Date): Date => event(at, true);
export const sunset = (at: Date): Date => event(at, false);

/** Steht die Sonne gerade über dem Horizont? */
export function isDaylight(now: Date): boolean {
  return now >= sunrise(now) && now < sunset(now);
}

/** Der nächste Sonnenaufgang nach `now`. */
export function nextSunrise(now: Date): Date {
  const today = sunrise(now);
  return today > now ? today : sunrise(new Date(now.getTime() + 86_400_000));
}
