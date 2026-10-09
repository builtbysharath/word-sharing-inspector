import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the real browser controller with controllable file reads and workers.
// Rendering/layout is checked separately in a browser.
function harness() {
  const nodes = new Map(), workers = [], blobs = [], revoked = [];
  const element = () => ({textContent: '', hidden: false, disabled: false, value: '', children: [], dataset: {}, listeners: {},
    classList: {toggle() {}}, setAttribute() {}, append(...items) {this.children.push(...items);}, replaceChildren(...items) {this.children = items;}, addEventListener(name, fn) {this.listeners[name] = fn;}});
  const select = selector => {if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector);};
  class Worker {constructor(url) {this.url = url; workers.push(this);} terminate() {this.stopped = true;} postMessage(message) {this.message = message;}}
  const urls = {createObjectURL: blob => {blobs.push(blob); return 'blob:inspector/' + blobs.length;}, revokeObjectURL: url => revoked.push(url)};
  const context = vm.createContext({document: {querySelector: select, createElement: element}, Worker, Blob, URL: urls, __INSPECTOR_WORKER_SOURCE__: 'self.onmessage = () => {};', Uint8Array, crypto: {}, setTimeout: () => 1, clearTimeout() {}, makeDemo: () => new Uint8Array([1])});
  const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/, '');
  vm.runInContext(source, context);
  return {select, workers, blobs, revoked, change: file => select('#file').listeners.change({target: {files: [file]}})};
}
test('a slower old file read cannot replace the latest selection', async () => {
  const ui = harness(); let resolveOld;
  const old = ui.change({name: 'old.docx', size: 1, arrayBuffer: () => new Promise(resolve => {resolveOld = resolve;})});
  await ui.change({name: 'new.docx', size: 1, arrayBuffer: async () => new Uint8Array([2]).buffer});
  resolveOld(new Uint8Array([1]).buffer); await old;
  assert.equal(ui.workers.length, 1); assert.equal(ui.workers[0].message.filename, 'new.docx');
});
test('clear removes document metadata and invalidates a pending read', async () => {
  const ui = harness(); let resolveRead;
  const pending = ui.change({name: 'private.docx', size: 1, arrayBuffer: () => new Promise(resolve => {resolveRead = resolve;})});
  for (const id of ['#filename', '#hash', '#summary', '#file-info']) ui.select(id).textContent = 'private value';
  ui.select('#clear').listeners.click(); resolveRead(new Uint8Array([1]).buffer); await pending;
  assert.equal(ui.workers.length, 0); assert.equal(ui.select('#download-report').disabled, true);
  for (const id of ['#filename', '#hash', '#summary', '#file-info']) assert.equal(ui.select(id).textContent, '');
});
test('a stale failed read cannot overwrite the latest file status', async () => {
  const ui = harness(); let rejectOld;
  const old = ui.change({name: 'old.docx', size: 1, arrayBuffer: () => new Promise((_, reject) => {rejectOld = reject;})});
  await ui.change({name: 'new.docx', size: 1, arrayBuffer: async () => new Uint8Array([2]).buffer});
  rejectOld(new Error('read failed')); await old;
  assert.match(ui.select('#status').textContent, /Inspecting new.docx/);
});
test('clear terminates a started inspector and releases its embedded worker source', async () => {
  const ui = harness();
  await ui.change({name: 'sample.docx', size: 1, arrayBuffer: async () => new Uint8Array([1]).buffer});
  assert.equal(ui.workers.length, 1);
  assert.match(ui.workers[0].url, /^blob:/);
  assert.equal(await ui.blobs[0].text(), 'self.onmessage = () => {};');
  ui.select('#clear').listeners.click();
  assert.equal(ui.workers[0].stopped, true);
  assert.deepEqual(ui.revoked, [ui.workers[0].url]);
});
