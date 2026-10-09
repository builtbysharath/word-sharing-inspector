import {build} from 'esbuild';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const options = {bundle: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: false};
const worker = await build({...options, entryPoints: ['web/worker.js'], write: false});
const source = worker.outputFiles[0].text;
await writeFile('public/worker.js', source);
// Embed the trusted worker bundle so a blob worker inherits the page's CSP,
// including on static hosts that cannot set worker response headers.
await build({...options, entryPoints: ['web/app.js'], outfile: 'public/app.js', define: {__INSPECTOR_WORKER_SOURCE__: JSON.stringify(source)}});
// Keep a fresh HTML response from loading an older, cached controller bundle.
const hash = createHash('sha256').update(await readFile('public/app.js')).digest('hex').slice(0, 16);
const page = await readFile('public/index.html', 'utf8');
const script = /src="\.\/app\.js(?:\?v=[0-9a-f]+)?"/;
if (!script.test(page)) throw new Error('Browser entry script reference not found.');
await writeFile('public/index.html', page.replace(script, 'src="./app.js?v=' + hash + '"'));
