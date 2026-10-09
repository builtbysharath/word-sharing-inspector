import {inspect} from '../src/inspect.js';
self.onmessage = event => {
  try {self.postMessage({report: inspect(new Uint8Array(event.data.buffer), {filename: event.data.filename})});}
  catch (error) {self.postMessage({error: error.message});}
};
