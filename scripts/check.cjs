const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

for (const folder of ['shared', 'web', 'scripts']) {
  for (const name of fs.readdirSync(folder)) {
    if (/\.(c?js)$/.test(name)) execFileSync(process.execPath, ['--check', path.join(folder, name)], { stdio: 'inherit' });
  }
}
console.log('JavaScript syntax passed.');
