// Health (spec sensors/collector: "Health is reported"). Unhealthy while the
// broker has been gone for more than healthBrokerDownMs, or writing has been
// failing for more than healthWriteFailMs. A device that is silent changes
// nothing: only the broker connection and the writes count.
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface HealthLimits {
  healthBrokerDownMs: number;
  healthWriteFailMs: number;
}

export interface HealthStatus {
  healthy: boolean;
  reason: string;
  updatedAt: number;
  /** Since when the broker connection is down; null while connected. */
  brokerDownSince: number | null;
  /** Since when writes fail; null while they work. */
  writeFailingSince: number | null;
}

export function createHealth(limits: HealthLimits, now: () => number) {
  // Before the first connection the broker counts as gone since the start.
  let brokerDownSince: number | null = now();
  let writeFailingSince: number | null = null;

  return {
    brokerConnected(): void {
      brokerDownSince = null;
    },
    brokerLost(): void {
      brokerDownSince ??= now();
    },
    writeOk(): void {
      writeFailingSince = null;
    },
    writeFailed(): void {
      writeFailingSince ??= now();
    },
    status(): HealthStatus {
      const t = now();
      const reasons: string[] = [];
      if (brokerDownSince !== null && t - brokerDownSince > limits.healthBrokerDownMs) {
        reasons.push(`broker unreachable for ${Math.round((t - brokerDownSince) / 1000)} s`);
      }
      if (writeFailingSince !== null && t - writeFailingSince > limits.healthWriteFailMs) {
        reasons.push(`database writes failing for ${Math.round((t - writeFailingSince) / 1000)} s`);
      }
      return {
        healthy: reasons.length === 0,
        reason: reasons.length === 0 ? 'ok' : reasons.join('; '),
        updatedAt: t,
        brokerDownSince,
        writeFailingSince,
      };
    },
  };
}

export type Health = ReturnType<typeof createHealth>;

/** Writes the status atomically, so the health check never reads half a file. */
export async function writeStatusFile(file: string, status: HealthStatus): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(status));
  await rename(temp, file);
}
