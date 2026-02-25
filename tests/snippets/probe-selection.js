/**
 * probe-selection.js
 * Detects element tree structure in Bricks Builder runtime.
 * Searches for arrays/objects with element-like keys (id, type, children, etc.)
 */
(() => {
  const matches = [];
  const walk = (obj, path, depth = 0) => {
    if (!obj || depth > 4) return;
    if (Array.isArray(obj)) {
      if (obj.length && typeof obj[0] === 'object') {
        const sample = obj[0];
        const keys = Object.keys(sample || {});
        if (keys.some(k => /id|type|children|props|settings|styles/i.test(k))) {
          matches.push({ path, kind: 'arrayOfObjects', keys: keys.slice(0, 12) });
        }
      }
      obj.slice(0, 10).forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.some(k => /elements|tree|nodes|state|selected|history/i.test(k))) {
        matches.push({ path, kind: 'object', keys: keys.slice(0, 20) });
      }
      keys.slice(0, 30).forEach(k => {
        try { walk(obj[k], `${path}.${k}`, depth + 1); } catch {}
      });
    }
  };

  Object.keys(window).forEach(k => {
    try { walk(window[k], `window.${k}`); } catch {}
  });
  console.table(matches.slice(0, 300));
  return matches;
})();
