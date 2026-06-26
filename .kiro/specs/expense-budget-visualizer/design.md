# Design Document: Expense & Budget Visualizer

## Overview

Expense & Budget Visualizer adalah aplikasi web standalone satu halaman (single-page) yang dibangun dengan HTML, CSS, dan Vanilla JavaScript murni — tanpa framework frontend dan tanpa backend server. Semua data persisten disimpan di browser Local Storage. Pengguna dapat mencatat transaksi pengeluaran, melihat riwayat dalam daftar scrollable, memantau total balance, dan memahami distribusi pengeluaran melalui pie chart interaktif berbasis Chart.js.

Arsitektur dipilih agar aplikasi dapat berjalan sebagai:
1. **Standalone web page** — langsung dibuka dari file system atau di-serve via HTTP server sederhana.
2. **Browser extension** — menggunakan artifact build yang sama tanpa perubahan source code.

Keputusan desain utama:
- **Tidak ada build step** — satu file `index.html` dengan CSS dan JS inline atau file terpisah yang di-link secara relatif, sehingga mudah dibuka langsung di browser.
- **Chart.js via CDN** — digunakan jika tersedia; graceful degradation jika tidak.
- **Module pattern (IIFE)** — menghindari polusi global namespace tanpa memerlukan bundler.

---

## Architecture

### Gambaran Umum

Aplikasi mengikuti arsitektur **Event-Driven MVC** yang sederhana:

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                           │
│  ┌──────────────┐   ┌──────────────────────────────────┐   │
│  │     View     │   │           Controller             │   │
│  │  (DOM / UI)  │◄──│  (EventListeners + AppState)     │   │
│  │              │   │                                  │   │
│  │ - Input_Form │   │  addTransaction()                │   │
│  │ - Tx_List    │   │  deleteTransaction()             │   │
│  │ - Balance    │   │  loadFromStorage()               │   │
│  │ - Chart      │   │  renderAll()                     │   │
│  └──────────────┘   └──────────────┬─────────────────┘    │
│                                    │                        │
│  ┌─────────────────────────────────▼──────────────────┐    │
│  │                    Model / Storage                  │    │
│  │  StorageManager: load(), save(), remove()           │    │
│  │  Validator: validateForm()                          │    │
│  │  ChartManager: init(), update(), destroy()          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                    Browser Local Storage
                    (key: "ebv_transactions")
```

### Alur Data Utama

**Menambah Transaksi:**
```
User Input → Validator → StorageManager.save() → AppState.transactions[] 
  → renderTransactionList() → renderBalance() → renderChart()
```

**Menghapus Transaksi:**
```
Delete Click → StorageManager.remove() → AppState.transactions[] (filter)
  → renderTransactionList() → renderBalance() → renderChart()
```

**Memuat Halaman:**
```
DOMContentLoaded → StorageManager.load() → AppState.transactions[]
  → renderTransactionList() → renderBalance() → renderChart()
```

---

## Components and Interfaces

### 1. `StorageManager`

Bertanggung jawab atas seluruh interaksi dengan `localStorage`.

```javascript
const StorageManager = {
  STORAGE_KEY: 'ebv_transactions',

  /** @returns {Transaction[]} array, atau [] jika data korup/kosong */
  load(): Transaction[],

  /** @throws {QuotaExceededError} jika storage penuh */
  save(transactions: Transaction[]): void,

  /** Alias untuk save() setelah filter */
  remove(id: string, transactions: Transaction[]): void
};
```

### 2. `Validator`

Memvalidasi data form sebelum transaksi dibuat.

```javascript
const Validator = {
  /**
   * @param {string} name  - nama item (max 100 char, bukan hanya spasi)
   * @param {string} amount - string angka dari input
   * @param {string} category - salah satu dari CATEGORIES
   * @returns {{ valid: boolean, errors: { field: string, message: string }[] }}
   */
  validateTransaction(name, amount, category): ValidationResult
};
```

Aturan validasi:
- `name`: wajib, tidak boleh hanya spasi, maksimal 100 karakter.
- `amount`: wajib, harus angka positif, rentang 0.01–999,999,999.99, maksimal 2 desimal.
- `category`: wajib, harus salah satu dari `['Food', 'Transport', 'Fun']`.

### 3. `AppState`

Singleton yang menyimpan state in-memory aplikasi.

```javascript
const AppState = {
  transactions: Transaction[],  // sumber kebenaran tunggal
  chartInstance: Chart | null   // referensi Chart.js instance
};
```

### 4. `TransactionListRenderer`

Merender ulang seluruh `Transaction_List` dari `AppState.transactions`.

```javascript
const TransactionListRenderer = {
  /**
   * Mengurutkan transactions (newest first) dan merender ke DOM.
   * Menampilkan pesan kosong jika array kosong.
   */
  render(transactions: Transaction[]): void,

  /** Membuat satu elemen <li> untuk sebuah transaksi */
  createItem(tx: Transaction): HTMLElement
};
```

### 5. `BalanceRenderer`

Menghitung dan menampilkan total balance.

```javascript
const BalanceRenderer = {
  /**
   * Menjumlahkan semua amount, bulatkan ke 2 desimal, perbarui DOM.
   */
  render(transactions: Transaction[]): void,

  /**
   * Menghitung total dari array amounts.
   * @returns {number} total dibulatkan ke 2 desimal
   */
  computeTotal(transactions: Transaction[]): number
};
```

### 6. `ChartManager`

Mengelola siklus hidup Chart.js pie chart.

```javascript
const ChartManager = {
  /**
   * Inisialisasi Chart.js instance pertama kali.
   * Jika Chart.js tidak tersedia, tidak melakukan apa-apa.
   */
  init(canvasId: string): void,

  /**
   * Hitung data per kategori dan update chart atau tampilkan placeholder.
   */
  update(transactions: Transaction[]): void,

  /**
   * Hitung persentase per kategori, bulatkan ke 1 desimal.
   * @returns {CategoryData[]}
   */
  computeCategoryData(transactions: Transaction[]): CategoryData[],

  /**
   * Hancurkan instance Chart.js saat ini (untuk re-init).
   */
  destroy(): void
};
```

### 7. `NotificationManager`

Menampilkan pesan error/info kepada pengguna.

```javascript
const NotificationManager = {
  /** Menampilkan pesan error sementara (auto-dismiss setelah 4 detik) */
  showError(message: string): void,

  /** Menampilkan pesan sukses sementara */
  showSuccess(message: string): void
};
```

### 8. Controller / Event Binding (`main.js` atau IIFE utama)

```javascript
function handleFormSubmit(event): void
function handleDeleteClick(event): void
function renderAll(transactions): void  // memanggil semua renderer sekaligus
function init(): void  // dipanggil saat DOMContentLoaded
```

---

## Data Models

### `Transaction`

```javascript
/**
 * @typedef {Object} Transaction
 * @property {string} id         - UUID v4 unik per transaksi
 * @property {string} name       - Nama item, 1–100 karakter (non-whitespace-only)
 * @property {number} amount     - Jumlah pengeluaran, float, 0.01–999999999.99
 * @property {Category} category - Salah satu dari: 'Food' | 'Transport' | 'Fun'
 * @property {string} date       - ISO 8601 timestamp (new Date().toISOString())
 */
```

Contoh objek Transaction:
```json
{
  "id": "a3f2c1b0-1234-4abc-9def-000000000001",
  "name": "Nasi Goreng",
  "amount": 15000.00,
  "category": "Food",
  "date": "2025-06-22T10:30:00.000Z"
}
```

### `Category`

```javascript
/** @typedef {'Food' | 'Transport' | 'Fun'} Category */
const CATEGORIES = ['Food', 'Transport', 'Fun'];
```

### `ValidationResult`

```javascript
/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {{ field: string, message: string }[]} errors
 */
```

### `CategoryData`

```javascript
/**
 * @typedef {Object} CategoryData
 * @property {Category} category
 * @property {number} total      - Total amount kategori (2 desimal)
 * @property {number} percentage - Persentase dari total keseluruhan (1 desimal)
 */
```

### Format Storage

Data disimpan dalam satu key di `localStorage`:

```javascript
localStorage.setItem('ebv_transactions', JSON.stringify(Transaction[]));
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Validator Menolak Nama yang Kosong atau Hanya Spasi

*For any* string yang terdiri sepenuhnya dari karakter whitespace (spasi, tab, newline) atau string kosong, memanggil `Validator.validateTransaction(name, validAmount, validCategory)` SHALL mengembalikan `valid: false` dan menyertakan error pada field `name`.

**Validates: Requirements 1.3**

---

### Property 2: Validator Menolak Amount yang Tidak Valid

*For any* nilai amount yang berada di luar rentang 0.01–999,999,999.99, atau yang memiliki lebih dari 2 angka desimal, atau yang merupakan nilai non-numerik, atau yang nol/negatif, memanggil `Validator.validateTransaction(validName, invalidAmount, validCategory)` SHALL mengembalikan `valid: false` dan menyertakan error pada field `amount`.

**Validates: Requirements 1.4**

---

### Property 3: Penambahan Transaksi Menambah Daftar sebesar Satu

*For any* daftar transaksi yang ada dan *for any* transaksi valid yang baru, menambahkan transaksi tersebut SHALL menghasilkan daftar dengan panjang bertambah tepat satu, dan transaksi yang ditambahkan SHALL dapat ditemukan dalam daftar berdasarkan ID-nya.

**Validates: Requirements 1.2**

---

### Property 4: Form Dikosongkan Setelah Submit Berhasil

*For any* input form yang terisi dengan data transaksi valid, setelah proses submit berhasil (tanpa error validasi), semua field (nama item, amount, kategori) SHALL kembali ke nilai default/kosong.

**Validates: Requirements 1.5**

---

### Property 5: Daftar Transaksi Selalu Diurutkan Terbaru di Atas

*For any* array transaksi dengan nilai `date` yang bervariasi, hasil render `TransactionListRenderer.render()` SHALL menghasilkan urutan descending berdasarkan timestamp ISO 8601 — transaksi dengan `date` paling besar muncul pertama.

**Validates: Requirements 2.1**

---

### Property 6: Penghapusan Transaksi Menghilangkan Item dari Daftar dan Storage

*For any* daftar transaksi yang berisi satu atau lebih item, dan *for any* transaksi yang dipilih untuk dihapus dari daftar tersebut, setelah operasi penghapusan:
- ID transaksi tersebut SHALL tidak ditemukan dalam array `AppState.transactions`, DAN
- Membaca kembali data dari `localStorage` SHALL tidak mengandung transaksi dengan ID tersebut.

**Validates: Requirements 2.3, 5.2**

---

### Property 7: Data Storage yang Korup atau Tidak Valid Menghasilkan Array Kosong

*For any* nilai yang disimpan di `localStorage` untuk key `ebv_transactions` yang bukan berupa JSON array of valid Transaction objects — termasuk string kosong, `null`, JSON malformed, array berisi non-object, atau object tanpa field wajib — memanggil `StorageManager.load()` SHALL mengembalikan array kosong `[]` tanpa melempar exception.

**Validates: Requirements 2.7, 5.5**

---

### Property 8: Perhitungan Total Balance Akurat untuk Semua Kombinasi Transaksi

*For any* array transaksi (termasuk array kosong), `BalanceRenderer.computeTotal(transactions)` SHALL mengembalikan nilai yang identik dengan penjumlahan semua `amount` dari setiap transaksi dalam array, dibulatkan ke tepat 2 angka desimal. Khusus untuk array kosong, SHALL mengembalikan `0.00`.

**Validates: Requirements 3.1, 3.4**

---

### Property 9: Persentase Chart Per Kategori Dihitung dengan Benar

*For any* array transaksi yang tidak kosong dan *for any* kategori yang memiliki total amount > 0, `ChartManager.computeCategoryData(transactions)` SHALL mengembalikan entri untuk kategori tersebut dengan `percentage` yang identik dengan `(category_total / grand_total) * 100` dibulatkan ke 1 angka desimal. Kategori dengan total amount sama dengan nol SHALL tidak muncul dalam hasil kembalian.

**Validates: Requirements 4.1, 4.6**

---

### Property 10: Serialisasi JSON Round-Trip Mempertahankan Semua Field Transaksi

*For any* objek `Transaction` yang valid, melakukan `JSON.parse(JSON.stringify(transaction))` SHALL menghasilkan objek dengan nilai dan tipe data yang identik untuk setiap field: `id` (string), `name` (string), `amount` (number), `category` (string dari enum CATEGORIES), dan `date` (string ISO 8601).

**Validates: Requirements 5.4**

---

### Property 11: Reload App Menampilkan Semua Data Tersimpan di Semua Komponen

*For any* array transaksi yang tersimpan di `localStorage`, setelah menjalankan `init()` / `loadFromStorage()`:
- `Transaction_List` SHALL menampilkan tepat semua transaksi dalam array tersebut,
- `Balance_Display` SHALL menampilkan jumlah total yang benar sesuai Property 8, DAN
- `ChartManager.computeCategoryData()` SHALL menggunakan seluruh data transaksi dari storage.

**Validates: Requirements 5.3, 2.5**

---

## Error Handling

### Hierarki Error

| Sumber Error | Tipe | Penanganan |
|---|---|---|
| Validasi form kosong/spasi | `ValidationError` | Tampilkan pesan per-field inline di bawah field terkait |
| Validasi amount tidak valid | `ValidationError` | Tampilkan pesan inline di bawah field amount |
| `localStorage` penuh (`QuotaExceededError`) | `StorageError` | Batalkan add, pertahankan state, tampilkan toast error |
| `localStorage` gagal baca (data korup) | `StorageError` | Inisialisasi dengan `[]`, log ke console, opsional tampilkan info |
| `localStorage` gagal hapus | `StorageError` | Pertahankan tampilan saat ini, tampilkan toast error |
| Chart.js tidak tersedia | `DependencyError` | Graceful degradation — sembunyikan elemen canvas, tampilkan placeholder |
| Chart.js error render | `ChartError` | Log ke console, tampilkan placeholder tanpa crash app |

### Strategi Penanganan

**Validasi Input (Requirement 1.3, 1.4)**
- Error ditampilkan inline di bawah field yang bermasalah, bukan sebagai alert modal.
- Pesan error harus spesifik: "Nama item wajib diisi" / "Jumlah harus berupa angka antara 0.01 dan 999,999,999.99".
- Error dihapus secara otomatis ketika pengguna mulai mengetik pada field yang sama.

**Storage Error (Requirement 2.6, 5.5, 5.6)**
```javascript
// Pola untuk semua operasi storage
try {
  StorageManager.save(transactions);
} catch (e) {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') {
    NotificationManager.showError('Penyimpanan penuh. Transaksi tidak dapat disimpan.');
    // Rollback: jangan perbarui AppState
  } else {
    NotificationManager.showError('Terjadi kesalahan saat menyimpan data.');
    console.error('Storage error:', e);
  }
}
```

**Inisialisasi dengan Data Korup (Requirement 5.5)**
```javascript
// StorageManager.load()
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidTransaction);
} catch {
  return []; // data korup → mulai bersih
}
```

**Graceful Degradation Chart.js (Requirement 4.7)**
```javascript
// ChartManager.init()
if (typeof Chart === 'undefined') {
  this._available = false;
  return; // semua operasi Chart selanjutnya menjadi no-op
}
```

### Notifikasi Pengguna

- **Toast notification**: Muncul di pojok kanan atas, auto-dismiss setelah 4 detik.
- **Inline validation error**: Muncul di bawah field form, hilang saat pengguna mengetik.
- **Placeholder chart**: Teks "Belum ada data pengeluaran" ditampilkan di area chart jika tidak ada data atau Chart.js tidak tersedia.

---

## Testing Strategy

### Pendekatan Pengujian

Strategi pengujian menggunakan dua pendekatan komplementer:

1. **Property-Based Tests** — memverifikasi properti universal yang berlaku untuk semua input yang valid (11 properti dari bagian Correctness Properties).
2. **Example-Based / Unit Tests** — memverifikasi skenario spesifik, edge case, dan penanganan error.

Library yang dipilih untuk **property-based testing**: **[fast-check](https://github.com/dubzzz/fast-check)** (JavaScript, browser-compatible, tidak memerlukan Node.js runtime untuk dijalankan di browser environment via bundler atau jsdom).

Test runner: **[Vitest](https://vitest.dev/)** — ringan, kompatibel dengan Vanilla JS project, mendukung jsdom environment.

---

### Property-Based Tests

Setiap property test dikonfigurasi dengan **minimum 100 iterasi** dan diberi tag referensi ke properti desain.

#### Property 1: Validator menolak nama kosong/whitespace
```
Feature: expense-budget-visualizer, Property 1: Validator menolak nama yang kosong atau hanya spasi
```
- Generator: arbitrary string dari karakter whitespace + string kosong
- Assert: `validateTransaction(name, '100', 'Food').valid === false`

#### Property 2: Validator menolak amount tidak valid
```
Feature: expense-budget-visualizer, Property 2: Validator menolak amount yang tidak valid
```
- Generator: angka negatif, nol, > 999999999.99, > 2 desimal, string non-numerik
- Assert: `validateTransaction('item', amount, 'Food').valid === false`

#### Property 3: Penambahan transaksi menambah list sebesar satu
```
Feature: expense-budget-visualizer, Property 3: Penambahan transaksi menambah daftar sebesar satu
```
- Generator: array transaksi valid (bisa kosong) + satu transaksi valid baru
- Assert: `transactions.length + 1 === newList.length && newList.find(t => t.id === newTx.id) !== undefined`

#### Property 4: Form dikosongkan setelah submit
```
Feature: expense-budget-visualizer, Property 4: Form dikosongkan setelah submit berhasil
```
- Generator: nama item valid (string non-whitespace, max 100 char), amount valid, kategori valid
- Assert: semua field form bernilai kosong/default setelah submit

#### Property 5: Daftar selalu terurut terbaru di atas
```
Feature: expense-budget-visualizer, Property 5: Daftar transaksi selalu diurutkan terbaru di atas
```
- Generator: array transaksi dengan `date` acak (ISO 8601 valid)
- Assert: hasil sort descending — `sortedList[i].date >= sortedList[i+1].date` untuk semua i

#### Property 6: Penghapusan menghilangkan dari list dan storage
```
Feature: expense-budget-visualizer, Property 6: Penghapusan transaksi menghilangkan item dari daftar dan storage
```
- Generator: array non-empty transaksi, pilih satu ID secara acak untuk dihapus
- Assert: ID tidak ada di array hasil + tidak ada di data localStorage yang di-parse

#### Property 7: Data korup menghasilkan array kosong
```
Feature: expense-budget-visualizer, Property 7: Data storage korup menghasilkan array kosong
```
- Generator: string acak bukan JSON valid, `null`, array berisi non-object, object tanpa field wajib
- Assert: `StorageManager.load()` mengembalikan `[]` tanpa exception

#### Property 8: Perhitungan total balance akurat
```
Feature: expense-budget-visualizer, Property 8: Perhitungan total balance akurat untuk semua kombinasi transaksi
```
- Generator: array transaksi dengan amount float acak (termasuk array kosong)
- Assert: `computeTotal(txs) === parseFloat(txs.reduce((s,t) => s + t.amount, 0).toFixed(2))`

#### Property 9: Persentase chart per kategori benar
```
Feature: expense-budget-visualizer, Property 9: Persentase chart per kategori dihitung dengan benar
```
- Generator: array transaksi non-empty dengan kombinasi kategori acak (termasuk kategori dengan amount 0)
- Assert: untuk setiap kategori dengan total > 0: `percentage === parseFloat((catTotal/grandTotal*100).toFixed(1))`; kategori dengan total = 0 tidak muncul

#### Property 10: Serialisasi JSON round-trip
```
Feature: expense-budget-visualizer, Property 10: Serialisasi JSON round-trip mempertahankan semua field transaksi
```
- Generator: objek Transaction acak (semua field valid)
- Assert: `JSON.parse(JSON.stringify(tx))` identik dengan `tx` untuk semua field (id, name, amount, category, date)

#### Property 11: Reload menampilkan semua data di semua komponen
```
Feature: expense-budget-visualizer, Property 11: Reload app menampilkan semua data tersimpan di semua komponen
```
- Generator: array transaksi acak (termasuk kosong)
- Assert: setelah mock localStorage + panggil init(): list length === input length, computeTotal() benar, computeCategoryData() menggunakan semua data

---

### Example-Based / Unit Tests

#### Validasi Form (Requirement 1)
- ✅ Form memiliki field name (text, max 100), amount (number), category (select) — verifikasi DOM
- ✅ Submit dengan semua field valid → transaksi ditambahkan
- ✅ Submit dengan name kosong → error message pada field name, tidak ada transaksi ditambahkan
- ✅ Submit dengan amount = 0 → error message pada field amount
- ✅ Submit dengan amount negatif → error message pada field amount

#### Daftar Transaksi (Requirement 2)
- ✅ Tampilan transaksi menampilkan nama, jumlah, dan kategori
- ✅ Storage gagal saat hapus → tampilan tetap, pesan error muncul

#### Visualisasi Chart (Requirement 4)
- ✅ `update([])` → placeholder "Belum ada data pengeluaran" ditampilkan
- ✅ Chart.js tersedia → canvas dirender, bukan placeholder
- ✅ Chart.js tidak tersedia → placeholder, fitur lain tetap berjalan
- ✅ Warna kategori memiliki contrast ratio ≥ 3:1 (static assertion)

#### Persistensi Data (Requirement 5)
- ✅ `QuotaExceededError` saat save → transaksi tidak ditambahkan, state tidak berubah, error toast muncul
- ✅ Storage failure saat delete → state tidak berubah, error toast muncul

#### Kompatibilitas (Requirement 6)
- ✅ App dapat dimuat sebagai standalone HTML (file://)
- ✅ Tidak ada dependensi selain Chart.js CDN

---

### Konfigurasi Pengujian

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  }
});
```

```javascript
// Contoh property test dengan fast-check
import fc from 'fast-check';

test('Property 8: computeTotal akurat untuk semua kombinasi', () => {
  // Feature: expense-budget-visualizer, Property 8: Perhitungan total balance akurat
  fc.assert(
    fc.property(
      fc.array(fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1 }),
        amount: fc.float({ min: 0.01, max: 999999999.99, noNaN: true }),
        category: fc.constantFrom('Food', 'Transport', 'Fun'),
        date: fc.date().map(d => d.toISOString()),
      })),
      (transactions) => {
        const expected = parseFloat(
          transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)
        );
        expect(BalanceRenderer.computeTotal(transactions)).toBe(expected);
      }
    ),
    { numRuns: 100 }
  );
});
```

---

### Cakupan Pengujian

| Requirement | Property Tests | Example Tests | Smoke Tests |
|---|---|---|---|
| 1 - Input Transaksi | P1, P2, P3, P4 | 5 tests | — |
| 2 - Daftar Transaksi | P5, P6, P7 | 2 tests | Scroll visual |
| 3 - Total Balance | P8 | — | Timing (≤500ms) |
| 4 - Pie Chart | P9 | 4 tests | Timing (≤500ms) |
| 5 - Persistensi Data | P10, P11 | 2 tests | — |
| 6 - Kompatibilitas & Performa | — | 2 tests | Timing, browser compat |
