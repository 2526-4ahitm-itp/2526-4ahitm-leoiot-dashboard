// MQTT side: subscribes to exactly the mapped topics (never a pattern) and
// publishes the live messages retained with QoS 1 and an expiry (MQTT 5,
// platform/data-contract "Room live messages expire after 30 days"). The client
// is replaceable for tests.
import { randomBytes } from 'node:crypto';
import mqtt from 'mqtt';
import { describeUrl } from './config.js';
import type { Log } from './log.js';
import type { LiveMessage } from './live.js';

/** Seconds after which the broker drops a room's retained live message (30 days). */
export const LIVE_EXPIRY_S = 30 * 24 * 60 * 60;

/** Options of a live message: retained, QoS 1, expiring. */
export interface PublishOptions {
  qos: 0 | 1 | 2;
  retain: boolean;
  properties?: { messageExpiryInterval?: number };
}

/** From this SUBACK code on a subscription was refused (MQTT 3.1.1: 128; MQTT 5: 128 to 162). */
const SUBACK_FAILURE = 128;

/** The part of the MQTT client this module needs. */
export interface MqttLike {
  connected: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  subscribe(
    topics: string[],
    options: { qos: 0 | 1 | 2 },
    callback?: (error: Error | null, granted?: { topic: string; qos: number }[]) => void,
  ): unknown;
  publish(
    topic: string,
    payload: string,
    options: PublishOptions,
    callback?: (error?: Error | null) => void,
  ): unknown;
  end(force?: boolean, callback?: () => void): unknown;
}

export type MqttConnect = (
  url: string,
  options: { username: string; password: string; reconnectPeriod: number; clientId: string; protocolVersion: 5 },
) => MqttLike;

export interface BrokerOptions {
  url: string;
  username: string;
  password: string;
  reconnectMs: number;
  /** The exact topics to subscribe to. */
  topics: string[];
  log: Log;
  /**
   * A message of a subscribed topic. `retained` is true for a message the
   * broker replays on subscribe (the old last value), false for a live one.
   */
  onMessage: (topic: string, payload: Buffer, retained: boolean) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  connect?: MqttConnect;
}

export function createBroker(options: BrokerOptions) {
  const connect: MqttConnect = options.connect ?? ((url, o) => mqtt.connect(url, o) as unknown as MqttLike);
  let client: MqttLike | null = null;

  function subscribe(current: MqttLike): void {
    current.subscribe(options.topics, { qos: 1 }, (error, granted) => {
      if (error) {
        options.log(`Subscribing failed: ${error.message}`);
        return;
      }
      const refused = (granted ?? []).filter((g) => g.qos >= SUBACK_FAILURE).map((g) => g.topic);
      if (refused.length > 0) options.log(`Broker refused the subscription to: ${refused.join(', ')}`);
      else options.log(`Subscribed to ${options.topics.length} topic(s)`);
    });
  }

  return {
    start(): void {
      if (client) return;
      const current = connect(options.url, {
        username: options.username,
        password: options.password,
        // The client reconnects by itself while the broker is gone.
        reconnectPeriod: options.reconnectMs,
        clientId: `sensors-collector-${randomBytes(4).toString('hex')}`,
        // MQTT 5 for the message expiry of the live messages.
        protocolVersion: 5,
      });
      client = current;
      current.on('connect', () => {
        options.log(`Connected to the broker at ${describeUrl(options.url)}`);
        options.onConnected();
        // A clean session forgets subscriptions, so subscribe on every connection.
        subscribe(current);
      });
      current.on('close', () => {
        options.onDisconnected();
      });
      current.on('error', (error: Error) => {
        options.log(`MQTT error: ${error.message}`);
      });
      current.on('message', (topic: string, payload: Buffer, packet?: { retain?: boolean }) => {
        options.onMessage(topic, payload, packet?.retain === true);
      });
    },

    /** Publishes a live message retained with QoS 1 and the expiry; never throws. */
    publish(message: LiveMessage): void {
      const publishOptions: PublishOptions = { qos: 1, retain: true, properties: { messageExpiryInterval: LIVE_EXPIRY_S } };
      try {
        client?.publish(message.topic, message.payload, publishOptions, (error) => {
          if (error) options.log(`Publishing ${message.topic} failed: ${error.message}`);
        });
      } catch (error) {
        options.log(`Publishing ${message.topic} failed: ${(error as Error).message}`);
      }
    },

    async close(): Promise<void> {
      const current = client;
      client = null;
      if (!current) return;
      await new Promise<void>((resolve) => {
        try {
          current.end(false, () => resolve());
        } catch {
          resolve();
        }
      });
    },
  };
}

export type Broker = ReturnType<typeof createBroker>;
