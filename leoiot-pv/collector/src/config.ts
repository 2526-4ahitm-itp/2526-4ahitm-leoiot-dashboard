// Konfiguration ausschließlich aus der Umgebung.

export interface Config {
  solaxBaseUrl: string;
  solaxClientId: string;
  solaxClientSecret: string;
  solaxUsername: string;
  solaxPassword: string;
  plantId: string;
  influxUrl: string;
  influxOrg: string;
  influxBucket: string;
  influxToken: string;
  mqttUrl: string;
  mqttUser: string;
  mqttPassword: string;
  publish: boolean;
  intervalMs: number;
  healthFile: string;
}

export class ConfigError extends Error {
  constructor(public readonly variable: string, message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

/** Pflichtvariablen in der Reihenfolge, in der die erste fehlende gemeldet wird. */
export const REQUIRED_VARIABLES = [
  'COLLECTOR_SOLAX_CLIENT_ID',
  'COLLECTOR_SOLAX_CLIENT_SECRET',
  'COLLECTOR_SOLAX_USERNAME',
  'COLLECTOR_SOLAX_PASSWORD',
  'COLLECTOR_SOLAX_PLANT_ID',
  'COLLECTOR_INFLUX_TOKEN',
  'COLLECTOR_MQTT_USER',
  'COLLECTOR_MQTT_PASSWORD',
] as const;

export function loadConfig(env: Env): Config {
  const required = (name: (typeof REQUIRED_VARIABLES)[number]): string => {
    const value = env[name];
    if (value === undefined || value.trim() === '') {
      throw new ConfigError(name, `Pflichtvariable ${name} fehlt`);
    }
    return value;
  };
  const optional = (name: string, fallback: string): string => {
    const value = env[name];
    return value === undefined || value.trim() === '' ? fallback : value;
  };

  const solaxClientId = required('COLLECTOR_SOLAX_CLIENT_ID');
  const solaxClientSecret = required('COLLECTOR_SOLAX_CLIENT_SECRET');
  const solaxUsername = required('COLLECTOR_SOLAX_USERNAME');
  const solaxPassword = required('COLLECTOR_SOLAX_PASSWORD');
  const plantId = required('COLLECTOR_SOLAX_PLANT_ID');
  const influxToken = required('COLLECTOR_INFLUX_TOKEN');
  const mqttUser = required('COLLECTOR_MQTT_USER');
  const mqttPassword = required('COLLECTOR_MQTT_PASSWORD');

  const intervalText = optional('COLLECTOR_INTERVAL_MS', '60000');
  const intervalMs = Number(intervalText);
  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new ConfigError(
      'COLLECTOR_INTERVAL_MS',
      `COLLECTOR_INTERVAL_MS muss eine positive ganze Zahl sein, ist aber "${intervalText}"`,
    );
  }

  return {
    solaxBaseUrl: optional('COLLECTOR_SOLAX_BASE_URL', 'https://openapi-eu.solaxcloud.com').replace(/\/+$/, ''),
    solaxClientId,
    solaxClientSecret,
    solaxUsername,
    solaxPassword,
    plantId,
    influxUrl: optional('COLLECTOR_INFLUX_URL', 'http://influxdb:8086').replace(/\/+$/, ''),
    influxOrg: optional('COLLECTOR_INFLUX_ORG', 'leoiot'),
    influxBucket: optional('COLLECTOR_INFLUX_BUCKET', 'pv_shadow'),
    influxToken,
    mqttUrl: optional('COLLECTOR_MQTT_URL', 'mqtt://mosquitto:1883'),
    mqttUser,
    mqttPassword,
    publish: ['1', 'true'].includes((env.COLLECTOR_PUBLISH ?? '').trim().toLowerCase()),
    intervalMs,
    healthFile: optional('COLLECTOR_HEALTH_FILE', '/tmp/collector-last-delivery'),
  };
}
