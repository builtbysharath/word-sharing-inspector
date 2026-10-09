import {makeDemo} from '../examples/demo.js';
const $ = selector => document.querySelector(selector);
const labels = {comments: 'Comments', revisions: 'Tracked changes', hidden: 'Hidden text', properties: 'Properties', embedded: 'Embedded content', links: 'External links', extra: 'Extra data'};
let report = null, worker = null, task = 0;
function resetReport() {
  worker?.terminate(); worker = null; report = null;
  $('#results').hidden = true; $('#download-report').disabled = true;
  for (const selector of ['#findings', '#categories', '#coverage-list']) $(selector).replaceChildren();
  for (const selector of ['#filename', '#summary', '#file-info', '#shown', '#hash']) $(selector).textContent = '';
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function setStatus(text, error = false) {$('#status').textContent = text; $('#status').className = error ? 'status error' : 'status';}
function render(filter = 'all') {
  const list = $('#findings'); list.replaceChildren();
  const visible = report.findings.filter(finding => filter === 'all' || finding.category === filter);
  if (!visible.length) list.append(node('p', 'No findings in this view.', 'empty'));
  for (const finding of visible) {
    const card = node('article', null, 'finding');
    card.append(node('span', labels[finding.category], 'badge'), node('h3', finding.title));
    if (finding.author || finding.date) card.append(node('p', [finding.author, finding.date].filter(Boolean).join(' · '), 'byline'));
    card.append(node('blockquote', finding.detail), node('p', finding.action, 'action'));
    const source = node('details'); source.append(node('summary', 'Where this was found'), node('code', finding.location || finding.part));
    card.append(source); list.append(card);
  }
  $('#shown').textContent = visible.length + ' of ' + report.findings.length + ' findings';
}
async function run(bytes, filename, synthetic = false, current = ++task) {
  if (current !== task) return;
  resetReport();
  if (bytes.byteLength > 25 * 1024 * 1024) {setStatus('This file exceeds the 25 MB inspection limit.', true); return;}
  setStatus('Inspecting ' + filename + ' on this device…');
  const original = new Uint8Array(bytes);
  const hash = crypto.subtle ? await crypto.subtle.digest('SHA-256', original).then(buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('')) : null;
  if (current !== task) return;
  worker = new Worker('./worker.js', {type: 'module'});
  const active = worker;
  const timer = setTimeout(() => {active.terminate(); if (current === task) setStatus('Inspection timed out. Try a smaller document.', true);}, 30000);
  active.onerror = () => {clearTimeout(timer); active.terminate(); if (current === task) setStatus('The inspector could not finish. Reload the page and try again.', true);};
  active.onmessage = event => {
    clearTimeout(timer); active.terminate();
    if (current !== task) return;
    if (event.data.error) {setStatus(event.data.error, true); return;}
    report = {...event.data.report, sha256: hash, synthetic};
    $('#filename').textContent = filename;
    $('#summary').textContent = report.summary;
    $('#file-info').textContent = (synthetic ? 'Synthetic sample · ' : '') + (bytes.byteLength / 1024).toFixed(1) + ' KB · ' + report.scannedParts + ' package parts inspected';
    $('#categories').replaceChildren();
    const all = node('button', 'All (' + report.findings.length + ')', 'chip selected'); all.type = 'button'; all.dataset.category = 'all'; all.setAttribute('aria-pressed', 'true'); $('#categories').append(all);
    for (const [category, label] of Object.entries(labels)) {
      const button = node('button', label + ' (' + report.counts[category] + ')', 'chip'); button.type = 'button'; button.dataset.category = category; button.setAttribute('aria-pressed', 'false'); $('#categories').append(button);
    }
    $('#coverage-list').replaceChildren(...report.limitations.map(text => node('li', text)));
    $('#hash').textContent = hash || 'Unavailable in this browser';
    $('#results').hidden = false; $('#download-report').disabled = false;
    setStatus('Inspection complete. Your document was read locally and was not changed.'); render();
  };
  // Transfer a copy. The original file and its bytes remain untouched.
  const copy = original.slice().buffer;
  active.postMessage({buffer: copy, filename}, [copy]);
}
$('#file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const current = ++task; resetReport();
  if (file.size > 25 * 1024 * 1024) {setStatus('This file exceeds the 25 MB inspection limit.', true); return;}
  setStatus('Reading ' + file.name + ' on this device…');
  try {const bytes = await file.arrayBuffer(); if (current === task) await run(bytes, file.name, false, current);} catch {if (current === task) setStatus('The file could not be read.', true);}
});
$('#demo').addEventListener('click', () => {$('#file').value = ''; run(makeDemo(), 'sample-proposal.docx', true).catch(() => setStatus('The sample could not be inspected.', true));});
$('#categories').addEventListener('click', event => {
  const button = event.target.closest('button[data-category]'); if (!button || !report) return;
  for (const chip of $('#categories').children) {chip.classList.toggle('selected', chip === button); chip.setAttribute('aria-pressed', String(chip === button));}
  render(button.dataset.category);
});
function download(bytes, filename, type) {
  const url = URL.createObjectURL(new Blob([bytes], {type})); const link = node('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#download-report').addEventListener('click', () => {if (report) download(JSON.stringify(report, null, 2), 'word-sharing-report.json', 'application/json');});
$('#download-demo').addEventListener('click', () => download(makeDemo(), 'sample-proposal.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
$('#clear').addEventListener('click', () => {task++; resetReport(); $('#file').value = ''; setStatus('Choose a document or try the sample.');});
