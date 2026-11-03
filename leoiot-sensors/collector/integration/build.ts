// Vitest global setup: the integration tests start the compiled program.
import { execFileSync } from 'node:child_process';
import { collectorDir } from './support.js';

export default function setup(): void {
  execFileSync('npm', ['run', 'build'], { cwd: collectorDir, stdio: 'ignore' });
}
