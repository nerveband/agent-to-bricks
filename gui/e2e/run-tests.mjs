// E2E Test Suite for Agent to Bricks GUI
// Runs against real app via tauri-plugin-mcp socket + live staging API
import MCPClient from './mcp-client.mjs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(E2E_DIR, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const GUI_VERSION = JSON.parse(
  fs.readFileSync(path.join(E2E_DIR, '..', 'package.json'), 'utf8')
).version;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredPageId(name) {
  const raw = requiredEnv(name);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

const STAGING_URL = requiredEnv('ATB_STAGING_URL').replace(/\/+$/, '');
const API_KEY = requiredEnv('ATB_STAGING_API_KEY');
const READ_PAGE_ID = requiredPageId('ATB_STAGING_READ_PAGE_ID');

const results = [];
let client;

function log(msg) { console.log(`  ${msg}`); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function test(name, fn) {
  process.stdout.write(`TEST: ${name} ... `);
  try {
    await fn();
    console.log('PASS');
    results.push({ name, status: 'PASS' });
  } catch (e) {
    console.log(`FAIL: ${e.message}`);
    results.push({ name, status: 'FAIL', error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function isRetryableJsError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('timeout') || message.includes('execute-js') || message.includes('execute_js');
}

// Execute JS in webview (uses new Function, needs explicit return)
async function js(code, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await client.executeJs(code);
    } catch (error) {
      lastError = error;
      if (!isRetryableJsError(error) || attempt === attempts) {
        break;
      }
      await sleep(500 * attempt);
    }
  }
  throw lastError;
}

// Execute JS and parse JSON result
async function jsJson(code) {
  const result = await js(code);
  return JSON.parse(result);
}

// Fetch from staging API (runs in Node.js, not webview — avoids CORS)
async function apiFetch(endpoint, opts = {}) {
  const url = `${STAGING_URL}/wp-json/${endpoint}`;
  const resp = await fetch(url, {
    headers: { 'X-ATB-Key': API_KEY, ...opts.headers },
    method: opts.method || 'GET',
    body: opts.body,
  });
  return { ok: resp.ok, status: resp.status, data: await resp.json() };
}

async function waitForWebviewReady(attempts = 20) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const readyState = await client.executeJs('return document.readyState');
      if (readyState === 'interactive' || readyState === 'complete') {
        return readyState;
      }
    } catch (error) {
      if (!isRetryableJsError(error) || attempt === attempts) {
        throw error;
      }
    }
    await sleep(500);
  }
  throw new Error('Timed out waiting for webview readiness');
}

// ============================================================
// TEST SUITE
// ============================================================

async function runTests() {
  log(`Using staging site ${STAGING_URL} (read page ${READ_PAGE_ID})`);
  client = new MCPClient();
  await client.connect();
  log('Connected to MCP socket\n');
  const readyState = await waitForWebviewReady();
  log(`Webview ready (${readyState})\n`);

  // ----------------------------------------------------------
  // 1. APP LIFECYCLE
  // ----------------------------------------------------------
  console.log('=== APP LIFECYCLE ===');

  await test('App has correct name and version', async () => {
    const info = await client.appInfo();
    assert(info.app.name === 'Agent to Bricks', `Name: ${info.app.name}`);
    assert(info.app.version === GUI_VERSION, `Version: ${info.app.version}`);
  });

  await test('Window is visible with correct title', async () => {
    const info = await client.appInfo();
    const win = info.windows.find(w => w.label === 'main');
    assert(win, 'Main window not found');
    assert(win.visible, 'Window not visible');
    assert(win.title === 'Agent to Bricks', `Title: ${win.title}`);
  });

  await test('Window has reasonable dimensions', async () => {
    const info = await client.appInfo();
    const win = info.windows.find(w => w.label === 'main');
    assert(win.size.width >= 800, `Width too small: ${win.size.width}`);
    assert(win.size.height >= 600, `Height too small: ${win.size.height}`);
  });

  await test('App URL is localhost dev server', async () => {
    const url = await js('return window.location.href');
    assert(url.includes('localhost'), `URL: ${url}`);
  });

  // ----------------------------------------------------------
  // 2. DARK THEME
  // ----------------------------------------------------------
  console.log('\n=== THEME ===');

  await test('Dark theme applied by default', async () => {
    const data = await jsJson(`
      var html = document.documentElement;
      var bg = getComputedStyle(document.body).backgroundColor;
      var rgbMatch = bg.match(/\\d+/g);
      var isDark = (rgbMatch && parseInt(rgbMatch[0]) < 50) || html.classList.contains('dark');
      return JSON.stringify({ isDark: isDark, bg: bg, classes: html.className });
    `);
    assert(data.isDark, `Theme not dark: bg=${data.bg} classes=${data.classes}`);
  });

  // ----------------------------------------------------------
  // 3. SIDEBAR — TOOLS LIST
  // ----------------------------------------------------------
  console.log('\n=== SIDEBAR ===');

  await test('Sidebar shows Tools section', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('TOOLS') || text.includes('Tools'), 'TOOLS not found');
  });

  await test('Bricks CLI tool listed', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('Bricks CLI'), 'Bricks CLI not found');
  });

  await test('Claude Code tool listed', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('Claude Code'), 'Claude Code not found');
  });

  await test('Codex tool listed', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('Codex'), 'Codex not found');
  });

  await test('OpenCode tool listed', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('OpenCode'), 'OpenCode not found');
  });

  await test('Add Tool button exists', async () => {
    const data = await jsJson(`
      var btns = document.querySelectorAll('button');
      var found = false;
      for (var i = 0; i < btns.length; i++) {
        var title = btns[i].getAttribute('title') || '';
        var aria = btns[i].getAttribute('aria-label') || '';
        if (title.toLowerCase().includes('add tool') || aria.toLowerCase().includes('add')) {
          found = true; break;
        }
      }
      return JSON.stringify({ found: found });
    `);
    assert(data.found, 'Add Tool button not found');
  });

  await test('Sessions section or indicator visible', async () => {
    const text = await js('return document.body.innerText');
    assert(
      text.includes('SESSIONS') || text.includes('Sessions') || text.includes('No active session'),
      'Sessions section not found'
    );
  });

  await test('Bottom nav has Settings, Terminal, Help', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('Settings'), 'Settings not found');
    assert(text.includes('Terminal'), 'Terminal not found');
    assert(text.includes('Help'), 'Help not found');
  });

  // ----------------------------------------------------------
  // 4. SITE MANAGEMENT
  // ----------------------------------------------------------
  console.log('\n=== SITE MANAGEMENT ===');

  await test('Site switcher shows connected site', async () => {
    const text = await js('return document.body.innerText');
    assert(
      text.includes('Tayseer Seminary') || text.includes('ts-staging') || text.includes('STG'),
      'No connected site found'
    );
  });

  // ----------------------------------------------------------
  // 5. PROMPT COMPOSER
  // ----------------------------------------------------------
  console.log('\n=== PROMPT COMPOSER ===');

  await test('Prompt input field exists (textarea)', async () => {
    const data = await jsJson(`
      var input = document.querySelector('textarea, [contenteditable="true"]');
      return JSON.stringify({ found: !!input, tag: input ? input.tagName : null });
    `);
    assert(data.found, 'No prompt input found');
  });

  await test('@-mention tags displayed', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('@page'), '@page not found');
    assert(text.includes('@section'), '@section not found');
    assert(text.includes('@element'), '@element not found');
    assert(text.includes('@class'), '@class not found');
  });

  await test('Preset buttons displayed', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('Hero Section'), 'Hero Section preset not found');
    assert(text.includes('Contact Form'), 'Contact Form preset not found');
    assert(text.includes('Card Grid'), 'Card Grid preset not found');
    assert(text.includes('Full Page'), 'Full Page preset not found');
    assert(text.includes('Restyle'), 'Restyle preset not found');
  });

  await test('Save and Copy buttons exist', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes('Save'), 'Save button not found');
    assert(text.includes('Copy'), 'Copy button not found');
  });

  await test('Search presets input exists', async () => {
    const data = await jsJson(`
      var inputs = document.querySelectorAll('input');
      var found = false;
      for (var i = 0; i < inputs.length; i++) {
        if ((inputs[i].placeholder || '').toLowerCase().includes('search presets')) {
          found = true; break;
        }
      }
      return JSON.stringify({ found: found });
    `);
    assert(data.found, 'Search presets input not found');
  });

  // Take sidebar + composer screenshot
  const composerShot = await client.screenshot();
  log(`Composer screenshot: ${composerShot.filePath}`);

  // ----------------------------------------------------------
  // 6. STAGING SITE CONNECTION (via Node.js fetch, not webview)
  // ----------------------------------------------------------
  console.log('\n=== STAGING SITE CONNECTION ===');

  await test('Site info endpoint returns valid data', async () => {
    const { ok, data } = await apiFetch('agent-bricks/v1/site/info');
    assert(ok, 'Site info fetch failed');
    assert(data.wpVersion, `No WP version: ${JSON.stringify(data).substring(0, 100)}`);
    assert(data.bricksVersion, `No Bricks version`);
    log(`  WP ${data.wpVersion}, Bricks ${data.bricksVersion}`);
  });

  await test('Site has correct WordPress version (6.9+)', async () => {
    const { data } = await apiFetch('agent-bricks/v1/site/info');
    const [major, minor] = data.wpVersion.split('.').map(Number);
    assert(major >= 6 && minor >= 9, `WP version too old: ${data.wpVersion}`);
  });

  // ----------------------------------------------------------
  // 7. PAGE BROWSING (live staging via Node.js)
  // ----------------------------------------------------------
  console.log('\n=== PAGE BROWSING ===');

  await test('Can fetch pages from staging', async () => {
    const { ok, data } = await apiFetch('wp/v2/pages?per_page=5');
    assert(ok, 'Pages fetch failed');
    assert(Array.isArray(data), 'Pages not an array');
    assert(data.length > 0, 'No pages returned');
    log(`  Found ${data.length} pages: ${data.map(p => p.title.rendered).join(', ')}`);
  });

  await test(`Can fetch elements for test page ${READ_PAGE_ID}`, async () => {
    const { ok, data } = await apiFetch(`agent-bricks/v1/pages/${READ_PAGE_ID}/elements`);
    assert(ok, 'Elements fetch failed');
    const elements = data.elements || data;
    assert(Array.isArray(elements), 'Elements not an array');
    assert(elements.length > 0, `No elements, got ${elements.length}`);
    log(`  Page ${READ_PAGE_ID} has ${elements.length} elements`);
  });

  // ----------------------------------------------------------
  // 8. ABILITIES API (live staging, WP 6.9)
  // ----------------------------------------------------------
  console.log('\n=== ABILITIES API ===');

  await test('Abilities endpoint returns 22+ abilities', async () => {
    const { ok, data } = await apiFetch('wp-abilities/v1/abilities');
    assert(ok, 'Abilities fetch failed');
    const arr = Array.isArray(data) ? data : Object.values(data);
    assert(arr.length >= 22, `Expected >=22 abilities, got ${arr.length}`);
    log(`  Found ${arr.length} abilities`);
  });

  await test('ATB abilities have correct categories', async () => {
    const { data } = await apiFetch('wp-abilities/v1/abilities');
    const arr = Array.isArray(data) ? data : Object.values(data);
    const atb = arr.filter(a => a.name?.startsWith('agent-bricks/'));
    const categories = [...new Set(atb.map(a => a.category).filter(Boolean))];
    assert(atb.length >= 20, `Expected >=20 ATB abilities, got ${atb.length}`);
    assert(categories.length >= 3, `Expected >=3 categories, got ${categories.length}`);
    log(`  ${atb.length} ATB abilities, categories: ${categories.join(', ')}`);
  });

  await test('Core WP abilities present', async () => {
    const { data } = await apiFetch('wp-abilities/v1/abilities');
    const arr = Array.isArray(data) ? data : Object.values(data);
    const core = arr.filter(a => a.name && !a.name.startsWith('agent-bricks/'));
    assert(core.length >= 1, `Expected >=1 core ability, got ${core.length}`);
    log(`  ${core.length} core abilities: ${core.map(a => a.name).join(', ')}`);
  });

  await test('Can execute readonly ability (get-site-info)', async () => {
    const { ok, status, data } = await apiFetch('wp-abilities/v1/abilities/agent-bricks/get-site-info/run');
    assert(ok, `Ability exec failed: status ${status}`);
    // Ability returns the data directly (same shape as site/info)
    assert(data.wpVersion || data.bricksVersion, 'No data from ability execution');
    log(`  Got site info via ability: WP ${data.wpVersion}`);
  });

  await test(`Can execute ability with input (get-page-elements for ${READ_PAGE_ID})`, async () => {
    const { ok, status, data } = await apiFetch(
      `wp-abilities/v1/abilities/agent-bricks/get-page-elements/run?input[page_id]=${READ_PAGE_ID}`
    );
    assert(ok, `Ability exec failed: status ${status}`);
    // Response is the elements data directly
    const elements = data.elements || (Array.isArray(data) ? data : null);
    assert(elements, `No elements in response: ${JSON.stringify(data).substring(0, 100)}`);
    log(`  Got ${elements.length} elements via ability`);
  });

  await test('Readonly ability rejects POST method', async () => {
    const { ok, status } = await apiFetch('wp-abilities/v1/abilities/agent-bricks/get-site-info/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(!ok, `Expected POST to be rejected for readonly ability`);
    assert(status === 405 || status === 400, `Expected 405/400, got ${status}`);
  });

  // ----------------------------------------------------------
  // 8b. CSS VARIABLES & COLORS (ACSS support)
  // ----------------------------------------------------------
  console.log('\n=== CSS VARIABLES & COLORS ===');

  await test('Variables endpoint returns extractedFromCSS', async () => {
    const { ok, data } = await apiFetch('agent-bricks/v1/variables');
    assert(ok, 'Variables fetch failed');
    const cssVars = data.extractedFromCSS || [];
    assert(cssVars.length > 0, `Expected CSS vars, got ${cssVars.length}`);
    log(`  Found ${cssVars.length} CSS variables`);
  });

  await test('Styles endpoint returns cssColors', async () => {
    const { ok, data } = await apiFetch('agent-bricks/v1/styles');
    assert(ok, 'Styles fetch failed');
    const cssColors = data.cssColors || [];
    assert(cssColors.length > 0, `Expected CSS colors, got ${cssColors.length}`);
    log(`  Found ${cssColors.length} CSS colors`);
  });

  await test('CSS colors have valid hex/rgb values', async () => {
    const { data } = await apiFetch('agent-bricks/v1/styles');
    const cssColors = data.cssColors || [];
    const sample = cssColors.slice(0, 5);
    for (const c of sample) {
      assert(c.slug, 'Color missing slug');
      assert(c.color, 'Color missing value');
      const isValid = c.color.startsWith('#') || c.color.startsWith('rgb') || c.color.startsWith('hsl');
      assert(isValid, `Invalid color value: ${c.color}`);
    }
  });

  // ----------------------------------------------------------
  // 9. UI INTERACTIONS
  // ----------------------------------------------------------
  console.log('\n=== UI INTERACTIONS ===');

  // First close any open dialog
  await js(`
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    return 'escaped';
  `);
  await new Promise(r => setTimeout(r, 300));

  await test('Settings dialog opens', async () => {
    await js(`
      var links = document.querySelectorAll('button, a, [role="button"], span');
      for (var i = 0; i < links.length; i++) {
        if (links[i].textContent.trim() === 'Settings') { links[i].click(); break; }
      }
      return 'clicked';
    `);
    await new Promise(r => setTimeout(r, 800));

    const data = await jsJson(`
      var dialog = document.querySelector('[role="dialog"], [class*="Dialog"], [class*="Settings"]');
      var text = document.body.innerText;
      return JSON.stringify({
        hasDialog: !!dialog,
        hasSettingsContent: text.indexOf('Site URL') !== -1 || text.indexOf('API Key') !== -1 ||
          text.indexOf('Appearance') !== -1 || text.indexOf('Theme') !== -1
      });
    `);
    assert(data.hasDialog || data.hasSettingsContent, 'Settings dialog did not open');
  });

  await test('Settings has configuration fields', async () => {
    const text = await js('return document.body.innerText');
    const hasFields = text.includes('Site URL') || text.includes('API Key') ||
      text.includes('Appearance') || text.includes('Theme') || text.includes('General');
    assert(hasFields, 'Settings missing config fields');
  });

  await test('Prompt template does not inline the raw API key', async () => {
    await js(`
      var tabs = document.querySelectorAll('button, [role="tab"], a');
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].textContent.trim() === 'Prompt') { tabs[i].click(); break; }
      }
      return 'clicked';
    `);
    await new Promise(r => setTimeout(r, 400));

    const data = await jsJson(`
      var areas = Array.from(document.querySelectorAll('textarea'));
      var promptArea = areas.find((el) => (el.value || '').indexOf('Bricks Builder') !== -1) || null;
      var value = promptArea ? promptArea.value : '';
      return JSON.stringify({
        found: !!promptArea,
        hasRawKey: value.indexOf(${JSON.stringify(API_KEY)}) !== -1,
        hasPlaceholder: value.indexOf('{api_key}') !== -1,
        hasRedactionNote: document.body.innerText.indexOf('managed by Agent to Bricks') !== -1
      });
    `);
    assert(data.found, 'Prompt template textarea not found');
    assert(!data.hasRawKey, 'Prompt template contains the raw API key');
    assert(data.hasPlaceholder, 'Prompt template lost the {api_key} placeholder');
    assert(data.hasRedactionNote, 'Redaction guidance not visible in settings');
  });

  // Screenshot settings
  const settingsShot = await client.screenshot();
  log(`Settings screenshot: ${settingsShot.filePath}`);

  // Close settings
  await js(`
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    return 'escaped';
  `);
  await new Promise(r => setTimeout(r, 500));

  // ----------------------------------------------------------
  // 9b. STATUS BAR
  // ----------------------------------------------------------
  console.log('\n=== STATUS BAR ===');

  // Close any open dialogs first
  await js(`
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    return 'escaped';
  `);
  await new Promise(r => setTimeout(r, 300));

  await test('Version number visible in status bar', async () => {
    const text = await js('return document.body.innerText');
    assert(text.includes(`v${GUI_VERSION}`), `Version not found in body text`);
  });

  await test('Version number is clickable', async () => {
    const data = await jsJson(`
      var btns = document.querySelectorAll('button');
      var found = false;
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim().match(/^v\\d+\\.\\d+\\.\\d+$/)) {
          found = true; break;
        }
      }
      return JSON.stringify({ found: found });
    `);
    assert(data.found, 'Version button not found');
  });

  // ----------------------------------------------------------
  // 10. WELCOME MESSAGE
  // ----------------------------------------------------------
  console.log('\n=== WELCOME MESSAGE ===');

  await test('Welcome message displayed', async () => {
    const text = await js('return document.body.innerText');
    assert(
      text.includes('Ready to manage') || text.includes('Bricks Builder') || text.includes('website'),
      'Welcome message not found'
    );
  });

  // ----------------------------------------------------------
  // 11. MCP TOOLS VERIFICATION
  // ----------------------------------------------------------
  console.log('\n=== MCP TOOLS ===');

  await test('get_page_map returns element tree', async () => {
    const data = await client.send('get_page_map', { window_label: 'main', include_content: true });
    assert(data, 'No page map returned');
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    assert(str.length > 100, `Page map too short: ${str.length} chars`);
  });

  await test('get_page_state returns page metadata', async () => {
    const data = await client.send('get_page_state', { window_label: 'main' });
    assert(data, 'No page state returned');
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    assert(str.includes('localhost') || str.includes('Agent to Bricks'), `Unexpected: ${str.substring(0, 200)}`);
  });

  await test('Screenshot saves to disk', async () => {
    const shot = await client.screenshot({ output_dir: SCREENSHOT_DIR });
    assert(shot.filePath, 'No file path in screenshot response');
    assert(fs.existsSync(shot.filePath), `Screenshot file not found: ${shot.filePath}`);
    const stat = fs.statSync(shot.filePath);
    assert(stat.size > 1000, `Screenshot too small: ${stat.size} bytes`);
    log(`  Screenshot: ${shot.filePath} (${Math.round(stat.size/1024)}KB)`);
  });

  // ----------------------------------------------------------
  // RESULTS
  // ----------------------------------------------------------
  console.log('\n\n========================================');
  console.log('        E2E TEST RESULTS SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  for (const r of results) {
    const icon = r.status === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.name}${r.error ? ` -- ${r.error}` : ''}`);
  }

  console.log(`\n  Total: ${results.length}  Passed: ${passed}  Failed: ${failed}`);

  // Save results to JSON
  const resultFile = path.join(SCREENSHOT_DIR, '..', 'test-results.json');
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    results
  }, null, 2));
  console.log(`  Results: ${resultFile}\n`);

  client.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  if (client) client.close();
  process.exit(1);
});
