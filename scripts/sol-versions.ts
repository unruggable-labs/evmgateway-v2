import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

type Contract = { spec: string; file: string };

find(fileURLToPath(new URL('../contracts/', import.meta.url)))
  .sort((a, b) => a.spec.localeCompare(b.spec) || a.file.localeCompare(b.file))
  .forEach((x) => console.log(x.spec.padEnd(8), x.file));

function find(dir: string, found: Contract[] = [], skip = dir.length) {
  for (const x of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, x.name);
    if (x.isDirectory()) {
      find(path, found, skip);
    } else if (x.name.endsWith('.sol')) {
      const code = readFileSync(path, { encoding: 'utf-8' });
      const match = code.match(/^pragma solidity (.*?);/m);
      if (!match) throw new Error(`expected pragma: ${path}`);
      found.push({
        spec: match[1],
        file: path.slice(skip),
      });
    }
  }
  return found;
}
