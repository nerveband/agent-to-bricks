/**
 * Bricks AI Panel
 *
 * Floating UI panel injected into the Bricks editor.
 * Connects to the REST API for LLM generation and uses BricksAIBridge for CRUD.
 */
(function () {
  'use strict';

  // Wait for Bricks editor to be ready.
  const INIT_INTERVAL = setInterval(() => {
    if (window.BricksAIBridge && window.BricksAIBridge.isReady() && document.querySelector('.brx-body')) {
      clearInterval(INIT_INTERVAL);
      initPanel();
    }
  }, 500);

  // Timeout after 30s.
  setTimeout(() => clearInterval(INIT_INTERVAL), 30000);

  function initPanel() {
    const config = window.bricksAIConfig || {};
    let selectedProvider = config.provider || '';
    let selectedModel = config.model || '';
    const bridge = window.BricksAIBridge;
    const providers = config.providers || {};

    let state = {
      mode: 'section',         // "section" or "page"
      phase: 'idle',           // "idle", "loading", "preview", "error"
      action: 'generate',      // "generate" or "modify"
      modifyTargetId: null,    // Element ID being modified
      elements: null,          // Generated elements (nested)
      explanation: '',
      error: null,
      minimized: false,
    };

    // ---- Build DOM ----

    const panel = document.createElement('div');
    panel.id = 'bricks-ai-panel';
    panel.innerHTML = `
      <div class="bai-header">
        <span class="bai-header-title">Bricks AI</span>
        <div class="bai-header-actions">
          <button class="bai-header-btn bai-btn-settings" title="Settings">&#9881;</button>
          <button class="bai-header-btn bai-btn-minimize" title="Minimize">&#8722;</button>
        </div>
      </div>
      <div class="bai-body">
        <div class="bai-provider">
          <select class="bai-provider-select">
            ${Object.entries(providers).map(([id, p]) =>
              `<option value="${escHtml(id)}" ${id === config.provider ? 'selected' : ''}>${escHtml(p.name)}</option>`
            ).join('')}
          </select>
          <select class="bai-model-select">
            ${(config.availableModels || []).map(m =>
              `<option value="${escHtml(m)}" ${m === config.model ? 'selected' : ''}>${escHtml(m)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="bai-context">
          Context: <span class="bai-context-label">Checking...</span>
        </div>
        <div class="bai-mode">
          <button class="bai-mode-btn active" data-mode="section">Section</button>
          <button class="bai-mode-btn" data-mode="page">Full Page</button>
        </div>
        <div class="bai-prompt">
          <textarea placeholder="Describe what you want to build..." rows="4"></textarea>
        </div>
        <div class="bai-actions bai-actions-generate">
          <button class="bai-btn bai-btn-generate">Generate</button>
          <button class="bai-btn bai-btn-modify">Modify Selected</button>
        </div>
        <div class="bai-drop-zone">
          <span class="bai-drop-icon">&#8615;</span> Drop JSON here to import
        </div>
        <div class="bai-loading" style="display:none">
          <div class="bai-spinner"></div>
          <div>Generating elements...</div>
        </div>
        <div class="bai-error-details" style="display:none"></div>
        <div class="bai-preview" style="display:none">
          <div class="bai-preview-title">Preview</div>
          <div class="bai-tree"></div>
        </div>
        <div class="bai-actions bai-actions-confirm" style="display:none">
          <button class="bai-btn bai-btn-insert">Insert</button>
          <button class="bai-btn bai-btn-cancel">Cancel</button>
        </div>
        <div class="bai-status"></div>
      </div>
    `;

    document.querySelector('.brx-body').appendChild(panel);

    // ---- Cache DOM refs ----

    const $ = (sel) => panel.querySelector(sel);
    const textarea        = $('textarea');
    const contextLabel    = $('.bai-context-label');
    const loadingEl       = $('.bai-loading');
    const previewEl       = $('.bai-preview');
    const treeEl          = $('.bai-tree');
    const actionsGen      = $('.bai-actions-generate');
    const actionsConfirm  = $('.bai-actions-confirm');
    const statusEl        = $('.bai-status');
    const errorDetails    = $('.bai-error-details');
    const bodyEl          = $('.bai-body');

    // ---- Event Handlers ----

    // Mode toggle.
    panel.querySelectorAll('.bai-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.bai-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
      });
    });

    // Minimize.
    $('.bai-btn-minimize').addEventListener('click', () => {
      state.minimized = !state.minimized;
      panel.classList.toggle('bai-minimized', state.minimized);
      $('.bai-btn-minimize').innerHTML = state.minimized ? '&#43;' : '&#8722;';
    });

    // Settings link.
    $('.bai-btn-settings').addEventListener('click', () => {
      window.open('/wp-admin/options-general.php?page=bricks-ai-settings', '_blank');
    });

    // Generate.
    $('.bai-btn-generate').addEventListener('click', () => handleGenerate());

    // Modify selected.
    $('.bai-btn-modify').addEventListener('click', () => handleModify());

    // Insert.
    $('.bai-btn-insert').addEventListener('click', () => handleInsert());

    // Cancel.
    $('.bai-btn-cancel').addEventListener('click', () => resetToIdle());

    // Keyboard: Enter to submit (Shift+Enter for newline).
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (state.phase === 'idle') {
          handleGenerate();
        }
      }
    });

    // Global keyboard shortcut: Ctrl+Shift+A toggles panel.
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        panel.classList.toggle('bai-hidden');
      }
    });

    // ---- Provider & Model Selectors ----

    const providerSelect = $('.bai-provider-select');
    const modelSelect = $('.bai-model-select');

    function updateModelOptions(providerId) {
      const p = providers[providerId];
      if (!p) return;
      const models = p.models || [];
      modelSelect.innerHTML = models.map(m =>
        `<option value="${escHtml(m)}">${escHtml(m)}</option>`
      ).join('');
      if (models.length > 0) {
        selectedModel = models[0];
      }
    }

    if (providerSelect) {
      providerSelect.addEventListener('change', (e) => {
        selectedProvider = e.target.value;
        updateModelOptions(selectedProvider);
      });
    }

    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        selectedModel = e.target.value;
      });
    }

    // ---- JSON Drag & Drop Import ----

    const dropZone = $('.bai-drop-zone');

    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('bai-drop-hover');
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('bai-drop-hover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('bai-drop-hover');

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (!file.name.endsWith('.json')) {
        setStatus('Invalid file — expected .json', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);

          // Support both formats:
          // 1. Plain array: [{id, name, parent, ...}, ...]
          // 2. Bricks copy format: {content: [...], globalClasses: [...], source: "bricksCopiedElements"}
          let flatArray;
          let importGlobalClasses = null;

          if (Array.isArray(data)) {
            flatArray = data;
          } else if (data && Array.isArray(data.content)) {
            flatArray = data.content;
            if (Array.isArray(data.globalClasses)) {
              importGlobalClasses = data.globalClasses;
            }
          } else {
            setStatus('Invalid format — expected Bricks element array or copy data', 'error');
            return;
          }

          if (flatArray.length === 0) {
            setStatus('No elements found in file', 'error');
            return;
          }

          if (!flatArray[0].name) {
            setStatus('Invalid Bricks export — elements missing "name" field', 'error');
            return;
          }

          // Register any missing global classes from the import.
          if (importGlobalClasses) {
            bridge.ensureGlobalClasses(importGlobalClasses);
          }

          // Convert flat to nested.
          const nested = bridge.flatToNested(flatArray);
          if (!nested.length) {
            setStatus('No root elements found in file', 'error');
            return;
          }

          // Insert each root tree.
          let insertedCount = 0;
          for (const tree of nested) {
            const ids = bridge.insertTree(tree, 0, undefined);
            insertedCount += ids.length;
          }

          setStatus(`Imported ${insertedCount} elements from ${file.name} (Ctrl+Z to undo)`, 'success');
        } catch (err) {
          setStatus('Failed to parse JSON: ' + err.message, 'error');
        }
      };

      reader.onerror = () => {
        setStatus('Failed to read file', 'error');
      };

      reader.readAsText(file);
    });

    // Also prevent default on the panel itself so the browser doesn't open the file.
    panel.addEventListener('dragover', (e) => e.preventDefault());
    panel.addEventListener('drop', (e) => e.preventDefault());

    // ---- Dragging ----

    let dragOffset = { x: 0, y: 0 };
    const header = $('.bai-header');

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.bai-header-btn')) return;
      dragOffset.x = e.clientX - panel.offsetLeft;
      dragOffset.y = e.clientY - panel.offsetTop;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
    });

    function onDrag(e) {
      panel.style.left = (e.clientX - dragOffset.x) + 'px';
      panel.style.top = (e.clientY - dragOffset.y) + 'px';
      panel.style.right = 'auto';
    }

    function onDragEnd() {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
      // Save position.
      localStorage.setItem('bricksAIPanelPos', JSON.stringify({
        left: panel.style.left,
        top: panel.style.top,
      }));
    }

    // Restore position.
    const savedPos = localStorage.getItem('bricksAIPanelPos');
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        panel.style.left = pos.left;
        panel.style.top = pos.top;
        panel.style.right = 'auto';
      } catch (e) { /* ignore */ }
    }

    // ---- Context Updater ----

    setInterval(() => {
      const sel = bridge.getSelection();
      if (sel && sel.activeElement) {
        const label = sel.activeElement.label || sel.activeElement.name;
        contextLabel.textContent = `"${label}" selected`;
        contextLabel.className = 'bai-context-label';
      } else {
        contextLabel.textContent = 'No selection (root level)';
        contextLabel.className = 'bai-context-label';
      }
    }, 1000);

    // ---- API Calls ----

    async function handleGenerate() {
      const prompt = textarea.value.trim();
      if (!prompt) return;

      setPhase('loading');

      try {
        const context = bridge.getPageContext();
        const response = await apiCall('generate', {
          prompt,
          postId: getPostId(),
          mode: state.mode,
          context,
          provider: selectedProvider,
          model: selectedModel,
        });

        if (response.success) {
          state.elements = response.elements;
          state.explanation = response.explanation || '';
          setPhase('preview');
          renderPreviewTree(response.elements);
          setStatus(`Generated ${countElements(response.elements)} elements via ${response.provider}`, 'success');
        } else {
          setPhase('error');
          showError(response.error, response.details);
        }
      } catch (err) {
        setPhase('error');
        showError(err.message);
      }
    }

    async function handleModify() {
      const prompt = textarea.value.trim();
      if (!prompt) return;

      const sel = bridge.getSelection();
      if (!sel || !sel.activeId) {
        setStatus('Select an element first.', 'error');
        return;
      }

      state.action = 'modify';
      state.modifyTargetId = sel.activeId;
      setPhase('loading');

      try {
        const subtree = bridge.getSubtree(sel.activeId);
        const context = bridge.getPageContext();
        const response = await apiCall('modify', {
          prompt,
          postId: getPostId(),
          currentElement: subtree,
          context,
          provider: selectedProvider,
          model: selectedModel,
        });

        if (response.success) {
          state.elements = response.elements;
          state.explanation = response.explanation || '';
          setPhase('preview');
          renderPreviewTree(response.elements);
          setStatus(`Modified — preview ready (${response.provider})`, 'success');
        } else {
          setPhase('error');
          showError(response.error, response.details);
        }
      } catch (err) {
        setPhase('error');
        showError(err.message);
      }
    }

    function handleInsert() {
      if (!state.elements || state.elements.length === 0) return;

      let insertedCount = 0;

      if (state.action === 'modify' && state.modifyTargetId) {
        // Modify mode: find the target element's parent and position,
        // delete the old element, then insert the replacement.
        const bricksState = bridge.getState();
        const oldEl = bricksState.content.find(e => e.id === state.modifyTargetId);
        const parentId = oldEl ? oldEl.parent : 0;

        // Find index of old element within parent's children.
        let index = 0;
        if (oldEl) {
          const parentEl = bricksState.content.find(e => e.id === parentId);
          if (parentEl && parentEl.children) {
            index = parentEl.children.indexOf(state.modifyTargetId);
            if (index < 0) index = 0;
          }
        }

        // Delete old element first.
        bridge.deleteElement(state.modifyTargetId);

        // Insert replacement at the same position.
        for (const element of state.elements) {
          const ids = bridge.insertTree(element, parentId, index);
          insertedCount += ids.length;
        }

        setStatus(`Replaced element with ${insertedCount} elements (Ctrl+Z to undo)`, 'success');
      } else if (state.mode === 'page') {
        const ids = bridge.insertFullPage(state.elements);
        insertedCount = ids.length;
        setStatus(`Inserted ${insertedCount} elements (Ctrl+Z to undo)`, 'success');
      } else {
        // Section mode — insert at root level.
        for (const element of state.elements) {
          const ids = bridge.insertTree(element, 0, undefined);
          insertedCount += ids.length;
        }
        setStatus(`Inserted ${insertedCount} elements (Ctrl+Z to undo)`, 'success');
      }

      resetToIdle();
    }

    // ---- UI State Management ----

    function setPhase(phase) {
      state.phase = phase;
      loadingEl.style.display = phase === 'loading' ? '' : 'none';
      previewEl.style.display = phase === 'preview' ? '' : 'none';
      actionsGen.style.display = (phase === 'idle' || phase === 'error') ? '' : 'none';
      actionsConfirm.style.display = phase === 'preview' ? '' : 'none';
      errorDetails.style.display = phase === 'error' ? '' : 'none';

      // Disable textarea during loading.
      textarea.disabled = phase === 'loading';
    }

    function resetToIdle() {
      state.elements = null;
      state.explanation = '';
      state.error = null;
      state.action = 'generate';
      state.modifyTargetId = null;
      setPhase('idle');
      treeEl.innerHTML = '';
      errorDetails.style.display = 'none';
      errorDetails.textContent = '';
    }

    function setStatus(message, type) {
      statusEl.textContent = message;
      statusEl.className = 'bai-status' + (type ? ' bai-status-' + type : '');
    }

    function showError(message, details) {
      setStatus(message, 'error');
      if (details && details.length) {
        errorDetails.style.display = '';
        errorDetails.textContent = details.join('\n');
      }
    }

    // ---- Preview Tree Renderer ----

    function renderPreviewTree(elements) {
      treeEl.innerHTML = '';
      for (const el of elements) {
        treeEl.appendChild(renderNode(el, 0));
      }
    }

    function renderNode(node, depth) {
      const div = document.createElement('div');
      div.className = depth === 0 ? 'bai-tree-leaf' : 'bai-tree-leaf';

      let html = `<span class="bai-tree-type">${escHtml(node.name)}</span>`;
      if (node.label) {
        html += `<span class="bai-tree-label">"${escHtml(node.label)}"</span>`;
      } else if (node.settings?.text) {
        const text = node.settings.text.length > 30
          ? node.settings.text.substring(0, 30) + '...'
          : node.settings.text;
        html += `<span class="bai-tree-label">"${escHtml(text)}"</span>`;
      }
      div.innerHTML = html;

      if (node.children && node.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'bai-tree-node';
        for (const child of node.children) {
          childContainer.appendChild(renderNode(child, depth + 1));
        }
        div.appendChild(childContainer);
      }

      return div;
    }

    // ---- Helpers ----

    function countElements(elements) {
      let count = 0;
      function walk(nodes) {
        for (const n of nodes) {
          count++;
          if (n.children) walk(n.children);
        }
      }
      walk(elements);
      return count;
    }

    function getPostId() {
      // Try bricksData first, then URL param.
      if (window.bricksData?.postId) return parseInt(window.bricksData.postId, 10);
      const params = new URLSearchParams(window.location.search);
      return parseInt(params.get('post') || '0', 10);
    }

    async function apiCall(endpoint, data) {
      const response = await fetch(config.restUrl + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': config.nonce,
        },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (!response.ok && !json.success) {
        throw new Error(json.error || json.message || `HTTP ${response.status}`);
      }

      return json;
    }

    function escHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  }
})();
