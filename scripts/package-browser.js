import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {zipSync, strToU8} from 'fflate';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/package-browser.js OUTPUT.zip (run npm run build first).');
const entries = {};
for (const name of ['index.html', 'style.css', 'app.js', 'worker.js']) entries[name] = await readFile(new URL('../public/' + name, import.meta.url));
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) entries[name] = await readFile(new URL('../' + name, import.meta.url));
const server = await readFile(new URL('./serve.js', import.meta.url), 'utf8');
if (!server.includes("new URL('../public/', import.meta.url)")) throw new Error('The browser launcher needs updating for the current server layout.');
entries['serve.js'] = strToU8(server.replace("new URL('../public/', import.meta.url)", "new URL('./', import.meta.url)"));
entries['package.json'] = strToU8('{"private":true,"type":"module"}\n');
entries['README.txt'] = strToU8('Word Sharing Inspector — prebuilt local browser app\n\nRequires Node 22+. Extract this ZIP and run: node serve.js\nOpen http://127.0.0.1:8765 and click Try the sample.\nNo npm install or build is needed. Keep all files in one folder.\nDocuments are processed locally, never uploaded or rewritten.\nThis is not a cleaner or a complete privacy or malware assessment.\nReview extracted names and excerpts before sharing a report.\n');
await writeFile(resolve(output), zipSync(entries, {level: 6, mtime: new Date('2026-10-09T12:00:00Z')}));
console.log(resolve(output));
