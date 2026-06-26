# Requirements Document

## Introduction

Expense & Budget Visualizer adalah aplikasi web standalone yang memungkinkan pengguna mencatat, mengelola, dan memvisualisasikan pengeluaran harian mereka berdasarkan kategori. Aplikasi dibangun sepenuhnya dengan HTML, CSS, dan Vanilla JavaScript tanpa backend server, menggunakan browser Local Storage sebagai penyimpanan data. Antarmuka yang bersih dan minimal memudahkan pengguna memahami distribusi pengeluaran melalui daftar transaksi dan pie chart interaktif.

## Glossary

- **App**: Aplikasi web Expense & Budget Visualizer yang berjalan di browser.
- **Transaction**: Satu entri pengeluaran yang terdiri dari nama item, jumlah uang, dan kategori.
- **Transaction_List**: Daftar scrollable yang menampilkan semua transaksi yang telah ditambahkan.
- **Input_Form**: Formulir HTML yang menerima input nama item, jumlah, dan kategori dari pengguna.
- **Validator**: Komponen yang memeriksa kelengkapan dan kevalidan data input sebelum transaksi disimpan.
- **Balance_Display**: Komponen yang menampilkan total kumulatif semua jumlah transaksi.
- **Chart**: Pie chart visual yang menampilkan distribusi pengeluaran per kategori.
- **Storage**: Browser Local Storage API yang menyimpan seluruh data transaksi di sisi client.
- **Category**: Klasifikasi pengeluaran; salah satu dari: Food, Transport, Fun.

---

## Requirements

### Requirement 1: Input Transaksi

**User Story:** Sebagai pengguna, saya ingin mengisi formulir dengan nama item, jumlah, dan kategori, agar saya dapat mencatat pengeluaran baru dengan cepat.

#### Acceptance Criteria

1. THE Input_Form SHALL menyediakan field teks untuk nama item (maksimal 100 karakter), field angka untuk jumlah (amount), dan dropdown untuk kategori dengan pilihan: Food, Transport, Fun.
2. WHEN pengguna mengisi semua field dan mengklik tombol submit, THE App SHALL menambahkan transaksi baru ke Transaction_List.
3. IF salah satu field kosong atau field nama item hanya berisi spasi saat submit, THEN THE Validator SHALL menampilkan pesan kesalahan yang mengidentifikasi field mana yang belum diisi dan mencegah penyimpanan transaksi.
4. IF semua field terisi namun nilai amount bukan angka positif dalam rentang 0.01 hingga 999,999,999.99 (dengan maksimal 2 angka desimal), THEN THE Validator SHALL menampilkan pesan kesalahan format dan mencegah penyimpanan transaksi.
5. WHEN transaksi berhasil ditambahkan, THE Input_Form SHALL mengosongkan semua field agar siap untuk input berikutnya.

---

### Requirement 2: Daftar Transaksi

**User Story:** Sebagai pengguna, saya ingin melihat semua pengeluaran yang telah saya catat dalam sebuah daftar, agar saya dapat meninjau dan mengelola riwayat transaksi saya.

#### Acceptance Criteria

1. THE Transaction_List SHALL menampilkan semua transaksi yang tersimpan secara terurut dari yang paling baru (most recent first), masing-masing menampilkan nama item, jumlah, dan kategori.
2. WHILE tinggi konten Transaction_List melebihi tinggi kontainer yang ditetapkan, THE Transaction_List SHALL menyediakan scroll vertikal untuk mengakses semua item.
3. WHEN pengguna mengklik tombol hapus pada sebuah transaksi, THE App SHALL menghapus transaksi tersebut dari Transaction_List dan dari Storage.
4. WHEN sebuah transaksi dihapus, THE Transaction_List SHALL memperbarui tampilan dalam waktu ≤ 500ms tanpa reload halaman.
5. WHEN App pertama kali dimuat, THE Transaction_List SHALL memuat dan menampilkan semua transaksi yang tersimpan di Storage.
6. IF operasi penghapusan ke Storage gagal, THEN THE App SHALL mempertahankan tampilan transaksi yang ada dan menampilkan pesan kesalahan kepada pengguna.
7. IF Storage mengembalikan data kosong atau format tidak valid saat App dimuat, THEN THE Transaction_List SHALL ditampilkan dalam kondisi kosong tanpa error yang terlihat oleh pengguna.

---

### Requirement 3: Total Balance

**User Story:** Sebagai pengguna, saya ingin melihat total keseluruhan pengeluaran saya yang selalu terkini, agar saya dapat memantau total anggaran yang telah terpakai.

#### Acceptance Criteria

1. THE Balance_Display SHALL menampilkan total kumulatif dari seluruh nilai amount transaksi yang ada di Transaction_List, dibulatkan ke 2 angka desimal.
2. WHEN sebuah transaksi baru ditambahkan, THE Balance_Display SHALL memperbarui nilai total secara otomatis dalam waktu ≤ 500ms tanpa membutuhkan aksi tambahan dari pengguna.
3. WHEN sebuah transaksi dihapus, THE Balance_Display SHALL memperbarui nilai total secara otomatis dalam waktu ≤ 500ms untuk mencerminkan sisa transaksi.
4. WHEN Transaction_List tidak mengandung transaksi apapun, THE Balance_Display SHALL menampilkan nilai 0.00.
5. THE Balance_Display SHALL ditempatkan di bagian atas halaman agar selalu terlihat oleh pengguna tanpa perlu scroll.

---

### Requirement 4: Visualisasi Pie Chart

**User Story:** Sebagai pengguna, saya ingin melihat distribusi pengeluaran saya berdasarkan kategori dalam bentuk pie chart, agar saya dapat memahami pola pengeluaran secara visual.

#### Acceptance Criteria

1. THE Chart SHALL menampilkan distribusi pengeluaran berdasarkan tiga kategori: Food, Transport, dan Fun; setiap slice merepresentasikan persentase total amount kategori tersebut terhadap total keseluruhan, dibulatkan ke 1 angka desimal.
2. WHEN sebuah transaksi baru ditambahkan, THE Chart SHALL memperbarui tampilan secara otomatis dalam waktu ≤ 500ms untuk mencerminkan perubahan distribusi pengeluaran.
3. WHEN sebuah transaksi dihapus, THE Chart SHALL memperbarui tampilan secara otomatis dalam waktu ≤ 500ms untuk mencerminkan distribusi yang baru.
4. WHEN Transaction_List kosong, THE Chart SHALL menampilkan teks placeholder "Belum ada data pengeluaran" sebagai pengganti chart.
5. THE Chart SHALL menggunakan warna yang berbeda secara perseptual (minimum contrast ratio 3:1 antar warna) untuk setiap kategori agar distribusi mudah dibedakan secara visual.
6. IF jumlah amount sebuah kategori adalah nol, THEN THE Chart SHALL tidak menampilkan slice untuk kategori tersebut.
7. WHERE Chart.js tersedia, THE App SHALL menggunakan Chart.js untuk merender pie chart; IF Chart.js tidak tersedia, THEN THE App SHALL tetap menjalankan semua fitur lainnya tanpa menampilkan visualisasi chart.

---

### Requirement 5: Persistensi Data

**User Story:** Sebagai pengguna, saya ingin data transaksi saya tetap tersimpan setelah menutup dan membuka kembali browser, agar saya tidak kehilangan riwayat pengeluaran saya.

#### Acceptance Criteria

1. WHEN sebuah transaksi baru ditambahkan, THE Storage SHALL menyimpan transaksi tersebut ke browser Local Storage — mencakup ID unik, jumlah (amount), nama item, kategori, dan tanggal — sebelum kontrol dikembalikan ke pengguna.
2. WHEN sebuah transaksi dihapus, THE Storage SHALL menghapus data transaksi yang diidentifikasi berdasarkan ID uniknya dari browser Local Storage sebelum kontrol dikembalikan ke pengguna.
3. WHEN App dimuat ulang atau browser dibuka kembali, THE App SHALL memuat semua data dari Storage dan menampilkannya di Transaction_List, Balance_Display, dan Chart.
4. THE Storage SHALL menyimpan data transaksi dalam format JSON sedemikian rupa sehingga setelah serialize dan parse kembali, seluruh field (ID unik, jumlah, nama item, kategori, tanggal) memiliki nilai dan tipe data yang identik.
5. IF Storage mengalami kegagalan saat membaca data (data korup atau format tidak valid), THEN THE App SHALL menginisialisasi dengan daftar transaksi kosong; IF inisialisasi tersebut juga gagal, THEN THE App SHALL menampilkan pesan notifikasi kesalahan kepada pengguna.
6. IF operasi penyimpanan ke Local Storage gagal karena storage penuh (QuotaExceededError), THEN THE App SHALL membatalkan operasi penambahan transaksi, mempertahankan data yang sudah ada, dan menampilkan pesan kesalahan kepada pengguna.

---

### Requirement 6: Kompatibilitas Browser & Performa

**User Story:** Sebagai pengguna, saya ingin aplikasi berjalan dengan lancar di browser modern apapun yang saya gunakan, agar saya tidak mengalami kendala teknis saat menggunakannya.

#### Acceptance Criteria

1. THE App SHALL dapat berjalan pada Chrome, Firefox, Edge, dan Safari versi stabil terbaru yang dirilis dalam 12 bulan terakhir tanpa memerlukan plugin atau dependensi tambahan.
2. WHEN pengguna menambahkan atau menghapus transaksi, THE App SHALL memperbarui Transaction_List, Balance_Display, dan Chart dalam waktu kurang dari 100 milidetik.
3. THE App SHALL dapat dijalankan sebagai standalone web page atau sebagai browser extension menggunakan artifact build yang sama tanpa perubahan pada source code.
4. WHEN halaman pertama kali dimuat di lingkungan localhost tanpa throttling jaringan, THE App SHALL selesai merender antarmuka awal dalam waktu kurang dari 2 detik.
