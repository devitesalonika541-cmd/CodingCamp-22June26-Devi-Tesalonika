/**
 * Tests for handleFormSubmit(), showFieldErrors(), clearFieldErrors(), renderAll()
 * Requirements: 1.2, 1.3, 1.4, 1.5, 5.1, 5.6
 */

import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ---------------------------------------------------------------------------
// Shared DOM + EBV setup
// ---------------------------------------------------------------------------

/**
 * Creates a fresh jsdom environment with the full index.html form structure
 * and evaluates app.js inside it.
 */
function createEnv() {
  const src = readFileSync(join(__dirname, 'app.js'), 'utf-8');

  const dom = new JSDOM(
    `<!DOCTYPE html>
    <html><body>
      <form id="expense-form">
        <input  id="input-name"     type="text"   value="" />
        <span   id="error-name"     class="field-error"></span>
        <input  id="input-amount"   type="number" value="" />
        <span   id="error-amount"   class="field-error"></span>
        <select id="input-category">
          <option value="">-- Pilih --</option>
          <option value="Food">Food</option>
          <option value="Transport">Transport</option>
          <option value="Fun">Fun</option>
        </select>
        <span   id="error-category" class="field-error"></span>
        <button type="submit">Submit</button>
      </form>
      <ul id="transaction-list"></ul>
      <div id="balance-display"><span class="balance-amount">Rp 0.00</span></div>
      <div id="notification-container"></div>
      <p   id="chart-placeholder"></p>
      <canvas id="expense-chart"></canvas>
    </body></html>`,
    { runScripts: 'dangerously' },
  );

  // Provide crypto.randomUUID() inside the jsdom window
  dom.window.crypto = {
    randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
  };

  dom.window.eval(src);

  const EBV = dom.window.__EBV__;
  return { dom, EBV };
}

// ---------------------------------------------------------------------------
// Helper: set form fields and fire submit
// ---------------------------------------------------------------------------
function fillForm(dom, { name = '', amount = '', category = '' } = {}) {
  dom.window.document.getElementById('input-name').value     = name;
  dom.window.document.getElementById('input-amount').value   = amount;
  dom.window.document.getElementById('input-category').value = category;
}

function submitForm(dom, EBV) {
  const event = new dom.window.Event('submit');
  event.preventDefault = vi.fn();
  EBV.handleFormSubmit(event);
  return event;
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('handleFormSubmit — unit tests', () => {
  let dom, EBV;

  beforeEach(() => {
    ({ dom, EBV } = createEnv());
    // Reset AppState between tests
    EBV.AppState.transactions = [];
  });

  // ── Req 1.3 — missing fields show inline errors ───────────────────────────
  test('shows name error when name is empty', () => {
    fillForm(dom, { name: '', amount: '100', category: 'Food' });
    submitForm(dom, EBV);
    const el = dom.window.document.getElementById('error-name');
    expect(el.textContent).not.toBe('');
  });

  test('shows amount error when amount is empty', () => {
    fillForm(dom, { name: 'Coffee', amount: '', category: 'Food' });
    submitForm(dom, EBV);
    const el = dom.window.document.getElementById('error-amount');
    expect(el.textContent).not.toBe('');
  });

  test('shows category error when category is empty', () => {
    fillForm(dom, { name: 'Coffee', amount: '25000', category: '' });
    submitForm(dom, EBV);
    const el = dom.window.document.getElementById('error-category');
    expect(el.textContent).not.toBe('');
  });

  test('whitespace-only name shows name error', () => {
    fillForm(dom, { name: '   ', amount: '100', category: 'Food' });
    submitForm(dom, EBV);
    const el = dom.window.document.getElementById('error-name');
    expect(el.textContent).not.toBe('');
  });

  // ── Req 1.4 — invalid amount shows error ─────────────────────────────────
  test('shows amount error when amount is negative', () => {
    fillForm(dom, { name: 'Taxi', amount: '-5', category: 'Transport' });
    submitForm(dom, EBV);
    const el = dom.window.document.getElementById('error-amount');
    expect(el.textContent).not.toBe('');
  });

  test('shows amount error when amount has more than 2 decimal places', () => {
    fillForm(dom, { name: 'Snack', amount: '10.999', category: 'Fun' });
    submitForm(dom, EBV);
    const el = dom.window.document.getElementById('error-amount');
    expect(el.textContent).not.toBe('');
  });

  // ── Req 1.2 — valid submission adds transaction ───────────────────────────
  test('adds transaction to AppState on valid input', () => {
    fillForm(dom, { name: 'Makan siang', amount: '25000', category: 'Food' });
    submitForm(dom, EBV);
    expect(EBV.AppState.transactions).toHaveLength(1);
  });

  test('transaction has correct name, amount, and category', () => {
    fillForm(dom, { name: 'Tiket bus', amount: '15000.50', category: 'Transport' });
    submitForm(dom, EBV);
    const tx = EBV.AppState.transactions[0];
    expect(tx.name).toBe('Tiket bus');
    expect(tx.amount).toBe(15000.50);
    expect(tx.category).toBe('Transport');
  });

  test('transaction id is a non-empty string (UUID)', () => {
    fillForm(dom, { name: 'Kopi', amount: '20000', category: 'Fun' });
    submitForm(dom, EBV);
    const tx = EBV.AppState.transactions[0];
    expect(typeof tx.id).toBe('string');
    expect(tx.id.length).toBeGreaterThan(0);
  });

  test('transaction date is a valid ISO 8601 string', () => {
    fillForm(dom, { name: 'Mie ayam', amount: '18000', category: 'Food' });
    submitForm(dom, EBV);
    const tx = EBV.AppState.transactions[0];
    expect(() => new Date(tx.date)).not.toThrow();
    expect(new Date(tx.date).toISOString()).toBe(tx.date);
  });

  test('transaction amount is rounded to 2 decimal places', () => {
    fillForm(dom, { name: 'Item', amount: '99.10', category: 'Food' });
    submitForm(dom, EBV);
    const tx = EBV.AppState.transactions[0];
    expect(tx.amount).toBe(99.10);
  });

  // ── Req 1.5 — form fields cleared after success ───────────────────────────
  test('clears form fields after successful submission', () => {
    fillForm(dom, { name: 'Snack', amount: '5000', category: 'Fun' });
    submitForm(dom, EBV);
    expect(dom.window.document.getElementById('input-name').value).toBe('');
    expect(dom.window.document.getElementById('input-amount').value).toBe('');
    expect(dom.window.document.getElementById('input-category').value).toBe('');
  });

  // ── Validation errors prevent transaction addition ─────────────────────────
  test('does NOT add transaction when validation fails', () => {
    fillForm(dom, { name: '', amount: '', category: '' });
    submitForm(dom, EBV);
    expect(EBV.AppState.transactions).toHaveLength(0);
  });

  // ── Req 5.6 — QuotaExceededError handling ────────────────────────────────
  test('rolls back transaction on QuotaExceededError', () => {
    // Monkey-patch StorageManager.save to throw QuotaExceededError
    const originalSave = EBV.StorageManager.save;
    EBV.StorageManager.save = () => {
      const err = new DOMException('QuotaExceededError', 'QuotaExceededError');
      throw err;
    };

    fillForm(dom, { name: 'Item', amount: '5000', category: 'Food' });
    submitForm(dom, EBV);

    // Transaction must have been rolled back
    expect(EBV.AppState.transactions).toHaveLength(0);

    // Restore original
    EBV.StorageManager.save = originalSave;
  });

  // ── clearFieldErrors clears existing messages ─────────────────────────────
  test('clears previous field errors before re-validating', () => {
    // First submit with empty fields to trigger errors
    fillForm(dom, { name: '', amount: '', category: '' });
    submitForm(dom, EBV);
    expect(dom.window.document.getElementById('error-name').textContent).not.toBe('');

    // Second submit with valid data — errors should be cleared
    fillForm(dom, { name: 'Item', amount: '1000', category: 'Food' });
    submitForm(dom, EBV);
    expect(dom.window.document.getElementById('error-name').textContent).toBe('');
    expect(dom.window.document.getElementById('error-amount').textContent).toBe('');
    expect(dom.window.document.getElementById('error-category').textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// showFieldErrors / clearFieldErrors — isolated unit tests
// ---------------------------------------------------------------------------

describe('showFieldErrors & clearFieldErrors', () => {
  let dom, EBV;

  beforeEach(() => {
    ({ dom, EBV } = createEnv());
  });

  test('showFieldErrors sets correct element text', () => {
    EBV.showFieldErrors([{ field: 'name', message: 'Wajib diisi' }]);
    expect(dom.window.document.getElementById('error-name').textContent).toBe('Wajib diisi');
  });

  test('showFieldErrors handles unknown field gracefully (no throw)', () => {
    expect(() => EBV.showFieldErrors([{ field: 'unknown', message: 'x' }])).not.toThrow();
  });

  test('clearFieldErrors empties all three error spans', () => {
    dom.window.document.getElementById('error-name').textContent     = 'err';
    dom.window.document.getElementById('error-amount').textContent   = 'err';
    dom.window.document.getElementById('error-category').textContent = 'err';
    EBV.clearFieldErrors();
    expect(dom.window.document.getElementById('error-name').textContent).toBe('');
    expect(dom.window.document.getElementById('error-amount').textContent).toBe('');
    expect(dom.window.document.getElementById('error-category').textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Req 5.1 — StorageManager.save() is called on valid submit
// ---------------------------------------------------------------------------

describe('handleFormSubmit — persistence (Req 5.1)', () => {
  test('calls StorageManager.save with the new transaction included', () => {
    const { dom, EBV } = createEnv();
    EBV.AppState.transactions = [];

    let savedData = null;
    const originalSave = EBV.StorageManager.save;
    EBV.StorageManager.save = (txs) => {
      savedData = txs;
      // Also call localStorage so nothing else breaks
      originalSave.call(EBV.StorageManager, txs);
    };

    fillForm(dom, { name: 'Ojek', amount: '12000', category: 'Transport' });
    submitForm(dom, EBV);

    expect(savedData).not.toBeNull();
    expect(savedData).toHaveLength(1);
    expect(savedData[0].name).toBe('Ojek');

    EBV.StorageManager.save = originalSave;
  });
});
