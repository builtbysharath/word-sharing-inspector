import {writeFileSync} from 'node:fs';
import {makeDemo, demoParts, packageParts} from '../examples/demo.js';
writeFileSync('examples/sample-proposal.docx', makeDemo());
writeFileSync('examples/clean-sample.docx', packageParts(demoParts({clean: true})));
console.log('Wrote two synthetic examples; no real client data.');
