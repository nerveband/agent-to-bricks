// E2E test MCP client — talks directly to the tauri-plugin-mcp Unix socket
import * as net from 'net';
import * as fs from 'fs';

const SOCKET_PATH = process.env.TAURI_MCP_IPC_PATH || '/tmp/tauri-mcp-atb.sock';

class MCPClient {
  constructor() {
    this.client = null;
    this.buffer = '';
    this.callbacks = new Map();
    this.reqId = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client = net.createConnection({ path: SOCKET_PATH }, () => {
        this.client.on('data', (data) => this.handleData(data));
        resolve();
      });
      this.client.on('error', reject);
    });
  }

  handleData(data) {
    this.buffer += data.toString();
    let idx;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const json = this.buffer.substring(0, idx);
      this.buffer = this.buffer.substring(idx + 1);
      try {
        const resp = JSON.parse(json);
        const id = resp.id;
        if (id && this.callbacks.has(id)) {
          const cb = this.callbacks.get(id);
          this.callbacks.delete(id);
          if (resp.success) cb.resolve(resp.data);
          else cb.reject(new Error(resp.error || 'Command failed'));
        }
      } catch (e) { /* ignore parse errors */ }
    }
  }

  async send(command, payload = {}, timeoutMs = 30000) {
    const id = `req_${++this.reqId}`;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      const msg = JSON.stringify({ command, payload, id }) + '\n';
      this.client.write(msg);
      setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`Timeout: ${command}`));
        }
      }, timeoutMs);
    });
  }

  async screenshot(opts = {}, attempts = 2) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.send(
          'take_screenshot',
          {
            window_label: 'main',
            save_to_disk: true,
            thumbnail: false,
            output_dir: process.env.SCREENSHOT_DIR || '/tmp',
            ...opts,
          },
          60000
        );
      } catch (error) {
        lastError = error;
        if (!String(error?.message || '').includes('Timeout') || attempt === attempts) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    throw lastError;
  }

  async appInfo() {
    return this.send('get_app_info', {});
  }

  async pageState() {
    return this.send('get_page_state', { window_label: 'main' });
  }

  async pageMap(opts = {}) {
    return this.send('get_page_map', {
      window_label: 'main',
      include_content: true,
      ...opts,
    });
  }

  async getDom() {
    return this.send('get_dom', 'main');
  }

  async executeJs(code) {
    const data = await this.send('execute_js', { window_label: 'main', code });
    // Response is {result: "...", type: "string"} — extract the result
    if (data && typeof data === 'object' && 'result' in data) {
      return data.result;
    }
    return data;
  }

  async click(x, y) {
    return this.send('click', { window_label: 'main', x, y });
  }

  async typeText(text) {
    return this.send('type_text', { window_label: 'main', text });
  }

  async findElement(selectorType, selectorValue, shouldClick = false) {
    return this.send('get_element_position', {
      window_label: 'main',
      selector_type: selectorType,
      selector_value: selectorValue,
      should_click: shouldClick,
    });
  }

  close() {
    if (this.client) this.client.end();
  }
}

export default MCPClient;
