// Adapter für den MQTT-Broker. Der Client ist austauschbar (Tests). Veröffentlichen
// wirft nie: ein nicht erreichbarer Broker darf den Zyklus nicht stören.
import mqtt from 'mqtt';
import type { Log } from '../log.js';

/** Der Teil des MQTT-Clients, den der Adapter braucht. */
export interface MqttLike {
  connected: boolean;
  on(event: 'connect' | 'error' | 'close', listener: (...args: any[]) => void): unknown;
  publish(
    topic: string,
    payload: string,
    options: { qos: 0 | 1 | 2; retain: boolean },
    callback?: (error?: Error | null) => void,
  ): unknown;
  end(force?: boolean, callback?: () => void): unknown;
}

export interface BrokerOptions {
  url: string;
  username: string;
  password: string;
  log: Log;
  connect?: (url: string, options: { username: string; password: string; reconnectPeriod: number }) => MqttLike;
}

export function createBroker(options: BrokerOptions) {
  const connect = options.connect ?? ((url, o) => mqtt.connect(url, o) as unknown as MqttLike);
  let client: MqttLike | null = null;

  function ensureClient(): MqttLike {
    if (!client) {
      // Der Client verbindet sich selbst neu (alle 5 s), solange der Broker fehlt.
      client = connect(options.url, {
        username: options.username,
        password: options.password,
        reconnectPeriod: 5000,
      });
      client.on('connect', () => options.log(`MQTT verbunden mit ${options.url}`));
      client.on('error', (error: Error) => options.log(`MQTT-Fehler: ${error.message}`));
    }
    return client;
  }

  return {
    /** Baut die Verbindung auf (nur nötig, wenn veröffentlicht wird). */
    start(): void {
      ensureClient();
    },

    /** Veröffentlicht retained mit QoS 0; liefert, ob die Nachricht übergeben wurde. */
    publish(topic: string, payload: string): boolean {
      try {
        const current = ensureClient();
        if (!current.connected) {
          options.log('Broker nicht erreichbar, Nachricht wird nicht veröffentlicht');
          return false;
        }
        current.publish(topic, payload, { qos: 0, retain: true }, (error) => {
          if (error) options.log(`MQTT-Veröffentlichung fehlgeschlagen: ${error.message}`);
        });
        return true;
      } catch (error) {
        options.log(`MQTT-Veröffentlichung fehlgeschlagen: ${(error as Error).message}`);
        return false;
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
