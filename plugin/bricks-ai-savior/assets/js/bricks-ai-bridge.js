/**
 * Bricks AI Bridge
 *
 * Wraps the builderTest API for safe CRUD operations.
 * All mutations go through Bricks' internal functions, preserving native undo/redo.
 */
(function () {
  'use strict';

  const BricksAIBridge = {

    // ---- State Access ----

    getState() {
      return window.builderTest?._getBricksState();
    },

    getInternals() {
      return window.builderTest?._getBricksInternalFunctions();
    },

    isReady() {
      return !!(window.builderTest && this.getState() && this.getInternals());
    },

    // ---- Selection ----

    getSelection() {
      const state = this.getState();
      if (!state) return null;

      const activeId = state.activeId;
      if (!activeId) return null;

      const activeElement = state.content.find(e => e.id === activeId);
      return {
        activeId,
        activeElement: activeElement || null,
      };
    },

    select(id) {
      const state = this.getState();
      const internals = this.getInternals();
      if (!state || !internals) return false;

      state.activeId = id;
      internals.$_setActiveElement();
      return true;
    },

    // ---- Page Context ----

    getPageSections() {
      const state = this.getState();
      if (!state) return [];

      return state.content
        .filter(e => e.parent === 0)
        .map(e => ({
          id: e.id,
          name: e.name,
          label: e.label || e.name,
        }));
    },

    getGlobalClasses() {
      const state = this.getState();
      if (!state || !state.globalClasses) return { byId: {}, byName: {} };

      const byId = {};
      const byName = {};
      for (const cls of state.globalClasses) {
        byId[cls.id] = cls;
        byName[cls.name] = cls;
      }
      return { byId, byName, list: state.globalClasses };
    },

    getAcssClasses() {
      const { list } = this.getGlobalClasses();
      if (!list) return [];

      return list.filter(cls =>
        cls.locked ||
        cls.id?.startsWith('acss_import_') ||
        cls.category?.id === 'acss'
      );
    },

    getPageContext() {
      return {
        sections: this.getPageSections(),
        selection: this.getSelection(),
        acssClasses: this.getAcssClasses().map(c => ({
          id: c.id,
          name: c.name,
          category: c.category,
        })),
      };
    },

    // ---- ID Generation ----

    generateId() {
      const internals = this.getInternals();
      if (internals?.$_generateId) {
        return internals.$_generateId();
      }
      // Fallback: 6-char random alphanumeric.
      return Math.random().toString(36).substring(2, 8);
    },

    // ---- Class Resolution ----

    resolveClassNames(names) {
      if (!names || !Array.isArray(names)) return [];
      const { byName } = this.getGlobalClasses();

      return names.map(name => {
        if (byName[name]) return byName[name].id;
        // Try with acss_import_ prefix.
        const acssKey = 'acss_import_' + name;
        if (byName[acssKey]) return byName[acssKey].id;
        // Return as-is (might be an ID already).
        return name;
      });
    },

    // ---- CRUD Operations ----

    /**
     * Insert a tree of nested elements.
     * AI returns nested JSON; this flattens and inserts via Bricks internals.
     *
     * @param {Object} node   - Nested node: { name, label, settings, children }
     * @param {string} parentId - Parent element ID (or 0 for root)
     * @param {number} index  - Position within parent's children
     * @returns {string[]} Array of inserted element IDs
     */
    insertTree(node, parentId, index) {
      const internals = this.getInternals();
      if (!internals) return [];

      const insertedIds = [];
      this._insertRecursive(node, parentId, index, internals, insertedIds);
      return insertedIds;
    },

    _insertRecursive(node, parentId, index, internals, insertedIds) {
      const state = this.getState();
      const contentLenBefore = state.content.length;

      const settings = this._prepareSettings(node.settings || {});
      const element = { name: node.name, settings };
      if (node.label) element.label = node.label;

      internals.$_addNewElement({
        element,
        parent: parentId,
        index,
      });

      // Find the newly created element(s) by diffing content array.
      // $_addNewElement does NOT reliably update activeId.
      const newElements = state.content.slice(contentLenBefore);
      const mainEl = newElements.find(e => e.name === node.name) || newElements[0];
      const newId = mainEl?.id;

      if (!newId) return; // insertion failed
      insertedIds.push(newId);

      // Apply label/settings to the actual element in state (may differ from what we passed).
      if (node.label && mainEl) mainEl.label = node.label;

      // Sections auto-create a container child in Bricks.
      // If our tree also has a container as first child, merge into the auto-container.
      const children = node.children || [];
      if (node.name === 'section' && children.length > 0) {
        const autoContainer = newElements.find(
          e => e.name === 'container' && e.parent === newId
        );
        if (autoContainer && children[0]?.name === 'container') {
          // Merge our container's settings/label into the auto-created one.
          const containerNode = children[0];
          insertedIds.push(autoContainer.id);
          if (containerNode.label) autoContainer.label = containerNode.label;
          if (containerNode.settings) {
            const prep = this._prepareSettings(containerNode.settings);
            Object.assign(autoContainer.settings, prep);
          }
          // Insert the container's children into the auto-container.
          const containerChildren = containerNode.children || [];
          for (let i = 0; i < containerChildren.length; i++) {
            this._insertRecursive(containerChildren[i], autoContainer.id, i, internals, insertedIds);
          }
          // Insert any remaining section children after the first container.
          for (let i = 1; i < children.length; i++) {
            this._insertRecursive(children[i], newId, i, internals, insertedIds);
          }
          return;
        }
      }

      // Normal child processing.
      for (let i = 0; i < children.length; i++) {
        this._insertRecursive(children[i], newId, i, internals, insertedIds);
      }
    },

    /**
     * Insert multiple root-level sections (full page mode).
     *
     * @param {Object[]} sections - Array of section nodes
     * @returns {string[]} All inserted element IDs
     */
    insertFullPage(sections) {
      const allIds = [];
      const pageSections = this.getPageSections();
      let index = pageSections.length; // Append after existing sections.

      for (const section of sections) {
        const ids = this.insertTree(section, 0, index);
        allIds.push(...ids);
        index++;
      }
      return allIds;
    },

    /**
     * Modify an existing element's settings.
     */
    modifyElement(id, newSettings) {
      const state = this.getState();
      if (!state) return false;

      const element = state.content.find(e => e.id === id);
      if (!element) return false;

      // Select the element first.
      this.select(id);

      // Merge settings (Bricks' reactive state tracks the change).
      const prepared = this._prepareSettings(newSettings);
      Object.assign(element.settings, prepared);

      // Force re-render.
      const internals = this.getInternals();
      if (internals.$_setActiveElement) {
        internals.$_setActiveElement();
      }

      return true;
    },

    /**
     * Delete an element by ID.
     */
    deleteElement(id) {
      const state = this.getState();
      const internals = this.getInternals();
      if (!state || !internals) return false;

      const element = state.content.find(e => e.id === id);
      if (!element) return false;

      // Must select it first, then pass the object (not ID).
      this.select(id);
      internals.$_deleteElement(element);
      return true;
    },

    /**
     * Delete multiple elements (e.g. replacing a section).
     */
    deleteElements(ids) {
      let deleted = 0;
      // Delete in reverse to avoid index shifting issues.
      for (const id of [...ids].reverse()) {
        if (this.deleteElement(id)) deleted++;
      }
      return deleted;
    },

    /**
     * Save the current page.
     */
    save() {
      const internals = this.getInternals();
      if (!internals) return false;
      internals.$_savePost({ force: true });
      return true;
    },

    // ---- Global Class Management ----

    /**
     * Ensure global classes from an import exist in the current state.
     * Adds any missing classes so that _cssGlobalClasses references resolve.
     *
     * @param {Object[]} classes - Array of global class objects from Bricks copy data
     */
    ensureGlobalClasses(classes) {
      const state = this.getState();
      if (!state || !classes) return;

      if (!state.globalClasses) state.globalClasses = [];

      const existingIds = new Set(state.globalClasses.map(c => c.id));

      for (const cls of classes) {
        if (!cls.id || existingIds.has(cls.id)) continue;
        // Add the class to state.
        state.globalClasses.push({
          id: cls.id,
          name: cls.name,
          settings: cls.settings && !Array.isArray(cls.settings) ? cls.settings : {},
          category: cls.category || undefined,
          locked: cls.locked || undefined,
        });
        existingIds.add(cls.id);
      }
    },

    // ---- Import Helpers ----

    /**
     * Convert Bricks flat array format to nested tree format.
     * Flat: [{ id, name, parent, children: [ids], settings }, ...]
     * Nested: { name, label, settings, children: [nested nodes] }
     *
     * @param {Object[]} flatArray - Bricks flat element array
     * @returns {Object[]} Array of root-level nested trees
     */
    flatToNested(flatArray) {
      if (!Array.isArray(flatArray) || flatArray.length === 0) return [];

      // Build lookup map.
      const byId = {};
      for (const el of flatArray) {
        byId[el.id] = el;
      }

      // Recursive builder.
      const buildNode = (el) => {
        const node = { name: el.name };
        if (el.label) node.label = el.label;
        node.settings = (el.settings && !Array.isArray(el.settings)) ? { ...el.settings } : {};
        node.children = [];

        if (el.children && Array.isArray(el.children)) {
          for (const childId of el.children) {
            const child = byId[childId];
            if (child) {
              node.children.push(buildNode(child));
            }
          }
        }

        return node;
      };

      // Find root elements (parent === 0 or parent === "0" or missing).
      const roots = flatArray.filter(el =>
        el.parent === 0 || el.parent === '0' || !el.parent
      );

      return roots.map(buildNode);
    },

    // ---- Internal Helpers ----

    _prepareSettings(settings) {
      if (!settings || Array.isArray(settings)) return {};
      const prepared = { ...settings };

      // Resolve global class names to IDs.
      if (prepared._cssGlobalClasses && Array.isArray(prepared._cssGlobalClasses)) {
        prepared._cssGlobalClasses = this.resolveClassNames(prepared._cssGlobalClasses);
      }

      return prepared;
    },

    /**
     * Get subtree of an element (for modify mode context).
     */
    getSubtree(elementId) {
      const state = this.getState();
      if (!state) return null;

      const collect = (id) => {
        const el = state.content.find(e => e.id === id);
        if (!el) return null;

        const node = {
          id: el.id,
          name: el.name,
          label: el.label || undefined,
          settings: el.settings && !Array.isArray(el.settings) ? { ...el.settings } : {},
          children: [],
        };

        if (el.children && el.children.length > 0) {
          node.children = el.children.map(childId => collect(childId)).filter(Boolean);
        }

        return node;
      };

      return collect(elementId);
    },
  };

  // Expose globally.
  window.BricksAIBridge = BricksAIBridge;
})();
