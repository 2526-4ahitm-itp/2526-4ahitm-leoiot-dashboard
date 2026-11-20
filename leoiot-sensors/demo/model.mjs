// DEMO, not a permanent part of the system: see README.md.
// Generated values, not measurements. reading(room, tsMs) is a pure,
// deterministic function of room and time (Europe/Vienna), so writing the same
// timestamp again overwrites the same point.

const ZONE = 'Europe/Vienna';
const OUTDOOR = 420;
const SCHOOL_START = 8 * 60;
const SCHOOL_END = 16 * 60 + 30;
const CO2_CAP = 1900;

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Local Vienna calendar parts of a timestamp. */
function viennaParts(tsMs) {
  const p = {};
  for (const { type, value } of formatter.formatToParts(new Date(tsMs))) p[type] = value;
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    weekend: p.weekday === 'Sat' || p.weekday === 'Sun',
    minute: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** Stable 32-bit FNV-1a hash of a string, as a number in [0, 1). */
function hash01(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

const lerp = (a, b, t) => a + (b - a) * t;
const toward = (level, target, minutes, tau) => target + (level - target) * Math.exp(-minutes / tau);

/** Rooms that are in use less: gyms, halls, the biolab. */
function isQuietRoom(room) {
  return room.startsWith('T') || room === '1Aula' || room === 'UBiolab';
}

/** CO2 and the state of the school day at a minute of the day. */
function schoolDay(room, day, minute) {
  const rise = lerp(100, 750, hash01(`${room}|rise`));
  const occupiedChance = isQuietRoom(room) ? 0.5 : 0.8;
  let level = OUTDOOR;
  let occupied = false;
  let airedBreak = false;
  for (let hour = 8; hour <= 16; hour++) {
    const start = hour * 60;
    const lessonEnd = hour === 16 ? SCHOOL_END : start + 50;
    const periodEnd = hour === 16 ? SCHOOL_END : start + 60;
    if (minute < start) break;
    occupied = hash01(`${room}|${day}|${hour}|occ`) < occupiedChance;
    airedBreak = false;
    const lesson = Math.min(minute, lessonEnd) - start;
    level = occupied
      ? toward(level, Math.min(level + rise, CO2_CAP), lesson, 25)
      : toward(level, OUTDOOR, lesson, 40);
    if (minute <= lessonEnd) return { level, occupied, airedBreak };
    occupied = false;
    airedBreak = hash01(`${room}|${day}|${hour}|air`) < 0.6;
    const pause = Math.min(minute, periodEnd) - lessonEnd;
    level = airedBreak ? toward(level, 480, pause, 4) : toward(level, OUTDOOR, pause, 30);
    if (minute < periodEnd) return { level, occupied, airedBreak };
    airedBreak = false;
  }
  if (minute >= SCHOOL_END) level = toward(level, OUTDOOR, minute - SCHOOL_END, 60);
  return { level, occupied: false, airedBreak: false };
}

/** Temperature offset over the day (degrees), before the per-room share. */
const DAY_SHAPE = [
  [0, -1.5], [360, -1.5], [480, -0.5], [960, 1], [1080, 0.4], [1320, -1.5], [1440, -1.5],
];

function dayShift(minute, warmShare) {
  for (let i = 1; i < DAY_SHAPE.length; i++) {
    const [m1, v1] = DAY_SHAPE[i];
    const [m0, v0] = DAY_SHAPE[i - 1];
    if (minute <= m1) {
      const v = lerp(v0, v1, (minute - m0) / (m1 - m0));
      return v > 0 ? v * warmShare : v;
    }
  }
  return -1.5;
}

function baseTemperature(room) {
  const bucket = hash01(`${room}|kind`);
  const t = hash01(`${room}|temp`);
  if (bucket < 0.08) return lerp(17.5, 18.7, t); // clearly too cold
  if (bucket < 0.14) return lerp(25.3, 26.5, t); // clearly too warm
  return lerp(19.5, 23.5, t);
}

/**
 * One generated reading for a room at a time.
 * @returns {{ co2: number, temperature: number, humidity: number }}
 */
export function reading(room, tsMs) {
  const { day, weekend, minute } = viennaParts(tsMs);
  const stamp = Math.floor(tsMs / 60000);
  const noise = (name) => hash01(`${room}|${stamp}|${name}`) - 0.5; // [-0.5, 0.5)

  const school = !weekend && minute >= SCHOOL_START
    ? schoolDay(room, day, minute)
    : { level: OUTDOOR, occupied: false, airedBreak: false };

  const co2 = Math.round(school.level + noise('co2') * 30);

  let temperature = baseTemperature(room);
  temperature += weekend ? -1 : dayShift(minute, lerp(0.6, 1, hash01(`${room}|warm`)));
  if (school.airedBreak) temperature -= 0.6;
  temperature += noise('temperature') * 0.1;

  let humidity = lerp(32, 55, hash01(`${room}|hum`));
  if (school.occupied) humidity += 4;
  humidity += noise('humidity') * 2;
  humidity = Math.min(70, Math.max(20, humidity));

  return {
    co2,
    temperature: Math.round(temperature * 10) / 10,
    humidity: Math.round(humidity * 10) / 10,
  };
}
