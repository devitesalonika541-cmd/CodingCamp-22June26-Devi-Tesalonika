/**
 * Tests for TransactionListRenderer.render()
 * Requirements: 2.1, 2.5
 */

import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { JSDOM } from 'jsdom';

// ---------------------------------------------------------------------------
// Bootstrap: load app.js into a jsdom window so window.__EBV__ is available
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let TransactionListRenderer;
let dom;

beforeAll(() => {
  const src = readFileSync(join(__dirname, 'app.js'), 'utf-8');
  dom = new JSDOM(
    `<!DOCTYPE html><html><body><ul id="transaction-list"></ul></body></html>`,
    { runScripts: 'dangerously' }
  );
  dom.window.eval(src);
  TransactionListRenderer = dom.window.__EBV__.TransactionListRenderer;
});

beforeEach(() => {
  // Reset the list element between tests
  dom.window.document.getElementById('transaction-list').innerHTML = '';
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** @param {Partial<{id:string,name:string,amount:number,category:string,date:string}>} overrides */
function makeTx(overrides = {}) {
  return {
    id: overrides.id ?? 'tx-' + Math.random().toString(36).slice(2),
    name: overrides.name ?? 'Item',
    amount: overrides.amount ?? 10,
    category: overrides.category ?? 'Food',
    date: overrides.date ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Unit Tests
// ---------------------------------------------------------------------------

describe('TransactionListRenderer.render — unit tests', () => {
  test('empty array shows placeholder <li class="transaction-empty">', () => {
    TransactionListRenderer.render([]);
    const list = dom.window.document.getElementById('transaction-list');
    expect(list.children).toHaveLength(1);
    expect(list.children[0].className).toBe('transaction-empty');
    expect(list.children[0].textContent).toBe('Belum ada transaksi.');
  });

  test('null shows placeholder', () => {
    TransactionListRenderer.render(null);
    const list = dom.window.document.getElementById('transaction-list');
    expect(list.children).toHaveLength(1);
    expect(list.children[0].className).toBe('transaction-empty');
  });

  test('undefined shows placeholder', () => {
    TransactionListRenderer.render(undefined);
    const list = dom.window.document.getElementById('transaction-list');
    expect(list.children).toHaveLength(1);
    expect(list.children[0].className).toBe('transaction-empty');
  });

  test('single transaction renders one <li class="transaction-item">', () => {
    const tx = makeTx({ name: 'Coffee' });
    TransactionListRenderer.render([tx]);
    const list = dom.window.document.getElementById('transaction-list');
    expect(list.children).toHaveLength(1);
    expect(list.children[0].className).toBe('transaction-item');
  });

  test('renders as many items as transactions', () => {
    const txs = [makeTx(), makeTx(), makeTx()];
    TransactionListRenderer.render(txs);
    const list = dom.window.document.getElementById('transaction-list');
    expect(list.children).toHaveLength(3);
  });

  test('sorts descending by date — newest first (Requirement 2.1)', () => {
    const txOld = makeTx({ id: 'old', date: '2024-01-01T00:00:00.000Z' });
    const txNew = makeTx({ id: 'new', date: '2024-06-01T00:00:00.000Z' });
    const txMid = makeTx({ id: 'mid', date: '2024-03-15T00:00:00.000Z' });

    // Pass in unsorted order
    TransactionListRenderer.render([txOld, txNew, txMid]);

    const list = dom.window.document.getElementById('transaction-list');
    const ids = Array.from(list.children).map((li) => li.dataset.id);
    expect(ids).toEqual(['new', 'mid', 'old']);
  });

  test('calling render twice clears previous contents (full re-render)', () => {
    TransactionListRenderer.render([makeTx()]);
    TransactionListRenderer.render([makeTx(), makeTx()]);
    const list = dom.window.document.getElementById('transaction-list');
    expect(list.children).toHaveLength(2);
  });

  test('switching from transactions to empty shows placeholder', () => {
    TransactionListRenderer.render([makeTx()]);
    TransactionListRenderer.render([]);
    const list = dom.window.document.getElementById('transaction-list');
    expect(list.children).toHaveLength(1);
    expect(list.children[0].className).toBe('transaction-empty');
  });

  test('does not mutate the original array', () => {
    const txOld = makeTx({ id: 'a', date: '2023-01-01T00:00:00.000Z' });
    const txNew = makeTx({ id: 'b', date: '2024-01-01T00:00:00.000Z' });
    const original = [txOld, txNew];
    TransactionListRenderer.render(original);
    // Original order must be unchanged
    expect(original[0].id).toBe('a');
    expect(original[1].id).toBe('b');
  });

  test('each rendered item carries the correct data-id', () => {
    const txs = [makeTx({ id: 'id-1' }), makeTx({ id: 'id-2' })];
    TransactionListRenderer.render(txs);
    const list = dom.window.document.getElementById('transaction-list');
    const ids = Array.from(list.children).map((li) => li.dataset.id);
    expect(ids).toContain('id-1');
    expect(ids).toContain('id-2');
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// Validates: Requirements 2.1, 2.5
// ---------------------------------------------------------------------------

describe('TransactionListRenderer.render — property tests', () => {
  const CATEGORIES = ['Food', 'Transport', 'Fun'];

  const txArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    amount: fc.float({ min: 0.01, max: 9999, noNaN: true, noDefaultInfinity: true }),
    category: fc.constantFrom(...CATEGORIES),
    date: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
      .map((d) => d.toISOString()),
  });

  /**
   * Property: rendered item count equals input array length (non-empty)
   * Validates: Requirements 2.1
   */
  test('Property: rendered item count equals transaction count', () => {
    fc.assert(
      fc.property(fc.array(txArbitrary, { minLength: 1, maxLength: 30 }), (transactions) => {
        TransactionListRenderer.render(transactions);
        const list = dom.window.document.getElementById('transaction-list');
        expect(list.children).toHaveLength(transactions.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: rendered items are in descending date order (newest first)
   * Validates: Requirements 2.1
   */
  test('Property: items are always sorted newest-first', () => {
    fc.assert(
      fc.property(fc.array(txArbitrary, { minLength: 2, maxLength: 20 }), (transactions) => {
        TransactionListRenderer.render(transactions);
        const list = dom.window.document.getElementById('transaction-list');
        const renderedIds = Array.from(list.children).map((li) => li.dataset.id);

        // Build sorted order independently
        const sortedIds = [...transactions]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map((tx) => tx.id);

        expect(renderedIds).toEqual(sortedIds);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: empty array always shows exactly one placeholder element
   * Validates: Requirements 2.5
   */
  test('Property: empty input always yields single placeholder', () => {
    // Render some items first so the list is not empty before the call
    fc.assert(
      fc.property(fc.array(txArbitrary, { minLength: 0, maxLength: 10 }), (_prev) => {
        TransactionListRenderer.render(_prev.length > 0 ? _prev : null);
        TransactionListRenderer.render([]);
        const list = dom.window.document.getElementById('transaction-list');
        expect(list.children).toHaveLength(1);
        expect(list.children[0].className).toBe('transaction-empty');
      }),
      { numRuns: 50 }
    );
  });
});
