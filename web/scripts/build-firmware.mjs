import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const env = { ...process.env };
const sdk = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
if (process.platform === 'darwin' && existsSync(sdk)) env.SDKROOT = sdk;
for (const revision of ['before', 'fixed']) {
  const source = join(root, 'demo-source', revision);
  const output = join(root, 'demo-bin', revision);
  mkdirSync(join(root, 'demo-bin'), { recursive: true });
  const result = spawnSync('cc', ['-O2', '-Wall', '-Wextra', '-std=c11',
    join(source, 'main.c'), join(source, 'hal.c'), join(source, 'firmware.c'), '-o', output],
    { env, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? result.stderr);
    process.exit(1);
  }
  console.log(`Built ${revision} firmware for ${process.platform}/${process.arch}`);
}
