// Energiefluss: Beschriftung, Richtung und Ruhezustand je Knoten. Rein, ohne DOM.
import type { Source } from '../core/energy';
import { formatKw } from '../core/format';
import type { KioskView } from '../data/view';

export const REST_KW = 0.05; // darunter gilt eine Verbindung als ruhend

export type FlowId = 'pv' | 'load' | 'grid' | 'battery';

export interface FlowNode {
  id: FlowId;
  name: 'Produktion' | 'Verbrauch' | 'Netz' | 'Batterie';
  source: Source;
  value: string; // Betrag mit Einheit
  word: string; // erzeugt | verbraucht | Bezug | Einspeisung | lädt | entlädt | ruht
  active: boolean;
  toHub: boolean; // Fluss läuft vom Knoten zur Mitte (sonst von der Mitte zum Knoten)
}

export interface FlowModel {
  live: boolean;
  sourceLabel: 'Live' | 'Ø letzte 10 Min';
  nodes: FlowNode[];
  summary: string;
}

/** Beschriftung, Richtung und Ruhezustand je Knoten; null ohne Leistungswerte. */
export function flowModel(flow: KioskView['flow']): FlowModel | null {
  if (!flow) return null;
  const { power } = flow;
  const live = flow.source === 'live';

  // Zweiseitige Knoten: positiv = zur Mitte, negativ = von der Mitte
  const node = (
    id: FlowId,
    name: FlowNode['name'],
    source: Source,
    v: number,
    pos: string,
    neg: string | null,
    posToHub: boolean,
  ): FlowNode => {
    let word = 'ruht';
    let toHub = posToHub;
    let active = false;
    if (v >= REST_KW) {
      word = pos;
      active = true;
    } else if (neg !== null && v <= -REST_KW) {
      word = neg;
      toHub = !posToHub;
      active = true;
    } else if (neg === null && Math.abs(v) >= REST_KW) {
      word = pos;
      active = true;
    }
    return { id, name, source, value: formatKw(Math.abs(v)), word, active, toHub };
  };

  const nodes: FlowNode[] = [
    node('pv', 'Produktion', 'pv', power.pv, 'erzeugt', null, true),
    node('load', 'Verbrauch', 'verbrauch', power.load, 'verbraucht', null, false),
    node('grid', 'Netz', 'netz', power.grid, 'Bezug', 'Einspeisung', true),
    node('battery', 'Batterie', 'batterie', power.battery, 'entlädt', 'lädt', true),
  ];

  const sourceLabel = live ? 'Live' : 'Ø letzte 10 Min';
  const parts = nodes.map((n) => `${n.name} ${n.value} ${n.word}`);
  return { live, sourceLabel, nodes, summary: `Energiefluss, ${sourceLabel}: ${parts.join(', ')}` };
}
