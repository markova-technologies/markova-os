// The API reference is generated from the repo-root openapi.yaml, which is the
// backend's source of truth. Copy it into public/ so the docs site can render
// the reference without depending on a running gateway.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../../openapi.yaml');
const target = resolve(here, '../public/openapi.yaml');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`openapi.yaml -> ${target}`);
