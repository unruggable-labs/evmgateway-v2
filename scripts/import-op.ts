import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const base_dir = fileURLToPath(new URL('../', import.meta.url));

const branch = 'v1.9.3'; // checked on 20241009
const src_url = `https://raw.githubusercontent.com/ethereum-optimism/optimism/${branch}/packages/contracts-bedrock/`;

// clean output directory
const out_dir = join(base_dir, 'lib/optimism/packages/contracts-bedrock');
rmSync(out_dir, { recursive: true });
mkdirSync(out_dir, { recursive: true });

const PREFIX = 'src/';

// TODO: detect these automatically by scanning contracts/
const files = [
  'src/libraries/rlp/RLPReader.sol',
  'src/libraries/Hashing.sol',
  'src/libraries/Bytes.sol',
  'src/dispute/interfaces/IDisputeGameFactory.sol',
];

const src_map = new Map<string, string>();

console.log(`Branch:`, branch);
console.log('Imports:', files);

// recursively find dependencies
const needs = new Set<string>();
while (files.length) {
  const file = files.pop()!;
  if (!file.startsWith(PREFIX)) {
    throw new Error(`expected ${PREFIX}: ${file}`);
  }
  needs.add(file);
  for (const need of await parse_needs(file)) {
    if (needs.has(need)) continue;
    files.push(need);
  }
}

console.log('Exports:', [...needs]);

// fix the imports
for (const need of needs) {
  let code = await read_code(need);
  for (const x of needs) {
    code = code.replaceAll(x, sol_relativize(need, x));
  }
  const dst_file = join(out_dir, need);
  mkdirSync(dirname(dst_file), { recursive: true });
  writeFileSync(dst_file, code);
}

async function read_code(need: string) {
  let code = src_map.get(need);
  if (!code) {
    const url = src_url + need;
    console.log(`Download: ${need}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`http ${res.status}: ${url}`);
    code = await res.text();
    src_map.set(need, code);
  }
  return code;
}

async function parse_needs(file: string) {
  const code = await read_code(file);
  return new Set(
    Array.from(
      code.matchAll(/import\s+(?:|{[^}]*}\s+from\s+)(["'])(.*?)\1/g),
      (match) => {
        const frag = match[2];
        if (frag.startsWith(PREFIX)) {
          // project relative
          return frag;
        } else if (frag.startsWith('./')) {
          // file relative
          return sol_dirname(file) + frag.slice(2);
        } else {
          throw new Error(`unsupported: ${file}`);
        }
      }
    )
  );
}

function sol_relativize(basePath: string, filePath: string) {
  const baseParts = basePath.split('/');
  baseParts.pop();
  const fileParts = filePath.split('/');
  let shared = 0;
  while (
    shared < baseParts.length &&
    shared < fileParts.length &&
    baseParts[shared] === fileParts[shared]
  ) {
    shared++;
  }
  const path =
    shared < baseParts.length
      ? Array.from({ length: baseParts.length - shared }, () => '..')
      : ['.'];
  path.push(...fileParts.slice(shared));
  return path.join('/');
}

function sol_dirname(path: string) {
  return path.replace(/[^/]+$/, '');
}
