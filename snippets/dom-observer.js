/**
 * dom-observer.js
 * Watches DOM mutations in the Bricks editor panel area.
 * Useful for detecting what changes when elements are selected/modified.
 */
(() => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
        console.log('[DOM]', m.type, {
          target: m.target.tagName + (m.target.className ? '.' + m.target.className.split(' ')[0] : ''),
          added: m.addedNodes.length,
          removed: m.removedNodes.length
        });
      }
      if (m.type === 'attributes') {
        console.log('[DOM attr]', m.attributeName, {
          target: m.target.tagName + '#' + (m.target.id || '') + '.' + (m.target.className?.split(' ')[0] || ''),
          old: m.oldValue?.slice(0, 80),
          new: m.target.getAttribute(m.attributeName)?.slice(0, 80)
        });
      }
    });
  });

  // Observe the entire document for now; narrow down once we identify builder panel
  observer.observe(document.body, {
    childList: true,
    attributes: true,
    subtree: true,
    attributeOldValue: true
  });

  console.log('DOM observer active. Select elements in Bricks to see mutations.');
  window._bricksObserver = observer; // Store ref for cleanup
})();
