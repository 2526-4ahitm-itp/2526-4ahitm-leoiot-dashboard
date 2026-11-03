// Texte der großen Momente und des Kopfes (reine Funktionen).
import { formatNumber, NBSP } from '@leoiot-pv/shared/format';
import { viennaTime } from '@leoiot-pv/shared/time';
import { SILENCE_MS } from '@leoiot-pv/shared/live';
import { CO2_SOURCE, co2Tonnes } from './facts';
import { isDaylight, nextSunrise } from './sun';

export interface Moment { kicker: string; value: string; unit: string; caption: string; source?: string }

/** Ab diesem Alter des jüngsten gespeicherten Stands steht dessen Zeit neben dem Zähler. */
export const STALE_STORED_MS = 15 * 60_000;

export function liveMoment(now: Date, live: { kw: number; t: number } | null): Moment {
  if (!isDaylight(now)) {
    return { kicker: 'Die Anlage ruht', value: viennaTime(nextSunrise(now)), unit: 'Uhr', caption: 'Dann kommt die Sonne zurück auf unser Dach.' };
  }
  if (live === null) return { kicker: 'Gerade jetzt', value: '', unit: '', caption: 'Gerade keine Live-Daten.' };
  const stale = now.getTime() - live.t > SILENCE_MS;
  return {
    kicker: stale ? `Stand ${viennaTime(new Date(live.t))}` : 'Gerade jetzt',
    value: formatNumber(live.kw),
    unit: 'kW',
    caption: stale ? 'kamen da zuletzt von unserem Dach.' : 'kommen in diesem Moment von unserem Dach.',
  };
}

export function totalMoment(total: number): Moment {
  return { kicker: 'Seit Beginn', value: formatNumber(total, { group: true }), unit: 'kWh', caption: 'Sonnenstrom hat diese Schule selbst erzeugt.' };
}

export function co2Moment(total: number): Moment {
  return { kicker: 'Das bedeutet', value: formatNumber(co2Tonnes(total), { group: true }), unit: 't', caption: 'CO₂-Äquivalent, rund, die wir nicht ausgestoßen haben.', source: CO2_SOURCE };
}

export const TAIL: Moment = { kicker: '', value: '', unit: '', caption: 'Und morgen wächst der nächste Berg.' };

/** „Stand 14:02“ neben dem Zähler, wenn der jüngste gespeicherte Stand älter als 15 Minuten ist; sonst leer. */
export function storedStand(now: Date, lastReading: number | null): string {
  return lastReading !== null && now.getTime() - lastReading > STALE_STORED_MS ? `Stand${NBSP}${viennaTime(new Date(lastReading))}` : '';
}

export const kwh = (v: number): string => formatNumber(v, { group: true });
