/**
 * probe-runtime.js
 * Inventories candidate globals and object graphs related to Bricks Builder.
 * Run in Chrome DevTools console while Bricks editor is open.
 */
(() => {
  const keys = Object.keys(window).sort();
  const suspects = keys.filter(k =>
    /bricks|builder|wp|store|state|react|vue|event/i.test(k)
  );
  console.table(suspects.map(k => ({
    key: k,
    type: typeof window[k],
    hasKeys: window[k] && typeof window[k] === 'object' ? Object.keys(window[k]).length : 0
  })));
  return suspects;
})();
