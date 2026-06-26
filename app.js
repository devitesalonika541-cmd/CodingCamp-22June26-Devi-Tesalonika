/**
 * Expense & Budget Visualizer
 * Standalone single-page app — HTML + CSS + Vanilla JS
 * All logic is wrapped in an IIFE to avoid polluting the global namespace.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants & Type Definitions (JSDoc)
  // ---------------------------------------------------------------------------

  /** Default built-in categories — mutable; extras are stored in localStorage */
  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
  const CATEGORIES_KEY = 'ebv_categories';

  /**
   * Returns the current live category list (built-ins + user-added).
   * @returns {string[]}
   */
  function getCategories() {
    try {
      const raw = localStorage.getItem(CATEGORIES_KEY);
      if (!raw) return [...DEFAULT_CATEGORIES];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_CATEGORIES];
      return parsed.filter(c => typeof c === 'string' && c.trim().length > 0);
    } catch {
      return [...DEFAULT_CATEGORIES];
    }
  }

  /**
   * Persists the category list.
   * @param {string[]} cats
   */
  function saveCategories(cats) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
  }

  // Live reference used throughout the module — refreshed on mutation.
  let CATEGORIES = getCategories();

  /**
   * @typedef {Object} Transaction
   * @property {string}   id       - UUID v4 unique per transaction
   * @property {string}   name     - Item name, 1–100 chars (non-whitespace-only)
   * @property {number}   amount   - Expense amount, float, 0.01–999999999.99
   * @property {string}   category - One of: 'Food' | 'Transport' | 'Fun'
   * @property {string}   date     - ISO 8601 timestamp
   */

  /**
   * @typedef {Object} ValidationResult
   * @property {boolean}                                    valid
   * @property {{ field: string, message: string }[]}      errors
   */

  /**
   * @typedef {Object} CategoryData
   * @property {string} category
   * @property {number} total      - Total amount for the category (2 decimals)
   * @property {number} percentage - Percentage of grand total (1 decimal)
   */

  // ---------------------------------------------------------------------------
  // Helper: isValidTransaction
  // ---------------------------------------------------------------------------

  /**
   * Validates that an object has all required Transaction fields with the
   * correct types and value constraints.
   *
   * Required fields:
   *  - id       : string (non-empty)
   *  - name     : string (non-empty)
   *  - amount   : number (finite, > 0)
   *  - category : one of CATEGORIES
   *  - date     : string (non-empty)
   *
   * @param {unknown} obj
   * @returns {boolean}
   */
  function isValidTransaction(obj) {
    if (obj === null || typeof obj !== 'object') return false;

    const { id, name, amount, category, date } = /** @type {any} */ (obj);

    if (typeof id !== 'string' || id.trim() === '') return false;
    if (typeof name !== 'string' || name.trim() === '') return false;
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) return false;
    if (!getCategories().includes(category)) return false;
    if (typeof date !== 'string' || date.trim() === '') return false;

    return true;
  }

  // ---------------------------------------------------------------------------
  // StorageManager
  // ---------------------------------------------------------------------------

  /**
   * Handles all interactions with browser localStorage.
   *
   * Storage key: 'ebv_transactions'
   * Format: JSON array of Transaction objects
   *
   * Requirements covered: 5.1, 5.2, 5.4, 5.5, 5.6, 2.7
   */
  const StorageManager = {
    STORAGE_KEY: 'ebv_transactions',

    /**
     * Reads and parses transactions from localStorage.
     *
     * - Returns [] if the key is missing, empty, or data is corrupt/invalid.
     * - Filters each entry through isValidTransaction() so partially-corrupt
     *   arrays degrade gracefully rather than crashing.
     * - Never throws; all errors are caught and result in an empty array.
     *
     * Requirement 5.5, 2.7
     *
     * @returns {Transaction[]}
     */
    load() {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter(isValidTransaction);
      } catch (_err) {
        // Data is corrupt (e.g. malformed JSON) — start with a clean slate.
        return [];
      }
    },

    /**
     * Serializes and persists the transaction array to localStorage.
     *
     * - Throws a DOMException (name: 'QuotaExceededError') if localStorage is
     *   full, so callers can handle it and roll back their state.
     *
     * Requirement 5.1, 5.4, 5.6
     *
     * @param {Transaction[]} transactions
     * @throws {DOMException} When localStorage quota is exceeded.
     */
    save(transactions) {
      // Let QuotaExceededError propagate so the caller can react (Req 5.6).
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(transactions));
    },

    /**
     * Removes a transaction by ID from the provided array and persists the
     * result via save().
     *
     * - The filtered array is what gets written; the caller should use the
     *   returned array to update AppState.
     * - Propagates any storage errors (e.g. QuotaExceededError) to the caller.
     *
     * Requirement 5.2
     *
     * @param {string}        id           - ID of the transaction to remove.
     * @param {Transaction[]} transactions - Current transaction array.
     * @returns {Transaction[]} The filtered array (without the removed item).
     * @throws {DOMException} When localStorage quota is exceeded.
     */
    remove(id, transactions) {
      const updated = transactions.filter((tx) => tx.id !== id);
      this.save(updated);
      return updated;
    },
  };

  // ---------------------------------------------------------------------------
  // Validator
  // Requirements: 1.3, 1.4
  // ---------------------------------------------------------------------------

  /**
   * Validates transaction input fields before saving.
   */
  const Validator = {
    /**
     * Validate name, amount, and category for a new transaction.
     *
     * Rules:
     *  - name     : required, non-whitespace-only, max 100 characters
     *  - amount   : required, positive number, range 0.01–999,999,999.99,
     *               max 2 decimal places
     *  - category : required, must be one of CATEGORIES
     *
     * @param {string} name
     * @param {*}      amount    — raw value (string or number) from the form
     * @param {string} category
     * @returns {ValidationResult}
     */
    validateTransaction(name, amount, category) {
      /** @type {{ field: string, message: string }[]} */
      const errors = [];

      // ── name ──────────────────────────────────────────────────────────────
      if (name === null || name === undefined || String(name).trim() === '') {
        errors.push({ field: 'name', message: 'Nama item wajib diisi.' });
      } else if (String(name).length > 100) {
        errors.push({
          field: 'name',
          message: 'Nama item tidak boleh melebihi 100 karakter.',
        });
      }

      // ── amount ────────────────────────────────────────────────────────────
      const rawAmount = (amount === null || amount === undefined) ? '' : String(amount).trim();
      if (rawAmount === '') {
        errors.push({ field: 'amount', message: 'Jumlah wajib diisi.' });
      } else {
        const amountNum = Number(rawAmount);
        if (isNaN(amountNum)) {
          errors.push({ field: 'amount', message: 'Jumlah harus berupa angka.' });
        } else if (amountNum <= 0) {
          errors.push({ field: 'amount', message: 'Jumlah harus berupa angka positif.' });
        } else if (amountNum < 0.01 || amountNum > 999999999.99) {
          errors.push({
            field: 'amount',
            message: 'Jumlah harus berada dalam rentang 0.01 hingga 999,999,999.99.',
          });
        } else {
          // Max 2 decimal places — check raw string so 1.000 is caught correctly
          const decimalMatch = rawAmount.match(/\.(\d+)$/);
          if (decimalMatch && decimalMatch[1].length > 2) {
            errors.push({
              field: 'amount',
              message: 'Jumlah maksimal memiliki 2 angka desimal.',
            });
          }
        }
      }

      // ── category ──────────────────────────────────────────────────────────
      if (category === null || category === undefined || String(category).trim() === '') {
        errors.push({ field: 'category', message: 'Kategori wajib dipilih.' });
      } else if (!CATEGORIES.includes(category)) {
        errors.push({
          field: 'category',
          message: `Kategori harus salah satu dari: ${CATEGORIES.join(', ')}.`,
        });
      }

      return { valid: errors.length === 0, errors };
    },
  };

  // ---------------------------------------------------------------------------
  // BalanceRenderer
  // Requirements: 3.1, 3.2, 3.3, 3.4
  // ---------------------------------------------------------------------------

  /**
   * Computes and renders the cumulative total of all transaction amounts.
   */
  const BalanceRenderer = {
    /**
     * Sums all transaction amounts and rounds to 2 decimal places.
     * Returns 0.00 for an empty array.
     *
     * Requirement 3.1, 3.4
     *
     * @param {Transaction[]} transactions
     * @returns {number} Total rounded to 2 decimal places.
     */
    computeTotal(transactions) {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return 0.00;
      }
      const sum = transactions.reduce((acc, tx) => acc + tx.amount, 0);
      return parseFloat(sum.toFixed(2));
    },

    /**
     * Computes the total and updates the #balance-display DOM element.
     * Updates the `.balance-amount` span with the formatted "Rp X.XX" string.
     *
     * Requirement 3.1, 3.2, 3.3, 3.4
     *
     * @param {Transaction[]} transactions
     */
    render(transactions) {
      const total = this.computeTotal(transactions);

      // Format as Indonesian Rupiah with 2 decimal places, e.g. "Rp 25,000.00"
      const formatted = 'Rp ' + total.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const balanceDisplay = document.getElementById('balance-display');
      if (balanceDisplay) {
        const amountSpan = balanceDisplay.querySelector('.balance-amount');
        if (amountSpan) {
          amountSpan.textContent = formatted;
        }
      }
    },
  };

  // ---------------------------------------------------------------------------
  // ChartManager
  // Requirements: 4.1, 4.6
  // ---------------------------------------------------------------------------

  /**
   * Manages pie chart data computation and rendering via Chart.js.
   * Requirements: 4.2, 4.3, 4.4, 4.5, 4.7
   */
  const ChartManager = {
    /** @type {boolean} — true only when Chart.js is available and chart was initialised */
    _available: false,

    /** @type {import('chart.js').Chart|null} */
    _instance: null,

    /**
     * Initialises a Chart.js pie chart on the given canvas element.
     *
     * If Chart.js is not loaded (e.g. CDN failure) the method sets
     * `_available = false` and returns early so the rest of the app
     * continues to work normally.
     *
     * Requirement 4.7
     *
     * @param {string} canvasId — ID of the <canvas> element to render into
     */
    init(canvasId) {
      // Chart.js may not be available (CDN failure) — Req 4.7
      if (typeof Chart === 'undefined') {
        this._available = false;
        return;
      }
      this._available = true;
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      this._instance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: ['#e74c3c', '#2980b9', '#27ae60'],
            borderWidth: 2,
            borderColor: '#ffffff',
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label(ctx) {
                  return `${ctx.label}: ${ctx.parsed.toFixed(1)}%`;
                },
              },
            },
          },
        },
      });
    },

    /**
     * Updates the pie chart (or placeholder) based on the current transactions.
     *
     * - If Chart.js is unavailable or the instance was never created, shows the
     *   placeholder text and hides the canvas.
     * - If there are no transactions, shows the placeholder and hides the canvas.
     * - Otherwise updates the chart data and re-renders.
     *
     * Requirements: 4.2, 4.3, 4.4, 4.5
     *
     * @param {Transaction[]} transactions
     */
    update(transactions) {
      const placeholder = document.getElementById('chart-placeholder');
      const canvas = document.getElementById('expense-chart');

      if (!this._available || !this._instance) {
        // Chart.js not available — show placeholder, hide canvas
        if (placeholder) placeholder.textContent = 'Belum ada data pengeluaran';
        if (canvas) canvas.style.display = 'none';
        return;
      }

      const data = this.computeCategoryData(transactions);

      if (data.length === 0) {
        // No transactions — show placeholder, hide canvas (Req 4.4)
        if (placeholder) placeholder.textContent = 'Belum ada data pengeluaran';
        if (canvas) canvas.style.display = 'none';
      } else {
        // Data available — show chart, hide placeholder (Req 4.2, 4.3, 4.5)
        if (placeholder) placeholder.textContent = '';
        if (canvas) canvas.style.display = '';

        /** Perceptually distinct colours per category (Req 4.5) */
        const COLOR_MAP = getCategoryColorMap();
        this._instance.data.labels = data.map(d => `${d.category} (${d.percentage}%)`);
        this._instance.data.datasets[0].data = data.map(d => d.percentage);
        this._instance.data.datasets[0].backgroundColor = data.map(d => COLOR_MAP[d.category] || generateCategoryColor(d.category));
        this._instance.update();
      }
    },

    /**
     * Destroys the Chart.js instance and resets internal state.
     * Safe to call even if no chart was initialised.
     *
     * @returns {void}
     */
    destroy() {
      if (this._instance) {
        this._instance.destroy();
        this._instance = null;
      }
      this._available = false;
    },

    /**
     * Computes per-category totals and percentages from a transaction array.
     *
     * - Groups transactions by category ('Food', 'Transport', 'Fun').
     * - Rounds each category total to 2 decimal places.
     * - Rounds the percentage of the grand total to 1 decimal place.
     * - Excludes categories whose total is 0 (Requirement 4.6).
     *
     * Requirements: 4.1, 4.6
     *
     * @param {Transaction[]} transactions
     * @returns {CategoryData[]}
     */
    computeCategoryData(transactions) {
      const cats = CATEGORIES; // uses live mutable array
      // Accumulate raw totals per category
      /** @type {Record<string, number>} */
      const totals = {};
      for (const cat of cats) {
        totals[cat] = 0;
      }

      for (const tx of transactions) {
        if (totals[tx.category] !== undefined) {
          totals[tx.category] += tx.amount;
        } else {
          // transaction from a category not in current list — still count it
          totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
        }
      }

      // Round each total to 2 decimal places
      for (const cat of Object.keys(totals)) {
        totals[cat] = Math.round(totals[cat] * 100) / 100;
      }

      // Grand total
      const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

      // Build result — skip categories with total = 0
      /** @type {CategoryData[]} */
      const result = [];
      for (const cat of Object.keys(totals)) {
        const total = totals[cat];
        if (total <= 0) continue;

        const percentage =
          grandTotal > 0
            ? Math.round((total / grandTotal) * 1000) / 10
            : 0;

        result.push({ category: cat, total, percentage });
      }

      return result;
    },
  };

  // ---------------------------------------------------------------------------
  // TransactionListRenderer
  // Requirements: 2.1
  // ---------------------------------------------------------------------------

  /**
   * Renders and manages the transaction list in the DOM.
   */
  const TransactionListRenderer = {
    /**
     * Creates a single <li> element for a given transaction.
     *
     * The element includes:
     *  - Item name
     *  - Formatted amount (Rp format, 2 decimal places)
     *  - Category badge
     *  - Delete button with data-id attribute
     *
     * @param {Transaction} tx
     * @returns {HTMLLIElement}
     */
    createItem(tx) {
      const li = document.createElement('li');
      li.className = 'transaction-item';
      li.dataset.id = tx.id;

      // Format amount as Rupiah with Indonesian locale, e.g. "Rp 15.000,00"
      const formattedAmount = 'Rp ' + tx.amount.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      li.innerHTML = `
        <div class="transaction-info">
          <span class="transaction-name">${tx.name}</span>
          <span class="transaction-amount">${formattedAmount}</span>
          <span class="transaction-category category-badge">${tx.category}</span>
        </div>
        <button class="btn-delete" data-id="${tx.id}" aria-label="Hapus transaksi ${tx.name}">Hapus</button>
      `;

      return li;
    },

    /**
     * Renders the full transaction list to the #transaction-list DOM element.
     *
     * - Clears the existing list contents.
     * - Shows a placeholder <li> if the array is empty or null/undefined.
     * - Otherwise sorts a copy of the array descending by date (newest first)
     *   and appends one <li> per transaction via createItem().
     *
     * Requirements: 2.1, 2.5
     *
     * @param {Transaction[]|null|undefined} transactions
     */
    render(transactions) {
      const list = document.getElementById('transaction-list');
      if (!list) return;

      // Clear current contents
      list.innerHTML = '';

      // Show placeholder when there are no transactions
      if (!transactions || transactions.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'transaction-empty';
        empty.textContent = 'Belum ada transaksi.';
        list.appendChild(empty);
        return;
      }

      // Sort according to AppState.sortBy
      const sortBy = AppState.sortBy || 'date-desc';
      const sorted = [...transactions].sort((a, b) => {
        switch (sortBy) {
          case 'date-asc':    return new Date(a.date) - new Date(b.date);
          case 'amount-desc': return b.amount - a.amount;
          case 'amount-asc':  return a.amount - b.amount;
          case 'category-asc':return a.category.localeCompare(b.category);
          case 'date-desc':
          default:            return new Date(b.date) - new Date(a.date);
        }
      });

      for (const tx of sorted) {
        list.appendChild(this.createItem(tx));
      }
    },
  };

  // ---------------------------------------------------------------------------
  // NotificationManager
  // Requirements: 1.3, 2.6, 5.5, 5.6
  // ---------------------------------------------------------------------------

  /**
   * Displays toast notifications in the top-right corner with auto-dismiss.
   */
  const NotificationManager = {
    _show(message, type) {
      const container = document.getElementById('notification-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.setAttribute('role', 'alert');
      toast.textContent = message;

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close';
      closeBtn.setAttribute('aria-label', 'Tutup');
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => this._dismiss(toast));
      toast.appendChild(closeBtn);

      container.appendChild(toast);

      // Trigger fade-in on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
      });

      // Auto-dismiss after 4 seconds
      setTimeout(() => this._dismiss(toast), 4000);
    },

    _dismiss(toast) {
      toast.classList.remove('show');
      toast.classList.add('hide');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      // Fallback removal in case transition doesn't fire
      setTimeout(() => toast.remove(), 500);
    },

    showError(message) { this._show(message, 'error'); },
    showSuccess(message) { this._show(message, 'success'); },
  };

  // ---------------------------------------------------------------------------
  // AppState — singleton holding runtime application state
  // ---------------------------------------------------------------------------

  const AppState = {
    /** @type {Transaction[]} */
    transactions: [],
    /** @type {any} */
    chartInstance: null,
    /** @type {'date-desc'|'date-asc'|'amount-desc'|'amount-asc'|'category-asc'} */
    sortBy: 'date-desc',
  };

  // ---------------------------------------------------------------------------
  // Controller helpers — field error display
  // ---------------------------------------------------------------------------

  /**
   * Writes validation error messages next to the relevant form fields.
   * @param {{ field: string, message: string }[]} errors
   */
  function showFieldErrors(errors) {
    errors.forEach(({ field, message }) => {
      const el = document.getElementById(`error-${field}`);
      if (el) el.textContent = message;
    });
  }

  /**
   * Clears all inline field-error messages.
   */
  function clearFieldErrors() {
    ['name', 'amount', 'category'].forEach(field => {
      const el = document.getElementById(`error-${field}`);
      if (el) el.textContent = '';
    });
  }

  // ---------------------------------------------------------------------------
  // renderAll — re-renders every view component from AppState
  // ---------------------------------------------------------------------------

  /**
   * Synchronises all view components with the current AppState.
   * Called after any mutation (add / delete transaction).
   */
  function renderAll() {
    TransactionListRenderer.render(AppState.transactions);
    BalanceRenderer.render(AppState.transactions);
    ChartManager.update(AppState.transactions);
  }

  // ---------------------------------------------------------------------------
  // handleFormSubmit — controller for the expense form
  // Requirements: 1.2, 1.3, 1.4, 1.5, 5.1, 5.6
  // ---------------------------------------------------------------------------

  /**
   * Handles the expense-form submit event.
   *
   * Flow:
   *  1. Prevent default browser submission.
   *  2. Read field values from the DOM.
   *  3. Clear any previous inline errors.
   *  4. Validate via Validator.validateTransaction(); show errors and abort if invalid.
   *  5. Build a new Transaction object (UUID v4, ISO 8601 date).
   *  6. Push to AppState and persist via StorageManager.save().
   *     On QuotaExceededError: roll back and notify the user (Req 5.6).
   *  7. Clear form fields.
   *  8. Re-render all views.
   *
   * @param {Event} event
   */
  function handleFormSubmit(event) {
    event.preventDefault();

    const nameInput     = document.getElementById('input-name');
    const amountInput   = document.getElementById('input-amount');
    const categoryInput = document.getElementById('input-category');

    const name     = nameInput     ? /** @type {HTMLInputElement}  */ (nameInput).value     : '';
    const amount   = amountInput   ? /** @type {HTMLInputElement}  */ (amountInput).value   : '';
    const category = categoryInput ? /** @type {HTMLSelectElement} */ (categoryInput).value : '';

    clearFieldErrors();

    const result = Validator.validateTransaction(name, amount, category);
    if (!result.valid) {
      showFieldErrors(result.errors);
      return;
    }

    /** @type {Transaction} */
    const tx = {
      id:       crypto.randomUUID(),
      name:     name.trim(),
      amount:   parseFloat(parseFloat(amount).toFixed(2)),
      category,
      date:     new Date().toISOString(),
    };

    try {
      AppState.transactions.push(tx);
      StorageManager.save(AppState.transactions);
    } catch (err) {
      // Roll back on QuotaExceededError (Req 5.6)
      AppState.transactions.pop();
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.showError('Penyimpanan penuh. Transaksi tidak dapat disimpan.');
      }
      return;
    }

    // Clear form fields (Req 1.5)
    if (nameInput)     /** @type {HTMLInputElement}  */ (nameInput).value     = '';
    if (amountInput)   /** @type {HTMLInputElement}  */ (amountInput).value   = '';
    if (categoryInput) /** @type {HTMLSelectElement} */ (categoryInput).value = '';

    renderAll();
  }

  // ---------------------------------------------------------------------------
  // Color helpers for dynamic categories
  // ---------------------------------------------------------------------------

  /** Fixed palette for the default 3 categories */
  const CATEGORY_COLORS = {
    Food:      '#e74c3c',
    Transport: '#2980b9',
    Fun:       '#27ae60',
  };

  /**
   * Deterministically generates a hsl color for an arbitrary category name.
   * @param {string} name
   * @returns {string}
   */
  function generateCategoryColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 45%)`;
  }

  /**
   * Returns a color map for all current categories.
   * @returns {Record<string, string>}
   */
  function getCategoryColorMap() {
    const map = { ...CATEGORY_COLORS };
    for (const cat of CATEGORIES) {
      if (!map[cat]) map[cat] = generateCategoryColor(cat);
    }
    return map;
  }

  // ---------------------------------------------------------------------------
  // CategoryManager — add / delete / render custom categories
  // ---------------------------------------------------------------------------

  const CategoryManager = {
    /**
     * Rebuilds the category <select> in the expense form.
     */
    populateSelect() {
      const sel = document.getElementById('input-category');
      if (!sel) return;
      const current = /** @type {HTMLSelectElement} */ (sel).value;
      sel.innerHTML = '<option value="" disabled>-- Pilih Kategori --</option>';
      for (const cat of CATEGORIES) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        sel.appendChild(opt);
      }
      // Restore selection if still valid
      if (CATEGORIES.includes(current)) {
        /** @type {HTMLSelectElement} */ (sel).value = current;
      }
    },

    /**
     * Renders the category management list inside #category-list.
     */
    renderList() {
      const ul = document.getElementById('category-list');
      if (!ul) return;
      ul.innerHTML = '';
      for (const cat of CATEGORIES) {
        const li = document.createElement('li');
        li.className = 'category-item';

        const colorDot = document.createElement('span');
        colorDot.className = 'category-color-dot';
        colorDot.style.background = getCategoryColorMap()[cat] || generateCategoryColor(cat);

        const label = document.createElement('span');
        label.className = 'category-item-name';
        label.textContent = cat;

        li.appendChild(colorDot);
        li.appendChild(label);

        // Default categories can't be deleted
        if (!DEFAULT_CATEGORIES.includes(cat)) {
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn-delete-category';
          delBtn.setAttribute('aria-label', `Hapus kategori ${cat}`);
          delBtn.textContent = '✕';
          delBtn.addEventListener('click', () => this.deleteCategory(cat));
          li.appendChild(delBtn);
        }

        ul.appendChild(li);
      }
    },

    /**
     * Adds a new custom category.
     */
    addCategory() {
      const input = /** @type {HTMLInputElement} */ (document.getElementById('input-new-category'));
      const errEl = document.getElementById('error-new-category');
      if (!input) return;

      const name = input.value.trim();
      if (!name) {
        if (errEl) errEl.textContent = 'Nama kategori tidak boleh kosong.';
        return;
      }
      if (name.length > 30) {
        if (errEl) errEl.textContent = 'Nama kategori maksimal 30 karakter.';
        return;
      }
      if (CATEGORIES.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
        if (errEl) errEl.textContent = 'Kategori sudah ada.';
        return;
      }

      if (errEl) errEl.textContent = '';
      CATEGORIES.push(name);
      saveCategories(CATEGORIES);
      input.value = '';
      this.populateSelect();
      this.renderList();
      NotificationManager.showSuccess(`Kategori "${name}" ditambahkan.`);
    },

    /**
     * Removes a custom category.
     * @param {string} name
     */
    deleteCategory(name) {
      if (DEFAULT_CATEGORIES.includes(name)) return; // guard
      const idx = CATEGORIES.indexOf(name);
      if (idx === -1) return;
      CATEGORIES.splice(idx, 1);
      saveCategories(CATEGORIES);
      this.populateSelect();
      this.renderList();
      NotificationManager.showSuccess(`Kategori "${name}" dihapus.`);
    },
  };

  // ---------------------------------------------------------------------------
  // ThemeManager — dark / light mode
  // ---------------------------------------------------------------------------

  const ThemeManager = {
    STORAGE_KEY: 'ebv_theme',

    /** @returns {'dark'|'light'} */
    getPreference() {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
      // Respect OS preference by default
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },

    apply(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(this.STORAGE_KEY, theme);
      // Update toggle button aria-label
      const btn = document.getElementById('btn-theme-toggle');
      if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    },

    toggle() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      this.apply(current === 'dark' ? 'light' : 'dark');
    },

    init() {
      this.apply(this.getPreference());
      const btn = document.getElementById('btn-theme-toggle');
      if (btn) btn.addEventListener('click', () => this.toggle());
    },
  };

  // ---------------------------------------------------------------------------
  // handleDeleteClick — event delegation on #transaction-list
  // Requirements: 2.3, 2.4, 5.2
  // ---------------------------------------------------------------------------

  /**
   * Handles click events on the transaction list via event delegation.
   * Identifies delete button clicks by checking for .btn-delete with data-id.
   *
   * @param {MouseEvent} event
   */
  function handleDeleteClick(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    // Walk up the DOM to find a .btn-delete with data-id
    const btn = target.closest('.btn-delete');
    if (!btn) return;

    const id = /** @type {HTMLElement} */ (btn).dataset.id;
    if (!id) return;

    try {
      AppState.transactions = StorageManager.remove(id, AppState.transactions);
    } catch (err) {
      // Storage failure — preserve existing state, show error (Req 2.6, 5.2)
      NotificationManager.showError('Gagal menghapus transaksi. Coba lagi.');
      return;
    }

    renderAll();
  }

  // ---------------------------------------------------------------------------
  // init — bootstrap called on DOMContentLoaded
  // Requirements: 2.5, 5.3
  // ---------------------------------------------------------------------------

  /**
   * Initialises the application:
   *  1. Loads transactions from localStorage into AppState.
   *  2. Initialises ChartManager.
   *  3. Renders all views.
   *  4. Attaches event listeners for form submit, delete (event delegation),
   *     and auto-clear of inline errors on input.
   *
   * Requirements: 2.5, 5.3
   */
  function init() {
    // Load persisted transactions (Req 5.3)
    try {
      AppState.transactions = StorageManager.load();
    } catch (err) {
      AppState.transactions = [];
      NotificationManager.showError('Gagal memuat data. Mulai dengan daftar kosong.');
    }

    // Theme
    ThemeManager.init();

    // Populate category dropdown from persisted categories
    CategoryManager.populateSelect();

    // Initialise chart (Chart.js may not be available — Req 4.7)
    ChartManager.init('expense-chart');

    // Initial render
    renderAll();

    // Form submit
    const form = document.getElementById('expense-form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }

    // Delete — event delegation on the list container (Req 2.3, 2.4)
    const list = document.getElementById('transaction-list');
    if (list) {
      list.addEventListener('click', handleDeleteClick);
    }

    // Sort control
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        AppState.sortBy = /** @type {any} */ (sortSelect).value;
        TransactionListRenderer.render(AppState.transactions);
      });
    }

    // Category manager toggle
    const btnToggle = document.getElementById('btn-toggle-categories');
    const panel = document.getElementById('category-panel');
    if (btnToggle && panel) {
      btnToggle.addEventListener('click', () => {
        const isOpen = !panel.hidden;
        panel.hidden = isOpen;
        btnToggle.setAttribute('aria-expanded', String(!isOpen));
        if (!isOpen) {
          // Opening — render current list
          CategoryManager.renderList();
        }
      });
    }

    // Add category button
    const btnAdd = document.getElementById('btn-add-category');
    if (btnAdd) btnAdd.addEventListener('click', () => CategoryManager.addCategory());
    // Allow Enter key in the new-category input
    const inputNewCat = document.getElementById('input-new-category');
    if (inputNewCat) {
      inputNewCat.addEventListener('keydown', (e) => {
        if (/** @type {KeyboardEvent} */ (e).key === 'Enter') {
          e.preventDefault();
          CategoryManager.addCategory();
        }
      });
      inputNewCat.addEventListener('input', () => {
        const errEl = document.getElementById('error-new-category');
        if (errEl) errEl.textContent = '';
      });
    }

    // Auto-clear inline errors when the user starts typing / changing fields
    ['input-name', 'input-amount', 'input-category'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const event = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(event, () => {
        const field = id.replace('input-', '');
        const errEl = document.getElementById(`error-${field}`);
        if (errEl) errEl.textContent = '';
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Expose internals for testing (available via window.__EBV__ in jsdom / browser)
  // ---------------------------------------------------------------------------

  /** @type {any} */
  const EBV = {
    CATEGORIES,
    DEFAULT_CATEGORIES,
    getCategories,
    saveCategories,
    getCategoryColorMap,
    generateCategoryColor,
    isValidTransaction,
    StorageManager,
    Validator,
    BalanceRenderer,
    ChartManager,
    TransactionListRenderer,
    NotificationManager,
    CategoryManager,
    ThemeManager,
    AppState,
    handleFormSubmit,
    handleDeleteClick,
    showFieldErrors,
    clearFieldErrors,
    renderAll,
    init,
  };

  // Make testable from outside the IIFE (e.g. Vitest with jsdom).
  if (typeof window !== 'undefined') {
    window.__EBV__ = EBV;
  }

  // Bootstrap on DOM ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      // DOM already ready (e.g. script loaded at end of body)
      init();
    }
  }

})();
