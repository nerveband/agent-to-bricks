/**
 * export-subtree.js
 *
 * Export normalized JSON for the selected element and its entire subtree.
 * Strips volatile fields (runtime-only refs) and resolves global class names.
 *
 * Usage: Select an element in the builder, then run this snippet.
 */
(() => {
  const state = window.builderTest._getBricksState();
  const activeEl = state.activeElement;

  if (!activeEl) {
    console.error('[export] No element selected. Click an element first.');
    return null;
  }

  const content = state.content;
  const globalClasses = state.globalClasses || [];

  // Recursively collect subtree
  function collectSubtree(elementId) {
    const el = content.find(e => e.id === elementId);
    if (!el) return null;

    const node = {
      name: el.name,
      label: el.label || undefined,
      settings: normalizeSettings(el.settings),
      children: []
    };

    if (el.children && el.children.length > 0) {
      node.children = el.children
        .map(childId => collectSubtree(childId))
        .filter(Boolean);
    }

    return node;
  }

  // Strip volatile fields, resolve class names
  function normalizeSettings(settings) {
    if (!settings || Array.isArray(settings)) return {};
    const clean = JSON.parse(JSON.stringify(settings));

    // Resolve _cssGlobalClasses IDs to names
    if (clean._cssGlobalClasses) {
      clean._cssGlobalClassNames = clean._cssGlobalClasses.map(id => {
        const cls = globalClasses.find(c => c.id === id);
        return cls ? cls.name : `[unknown:${id}]`;
      });
    }

    return clean;
  }

  // Collect referenced global classes
  function collectReferencedClasses(node) {
    const refs = new Set();
    function walk(n) {
      if (n.settings?._cssGlobalClasses) {
        n.settings._cssGlobalClasses.forEach(id => refs.add(id));
      }
      if (n.children) n.children.forEach(walk);
    }
    walk(node);

    return [...refs].map(id => {
      const cls = globalClasses.find(c => c.id === id);
      return cls ? { id: cls.id, name: cls.name, category: cls.category } : { id, name: '[unknown]' };
    });
  }

  const subtree = collectSubtree(activeEl.id);
  const referencedClasses = collectReferencedClasses(subtree);

  const exportData = {
    meta: {
      version: '1.0',
      source: 'manual',
      timestamp: Math.floor(Date.now() / 1000),
      bricksVersion: window.bricksData.version,
      exportedFrom: {
        postId: state.postId,
        elementId: activeEl.id,
        elementName: activeEl.name
      }
    },
    patchMode: 'insert',
    nodes: [subtree],
    bindings: {
      globalClasses: referencedClasses
    }
  };

  // Copy to clipboard
  const json = JSON.stringify(exportData, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    console.log('[export] Copied to clipboard! (' + json.length + ' chars)');
  }).catch(() => {
    console.log('[export] Could not copy to clipboard. JSON logged below:');
  });

  console.log('[export] Subtree export:', exportData);
  return exportData;
})();
