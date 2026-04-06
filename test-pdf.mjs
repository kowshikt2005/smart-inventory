import { PDFParse } from './smart-inventory/node_modules/pdf-parse/dist/pdf-parse/esm/index.js';
import { writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';

const buf = readFileSync('C:/Users/kowsh/Documents/Invoice_1221771524_.xlsx');
const tmp = tmpdir() + '/test.pdf';
writeFileSync(tmp, buf);
const fileUrl = new URL('file:///' + tmp.replace(/\/g, '/')).href;
console.log('url:', fileUrl);
try {
  const parser = new PDFParse({ url: fileUrl });
  const r = await parser.getText();
  console.log('text len:', r.text.length, '\npreview:\n', r.text.slice(0, 300));
} catch(e) {
  console.log('error:', e.message);
}
