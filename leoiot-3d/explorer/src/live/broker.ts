// Room-climate live data from the broker at /mqtt of the page's own host
// (spec model3d/room-climate-view, "Live values come from the broker").

import mqtt from 'mqtt';
import { ROOM_TOPIC_FILTER } from '../core/messages';
import type { RoomStore } from '../core/store';

export function brokerUrl(loc: Pick<Location, 'protocol' | 'host'>): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/mqtt`;
}

/** Connects without credentials, subscribes to every room and feeds the store; reconnects by itself. */
export function connectBroker(store: RoomStore): void {
  const client = mqtt.connect(brokerUrl(location), {
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    clean: true,
  });
  // Subscribe on every (re)connect: a clean session forgets subscriptions
  client.on('connect', () => client.subscribe(ROOM_TOPIC_FILTER, { qos: 0 }));
  client.on('message', (topic, payload) => store.apply(topic, payload.toString()));
  // Errors are retried by the reconnect; the explorer keeps working without data
  client.on('error', () => undefined);
}
