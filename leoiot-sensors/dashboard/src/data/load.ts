// Loading: a query, its CSV answer, the parsed result.
import { parseAnnotatedCsv } from '../core/csv';
import { historyQuery, latestQuery, type Source } from '../core/flux';
import type { RangeId } from '../core/ranges';
import { parseHistory, parseLatest, type HistoryPoint, type Snapshot } from '../core/snapshot';
import type { Query } from './api';

export async function loadLatest(query: Query, room: string): Promise<Snapshot> {
  return parseLatest(parseAnnotatedCsv(await query(latestQuery(room))));
}

export async function loadHistory(query: Query, room: string, source: Source, range: RangeId, now: number): Promise<HistoryPoint[]> {
  return parseHistory(parseAnnotatedCsv(await query(historyQuery(room, source, range, now))));
}
