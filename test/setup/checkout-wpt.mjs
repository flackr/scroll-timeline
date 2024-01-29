#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { chdir, exit, env } from 'node:process';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoUrl = 'https://github.com/web-platform-tests/wpt.git';
const checkoutDir = 'wpt';
const command = 'npm install';
const execEnv = { stdio: [0, 1, 2] };

chdir(__dirname);
chdir('..');

if (existsSync(checkoutDir)) {
  console.log(`Checkout ${checkoutDir} already exists, updating`);
  execSync(`git pull --ff-only`, {...execEnv, cwd: path.resolve(`${__dirname}/../${checkoutDir}`)});
  exit(0);
}

execSync(`git clone --depth 1 --branch master --single-branch ${repoUrl}`, {...execEnv, cwd: path.resolve(`${__dirname}/..`)});
console.warn('Ensure that you setup wpt for local test runs per published instructions: https://web-platform-tests.org/running-tests/from-local-system.html');
console.log(`Checked out ${checkoutDir}`);

exit(0);
