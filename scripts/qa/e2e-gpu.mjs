#!/usr/bin/env node
/**
 * Cross-platform runner for the opt-in real-GPU Playwright project (`gpu` in playwright.config.ts).
 * npm runs scripts through cmd.exe on Windows, which has no `VAR=value cmd` prefix, so the
 * environment is set here instead. Extra arguments are forwarded, e.g.
 *   npm run test:e2e:gpu -- -g "portal"
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
const args = [cli, 'test', '--project=gpu', '--workers=1', ...process.argv.slice(2)];

const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, E2E_GPU: '1' } });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
