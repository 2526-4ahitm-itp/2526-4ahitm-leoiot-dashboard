// Configuration from the environment only (spec sensors/collector: "Credentials
// come from the environment"). Credentials are never logged.

export interface Config {
  influxUrl: string;
  influxOrg: string;
  influxBucket: string;
  influxToken: string;
  mqttUrl: string;
  mqttUser: string;
  mqttPassword: string;
  /** Path or file URL of the device mapping. */
  devicesFile: string | URL;
  healthFile: string;
  /** Writing to the database every this many ms. */
  flushIntervalMs: number;
  /** Readings that could not be written are kept for at most this long. */
  bufferMaxAgeMs: number;
  mqttReconnectMs: number;
  /** Unhealthy when the broker has been gone for longer than this. */
  healthBrokerDownMs: number;
  /** Unhealthy when writing has been failing for longer than this. */
  healthWriteFailMs: number;
  /** The status file is rewritten this often. */
  healthIntervalMs: number;
}

export class ConfigError extends Error {
  constructor(public readonly missing: string[], message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

/** Required variables, in the order they are reported. */
export const REQUIRED_VARIABLES = ['SENSORS_INFLUX_TOKEN', 'SENSORS_MQTT_USER', 'SENSORS_MQTT_PASSWORD'] as const;

/** The mapping that ships with the collector. */
export const BUNDLED_DEVICES_FILE = new URL('../devices.json', import.meta.url);

export function loadConfig(env: Env): Config {
  const blank = (name: string) => env[name] === undefined || env[name]!.trim() === '';

  const missing = REQUIRED_VARIABLES.filter(blank);
  if (missing.length > 0) {
    throw new ConfigError(
      [...missing],
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
    );
  }

  const optional = (name: string, fallback: string): string => (blank(name) ? fallback : env[name]!);
  const duration = (name: string, fallback: number): number => {
    const text = optional(name, String(fallback));
    const value = Number(text);
    if (!Number.isInteger(value) || value <= 0) {
      throw new ConfigError([], `${name} must be a positive whole number of milliseconds, got ${JSON.stringify(text)}`);
    }
    return value;
  };

  const mqttUrl = optional('SENSORS_MQTT_URL', 'mqtt://mosquitto:1883');
  try {
    new URL(mqttUrl);
  } catch {
    // Do not echo the value: a URL may carry a password.
    throw new ConfigError([], 'SENSORS_MQTT_URL is not a valid URL');
  }

  return {
    influxUrl: optional('SENSORS_INFLUX_URL', 'http://influxdb:8086').replace(/\/+$/, ''),
    influxOrg: optional('SENSORS_INFLUX_ORG', 'leoiot'),
    influxBucket: optional('SENSORS_INFLUX_BUCKET', 'server_data'),
    influxToken: env.SENSORS_INFLUX_TOKEN!,
    mqttUrl,
    mqttUser: env.SENSORS_MQTT_USER!,
    mqttPassword: env.SENSORS_MQTT_PASSWORD!,
    devicesFile: blank('SENSORS_DEVICES_FILE') ? BUNDLED_DEVICES_FILE : env.SENSORS_DEVICES_FILE!,
    healthFile: optional('SENSORS_HEALTH_FILE', '/tmp/collector-health.json'),
    flushIntervalMs: duration('SENSORS_FLUSH_INTERVAL_MS', 2_000),
    bufferMaxAgeMs: duration('SENSORS_BUFFER_MAX_AGE_MS', 60 * 60 * 1000),
    mqttReconnectMs: duration('SENSORS_MQTT_RECONNECT_MS', 5_000),
    healthBrokerDownMs: duration('SENSORS_HEALTH_BROKER_DOWN_MS', 2 * 60 * 1000),
    healthWriteFailMs: duration('SENSORS_HEALTH_WRITE_FAIL_MS', 5 * 60 * 1000),
    healthIntervalMs: duration('SENSORS_HEALTH_INTERVAL_MS', 5_000),
  };
}

/** The broker address for a log line, without any user info. */
export function describeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '(invalid url)';
  }
}
