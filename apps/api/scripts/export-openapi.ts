/** Экспорт OpenAPI 3.1 в packages/contracts/openapi.json — источник для сгенерированного клиента фронтенда. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { API_INFO, createApp } from '../src/app.js';
import { testVerifier } from '../src/platform/auth.js';
import { fakeStorage } from '../src/platform/storage.js';
import type { Db } from '../src/platform/db/client.js';

const app = createApp({ db: {} as Db, verifier: testVerifier(), ai: null, storage: fakeStorage() });
const doc = app.getOpenAPI31Document(API_INFO);
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/contracts/openapi.json');
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`OpenAPI: ${Object.keys(doc.paths ?? {}).length} путей, ${Object.keys(doc.components?.schemas ?? {}).length} схем → ${path.relative(process.cwd(), out)}`);
