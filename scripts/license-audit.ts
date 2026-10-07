import * as fs from 'fs';
import * as path from 'path';

function auditLicenses() {
  const licensesFile = path.resolve(__dirname, '../docs/LICENSES.md');
  if (!fs.existsSync(licensesFile)) {
    console.error('docs/LICENSES.md not found');
    process.exit(1);
  }
  
  // Minimal check for M0
  const content = fs.readFileSync(licensesFile, 'utf-8');
  if (content.length === 0) {
    console.error('LICENSES.md is empty');
    process.exit(1);
  }
  
  console.log('License audit passed (stub).');
}

auditLicenses();
