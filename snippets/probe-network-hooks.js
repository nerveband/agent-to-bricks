/**
 * probe-network-hooks.js
 * Intercepts fetch and XHR calls to log all network activity.
 * Run BEFORE performing builder actions to capture payloads.
 */
(() => {
  // Hook fetch
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const [input, init] = args;
    const res = await origFetch(...args);
    try {
      const url = typeof input === 'string' ? input : input.url;
      console.log('[fetch]', init?.method || 'GET', url, init?.body || null, 'status:', res.status);
    } catch {}
    return res;
  };

  // Hook XHR
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._m = method;
    this._u = url;
    return open.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(body) {
    console.log('[xhr]', this._m, this._u, body || null);
    return send.call(this, body);
  };

  console.log('Network hooks installed. Perform builder actions to see traffic.');
})();
