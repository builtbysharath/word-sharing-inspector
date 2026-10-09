import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
const options = {bundle: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: false};
const worker = await build({...options, entryPoints: ['web/worker.js'], write: false});
const source = worker.outputFiles[0].text;
await writeFile('public/worker.js', source);
// Embed the trusted worker bundle so a blob worker inherits the page's CSP,
// including on static hosts that cannot set worker response headers.
await build({...options, entryPoints: ['web/app.js'], outfile: 'public/app.js', define: {__INSPECTOR_WORKER_SOURCE__: JSON.stringify(source)}});
