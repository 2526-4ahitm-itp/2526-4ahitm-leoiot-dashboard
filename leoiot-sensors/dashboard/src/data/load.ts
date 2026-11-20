// Loading: a query, its CSV answer, the parsed result.
import { parseAnnotatedCsv, type CsvRecord } from '../core/csv';
import { aboveMinutesQuery, historyQuery, latestQuery, peakQuery, roomsLatestQuery, type Source } from '../core/flux';
import type { RangeId } from '../core/ranges';
import { parseAboveMinutes, parsePeak, type Peak } from '../core/today';
import { parseHistory, parseLatest, type HistoryPoint, type Snapshot } from '../core/snapshot';
import type { Query } from './api';

export async function loadLatest(query: Query, room: string): Promise<Snapshot> {
  return parseLatest(parseAnnotatedCsv(await query(latestQuery(room))));
}

export async function loadHistory(query: Query, room: string, source: Source, range: RangeId, now: number): Promise<HistoryPoint[]> {
  return parseHistory(parseAnnotatedCsv(await query(historyQuery(room, source, range, now))));
}

/** The stored latest values of every room, as records with their `room` column (for the room list). */
export async function loadRooms(query: Query): Promise<CsvRecord[]> {
  return parseAnnotatedCsv(await query(roomsLatestQuery()));
}

/** The day's highest CO2 reading from local midnight until now; null when there is none. */
export async function loadPeak(query: Query, room: string, source: Source, startMs: number, endMs: number): Promise<Peak | null> {
  return parsePeak(parseAnnotatedCsv(await query(peakQuery(room, source, startMs, endMs))));
}

/** The minutes of today in which the highest stored CO2 reading was above 1000 ppm; 0 when there are none. */
export async function loadAboveMinutes(query: Query, room: string, source: Source, startMs: number, endMs: number): Promise<number> {
  return parseAboveMinutes(parseAnnotatedCsv(await query(aboveMinutesQuery(room, source, startMs, endMs))));
}
