// MQTT side: subscribes to exactly the mapped topics (never a pattern) and
// publishes the live messages retained with QoS 1. The client is replaceable
// for tests.
import { randomBytes } from 'node:crypto';
import mqtt from 'mqtt';
import { describeUrl } from './config.js';
import type { Log } from './log.js';
import type { LiveMessage } from './live.js';

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
    options: { qos: 0 | 1 | 2; retain: boolean },
    callback?: (error?: Error | null) => void,
  ): unknown;
  end(force?: boolean, callback?: () => void): unknown;
}

export type MqttConnect = (
  url: string,
  options: { username: string; password: string; reconnectPeriod: number; clientId: string },
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
      const refused = (granted ?? []).filter((g) => g.qos === 128).map((g) => g.topic);
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

    /** Publishes a live message retained with QoS 1; never throws. */
    publish(message: LiveMessage): void {
      try {
        client?.publish(message.topic, message.payload, { qos: 1, retain: true }, (error) => {
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
