#!/usr/bin/env node
import {readFileSync, statSync, existsSync} from 'node:fs';
import {basename, resolve} from 'node:path';
import {writePrivate} from '../src/write-private.js';
import {inspect} from '../src/inspect.js';
try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) console.log('word-sharing-inspector FILE.docx [--output REPORT.json]\nRead-only local inspection. Exit 0 = no findings, 1 = findings, 2 = unsupported/error.');
  else {
    if (![1, 3].includes(args.length) || args.length === 3 && args[1] !== '--output') throw new Error('Use FILE.docx [--output REPORT.json].');
    if (args[2] && resolve(args[0]) === resolve(args[2])) throw new Error('The report output must be a different file from the document.');
    const input = statSync(args[0]);
    if (!input.isFile() || input.size > 25 * 1024 * 1024) throw new Error('Choose a document file no larger than 25 MB.');
    if (args[2] && existsSync(args[2])) {
      const output = statSync(args[2]);
      if (output.dev === input.dev && output.ino === input.ino) throw new Error('The report output points to the original document.');
    }
    const report = inspect(readFileSync(args[0]), {filename: basename(args[0])});
    const output = JSON.stringify(report, null, 2) + '\n';
    if (args[2]) writePrivate(args[2], output); else process.stdout.write(output);
    process.exitCode = report.findings.length ? 1 : 0;
  }
} catch (error) {console.error('Word Sharing Inspector: ' + error.message); process.exitCode = 2;}
