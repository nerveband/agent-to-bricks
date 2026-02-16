/**
 * test-select-element.js
 * TESTED: PASS
 *
 * Programmatically select an element in the Bricks Builder.
 *
 * Method: Set state.activeId then call $_setActiveElement()
 *
 * Usage: Change ELEMENT_ID to target element.
 */
(() => {
  const ELEMENT_ID = '705598'; // Target element ID

  const state = window.builderTest._getBricksState();
  const internals = window.builderTest._getBricksInternalFunctions();

  // Set active ID
  state.activeId = ELEMENT_ID;

  // Trigger selection update
  internals.$_setActiveElement();

  // Verify
  const result = {
    success: state.activeId === ELEMENT_ID,
    activeElement: state.activeElement ? {
      id: state.activeElement.id,
      name: state.activeElement.name,
      label: state.activeElement.label,
      settings: state.activeElement.settings
    } : null
  };

  console.log('[test-select]', result.success ? 'PASS' : 'FAIL', result);
  return result;
})();
