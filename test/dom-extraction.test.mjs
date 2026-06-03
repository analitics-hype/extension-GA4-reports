/**
 * DOM extraction tests against saved GA4 HTML fixtures (jsdom)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name) {
  const html = fs.readFileSync(path.join(fixturesDir, name), 'utf8');
  return new JSDOM(html);
}

async function loadExtractionModule() {
  const modulePath = pathToFileURL(
    path.join(__dirname, '../src/content/modules/data-extraction.js'),
  ).href;
  return import(modulePath);
}

async function withFixture(name, fn) {
  const dom = loadFixture(name);
  global.document = dom.window.document;
  global.window = dom.window;
  const mod = await loadExtractionModule();
  const helpers = await import(pathToFileURL(
    path.join(__dirname, '../src/content/modules/dom-helpers.js'),
  ).href);
  return fn({ ...mod, ...helpers }, dom.window.document);
}

async function runTests() {
  await withFixture('new-table-page.html', async ({ getReportInfo, getTableData, detectTableVariant }, doc) => {
    assert.equal(detectTableVariant(doc), 'new');
    const info = getReportInfo(doc);
    assert.equal(info.success, true);
    assert.equal(info.data.reportName, 'IP - Test Report');
    assert.deepEqual(info.data.segments, ['V0', 'V1']);
    assert.deepEqual(info.data.kpis, ['Sessions']);

    const table = getTableData(doc);
    assert.deepEqual(table.kpis, ['Sessions']);
    assert.equal(table.segments.length, 2);
    assert.equal(table.segments[0].segment, 'V0');
    assert.equal(table.segments[0].metrics.Sessions, 1902);
    assert.equal(table.segments[1].metrics.Sessions, 1875);
  });

  await withFixture('old-table-page.html', async ({ getReportInfo, getTableData, detectTableVariant }, doc) => {
    assert.equal(detectTableVariant(doc), 'old');
    const info = getReportInfo(doc);
    assert.equal(info.success, true);
    assert.equal(info.data.reportName, 'IP - Test Report');

    const table = getTableData(doc);
    assert.deepEqual(table.kpis, ['Sessions']);
    assert.equal(table.segments[0].segment, 'V0');
    assert.equal(table.segments[0].metrics.Sessions, 337);
    assert.equal(table.segments[1].metrics.Sessions, 323);
  });
}

runTests()
  .then(() => console.log('dom-extraction: all tests passed'))
  .catch((err) => {
    console.error('dom-extraction: FAILED');
    console.error(err);
    process.exit(1);
  });
