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
      // Resolve class names to IDs in settings.
      const settings = this._prepareSettings(node.settings || {});

      const element = {
        name: node.name,
        settings: settings,
      };
      if (node.label) {
        element.label = node.label;
      }

      internals.$_addNewElement({
        element: element,
        parent: parentId,
        index: index,
      });

      // Find the newly inserted element.
      const state = this.getState();
      const newEl = state.content.find(e =>
        e.name === node.name &&
        e.parent === parentId &&
        !insertedIds.includes(e.id) &&
        // Match by label if available, otherwise by position.
        (!node.label || e.label === node.label)
      );

      // Fallback: use activeId (Bricks sets it after insert).
      const newId = newEl?.id || state.activeId;
      if (newId) {
        insertedIds.push(newId);
      }

      // Recurse for children.
      if (node.children && node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
          this._insertRecursive(node.children[i], newId, i, internals, insertedIds);
        }
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
