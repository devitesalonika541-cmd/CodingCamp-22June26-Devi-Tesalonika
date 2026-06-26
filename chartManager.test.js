/**
 * Tests for ChartManager.computeCategoryData()
 * Requirements: 4.1, 4.6
 */

import { describe, test, expect, beforeAll } from 'vitest';
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

let ChartManager;

beforeAll(() => {
  const src = readFileSync(join(__dirname, 'app.js'), 'utf-8');
  const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
    runScripts: 'dangerously',
  });
  dom.window.eval(src);
  ChartManager = dom.window.__EBV__.ChartManager;
});

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

/** @param {Partial<{id:string,name:string,amount:number,category:string,date:string}>} overrides */
function makeTx(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'Item',
    amount: overrides.amount ?? 10,
    category: overrides.category ?? 'Food',
    date: overrides.date ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Unit Tests
// ---------------------------------------------------------------------------

describe('ChartManager.computeCategoryData — unit tests', () => {
  test('returns empty array for empty input', () => {
    expect(ChartManager.computeCategoryData([])).toEqual([]);
  });

  test('single transaction — 100% in its category', () => {
    const result = ChartManager.computeCategoryData([makeTx({ amount: 50, category: 'Food' })]);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Food');
    expect(result[0].total).toBe(50);
    expect(result[0].percentage).toBe(100);
  });

  test('two categories with equal amounts — each 50%', () => {
    const txs = [
      makeTx({ amount: 100, category: 'Food' }),
      makeTx({ amount: 100, category: 'Transport' }),
    ];
    const result = ChartManager.computeCategoryData(txs);
    expect(result).toHaveLength(2);
    const food = result.find((r) => r.category === 'Food');
    const transport = result.find((r) => r.category === 'Transport');
    expect(food.percentage).toBe(50);
    expect(transport.percentage).toBe(50);
  });

  test('categories with zero total are excluded (Req 4.6)', () => {
    const txs = [
      makeTx({ amount: 75, category: 'Fun' }),
      // No Food or Transport transactions — those totals stay 0
    ];
    const result = ChartManager.computeCategoryData(txs);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Fun');
  });

  test('all three categories present — percentages sum to 100', () => {
    const txs = [
      makeTx({ amount: 200, category: 'Food' }),
      makeTx({ amount: 100, category: 'Transport' }),
      makeTx({ amount: 100, category: 'Fun' }),
    ];
    const result = ChartManager.computeCategoryData(txs);
    expect(result).toHaveLength(3);
    const total = result.reduce((s, r) => s + r.percentage, 0);
    // Rounding may cause off-by-0.1; allow tiny tolerance
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(0.2);
  });

  test('percentage rounded to 1 decimal place', () => {
    // 1/3 ≈ 33.3%
    const txs = [
      makeTx({ amount: 1, category: 'Food' }),
      makeTx({ amount: 1, category: 'Transport' }),
      makeTx({ amount: 1, category: 'Fun' }),
    ];
    const result = ChartManager.computeCategoryData(txs);
    for (const entry of result) {
      const str = String(entry.percentage);
      const decimals = str.includes('.') ? str.split('.')[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(1);
    }
  });

  test('total rounded to 2 decimal places', () => {
    const txs = [
      makeTx({ amount: 10.005, category: 'Food' }),
    ];
    const result = ChartManager.computeCategoryData(txs);
    if (result.length > 0) {
      const str = String(result[0].total);
      const decimals = str.includes('.') ? str.split('.')[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });

  test('multiple transactions in same category are summed', () => {
    const txs = [
      makeTx({ amount: 30, category: 'Food' }),
      makeTx({ amount: 20, category: 'Food' }),
      makeTx({ amount: 50, category: 'Transport' }),
    ];
    const result = ChartManager.computeCategoryData(txs);
    const food = result.find((r) => r.category === 'Food');
    expect(food.total).toBe(50);
    expect(food.percentage).toBe(50);
  });

  test('returned objects have required shape: { category, total, percentage }', () => {
    const result = ChartManager.computeCategoryData([makeTx({ amount: 10, category: 'Fun' })]);
    for (const entry of result) {
      expect(entry).toHaveProperty('category');
      expect(entry).toHaveProperty('total');
      expect(entry).toHaveProperty('percentage');
    }
  });
});

// ---------------------------------------------------------------------------
// Property-Based Test — Property 9
// Validates: Requirements 4.1, 4.6
// ---------------------------------------------------------------------------

describe('ChartManager.computeCategoryData — Property 9', () => {
  /**
   * Property 9: Persentase chart per kategori dihitung dengan benar
   *
   * For any non-empty transaction array:
   *  - Each category with total > 0 appears in the result.
   *  - percentage === round((catTotal / grandTotal) * 100, 1 decimal)
   *  - Categories with total === 0 do NOT appear.
   *
   * Validates: Requirements 4.1, 4.6
   */
  test('Property 9: percentage computed correctly; zero-total categories excluded', () => {
    const CATEGORIES = ['Food', 'Transport', 'Fun'];

    // Arbitrary: array of 1–20 transactions with valid-ish amounts and categories
    const txArbitrary = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      amount: fc.float({ min: 0.01, max: 9999, noNaN: true, noDefaultInfinity: true }),
      category: fc.constantFrom(...CATEGORIES),
      date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString()),
    });

    fc.assert(
      fc.property(fc.array(txArbitrary, { minLength: 1, maxLength: 20 }), (transactions) => {
        const result = ChartManager.computeCategoryData(transactions);

        // Compute expected totals
        /** @type {Record<string, number>} */
        const totals = { Food: 0, Transport: 0, Fun: 0 };
        for (const tx of transactions) {
          totals[tx.category] += tx.amount;
        }
        // Round totals to 2 decimals (mirrors implementation)
        for (const cat of CATEGORIES) {
          totals[cat] = Math.round(totals[cat] * 100) / 100;
        }
        const grandTotal = CATEGORIES.reduce((s, c) => s + totals[c], 0);

        for (const cat of CATEGORIES) {
          const entry = result.find((r) => r.category === cat);

          if (totals[cat] <= 0) {
            // Req 4.6: zero-total category must be absent
            expect(entry).toBeUndefined();
          } else {
            // Req 4.1: category must be present
            expect(entry).toBeDefined();
            expect(entry.total).toBe(totals[cat]);

            // Percentage rounded to 1 decimal
            const expectedPct = Math.round((totals[cat] / grandTotal) * 1000) / 10;
            expect(entry.percentage).toBe(expectedPct);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
