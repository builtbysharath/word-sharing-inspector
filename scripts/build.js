import {build} from 'esbuild';
await build({entryPoints: ['web/app.js', 'web/worker.js'], bundle: true, outdir: 'public', format: 'esm', platform: 'browser', target: ['es2022'], minify: false});
