import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'test', 'fixtures');

const chrome = (table) => `<!DOCTYPE html>
<html lang="en">
<body>
  <div class="analysis-header-shared"><span>IP - Test Report</span></div>
  <div class="primary-date-range-text">Jan 1 - Jan 31, 2024</div>
  <div id="segment_comparison">
    <div data-guidedhelpid="concept-chip-list-container-segment-comparison">
      <div class="chip-text-content"><span class="chip-title">V0</span></div>
      <div class="chip-text-content"><span class="chip-title">V1</span></div>
    </div>
  </div>
  <div id="value">
    <div class="chip-text-content"><span class="chip-title">Sessions</span></div>
  </div>
  <div class="analysis-area">${table}</div>
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'new-table-page.html'),
  chrome(fs.readFileSync(path.join(root, 'newtabledom.html'), 'utf8')),
);
fs.writeFileSync(
  path.join(outDir, 'old-table-page.html'),
  chrome(fs.readFileSync(path.join(root, 'oldtabledom.html'), 'utf8')),
);
console.log('Fixtures built in test/fixtures/');
