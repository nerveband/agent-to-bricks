/**
 * test-clone-element.js
 * TESTED: PASS
 *
 * Clone/duplicate an element in the Bricks Builder.
 *
 * Method: Select element, then $_cloneElement({ element })
 *
 * Pass criteria: New element with same settings appears in content array.
 * Rollback: Delete the cloned element after test.
 */
(() => {
  const internals = window.builderTest._getBricksInternalFunctions();
  const state = window.builderTest._getBricksState();
  const countBefore = state.content.length;

  // Select the first heading
  const heading = state.content.find(e => e.name === 'heading');
  if (!heading) return { error: 'No heading element found' };

  state.activeId = heading.id;
  internals.$_setActiveElement();

  // Clone it
  internals.$_cloneElement({ element: heading });

  const countAfter = state.content.length;

  // Find the clone (same parent, same name, different ID)
  const clones = state.content.filter(e =>
    e.name === heading.name &&
    e.parent === heading.parent &&
    e.id !== heading.id &&
    e.settings?.text === heading.settings?.text
  );

  const result = {
    pass: countAfter === countBefore + 1 && clones.length > 0,
    originalId: heading.id,
    cloneId: clones[0]?.id,
    countBefore,
    countAfter
  };

  console.log('[test-clone]', result.pass ? 'PASS' : 'FAIL', result);

  // Rollback: delete the clone
  if (clones[0]) {
    state.activeId = clones[0].id;
    internals.$_setActiveElement();
    internals.$_deleteElement(clones[0]);
    console.log('[test-clone] Rollback: deleted', clones[0].id);
  }

  return result;
})();
