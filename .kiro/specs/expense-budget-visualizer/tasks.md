# Implementation Plan: Expense & Budget Visualizer

## Overview

Implementasi aplikasi web standalone satu halaman menggunakan HTML, CSS, dan Vanilla JavaScript murni dengan Chart.js via CDN. Arsitektur Event-Driven MVC diimplementasikan dalam pola IIFE untuk menghindari polusi namespace global. Semua data persisten disimpan di browser Local Storage.

## Tasks

- [x] 1. Set up project structure and core data models
  - Buat file `index.html`, `style.css`, dan `app.js` di root project
  - Definisikan konstanta `CATEGORIES = ['Food', 'Transport', 'Fun']` dan typedef `Transaction`, `ValidationResult`, `CategoryData` sebagai JSDoc comments di `app.js`
  - Buat IIFE wrapper untuk seluruh aplikasi di `app.js`
  - Set up `vitest.config.js` dengan environment `jsdom` dan globals `true`
  - Install dev dependencies: `vitest`, `@vitest/ui`, `fast-check`, `jsdom`
  - _Requirements: 1.1, 5.4_

- [x] 2. Implement StorageManager
  - [x] 2.1 Implementasikan `StorageManager` dengan metode `load()`, `save()`, dan `remove()`
    - `load()`: baca localStorage key `ebv_transactions`, parse JSON, filter dengan `isValidTransaction()`, kembalikan `[]` jika gagal/korup
    - `save(transactions)`: serialize array ke JSON dan simpan, lempar error jika QuotaExceeded
    - `remove(id, transactions)`: filter transaksi berdasarkan ID lalu panggil `save()`
    - Implementasikan fungsi helper `isValidTransaction(obj)` untuk validasi field wajib
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 2.7_

- [x] 3. Implement Validator
  - [x] 3.1 Implementasikan `Validator.validateTransaction(name, amount, category)`
    - Validasi `name`: wajib, non-whitespace-only, maksimal 100 karakter
    - Validasi `amount`: wajib, angka positif, rentang 0.01–999,999,999.99, maksimal 2 desimal
    - Validasi `category`: wajib, harus salah satu dari `CATEGORIES`
    - Kembalikan `{ valid: boolean, errors: [{ field, message }] }`
    - _Requirements: 1.3, 1.4_

- [x] 4. Checkpoint — Pastikan semua tests storage dan validator lulus
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement AppState and BalanceRenderer
  - [x] 5.1 Implementasikan `AppState` singleton dengan `transactions: []` dan `chartInstance: null`
    - _Requirements: 3.1, 3.4_

  - [x] 5.2 Implementasikan `BalanceRenderer.computeTotal(transactions)` dan `BalanceRenderer.render(transactions)`
    - `computeTotal()`: jumlahkan semua `amount`, bulatkan ke 2 desimal, kembalikan `0.00` untuk array kosong
    - `render()`: hitung total lalu perbarui elemen DOM `#balance-display`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Implement TransactionListRenderer
  - [x] 6.1 Implementasikan `TransactionListRenderer.createItem(tx)` yang membuat elemen `<li>` dengan nama, jumlah, kategori, dan tombol hapus
    - Setiap item harus menyertakan `data-id` attribute untuk identifikasi saat delete
    - _Requirements: 2.1_

  - [x] 6.2 Implementasikan `TransactionListRenderer.render(transactions)`
    - Urutkan transaksi descending berdasarkan `date` (newest first)
    - Render ulang seluruh list ke DOM element `#transaction-list`
    - Tampilkan pesan kosong jika array kosong
    - _Requirements: 2.1, 2.5_

- [x] 7. Implement ChartManager
  - [x] 7.1 Implementasikan `ChartManager.computeCategoryData(transactions)`
    - Hitung total per kategori dan persentase dari grand total, bulatkan ke 1 desimal
    - Kategori dengan total = 0 tidak dimasukkan ke hasil
    - _Requirements: 4.1, 4.6_

  - [x] 7.3 Implementasikan `ChartManager.init(canvasId)`, `ChartManager.update(transactions)`, dan `ChartManager.destroy()`
    - `init()`: inisialisasi Chart.js instance; set `_available = false` dan return jika `Chart` tidak terdefinisi
    - `update()`: hitung data per kategori, update chart atau tampilkan placeholder `"Belum ada data pengeluaran"`
    - `destroy()`: hancurkan Chart.js instance yang ada
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.7_

- [x] 8. Implement NotificationManager
  - [x] 8.1 Implementasikan `NotificationManager.showError(message)` dan `NotificationManager.showSuccess(message)`
    - Tampilkan toast notification di pojok kanan atas dengan auto-dismiss setelah 4 detik
    - _Requirements: 1.3, 2.6, 5.5, 5.6_

- [x] 9. Build the HTML structure and CSS styling
  - [x] 9.1 Buat struktur HTML di `index.html`
    - `Input_Form` dengan field: teks nama item (maxlength=100), angka amount, select kategori (Food/Transport/Fun), tombol submit
    - `Balance_Display` di bagian atas halaman (`#balance-display`)
    - `Transaction_List` sebagai `<ul id="transaction-list">` dalam kontainer scrollable
    - `<canvas id="expense-chart">` untuk Chart.js
    - Container untuk toast notification
    - Link ke Chart.js CDN dan `app.js`
    - _Requirements: 1.1, 3.5, 4.7_

  - [x] 9.2 Buat CSS di `style.css`
    - Layout responsif dengan Balance_Display di atas
    - `Transaction_List` dengan `overflow-y: auto` dan tinggi kontainer tetap untuk scroll vertikal
    - Warna kategori berbeda secara perseptual untuk chart (contrast ratio ≥ 3:1 antar warna)
    - Styling toast notification (posisi fixed kanan atas, transition fade)
    - Styling inline validation error di bawah field terkait
    - _Requirements: 2.2, 4.5_

- [x] 10. Implement Controller — event binding and wiring
  - [x] 10.1 Implementasikan `handleFormSubmit(event)`
    - Ambil nilai semua field form
    - Panggil `Validator.validateTransaction()`, tampilkan error inline jika tidak valid
    - Buat objek Transaction baru dengan UUID v4, timestamp ISO 8601
    - Tambahkan ke `AppState.transactions`, panggil `StorageManager.save()` (dengan error handling untuk QuotaExceededError)
    - Kosongkan semua field form setelah submit berhasil
    - Panggil `renderAll()`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.1, 5.6_

  - [x] 10.4 Implementasikan `handleDeleteClick(event)` menggunakan event delegation pada `#transaction-list`
    - Identifikasi transaksi berdasarkan `data-id` pada elemen yang diklik
    - Filter dari `AppState.transactions`, panggil `StorageManager.remove()` (dengan error handling)
    - Panggil `renderAll()`
    - _Requirements: 2.3, 2.4, 5.2_

  - [x] 10.6 Implementasikan `renderAll(transactions)` yang memanggil `TransactionListRenderer.render()`, `BalanceRenderer.render()`, dan `ChartManager.update()` secara berurutan
    - _Requirements: 3.2, 3.3, 4.2, 4.3_

  - [x] 10.7 Implementasikan `init()` yang dipanggil saat `DOMContentLoaded`
    - Panggil `StorageManager.load()`, simpan ke `AppState.transactions`
    - Panggil `ChartManager.init('expense-chart')`
    - Panggil `renderAll()`
    - Pasang event listener untuk form submit dan delete click (event delegation)
    - Pasang logic auto-clear inline error saat pengguna mengetik pada field
    - _Requirements: 2.5, 5.3_

- [x] 11. Checkpoint — Pastikan seluruh integrasi berjalan
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Final checkpoint — Verifikasi end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks bertanda `*` adalah opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirement spesifik untuk traceabilitas
- Checkpoint memastikan validasi inkremental di setiap tahap
- Property tests memvalidasi properti kebenaran universal (11 properti)
- Unit tests memvalidasi skenario spesifik dan edge case
- Aplikasi tidak memerlukan build step — dapat dibuka langsung sebagai file HTML di browser
- UUID v4 dapat di-generate dengan `crypto.randomUUID()` (tersedia di semua browser modern)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1", "5.1", "9.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.2", "3.3", "5.2", "6.1", "7.1", "8.1", "9.2"] },
    { "id": 2, "tasks": ["5.3", "6.2", "7.2", "7.3", "10.1"] },
    { "id": 3, "tasks": ["6.3", "10.2", "10.3", "10.4"] },
    { "id": 4, "tasks": ["10.5", "10.6"] },
    { "id": 5, "tasks": ["10.7"] },
    { "id": 6, "tasks": ["12"] }
  ]
}
```
