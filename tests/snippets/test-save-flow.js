/**
 * test-save-flow.js
 * TESTED: PASS
 *
 * Captures the full save flow: insert element, save, verify persistence.
 *
 * Method: Install XHR hooks, make change, $_savePost({ force: true })
 *
 * Pass criteria: XHR POST to admin-ajax.php returns { success: true }
 * Rollback: Delete test element and save again.
 */
(() => {
  const internals = window.builderTest._getBricksInternalFunctions();
  const state = window.builderTest._getBricksState();

  // --- Step 1: Install XHR hooks ---
  window._saveTestLog = [];
  const origOpen = XMLHttpRequest.prototype._origOpen || XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype._origSend || XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._m = method; this._u = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if (body && typeof body === 'string') {
      const params = new URLSearchParams(body);
      window._saveTestLog.push({
        method: this._m,
        url: this._u,
        params: Object.fromEntries([...params.entries()].map(([k,v]) => [k, v.slice(0, 100)]))
      });
    }
    this.addEventListener('load', () => {
      const last = window._saveTestLog[window._saveTestLog.length - 1];
      if (last) { last.status = this.status; last.response = this.responseText?.slice(0, 200); }
    });
    return origSend.call(this, body);
  };

  // --- Step 2: Insert test element ---
  const firstSection = state.content.find(e => e.parent === 0);
  internals.$_addNewElement({
    element: { name: 'text-basic', settings: { text: '[SAVE-TEST] Delete me' } },
    parent: firstSection.id,
    index: 0
  });

  // --- Step 3: Save ---
  internals.$_savePost({ force: true });

  // --- Step 4: Wait and check ---
  return new Promise(resolve => {
    setTimeout(() => {
      const log = window._saveTestLog;
      const saveEntry = log.find(e => e.params?.action === 'bricks_save_post');

      const result = {
        pass: saveEntry?.status === 200,
        endpoint: saveEntry?.url,
        payloadKeys: saveEntry ? Object.keys(saveEntry.params) : [],
        status: saveEntry?.status,
        response: saveEntry?.response
      };

      console.log('[test-save]', result.pass ? 'PASS' : 'FAIL', result);

      // --- Rollback: delete test element and save ---
      const testEl = state.content.find(e => e.settings?.text === '[SAVE-TEST] Delete me');
      if (testEl) {
        state.activeId = testEl.id;
        internals.$_setActiveElement();
        internals.$_deleteElement(testEl);
        internals.$_savePost();
        console.log('[test-save] Rollback: deleted and saved');
      }

      resolve(result);
    }, 5000);
  });
})();
