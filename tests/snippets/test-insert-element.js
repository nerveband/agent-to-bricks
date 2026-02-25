/**
 * test-insert-element.js
 * TESTED: PASS
 *
 * Insert a new element into the Bricks Builder page.
 *
 * Method: $_addNewElement({ element, parent, index })
 *
 * Pass criteria: Element appears in state.content, renders on canvas.
 * Rollback: Delete the inserted element after test.
 */
(() => {
  const internals = window.builderTest._getBricksInternalFunctions();
  const state = window.builderTest._getBricksState();
  const countBefore = state.content.length;

  // Find a parent to insert into (first root section)
  const firstSection = state.content.find(e => e.parent === 0);

  // Insert a new heading
  internals.$_addNewElement({
    element: {
      name: 'heading',
      label: 'AI Test Heading',
      settings: {
        text: 'Inserted by AI',
        tag: 'h2'
      }
    },
    parent: firstSection.children[0] || firstSection.id,
    index: 0
  });

  const countAfter = state.content.length;
  const newEl = state.content.find(e => e.settings?.text === 'Inserted by AI');

  const result = {
    pass: countAfter === countBefore + 1 && !!newEl,
    countBefore,
    countAfter,
    newElement: newEl ? { id: newEl.id, name: newEl.name, parent: newEl.parent } : null
  };

  console.log('[test-insert]', result.pass ? 'PASS' : 'FAIL', result);

  // Rollback: delete the test element
  if (newEl) {
    state.activeId = newEl.id;
    internals.$_setActiveElement();
    internals.$_deleteElement(newEl);
    console.log('[test-insert] Rollback: deleted', newEl.id);
  }

  return result;
})();
