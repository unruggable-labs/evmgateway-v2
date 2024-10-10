import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmdirSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pkg from '../package.json';
import tsc from '../tsconfig.json'; // parses json comments

const baseDir = fileURLToPath(new URL('../', import.meta.url));
const distDir = join(baseDir, 'dist');
const packageFile = join(baseDir, 'package.json');
const tsconfigFile = join(baseDir, 'tsconfig.json');

function log(...a: any) {
  console.log(performance.now().toFixed(0).padStart(5), ...a);
}

// save a copy of config files
const packageOriginal = readFileSync(packageFile, { encoding: 'utf8' });
const tsconfigOriginal = readFileSync(tsconfigFile, { encoding: 'utf8' });

// ensure correct starting state
if (pkg.type !== 'module') {
  throw new Error(`unexpected package type: ${pkg.type}`);
}
log(`Saved configuration`);

// verify build
log(`Typechecking...`);
runTypescript('--noEmit');
log('Ready!');

// clear dist
rmdirSync(distDir, { recursive: true });
mkdirSync(distDir);
log(`Cleaned ${distDir}`);

// remove tests and scripts
tsc.include = ['src'];
writeFileSync(tsconfigFile, JSON.stringify(tsc));

// create outputs
const cjsDir = join(distDir, 'cjs');
const esmDir = join(distDir, 'esm');
const typesDir = join(distDir, 'types');
try {
  setPackageType('commonjs');
  runTypescript('--outDir', cjsDir, '--module', 'node16');
  forceExtension(cjsDir, 'cjs');
  log('Built cjs');

  setPackageType('module');
  runTypescript('--outDir', esmDir);
  forceExtension(esmDir, 'mjs');
  log('Built esm');

  runTypescript(
    '--outDir',
    typesDir,
    '--module',
    'esnext',
    '--emitDeclarationOnly',
    '--declaration',
    '--declarationMap'
  );
  log('Built types');
} finally {
  writeFileSync(packageFile, packageOriginal);
  writeFileSync(tsconfigFile, tsconfigOriginal);
  log(`Restored configuration`);
}

function runTypescript(...args: string[]) {
  spawnSync('bun', ['tsc', '-p', '.', ...args]);
}

function setPackageType(type: string) {
  pkg.type = type;
  writeFileSync(packageFile, JSON.stringify(pkg));
  log(`Set package type: "${type}"`);
}

function forceExtension(dir: string, ext: string) {
  for (const x of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, x.name);
    if (x.isDirectory()) {
      forceExtension(path, ext);
    } else if (x.name.endsWith('.js')) {
      let code = readFileSync(path, { encoding: 'utf-8' });
      code = code.replaceAll(
        /(["'])(.*?\.)js\1/g,
        (_, q, x) => q + x + ext + q
      );
      writeFileSync(path, code);
      renameSync(path, join(dir, x.name.slice(0, -2) + ext));
    }
  }
}
