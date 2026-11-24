/**
 * ============================================================================
 * E-TELLER BANK MINI SEKOLAH - CORE FRONTEND JAVASCRIPT ENGINE
 * SMK NEGERI 1 BANTUL - UJI KOMPETENSI KEAHLIAN RPL
 * ============================================================================
 * PANDUAN PENCARIAN KODE CEPAT (Tekan Ctrl + F lalu ketik kata kunci):
 * ----------------------------------------------------------------------------
 * 1.  FITUR_AUTH_CLIENT              : Manajemen Token Sanctum & apiCall()
 * 2.  FITUR_HELPER_FORMATTER         : Format Rupiah & Tanggal
 * 3.  FITUR_ROUTER_NAVIGASI          : Router & Penentuan Tampilan Role
 * 4.  FITUR_VIEW_PUBLIC_PROFILE      : View Profil Publik QR Nasabah (/profil)
 * 5.  FITUR_VIEW_LANDING_PAGE        : View Halaman Depan / Beranda Bank Mini
 * 6.  FITUR_VIEW_LOGIN               : View Form Login & Dialog Pemulihan
 * 7.  FITUR_HANDLE_LOGIN             : Handler Submit Login Pengguna
 * 8.  FITUR_LUPA_PASSWORD_PIN_OTP    : Handler Reset Password & PIN via OTP Email
 * 9.  FITUR_LOGOUT                   : Handler Keluar / Selesai Sesi
 * 10. FITUR_ADMIN_LAYOUT             : View Portal Master Data Administrator
 * 11. FITUR_DATA_SAVER               : Kelola Data Saver, Status Aktif & Soft Delete
 * 12. FITUR_DATA_MEMBER_IMPORT       : Kelola Member, Upload Excel & Naik Kelas
 * 13. FITUR_KELOLA_STAF              : Kelola Pengguna Staf (Teller & Supervisor)
 * 14. FITUR_KARTU_DIGITAL_QR         : Preview Kartu Siswa & Download File QR
 * 15. FITUR_TELLER_LAYOUT            : View Utama Loket Kas Piket Teller
 * 16. FITUR_TELLER_NAVIGASI          : State Loket, Modal Awal, & Tab Teller
 * 17. FITUR_TELLER_CARI_NASABAH      : Pencarian Cepat Member & Nasabah Saver
 * 18. FITUR_TELLER_SCAN_QR_KAMERA    : Pemindai Kamera Webcam & Upload Gambar QR
 * 19. FITUR_TELLER_PROFIL_NASABAH    : Kartu Info Saldo & Batas Tarik di Loket
 * 20. FITUR_TELLER_TRANSAKSI_SETOR_TARIK : Eksekusi Setor Tunai & Tarik Tunai
 * 21. FITUR_TELLER_CLOSING_KAS       : Rekonsiliasi & Submit Penutupan Kas Harian
 * 22. FITUR_TELLER_CETAK_STRUK       : Struk Transaksi & Format Cetak Termal
 * 23. FITUR_SUPERVISOR_LAYOUT        : View Portal Pengawas Bank Mini
 * 24. FITUR_SUPERVISOR_NAVIGASI      : Navigasi Tab Approval, Audit & Laporan
 * 25. FITUR_SUPERVISOR_LAPORAN       : Laporan Rekap Mutasi Setor & Tarik
 * 26. FITUR_SUPERVISOR_APPROVAL_REJEKSI_KAS : Approval Kas & Download PDF
 * 27. FITUR_SUPERVISOR_AUDIT_JURNAL  : Audit Buku Besar Jurnal (101 vs 201)
 * 28. FITUR_NASABAH_LAYOUT           : View Portal Buku Tabungan Digital (E-Passbook)
 * 29. FITUR_NASABAH_MUTASI_PORTAL    : Riwayat Mutasi 30 Hari & Cetak Buku Siswa
 * 30. FITUR_NASABAH_GANTI_PASSWORD_PIN: Form Ubah Password & PIN Mandiri Siswa
 * 31. FITUR_INIT_APLIKASI            : Inisialisasi DOM Ready & Boot Router
 * ============================================================================
 */

const API_BASE = '/api';
let spvLaporanNasabahList = [];

// ============================================================================
// [FITUR 01] MANAJEMEN SESI & CLIENT API
// - Deskripsi : Mengatur penyimpanan token Sanctum, data login user di localStorage,
//               serta fungsi apiCall() untuk komunikasi HTTP ke backend Laravel.
// - Cari Cepat: FITUR_AUTH_CLIENT
// ============================================================================
const Auth = {
    getToken: () => localStorage.getItem('bm_token'),
    getRole: () => localStorage.getItem('bm_role'),
    getUser: () => {
        const u = localStorage.getItem('bm_user');
        return u ? JSON.parse(u) : null;
    },
    setSession: (token, role, user) => {
        localStorage.setItem('bm_token', token);
        localStorage.setItem('bm_role', role);
        localStorage.setItem('bm_user', JSON.stringify(user));
    },
    clearSession: () => {
        localStorage.removeItem('bm_token');
        localStorage.removeItem('bm_role');
        localStorage.removeItem('bm_user');
    },
    isLoggedIn: () => !!localStorage.getItem('bm_token')
};

// ----------------------------------------------------------------------------
// 2. UNIVERSAL FETCH API CLIENT
// ----------------------------------------------------------------------------
async function apiCall(endpoint, method = 'GET', data = null) {
    const headers = {
        'Accept': 'application/json'
    };
    const isFormData = data instanceof FormData;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const token = Auth.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { method, headers };
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = isFormData ? data : JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const result = await response.json();

        const isPublicAuthEndpoint = /^\/auth\/(?:login|login-user|login-nasabah|forgot-credential|verify-credential-reset-otp|reset-credential)$/.test(endpoint);
        if (response.status === 401 && token && !isPublicAuthEndpoint) {
            Swal.fire({
                icon: 'warning',
                title: 'Sesi Berakhir',
                text: 'Sesi login Anda telah kedaluwarsa. Silakan masuk kembali.',
                confirmButtonColor: '#138f9c'
            }).then(() => {
                Auth.clearSession();
                Router.render();
            });
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            throw result;
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================================================
// [FITUR 02] FORMATTER & HELPER
// - Deskripsi : Fungsi bantuan format mata uang Rupiah (IDR) dan format tanggal/waktu.
// - Cari Cepat: FITUR_HELPER_FORMATTER
// ============================================================================
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================================================
// [FITUR 03] ROUTER & NAVIGASI ROLE
// - Deskripsi : Mengatur penentuan halaman berdasarkan status login dan role
//               (Teller, Admin/Supervisor, Nasabah, Landing Page, Profil Publik).
// - Cari Cepat: FITUR_ROUTER_NAVIGASI
// ============================================================================
const Router = {
    render: () => {
        const app = document.getElementById('app');
        const publicProfileMatch = window.location.pathname.match(/^\/profil\/([^/]+)\/?$/);
        if (publicProfileMatch) {
            app.innerHTML = Views.PublicProfileLoading();
            initPublicProfile(decodeURIComponent(publicProfileMatch[1]));
            return;
        }

        if (!Auth.isLoggedIn()) {
            if (window.location.pathname === '/') {
                app.innerHTML = Views.PublicLanding();
                return;
            }

            app.innerHTML = Views.Login();
            const loginForm = document.getElementById('form-login');
            loginForm.reset();
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            return;
        }

        const role = Auth.getRole();
        switch (role) {
            case 'teller':
                renderTellerPage(app);
                break;
            case 'admin':
            case 'supervisor':
                app.innerHTML = Views.SupervisorLayout();
                initSupervisorEvents();
                break;
            case 'nasabah':
                app.innerHTML = Views.NasabahLayout();
                initNasabahEvents();
                break;
            default:
                Auth.clearSession();
                Router.render();
        }
    }
};

async function renderTellerPage(app) {
    app.innerHTML = Views.TellerLayout();
    initTellerEvents();
}

function memberImportPanel() {
    return `
        <div class="flex flex-col items-start gap-2 sm:items-end">
            <div class="flex flex-wrap items-center gap-2">
                <input id="member-import-file" type="file" accept=".xlsx,.csv"
                    class="max-w-[220px] text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-bold file:text-emerald-700">
                <button type="button" onclick="importMembersExcel(this)" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition">
                    <i class="fa-solid fa-file-arrow-up"></i> Upload Excel
                </button>
            </div>
            <button onclick="downloadMemberImportTemplate()" class="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline">
                Unduh template Excel/CSV
            </button>
            <div class="flex flex-wrap justify-end gap-2">
                <button type="button" onclick="promoteMembersByGraduationYear()" class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">
                    <i class="fa-solid fa-arrow-up mr-1"></i> Naik Kelas
                </button>
                <button type="button" onclick="reclassifyMember()" class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100">
                    <i class="fa-solid fa-user-pen mr-1"></i> Tidak Naik Kelas
                </button>
            </div>
            <p class="max-w-xl text-right text-[10px] text-slate-500">
                Kolom: nis, nama_siswa, kelas (opsional), angkatan_keluar, nomor_hp, gender.
                Gender wajib diisi: Laki-laki/Perempuan, L/P, atau Pria/Wanita. NIS sebaiknya diformat sebagai teks.
                Tidak ada batas minimum atau maksimum jumlah siswa per upload. Baris data yang diisi tetap harus valid.
            </p>
        </div>
    `;
}

// ============================================================================
// [FITUR 04] VIEW: PROFIL PUBLIK NASABAH (Scan QR dari Luar)
// - Deskripsi : Halaman baca-saja profil nasabah saat QR code dipindai oleh umum/siswa
//               melalui URL /profil/{no_rekening}.
// - Cari Cepat: FITUR_VIEW_PUBLIC_PROFILE
// ============================================================================
const Views = {
    TellerLoading: () => `
        <main class="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
                <i class="fa-solid fa-spinner fa-spin text-3xl text-teal-600 mb-3"></i>
                <p class="text-sm font-semibold text-slate-600">Memeriksa modal awal kas...</p>
            </div>
        </main>
    `,

    TellerModalAwalError: () => `
        <main class="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div class="w-full max-w-md bg-white rounded-2xl border border-amber-200 shadow-xl p-8 text-center">
                <i class="fa-solid fa-triangle-exclamation text-3xl text-amber-500 mb-3"></i>
                <h1 class="font-bold text-slate-800">Status modal awal belum dapat diperiksa</h1>
                <p class="text-sm text-slate-500 mt-2">Pastikan koneksi server tersedia, lalu coba periksa kembali.</p>
                <button onclick="Router.render()" class="mt-5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg">Coba Lagi</button>
                <button onclick="handleLogout()" class="block w-full mt-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600">Keluar dari akun</button>
            </div>
        </main>
    `,

    PublicProfileLoading: () => `
        <main class="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
                <i class="fa-solid fa-spinner fa-spin text-3xl text-teal-600 mb-3"></i>
                <p class="text-sm font-semibold text-slate-600">Memuat profil nasabah...</p>
            </div>
        </main>
    `,

    PublicProfile: (data) => `
        <main class="min-h-screen bg-gradient-to-br from-teal-300 via-cyan-400 to-sky-300 p-4 sm:p-8">
            <section class="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
                <header class="bg-gradient-to-r from-teal-600 to-cyan-700 p-6 text-white">
                    <div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-white flex items-center justify-center"><img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="w-10 h-10 object-contain"></div><div><p class="text-[10px] uppercase tracking-widest text-emerald-100 font-bold">Bank Mini Sekolah</p><h1 class="text-xl font-extrabold">Profil Nasabah</h1></div></div>
                </header>
                <div class="p-6 space-y-5">
                    <div class="flex items-center gap-4 border-b border-slate-100 pb-5"><div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold text-2xl">${data.nama_siswa.charAt(0)}</div><div><h2 class="text-lg font-extrabold text-slate-800">${data.nama_siswa}</h2><p class="text-sm text-slate-500">${data.kelas}</p><span class="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-700 uppercase"><i class="fa-solid fa-circle-check"></i> ${data.status || 'Aktif'}</span></div></div>
                    <dl class="grid grid-cols-2 gap-3 text-sm"><div class="bg-slate-50 border border-slate-200 rounded-xl p-3"><dt class="text-[10px] uppercase font-bold text-slate-400">No. Rekening</dt><dd class="font-mono font-bold text-slate-700 mt-1">${data.no_rekening}</dd></div><div class="bg-slate-50 border border-slate-200 rounded-xl p-3"><dt class="text-[10px] uppercase font-bold text-slate-400">NIS</dt><dd class="font-mono font-bold text-slate-700 mt-1">${data.nis}</dd></div><div class="col-span-2 bg-emerald-50 border border-emerald-100 rounded-xl p-4"><dt class="text-[10px] uppercase font-bold text-emerald-700">Saldo Berjalan</dt><dd class="font-mono font-extrabold text-emerald-800 text-xl mt-1">${formatRupiah(data.saldo ?? data.saldo_berjalan ?? 0)}</dd></div></dl>
                    <p class="text-center text-xs text-slate-400">Profil ini ditampilkan dari QR resmi Bank Mini Sekolah.</p>
                </div>
            </section>
        </main>
    `,

    PublicProfileError: (message) => `<main class="min-h-screen flex items-center justify-center bg-slate-100 p-4"><div class="w-full max-w-md bg-white rounded-2xl border border-red-200 shadow-xl p-8 text-center"><i class="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-3"></i><h1 class="font-bold text-slate-800">Profil tidak ditemukan</h1><p class="text-sm text-slate-500 mt-2">${message}</p></div></main>`,

    // ========================================================================
    // [FITUR 05] VIEW: LANDING PAGE PUBLIK (Beranda Bank Mini)
    // - Deskripsi : Halaman beranda utama dengan Hero Section, Tentang,
    //               Keunggulan 01-04, Alur Transaksi 1-4, Layanan Tabungan,
    //               Jadwal Loket, FAQ, dan Footer resmi SMK Negeri 1 Bantul.
    // - Cari Cepat: FITUR_VIEW_LANDING_PAGE
    // ========================================================================
    PublicLanding: () => `
        <div class="min-h-screen bg-slate-50 flex flex-col">
            <!-- STICKY TOP NAVBAR -->
            <header class="sticky top-0 z-50 border-b border-emerald-100/70 bg-white/95 backdrop-blur-md shadow-xs">
                <div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <a href="/" class="flex items-center gap-2.5 group">
                        <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="h-10 w-10 rounded-xl border border-emerald-100 bg-white object-contain p-1 shadow-xs transition group-hover:scale-105">
                        <div class="text-left">
                            <p class="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700">Bank Mini Sekolah</p>
                            <p class="text-xs font-extrabold text-slate-800">SMK Negeri 1 Bantul</p>
                        </div>
                    </a>

                    <nav class="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-600">
                        <a href="#tentang" class="transition hover:text-emerald-700">Tentang</a>
                        <a href="#keunggulan" class="transition hover:text-emerald-700">Keunggulan</a>
                        <a href="#alur" class="transition hover:text-emerald-700">Alur Menabung</a>
                        <a href="#layanan" class="transition hover:text-emerald-700">Layanan</a>
                        <a href="#jadwal" class="transition hover:text-emerald-700">Jadwal Loket</a>
                        <a href="#faq" class="transition hover:text-emerald-700">FAQ</a>
                    </nav>

                    <a href="/login" class="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-emerald-900/10 transition hover:bg-emerald-800 sm:text-sm">
                        Login
                    </a>
                </div>
            </header>

            <main class="flex-1">
                <!-- HERO SECTION -->
                <section class="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-slate-50 px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:px-8 lg:pb-24">
                    <div class="mx-auto max-w-4xl text-center">
                        <h1 class="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                            Belajar mengelola uang dengan <span class="text-emerald-700">lebih mudah.</span>
                        </h1>
                        <p class="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                            Bank Mini Sekolah membantu siswa mengenal kebiasaan menabung dan menghadirkan pengelolaan transaksi sekolah yang tercatat, tertib, dan transparan.
                        </p>
                        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <a href="/login" class="inline-flex items-center rounded-xl bg-emerald-700 px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 hover:shadow-xl">
                                Login
                            </a>
                            <a href="#tentang" class="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-5 py-3.5 text-xs font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-50">
                                Kenali Bank Mini
                            </a>
                            <a href="#alur" class="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-5 py-3.5 text-xs font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-50">
                                Cara Bertransaksi
                            </a>
                        </div>
                    </div>
                </section>

                <!-- SECTION 1: TENTANG & KEUNGGULAN -->
                <section id="tentang" class="border-y border-emerald-100 bg-white py-16 sm:py-20">
                    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div class="mx-auto max-w-2xl text-center">
                            <p class="text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700">Tentang Layanan</p>
                            <h2 class="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Apa itu Bank Mini Sekolah?</h2>
                            <p class="mt-4 text-sm leading-7 text-slate-600">
                                Bank Mini adalah layanan tabungan dan sarana edukasi keuangan di lingkungan sekolah. Siswa maupun guru dapat menabung dengan aman, sementara petugas mengelola setoran, penarikan, dan pencatatan kas melalui sistem yang terintegrasi secara profesional.
                            </p>
                        </div>

                        <div id="keunggulan" class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <article class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 transition hover:shadow-md hover:bg-emerald-50/80">
                                <span class="text-xs font-black text-emerald-600">01</span>
                                <h3 class="mt-2 text-sm font-extrabold text-slate-800">Biasakan Menabung</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Membantu membangun kebiasaan menyisihkan uang saku sejak dini untuk masa depan pendidikan.</p>
                            </article>
                            <article class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 transition hover:shadow-md hover:bg-emerald-50/80">
                                <span class="text-xs font-black text-emerald-600">02</span>
                                <h3 class="mt-2 text-sm font-extrabold text-slate-800">Transaksi Tercatat</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Setiap setoran dan penarikan tercatat ke buku kas digital dan disertai bukti struk fisik resmi.</p>
                            </article>
                            <article class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 transition hover:shadow-md hover:bg-emerald-50/80">
                                <span class="text-xs font-black text-emerald-600">03</span>
                                <h3 class="mt-2 text-sm font-extrabold text-slate-800">Kas Lebih Terpantau</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Membantu petugas memantau saldo, jurnal, penutupan kas loket, dan audit pembukuan sekolah.</p>
                            </article>
                            <article class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 transition hover:shadow-md hover:bg-emerald-50/80">
                                <span class="text-xs font-black text-emerald-600">04</span>
                                <h3 class="mt-2 text-sm font-extrabold text-slate-800">Akses Praktis & Cepat</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Dukungan pemindaian kartu QR nasabah membuat proses antrean di loket berjalan efisien.</p>
                            </article>
                        </div>
                    </div>
                </section>

                <!-- SECTION 2: ALUR MENABUNG -->
                <section id="alur" class="bg-slate-50/60 py-16 sm:py-20">
                    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div class="mx-auto max-w-2xl text-center">
                            <p class="text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700">Panduan Bertransaksi</p>
                            <h2 class="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Alur Menabung Mudah & Terstruktur</h2>
                            <p class="mt-4 text-sm leading-7 text-slate-600">
                                4 langkah sederhana bagi siswa dan guru untuk mulai menabung dan bertransaksi di Bank Mini Sekolah.
                            </p>
                        </div>

                        <div class="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                            <div class="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-sm font-black text-emerald-800">1</span>
                                <h3 class="mt-5 text-sm font-extrabold text-slate-800">Buka Rekening</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Siswa didaftarkan oleh administrator dan menerima nomor rekening tabungan serta akun portal.</p>
                            </div>

                            <div class="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-sm font-black text-emerald-800">2</span>
                                <h3 class="mt-5 text-sm font-extrabold text-slate-800">Kunjungi Loket</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Datangi ruang loket Bank Mini pada jam operasional dengan membawa uang setoran atau kartu nasabah.</p>
                            </div>

                            <div class="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-sm font-black text-emerald-800">3</span>
                                <h3 class="mt-5 text-sm font-extrabold text-slate-800">Proses di Loket</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Teller memproses setoran tunai atau penarikan dana dengan verifikasi keamanan PIN 6-digit.</p>
                            </div>

                            <div class="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-sm font-black text-emerald-800">4</span>
                                <h3 class="mt-5 text-sm font-extrabold text-slate-800">Struk & Pantau Saldo</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Terima bukti struk transaksi fisik dan pantau saldo berkala melalui portal siswa secara mandiri.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- SECTION 3: LAYANAN UTAMA -->
                <section id="layanan" class="border-y border-emerald-100 bg-white py-16 sm:py-20">
                    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div class="mx-auto max-w-2xl text-center">
                            <p class="text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700">Fitur & Layanan</p>
                            <h2 class="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Layanan Keuangan Sekolah Terpadu</h2>
                            <p class="mt-4 text-sm leading-7 text-slate-600">
                                Sistem E-Teller dilengkapi fitur terintegrasi yang menjamin ketertiban dan akurasi kas loket harian.
                            </p>
                        </div>

                        <div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <div class="rounded-2xl border border-slate-200 bg-slate-50/40 p-6 transition hover:border-emerald-300 hover:bg-white hover:shadow-xs">
                                <span class="inline-block rounded-lg bg-emerald-100/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">Simpanan</span>
                                <h3 class="mt-3 text-sm font-extrabold text-slate-900">Tabungan Siswa & Guru</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Simpanan aman tanpa potongan administrasi bulanan, dirancang mendukung literasi keuangan sekolah.</p>
                            </div>

                            <div class="rounded-2xl border border-slate-200 bg-slate-50/40 p-6 transition hover:border-emerald-300 hover:bg-white hover:shadow-xs">
                                <span class="inline-block rounded-lg bg-emerald-100/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">Operasional</span>
                                <h3 class="mt-3 text-sm font-extrabold text-slate-900">Loket Teller Digital</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Layanan setoran dan penarikan instan dengan validasi saldo otomatis dan deteksi status kas loket.</p>
                            </div>

                            <div class="rounded-2xl border border-slate-200 bg-slate-50/40 p-6 transition hover:border-emerald-300 hover:bg-white hover:shadow-xs">
                                <span class="inline-block rounded-lg bg-emerald-100/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">Keamanan</span>
                                <h3 class="mt-3 text-sm font-extrabold text-slate-900">PIN Keamanan 6-Digit</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Setiap penarikan dana wajib mengonfirmasi kode PIN pemilik rekening untuk perlindungan maksimal.</p>
                            </div>

                            <div class="rounded-2xl border border-slate-200 bg-slate-50/40 p-6 transition hover:border-emerald-300 hover:bg-white hover:shadow-xs">
                                <span class="inline-block rounded-lg bg-emerald-100/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">Bukti Sah</span>
                                <h3 class="mt-3 text-sm font-extrabold text-slate-900">Pencetakan Struk Otomatis</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Bukti struk tercetak dengan nomor referensi unik, kode transaksi, waktu, serta saldo terakhir nasabah.</p>
                            </div>

                            <div class="rounded-2xl border border-slate-200 bg-slate-50/40 p-6 transition hover:border-emerald-300 hover:bg-white hover:shadow-xs">
                                <span class="inline-block rounded-lg bg-emerald-100/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">Audit & Kas</span>
                                <h3 class="mt-3 text-sm font-extrabold text-slate-900">Tutup Kas & Review Supervisor</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Validasi uang fisik loket versus pencatatan sistem di akhir hari dengan otorisasi pengawasan ketat.</p>
                            </div>

                            <div class="rounded-2xl border border-slate-200 bg-slate-50/40 p-6 transition hover:border-emerald-300 hover:bg-white hover:shadow-xs">
                                <span class="inline-block rounded-lg bg-emerald-100/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">Akses Mandiri</span>
                                <h3 class="mt-3 text-sm font-extrabold text-slate-900">Portal Nasabah Mandiri</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Siswa dapat masuk ke sistem untuk melihat saldo tabungan, mutasi 30 hari, serta kartu QR rekening.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- SECTION 4: JADWAL & LOKASI -->
                <section id="jadwal" class="bg-slate-50/60 py-16 sm:py-20">
                    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div class="mx-auto max-w-2xl text-center">
                            <p class="text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700">Informasi Operasional</p>
                            <h2 class="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Jadwal & Lokasi Layanan Loket</h2>
                            <p class="mt-4 text-sm leading-7 text-slate-600">
                                Kunjungi loket Bank Mini di sekolah pada waktu layanan untuk setoran atau penarikan saldo.
                            </p>
                        </div>

                        <div class="mt-12 grid gap-6 lg:grid-cols-2">
                            <!-- Card Jam Layanan -->
                            <div class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
                                <h3 class="text-base font-extrabold text-slate-900">Jam Operasional Loket</h3>
                                <p class="text-xs text-slate-500">Waktu pelayanan transaksi tunai</p>
                                <ul class="mt-6 space-y-3 text-xs">
                                    <li class="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                                        <span class="font-bold text-slate-700">Hari Layanan</span>
                                        <span class="font-extrabold text-emerald-700">Senin – Jumat</span>
                                    </li>
                                    <li class="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                                        <span class="font-bold text-slate-700">Sesi Pagi</span>
                                        <span class="font-semibold text-slate-800">08.00 – 11.30 WIB</span>
                                    </li>
                                    <li class="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                                        <span class="font-bold text-slate-700">Istirahat & Sholat</span>
                                        <span class="font-semibold text-amber-700">11.30 – 12.45 WIB</span>
                                    </li>
                                    <li class="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                                        <span class="font-bold text-slate-700">Sesi Siang</span>
                                        <span class="font-semibold text-slate-800">12.45 – 14.30 WIB</span>
                                    </li>
                                    <li class="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                                        <span class="font-bold text-slate-700">Sabtu, Minggu & Hari Libur</span>
                                        <span class="font-bold text-slate-400">Tutup</span>
                                    </li>
                                </ul>
                            </div>

                            <!-- Card Lokasi & Petugas -->
                            <div class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
                                <h3 class="text-base font-extrabold text-slate-900">Lokasi & Pengelola</h3>
                                <p class="text-xs text-slate-500">Informasi ruang praktik dan pendampingan</p>
                                <div class="mt-6 space-y-4 text-xs leading-6 text-slate-600">
                                    <div class="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                                        <p class="font-bold text-emerald-900">Ruang Praktik Bank Mini Sekolah</p>
                                        <p class="mt-1 text-slate-600">Gedung Kejuruan Lantai 1, SMK Negeri 1 Bantul. Bersebelahan dengan Laboratorium Komputer Akuntansi.</p>
                                    </div>
                                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                        <p class="font-bold text-slate-800">Petugas Loket (Piket Teller)</p>
                                        <p class="mt-1 text-slate-600">Dikelola oleh siswa praktikan program keahlian Akuntansi dan Rekayasa Perangkat Lunak (RPL) dengan bimbingan Guru Kejuruan.</p>
                                    </div>
                                    <p class="text-[11px] text-slate-500 italic">
                                        Tips: Siapkan kartu identitas/QR nasabah dan uang pas agar pelayanan di loket lebih cepat.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- SECTION 5: FAQ -->
                <section id="faq" class="border-y border-emerald-100 bg-white py-16 sm:py-20">
                    <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                        <div class="mx-auto max-w-2xl text-center">
                            <p class="text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700">Tanya Jawab</p>
                            <h2 class="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Pertanyaan yang Sering Diajukan</h2>
                            <p class="mt-4 text-sm leading-7 text-slate-600">
                                Temukan jawaban atas pertanyaan umum terkait pembukaan rekening dan layanan tabungan.
                            </p>
                        </div>

                        <div class="mt-12 space-y-4">
                            <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition hover:bg-white hover:shadow-xs">
                                <h3 class="text-sm font-extrabold text-slate-900">
                                    Berapa batas minimal setoran menabung di Bank Mini?
                                </h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">
                                    Sangat terjangkau! Minimal setoran tabungan adalah Rp 5.000. Siswa bebas menyisihkan uang sakunya kapan pun saat loket buka.
                                </p>
                            </div>

                            <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition hover:bg-white hover:shadow-xs">
                                <h3 class="text-sm font-extrabold text-slate-900">
                                    Apakah ada potongan biaya administrasi bulanan?
                                </h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">
                                    Tidak ada sama sekali. Tabungan di Bank Mini Sekolah bebas biaya administrasi bulanan, sehingga saldo tabungan Anda tetap utuh.
                                </p>
                            </div>

                            <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition hover:bg-white hover:shadow-xs">
                                <h3 class="text-sm font-extrabold text-slate-900">
                                    Bagaimana jika nasabah lupa PIN penarikan atau kata sandi?
                                </h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">
                                    Siswa dapat mendatangi loket atau menemui petugas Administrator di sekolah dengan menunjukkan kartu pelajar/identitas siswa yang sah untuk memulihkan atau mereset PIN transaksi.
                                </p>
                            </div>

                            <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition hover:bg-white hover:shadow-xs">
                                <h3 class="text-sm font-extrabold text-slate-900">
                                    Bagaimana cara memantau mutasi dan saldo tabungan?
                                </h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">
                                    Klik tombol "Login" pada website ini, lalu masukkan username dan kata sandi Anda. Anda dapat melihat saldo terkini dan riwayat transaksi 30 hari terakhir kapan saja.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- SECTION 6: CTA BANNER -->
                <section class="bg-gradient-to-br from-emerald-800 via-teal-800 to-green-900 px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
                    <div class="mx-auto max-w-4xl text-center">
                        <h2 class="text-3xl font-black tracking-tight sm:text-4xl">Siap Mulai Mengelola Tabungan Sekolah?</h2>
                        <p class="mx-auto mt-4 max-w-xl text-xs sm:text-sm leading-6 text-emerald-100">
                            Masuk ke sistem E-Teller Bank Mini sekarang untuk memeriksa saldo tabungan, melayani transaksi loket harian, atau mencetak laporan kas.
                        </p>
                        <div class="mt-8">
                            <a href="/login" class="inline-flex items-center rounded-xl bg-white px-8 py-3.5 text-sm font-extrabold text-emerald-800 shadow-xl transition hover:bg-emerald-50 hover:scale-105">
                                Masuk ke Sistem (Login)
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <!-- FOOTER -->
            <footer class="border-t border-slate-200 bg-white text-slate-600">
                <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                    <div class="grid gap-8 md:grid-cols-3">
                        <div>
                            <div class="flex items-center gap-2.5">
                                <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="h-10 w-10 rounded-xl border border-emerald-100 bg-white object-contain p-1">
                                <div>
                                    <p class="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700">Bank Mini Sekolah</p>
                                    <p class="text-xs font-extrabold text-slate-800">SMK Negeri 1 Bantul</p>
                                </div>
                            </div>
                            <p class="mt-4 text-xs leading-6 text-slate-500">
                                Sistem Informasi E-Teller dan Akuntansi Kas Loket Bank Mini Sekolah. Dirancang untuk mengawal integritas transaksi, transparansi keuangan, dan literasi perbankan siswa.
                            </p>
                        </div>

                        <div>
                            <h4 class="text-xs font-black uppercase tracking-wider text-slate-900">Tautan Cepat</h4>
                            <ul class="mt-4 space-y-2 text-xs">
                                <li><a href="#tentang" class="hover:text-emerald-700 transition">Tentang Bank Mini</a></li>
                                <li><a href="#keunggulan" class="hover:text-emerald-700 transition">Keunggulan Layanan</a></li>
                                <li><a href="#alur" class="hover:text-emerald-700 transition">Alur Menabung</a></li>
                                <li><a href="#layanan" class="hover:text-emerald-700 transition">Fitur & Layanan</a></li>
                                <li><a href="#jadwal" class="hover:text-emerald-700 transition">Jadwal Operasional</a></li>
                                <li><a href="#faq" class="hover:text-emerald-700 transition">Pertanyaan Umum (FAQ)</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 class="text-xs font-black uppercase tracking-wider text-slate-900">Kontak & Lokasi</h4>
                            <ul class="mt-4 space-y-2.5 text-xs text-slate-500 leading-5">
                                <li><strong class="text-slate-700">Sekolah:</strong> SMK Negeri 1 Bantul</li>
                                <li><strong class="text-slate-700">Alamat:</strong> Jl. Bantul No. 99, D.I. Yogyakarta</li>
                                <li><strong class="text-slate-700">Lokasi Loket:</strong> Gedung Praktik Akuntansi (Lantai 1)</li>
                                <li><strong class="text-slate-700">Hari Layanan:</strong> Senin – Jumat: 08.00 – 14.30 WIB</li>
                            </ul>
                        </div>
                    </div>

                    <div class="mt-10 border-t border-slate-100 pt-6 text-center text-[11px] text-slate-400">
                        Uji Kompetensi Keahlian RPL &copy; 2026 Bank Mini Sekolah SMK Negeri 1 Bantul. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    `,

    // ========================================================================
    // [FITUR 06] VIEW: FORM LOGIN TERPADU & MODAL PEMULIHAN
    // - Deskripsi : Form login terintegrasi untuk seluruh role (Teller, Spv, Admin, Nasabah)
    //               serta modal reset password & reset PIN dengan OTP via email.
    // - Cari Cepat: FITUR_VIEW_LOGIN
    // ========================================================================
    Login: () => `
        <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-300 via-cyan-400 to-sky-300 p-4 sm:p-6">
            <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-emerald-100">
                <div class="px-6 pt-5">
                    <a href="/" class="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-900">
                        <i class="fa-solid fa-arrow-left"></i> Kembali ke beranda
                    </a>
                </div>
                <div class="bg-gradient-to-r from-teal-600 to-cyan-700 p-6 text-white text-center">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-3 border border-white/20">
                        <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="w-14 h-14 object-contain">
                    </div>
                    <h1 class="text-2xl font-extrabold tracking-tight">BANK MINI SEKOLAH</h1>
                    <p class="text-xs text-emerald-100 mt-1 font-medium">Sistem Informasi E-Teller & Akuntansi Kas Loket</p>
                </div>

                <div class="p-6 sm:p-8">
                    <form id="form-login" class="space-y-4" autocomplete="off" onsubmit="handleLogin(event)">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Username</label>
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                    <i class="fa-solid fa-user text-sm"></i>
                                </span>
                                <input type="text" id="login-username" name="login-username" required autocomplete="off" value="" placeholder="Masukkan username"
                                    class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Kata Sandi</label>
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                    <i class="fa-solid fa-lock text-sm"></i>
                                </span>
                                <input type="password" id="login-password" name="login-password" required autocomplete="new-password" value="" placeholder="Masukkan password"
                                    class="w-full pl-9 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition">
                                <button type="button" onclick="toggleCredentialVisibility('login-password', this)" aria-label="Lihat password" title="Lihat password" class="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-teal-700">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                            </div>
                        </div>

                        <div class="flex justify-between gap-3 text-xs">
                            <button type="button" onclick="startCredentialRecovery('password')" class="font-semibold text-teal-700 hover:underline">Lupa password?</button>
                        </div>

                        <button type="submit" id="btn-submit-login"
                            class="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2">
                            <span>Masuk</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </form>
                </div>

                <div class="p-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400">
                    Uji Kompetensi Keahlian RPL &copy; 2026 Bank Mini
                </div>
            </div>
        </div>
    `
};

// ============================================================================
// [FITUR 07] HANDLER LOGIN PENGGUNA
// - Deskripsi : Memproses submit form login, validasi kredensial ke /api/auth/login,
//               menyimpan sesi token Sanctum, dan mengarahkan dashboard sesuai role.
// - Cari Cepat: FITUR_HANDLE_LOGIN
// ============================================================================
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-login');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memvalidasi...`;

    try {
        const res = await apiCall('/auth/login', 'POST', { username, password });
        const user = res.data.user;
        Auth.setSession(res.data.token, user.role, user);

        Swal.fire({
            icon: 'success',
            title: 'Login Berhasil!',
            text: `Selamat datang, ${user.nama_siswa || user.nama_petugas} (${user.role.toUpperCase()})`,
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            Router.render();
        });
    } catch (err) {
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        Swal.fire({
            icon: 'error',
            title: 'Gagal Masuk',
            text: err.message || err.errors?.username?.[0] || err.errors?.password?.[0] || 'Username atau password yang Anda masukkan salah.',
            confirmButtonColor: '#138f9c'
        });
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Masuk</span> <i class="fa-solid fa-arrow-right"></i>`;
    }

}

async function promptTellerModalAwal(user, modalAwal = null) {
    if (!modalAwal) {
        try {
            const res = await apiCall('/teller/modal-awal');
            modalAwal = res.data;
        } catch (error) {
            Auth.clearSession();
            await Swal.fire({
                icon: 'error',
                title: 'Gagal Memuat Modal Awal',
                text: error.message || 'Status modal awal tidak dapat diperiksa. Silakan coba login kembali.',
                confirmButtonColor: '#138f9c'
            });
            Router.render();
            return false;
        }
    }

    const result = await Swal.fire({
        icon: 'info',
        title: 'Konfirmasi Modal Awal Kas',
        text: `Selamat datang, ${user.nama_petugas}. Masukkan modal awal kas hari ini sebelum membuka dashboard teller.`,
        input: 'number',
        inputLabel: 'Modal awal kas hari ini (Rupiah)',
        inputPlaceholder: 'Masukkan nominal modal awal',
        inputValue: modalAwal.sudah_diatur ? modalAwal.nominal : '',
        inputAttributes: {
            min: '0',
            step: '500',
            required: 'true'
        },
        showCancelButton: true,
        confirmButtonText: 'Simpan & Masuk Dashboard',
        cancelButtonText: 'Keluar',
        confirmButtonColor: '#138f9c',
        cancelButtonColor: '#64748b',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showLoaderOnConfirm: true,
        preConfirm: async (value) => {
            const nominal = Number(value);
            if (value === '' || !Number.isSafeInteger(nominal) || nominal < 0) {
                Swal.showValidationMessage('Masukkan nominal modal awal berupa angka bulat minimal Rp 0.');
                return false;
            }

            try {
                await apiCall('/teller/modal-awal', 'POST', { nominal });
                return true;
            } catch (error) {
                Swal.showValidationMessage(error.message || 'Modal awal gagal disimpan. Silakan coba lagi.');
                return false;
            }
        }
    });

    if (result.isConfirmed) return true;

    try {
        await apiCall('/auth/logout', 'POST');
    } catch (error) {
        console.error('Gagal mengakhiri sesi teller yang batal login:', error);
    }
    Auth.clearSession();
    Router.render();
    return false;
}

function toggleCredentialVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    button.innerHTML = `<i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
    button.setAttribute('aria-label', isHidden ? 'Sembunyikan password atau PIN' : 'Lihat password atau PIN');
    button.title = isHidden ? 'Sembunyikan' : 'Lihat';
}

// ============================================================================
// [FITUR 08] PEMULIHAN PASSWORD & PIN TRANSAKSI (OTP EMAIL)
// - Deskripsi : Mengirim kode OTP 6-digit via email untuk mereset kata sandi
//               atau PIN 6-digit nasabah Saver jika lupa.
// - Cari Cepat: FITUR_LUPA_PASSWORD_PIN_OTP
// ============================================================================
async function startCredentialRecovery(credential, saverId = null) {
    const label = credential === 'pin' ? 'PIN' : 'password';
    try {
        let requestData;
        let response;
        if (credential === 'pin') {
            if (!saverId) {
                Swal.fire('Pilih Saver', 'Cari data nasabah melalui Teller terlebih dahulu untuk mengirim OTP ke email Saver yang sesuai.', 'warning');
                return;
            }
            response = await apiCall(`/teller/savers/${saverId}/forgot-pin`, 'POST', {});
            requestData = { credential, saver_id: saverId };
        } else {
            const request = await Swal.fire({
                title: `Lupa ${label}?`,
                html: `
                    <p class="mb-3 text-left text-sm text-slate-600">Masukkan username dan email yang terdaftar. Kode OTP akan dikirim ke email tersebut.</p>
                    <input id="recovery-username" type="text" class="swal2-input" placeholder="Username akun">
                    <input id="recovery-email" type="email" class="swal2-input" placeholder="Email akun">
                `,
                showCancelButton: true,
                confirmButtonText: 'Kirim Kode OTP',
                cancelButtonText: 'Batal',
                preConfirm: () => {
                    const username = document.getElementById('recovery-username').value.trim();
                    const email = document.getElementById('recovery-email').value.trim();
                    if (!username) {
                        Swal.showValidationMessage('Masukkan username akun.');
                        return false;
                    }
                    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        Swal.showValidationMessage('Masukkan alamat email yang valid.');
                        return false;
                    }
                    return { username, email };
                }
            });
            if (!request.isConfirmed) return;
            requestData = { ...request.value, credential };
            response = await apiCall('/auth/forgot-credential', 'POST', requestData);
        }

        let otpValue;
        if (credential === 'password') {
            const otpConfirmation = await Swal.fire({
                title: 'Konfirmasi Kode OTP',
                html: `
                    <p class="mb-2 text-left text-sm text-slate-600">${escapeHtml(response.message)}</p>
                    <input id="recovery-otp" type="text" inputmode="numeric" maxlength="6" class="swal2-input" placeholder="Kode OTP 6 digit">
                `,
                showCancelButton: true,
                confirmButtonText: 'Konfirmasi OTP',
                cancelButtonText: 'Batal',
                preConfirm: async () => {
                    const otp = document.getElementById('recovery-otp').value.trim();
                    if (!/^\d{6}$/.test(otp)) {
                        Swal.showValidationMessage('OTP harus terdiri dari 6 digit.');
                        return false;
                    }
                    try {
                        await apiCall('/auth/verify-credential-reset-otp', 'POST', {
                            ...requestData,
                            otp
                        });
                        return otp;
                    } catch (error) {
                        Swal.showValidationMessage(error.message || 'Kode OTP tidak valid atau sudah kedaluwarsa.');
                        return false;
                    }
                }
            });
            if (!otpConfirmation.isConfirmed) return;
            otpValue = otpConfirmation.value;
        }

        const reset = await Swal.fire({
            title: credential === 'password' ? 'Buat Kata Sandi Baru' : 'Atur PIN Baru',
            html: `
                ${credential === 'password' ? '' : `<p class="mb-2 text-left text-sm text-slate-600">${escapeHtml(response.message)}</p><input id="recovery-otp" type="text" inputmode="numeric" maxlength="6" class="swal2-input" placeholder="Kode OTP 6 digit">`}
                <div class="relative">
                    <input id="recovery-new-value" type="password" inputmode="${credential === 'pin' ? 'numeric' : 'text'}" maxlength="${credential === 'pin' ? '6' : '100'}" class="swal2-input" placeholder="${credential === 'pin' ? 'PIN baru (6 digit)' : 'Password baru (min. 8 karakter)'}" ${credential === 'password' ? 'minlength="8"' : 'pattern="[0-9]{6}"'} style="padding-right: 3rem">
                    <button type="button" onclick="toggleCredentialVisibility('recovery-new-value', this)" aria-label="Lihat password atau PIN" title="Lihat" class="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500"><i class="fa-solid fa-eye"></i></button>
                </div>
                ${credential === 'password' ? `<input id="recovery-confirm-value" type="password" minlength="8" maxlength="100" class="swal2-input" placeholder="Konfirmasi password baru">` : ''}
            `,
            showCancelButton: true,
            confirmButtonText: `Simpan ${label} Baru`,
            cancelButtonText: 'Batal',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                const otp = credential === 'password' ? otpValue : document.getElementById('recovery-otp').value.trim();
                const newValue = document.getElementById('recovery-new-value').value;
                const confirmation = credential === 'password' ? document.getElementById('recovery-confirm-value').value : newValue;
                if (!/^\d{6}$/.test(otp)) {
                    Swal.showValidationMessage('OTP harus terdiri dari 6 digit.');
                    return false;
                }
                if (credential === 'password' && newValue.length < 8) {
                    Swal.showValidationMessage('Password baru minimal 8 karakter.');
                    return false;
                }
                if (credential === 'pin' && !/^\d{6}$/.test(newValue)) {
                    Swal.showValidationMessage('PIN baru harus terdiri dari 6 digit.');
                    return false;
                }
                if (newValue !== confirmation) {
                    Swal.showValidationMessage('Konfirmasi password baru tidak sama. Periksa kembali kedua kolom password.');
                    return false;
                }

                const resetData = {
                    ...requestData,
                    otp,
                    [credential === 'password' ? 'new_password' : 'new_pin']: newValue
                };
                if (credential === 'password') {
                    resetData.new_password_confirmation = confirmation;
                }

                try {
                    return await apiCall('/auth/reset-credential', 'POST', resetData);
                } catch (error) {
                    const validationMessage = error.errors
                        ? Object.values(error.errors).flat()[0]
                        : error.message;
                    Swal.showValidationMessage(validationMessage || 'Password belum dapat diubah. Periksa kembali data Anda lalu coba lagi.');
                    return false;
                }
            }
        });

        if (!reset.isConfirmed) return;
        Swal.fire('Berhasil', reset.value.message, 'success');
    } catch (error) {
        Swal.fire('Pemulihan Gagal', error.message || 'Kode OTP tidak dapat dikirim atau tidak valid.', 'error');
    }
}

// ============================================================================
// [FITUR 09] LOGOUT PENGGUNA
// - Deskripsi : Mengakhiri sesi pengguna, menghapus token di database dan localStorage.
// - Cari Cepat: FITUR_LOGOUT
// ============================================================================
function handleLogout() {
    Swal.fire({
        title: 'Konfirmasi Keluar',
        text: 'Apakah Anda yakin ingin mengakhiri sesi ini?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            if (nasabahBankStatusInterval) {
                clearInterval(nasabahBankStatusInterval);
                nasabahBankStatusInterval = null;
            }
            try {
                await apiCall('/auth/logout', 'POST');
            } catch (e) {
                // Abaikan error jaringan saat logout
            }
            Auth.clearSession();
            Router.render();
        }
    });
}

// ============================================================================
// [FITUR 10] VIEW: DASHBOARD ADMINISTRATOR
// - Deskripsi : Tata letak portal admin master data (Member, Saver, Akun Staf).
// - Cari Cepat: FITUR_ADMIN_LAYOUT
// ============================================================================
Views.AdminLayout = () => {
    const user = Auth.getUser();
    return `
        <div class="min-h-screen bg-slate-100 flex flex-col">
            <!-- TOPBAR -->
            <header class="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                        <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="w-9 h-9 object-contain">
                    </div>
                    <div>
                        <h2 class="font-bold text-slate-800 text-base leading-tight">Portal Administrator</h2>
                        <p class="text-xs text-slate-500 font-medium">Bank Mini Sekolah &bull; Master Data</p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="text-right hidden sm:block">
                        <div class="text-xs font-bold text-slate-700">${user?.nama_petugas || 'Admin'}</div>
                        <span class="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase">Administrator</span>
                    </div>
                    <button onclick="handleLogout()" class="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Logout">
                        <i class="fa-solid fa-right-from-bracket text-base"></i>
                    </button>
                </div>
            </header>

            <!-- MAIN CONTAINER -->
            <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
                <!-- NAV TABS ADMIN -->
                <div class="flex flex-wrap border-b border-slate-200 gap-2 bg-white p-2 rounded-xl shadow-sm">
                    <button onclick="switchAdminTab('members')" id="admin-tab-members"
                        class="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white transition flex items-center gap-2">
                        <i class="fa-solid fa-user-graduate"></i> Member
                    </button>
                    <button onclick="switchAdminTab('savers')" id="admin-tab-savers"
                        class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2">
                        <i class="fa-solid fa-piggy-bank"></i> Saver
                    </button>
                    <button onclick="switchAdminTab('users')" id="admin-tab-users" 
                        class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2">
                        <i class="fa-solid fa-user-gear"></i> Master User Internal
                    </button>
                </div>

                <div id="admin-sec-members" class="space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                        <div>
                            <h3 class="font-bold text-slate-800 text-lg">Daftar Member Belum Memiliki Akun</h3>
                            <p class="text-xs text-slate-500">Upload data siswa satu angkatan. Buatkan akun siswa dari daftar Member; rekening tabungan dibuat Teller saat setoran pertama.</p>
                        </div>
                        ${memberImportPanel()}
                    </div>
                    <div class="bg-white p-3 rounded-xl border border-slate-200">
                        <label for="admin-member-search" class="sr-only">Cari Member</label>
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input id="admin-member-search" type="search" oninput="searchAdminMembers()"
                                placeholder="Cari Member berdasarkan NIS atau nama siswa..."
                                class="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th class="py-3.5 px-4 font-bold">NIS</th>
                                        <th class="py-3.5 px-4 font-bold">Nama Siswa</th>
                                        <th class="py-3.5 px-4 font-bold">Kelas</th>
                                        <th class="py-3.5 px-4 font-bold">Angkatan Keluar</th>
                                        <th class="py-3.5 px-4 font-bold">Nomor HP</th>
                                        <th class="py-3.5 px-4 font-bold">Gender</th>
                                        <th class="py-3.5 px-4 font-bold">Status Akun</th>
                                        <th class="py-3.5 px-4 font-bold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-members" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                    <tr><td colspan="8" class="text-center py-8 text-slate-400">Memuat data anggota...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="admin-sec-savers" class="space-y-4 hidden">
                    <div class="bg-white p-4 rounded-xl border border-slate-200">
                        <h3 class="font-bold text-slate-800 text-lg">Daftar Saver</h3>
                        <p class="text-xs text-slate-500">Siswa yang sudah dibuatkan akun login. Rekening dan kartu QR dibuat saat akun diaktifkan; saldo bertambah saat setoran di Teller.</p>
                    </div>
                    <div id="admin-saver-closure-approval" class="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                        <div class="flex flex-col gap-3 border-b border-amber-100 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 class="font-bold text-amber-900">Pengajuan Hapus Akun dari Teller</h3>
                                <p class="mt-1 text-xs text-amber-800">Periksa penarikan penuh dan setujui penghapusan akun. Riwayat transaksi dan jurnal tetap disimpan.</p>
                            </div>
                            <button onclick="loadAdminNasabah()" class="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"><i class="fa-solid fa-rotate mr-1"></i>Muat Ulang</button>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full min-w-[850px] text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200"><tr>
                                    <th class="py-3 px-4">Nasabah</th><th class="py-3 px-4">No. Rekening</th><th class="py-3 px-4">Teller</th><th class="py-3 px-4 text-right">Jumlah Ditarik</th><th class="py-3 px-4">Waktu Pengajuan</th><th class="py-3 px-4 text-center">Persetujuan</th>
                                </tr></thead>
                                <tbody id="tbody-saver-closure-requests" class="divide-y divide-slate-100 text-slate-700">
                                    <tr><td colspan="6" class="py-6 text-center text-slate-400">Memuat pengajuan...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="bg-white p-3 rounded-xl border border-slate-200">
                        <label for="admin-saver-search" class="sr-only">Cari Saver</label>
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input id="admin-saver-search" type="search" oninput="searchAdminSavers()"
                                placeholder="Cari Saver berdasarkan nama, username, NIS, atau no. rekening..."
                                class="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th class="py-3.5 px-4 font-bold">No. Rekening</th>
                                        <th class="py-3.5 px-4 font-bold">NIS</th>
                                        <th class="py-3.5 px-4 font-bold">Nama Siswa</th>
                                        <th class="py-3.5 px-4 font-bold">Kelas</th>
                                        <th class="py-3.5 px-4 font-bold">Email</th>
                                        <th class="py-3.5 px-4 font-bold">Nomor HP</th>
                                        <th class="py-3.5 px-4 font-bold">Username</th>
                                        <th class="py-3.5 px-4 font-bold">Status Akun</th>
                                        <th class="py-3.5 px-4 font-bold text-right">Saldo Saat Ini</th>
                                        <th class="py-3.5 px-4 font-bold text-center">Kode QR</th>
                                        <th class="py-3.5 px-4 font-bold text-center">Kelola Akun</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-nasabah" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                    <tr><td colspan="11" class="text-center py-8 text-slate-400">Memuat data saver...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: MASTER USERS (HIDDEN DEFAULT) -->
                <div id="admin-sec-users" class="space-y-4 hidden">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                        <div>
                            <h3 class="font-bold text-slate-800 text-lg">Daftar Pengguna Sistem Internal</h3>
                            <p class="text-xs text-slate-500">Kelola akun staf Administrator, Teller, dan Supervisor</p>
                        </div>
                        <button onclick="openModalTambahUser()" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition">
                            <i class="fa-solid fa-user-shield"></i> Tambah User Staf
                        </button>
                    </div>

                    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th class="py-3.5 px-4 font-bold">Username</th>
                                        <th class="py-3.5 px-4 font-bold">Nama Petugas</th>
                                        <th class="py-3.5 px-4 font-bold">Role Akses</th>
                                        <th class="py-3.5 px-4 font-bold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-users" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                    <tr><td colspan="4" class="text-center py-8 text-slate-400">Memuat data user...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;
};

// ============================================================================
// [FITUR 11] KELOLA DATA NASABAH (SAVER)
// - Deskripsi : Menampilkan daftar nasabah pemilik rekening, pencarian instan,
//               status akun aktif/nonaktif, soft delete (arsip Saver),
//               serta pembuatan kredensial login akun siswa.
// - Cari Cepat: FITUR_DATA_SAVER
// ============================================================================
function initAdminEvents() {
    loadAdminMembers();
}

function switchAdminTab(tab) {
    const tabs = {
        members: loadAdminMembers,
        savers: loadAdminNasabah,
        users: loadAdminUsers,
    };
    if (!tabs[tab]) return;
    Object.keys(tabs).forEach(tabName => {
        document.getElementById(`admin-tab-${tabName}`).className = tabName === tab
            ? "px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white transition flex items-center gap-2"
            : "px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2";
        document.getElementById(`admin-sec-${tabName}`).classList.toggle('hidden', tabName !== tab);
    });
    tabs[tab]();
}

let cachedAdminNasabah = [];

async function loadAdminNasabah() {
    try {
        const res = await apiCall('/admin/savers');
        const tbody = document.getElementById('tbody-nasabah');
        cachedAdminNasabah = res.data || [];
        renderAdminNasabahRows(tbody, '');
        if (document.getElementById('tbody-saver-closure-requests')) {
            await loadSaverClosureRequests();
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadSaverClosureRequests() {
    const tbody = document.getElementById('tbody-saver-closure-requests');
    if (!tbody) return;

    try {
        const response = await apiCall('/admin/saver-closure-requests');
        const requests = response.data || [];
        if (!requests.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-400">Tidak ada pengajuan penghapusan yang menunggu persetujuan.</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(item => `
            <tr class="hover:bg-slate-50">
                <td class="py-3 px-4 font-semibold">${escapeHtml(item.saver?.nama_siswa || '-')}<span class="block text-[10px] text-slate-400">NIS ${escapeHtml(item.saver?.nis || '-')}</span></td>
                <td class="py-3 px-4 font-mono">${escapeHtml(item.saver?.no_rekening || '-')}</td>
                <td class="py-3 px-4">${escapeHtml(item.teller || '-')}</td>
                <td class="py-3 px-4 text-right font-mono font-bold">${formatRupiah(item.jumlah_penarikan)}</td>
                <td class="py-3 px-4">${escapeHtml(formatDate(item.created_at))}</td>
                <td class="py-3 px-4"><div class="flex justify-center gap-2">
                    <button onclick="approveSaverClosureRequest(${item.id})" class="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700">Setujui</button>
                </div></td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-red-600">${escapeHtml(error.message || 'Pengajuan tidak dapat dimuat.')}</td></tr>`;
    }
}

async function approveSaverClosureRequest(requestId) {
    const result = await Swal.fire({
        title: 'Setujui penghapusan akun?',
        text: 'Akun Saver akan diarsipkan dan akses loginnya dinonaktifkan. Riwayat transaksi serta jurnal tetap tersimpan.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Setujui Penghapusan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#059669',
    });
    if (!result.isConfirmed) return;

    try {
        const response = await apiCall(`/admin/saver-closure-requests/${requestId}/approve`, 'POST', {});
        await loadAdminNasabah();
        await Swal.fire('Penghapusan Disetujui', response.message, 'success');
    } catch (error) {
        await Swal.fire('Persetujuan Gagal', error.message || 'Pengajuan tidak dapat disetujui.', 'error');
    }
}

function searchAdminSavers() {
    const searchInput = document.getElementById('admin-saver-search') || document.getElementById('spv-saver-search');
    const tbody = document.getElementById('tbody-nasabah');
    if (!searchInput || !tbody) return;
    renderAdminNasabahRows(tbody, searchInput.value.trim().toLocaleLowerCase('id'));
}

function renderAdminNasabahRows(tbody, query) {
    const columnCount = document.getElementById('admin-sec-savers') ? 11 : 10;
    if (cachedAdminNasabah.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columnCount}" class="text-center py-8 text-slate-400">Belum ada saver terdaftar.</td></tr>`;
        return;
    }

    const filteredSavers = cachedAdminNasabah.filter(item => [
        item.nama_siswa,
        item.username,
        item.nis,
        item.no_rekening,
    ].some(value => String(value || '').toLocaleLowerCase('id').includes(query)));

    if (filteredSavers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columnCount}" class="text-center py-8 text-slate-400">Saver tidak ditemukan.</td></tr>`;
        return;
    }

    const canManageSaver = ['admin', 'supervisor'].includes(Auth.getRole());
    tbody.innerHTML = filteredSavers.map(item => `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono font-bold text-emerald-700">${item.no_rekening || 'Belum ada'}</td>
                <td class="py-3 px-4 font-mono">${escapeHtml(item.nis)}</td>
                <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(item.nama_siswa)}</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 bg-slate-100 rounded text-slate-600 text-[11px] font-semibold">${escapeHtml(item.kelas)}</span></td>
                <td class="py-3 px-4">${escapeHtml(item.email || '-')}</td>
                <td class="py-3 px-4">${escapeHtml(item.nomor_hp || '-')}</td>
                <td class="py-3 px-4 font-mono">${escapeHtml(item.username || '-')}</td>
                <td class="py-3 px-4"><span class="px-2 py-1 rounded-full ${!item.has_login ? 'bg-slate-100 text-slate-700' : item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'} text-[10px] font-bold">${!item.has_login ? 'Belum ada login' : item.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td class="py-3 px-4 text-right font-mono font-bold text-slate-800">${formatRupiah(item.saldo)}</td>
                <td class="py-3 px-4 text-center">
                        ${item.no_rekening ? `
                            <button onclick="showKartuQR(decodeURIComponent('${encodeURIComponent(item.no_rekening)}'), decodeURIComponent('${encodeURIComponent(item.nama_siswa)}'), decodeURIComponent('${encodeURIComponent(item.kelas)}'))"
                                class="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg border border-emerald-200 transition">
                                <i class="fa-solid fa-qrcode"></i> Kartu QR
                            </button>
                        ` : '<span class="text-[10px] text-slate-400">Menunggu setoran Teller</span>'}
                </td>
                <td class="py-3 px-4 text-center">
                    <div class="flex flex-col items-center justify-center gap-2">
                        ${canManageSaver && item.closure_pending ? `
                            <span class="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[10px] font-bold text-amber-800">Menunggu Persetujuan</span>
                            <div class="flex gap-1.5">
                                <button onclick="approveSaverClosureRequest(${item.closure_request_id})" class="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700">Setujui</button>
                            </div>
                        ` : canManageSaver && !item.has_login ? `
                            <button onclick="setSaverCredentials(${item.id})"
                                class="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-bold rounded-lg border transition">
                                Buat Login
                            </button>
                        ` : canManageSaver ? `
                            <button onclick="toggleSaverStatus(${item.id}, ${!item.is_active})"
                                class="px-2.5 py-1.5 ${item.is_active ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'} font-bold rounded-lg border transition">
                                ${item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                        ` : '<span class="text-[10px] text-slate-400">Khusus Admin</span>'}
                    </div>
                </td>
            </tr>
        `).join('');
}

async function loadAdminMembers() {
    try {
        const search = document.getElementById('admin-member-search')?.value.trim() || '';
        const res = await apiCall(`/admin/members${search ? `?search=${encodeURIComponent(search)}` : ''}`);
        const tbody = document.getElementById('tbody-members');
        if (!res.data || res.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">${search ? 'Tidak ditemukan Member yang cocok.' : 'Belum ada Member terdaftar.'}</td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.map(item => `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono">${escapeHtml(item.student_number)}</td>
                <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(item.student_name)}</td>
                <td class="py-3 px-4">${escapeHtml(item.class || '-')}</td>
                <td class="py-3 px-4">${item.graduation_year}</td>
                <td class="py-3 px-4">${escapeHtml(item.nomor_hp || '-')}</td>
                <td class="py-3 px-4">${escapeHtml(item.gender || '-')}</td>
                <td class="py-3 px-4"><span class="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Belum dibuatkan akun</span></td>
                <td class="py-3 px-4 text-center whitespace-nowrap">
                    <button onclick="editMember(${item.user_id})" class="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg" title="Ubah anggota">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="deleteMember(${item.user_id})" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus anggota">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        const tbody = document.getElementById('tbody-members');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-red-600">${escapeHtml(error.message || 'Data Member gagal dimuat.')}</td></tr>`;
    }
}

async function loadTellerMembers() {
    const tbody = document.getElementById('tbody-teller-members');
    if (!tbody) return;

    try {
        const search = document.getElementById('teller-member-search')?.value.trim() || '';
        const response = await apiCall(`/teller/members${search ? `?search=${encodeURIComponent(search)}` : ''}`);
        if (!response.data?.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">${search ? 'Member tidak ditemukan.' : 'Belum ada data Member.'}</td></tr>`;
            return;
        }

        tbody.innerHTML = response.data.map(item => `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono">${escapeHtml(item.student_number)}</td>
                <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(item.student_name)}</td>
                <td class="py-3 px-4">${escapeHtml(item.class || '-')}</td>
                <td class="py-3 px-4">${item.graduation_year}</td>
                <td class="py-3 px-4">${escapeHtml(item.nomor_hp || '-')}</td>
                <td class="py-3 px-4">${escapeHtml(item.gender || '-')}</td>
                <td class="py-3 px-4"><span class="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Belum menjadi Saver</span></td>
                <td class="py-3 px-4 text-center whitespace-nowrap">
                    <button onclick="activateTellerMember(${item.user_id})" class="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold rounded-lg transition">
                        <i class="fa-solid fa-user-check"></i> Aktivasi
                    </button>
                    <button onclick="editMember(${item.user_id})" class="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg" title="Ubah member">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="deleteMember(${item.user_id})" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus member">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-red-600">${escapeHtml(error.message || 'Data Member gagal dimuat.')}</td></tr>`;
    }
}

// ============================================================================
// [FITUR 12] KELOLA DATA MEMBER & SISWA (Import, Aktivasi, Kenaikan Kelas)
// - Deskripsi : CRUD data calon nasabah (Member), upload spreadsheet Excel/CSV,
//               aktivasi member menjadi Saver dengan nomor rekening baru,
//               kenaikan kelas serentak per tahun kelulusan, dan siswa tidak naik kelas.
// - Cari Cepat: FITUR_DATA_MEMBER_IMPORT
// ============================================================================
let memberSearchTimeout;

function searchAdminMembers() {
    clearTimeout(memberSearchTimeout);
    memberSearchTimeout = setTimeout(loadAdminMembers, 250);
}

async function promoteMembersByGraduationYear() {
    const result = await Swal.fire({
        title: 'Kenaikan Kelas Serentak',
        html: `
            <p class="mb-3 text-left text-sm text-slate-600">Pilih tahun kelulusan untuk menaikkan seluruh member pada angkatan tersebut. Kelas X menjadi XI dan XI menjadi XII; kelas XII tetap. Tahun kelulusan tidak berubah.</p>
            <label for="promotion-graduation-year" class="block text-left text-xs font-bold text-slate-600">Tahun kelulusan</label>
            <input id="promotion-graduation-year" type="number" min="2000" max="2100" class="swal2-input" value="${new Date().getFullYear()}">
        `,
        showCancelButton: true,
        confirmButtonText: 'Proses Kenaikan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#138f9c',
        preConfirm: async () => {
            const graduationYear = Number(document.getElementById('promotion-graduation-year').value);
            if (!Number.isInteger(graduationYear) || graduationYear < 2000 || graduationYear > 2100) {
                Swal.showValidationMessage('Masukkan tahun kelulusan antara 2000 dan 2100.');
                return false;
            }

            try {
                return await apiCall('/admin/members/promote-by-graduation-year', 'POST', {
                    graduation_year: graduationYear
                });
            } catch (error) {
                const details = Array.isArray(error.errors) ? ` ${error.errors.join(', ')}` : '';
                Swal.showValidationMessage(`${error.message || 'Kenaikan kelas gagal diproses.'}${details}`);
                return false;
            }
        }
    });

    if (result.isConfirmed && result.value) {
        await Swal.fire('Kenaikan Kelas Selesai', result.value.message, 'success');
        await loadAdminMembers();
    }
}

async function reclassifyMember() {
    const searchResult = await Swal.fire({
        title: 'Cari Siswa yang Tidak Naik Kelas',
        input: 'text',
        inputLabel: 'Cari berdasarkan NIS atau nama siswa',
        inputPlaceholder: 'Masukkan NIS atau nama siswa',
        showCancelButton: true,
        confirmButtonText: 'Cari Siswa',
        cancelButtonText: 'Batal',
        preConfirm: async (query) => {
            const search = query.trim();
            if (!search) {
                Swal.showValidationMessage('Masukkan NIS atau nama siswa untuk mencari.');
                return false;
            }

            try {
                const response = await apiCall(`/admin/members?search=${encodeURIComponent(search)}`);
                return response.data || [];
            } catch (error) {
                Swal.showValidationMessage(error.message || 'Data siswa gagal dicari.');
                return false;
            }
        }
    });

    if (!searchResult.isConfirmed) return;
    if (!searchResult.value.length) {
        await Swal.fire('Siswa Tidak Ditemukan', 'Periksa kembali NIS atau nama siswa.', 'info');
        return;
    }

    const memberOptions = Object.fromEntries(searchResult.value.map(member => [
        String(member.user_id),
        `${member.student_number} - ${member.student_name} (Kelas ${member.class || '-'}, ${member.graduation_year})`
    ]));
    const selection = await Swal.fire({
        title: 'Pilih Siswa',
        input: 'select',
        inputOptions: memberOptions,
        inputPlaceholder: 'Pilih siswa',
        showCancelButton: true,
        confirmButtonText: 'Lanjutkan',
        cancelButtonText: 'Batal',
        inputValidator: value => value ? undefined : 'Pilih siswa terlebih dahulu.'
    });
    if (!selection.isConfirmed) return;

    const member = searchResult.value.find(item => String(item.user_id) === selection.value);
    if (!member) {
        await Swal.fire('Gagal Memilih Siswa', 'Data siswa yang dipilih tidak lagi tersedia. Silakan cari kembali.', 'error');
        return;
    }

    const updateResult = await Swal.fire({
        title: 'Perbarui Data Kelas Siswa',
        html: `
            <p class="mb-3 text-left text-xs text-slate-600">${escapeHtml(member.student_name)} (${escapeHtml(member.student_number)})</p>
            <label for="reclass-grade" class="block text-left text-xs font-bold text-slate-600">Kelas</label>
            <input id="reclass-grade" type="text" maxlength="20" class="swal2-input" placeholder="Contoh: XI" value="${escapeHtml(String(member.class || '').split(/\s+/)[0] || '')}">
            <label for="reclass-major" class="block text-left text-xs font-bold text-slate-600">Jurusan / Rombel</label>
            <input id="reclass-major" type="text" maxlength="20" class="swal2-input" placeholder="Contoh: RPL 1" value="${escapeHtml(String(member.class || '').split(/\s+/).slice(1).join(' '))}">
            <label for="reclass-graduation-year" class="block text-left text-xs font-bold text-slate-600">Tahun kelulusan</label>
            <input id="reclass-graduation-year" type="number" min="2000" max="2100" class="swal2-input" value="${member.graduation_year}">
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan Perubahan',
        cancelButtonText: 'Batal',
        preConfirm: async () => {
            const grade = document.getElementById('reclass-grade').value.trim();
            const major = document.getElementById('reclass-major').value.trim();
            const graduationYear = Number(document.getElementById('reclass-graduation-year').value);
            const className = `${grade} ${major}`.trim();
            if (!grade || !major || className.length > 20) {
                Swal.showValidationMessage('Isi kelas dan jurusan/rombel; gabungannya maksimal 20 karakter.');
                return false;
            }
            if (!Number.isInteger(graduationYear) || graduationYear < 2000 || graduationYear > 2100) {
                Swal.showValidationMessage('Masukkan tahun kelulusan antara 2000 dan 2100.');
                return false;
            }

            try {
                return await apiCall(`/admin/members/${member.user_id}/reclassify`, 'PATCH', {
                    class: className,
                    graduation_year: graduationYear
                });
            } catch (error) {
                Swal.showValidationMessage(error.message || 'Data kelas siswa gagal diperbarui.');
                return false;
            }
        }
    });

    if (updateResult.isConfirmed) {
        await Swal.fire('Berhasil', updateResult.value.message, 'success');
        await loadAdminMembers();
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
}

async function loadAdminUsers() {
    try {
        const res = await apiCall('/admin/users');
        const tbody = document.getElementById('tbody-users');
        if (!res.data || res.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-400">Belum ada user terdaftar.</td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.map(item => `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono font-bold text-slate-800">${item.username}</td>
                <td class="py-3 px-4 text-slate-700">${item.nama_petugas}</td>
                <td class="py-3 px-4">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        item.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        item.role === 'supervisor' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                    }">${item.role}</span>
                </td>
                <td class="py-3 px-4 text-center">
                    ${Number(Auth.getUser()?.id) === Number(item.id) ? '<span class="text-xs text-slate-400">Akun Anda</span>' : `
                    <button onclick="deleteUser(${item.id})" class="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition" title="Hapus User">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    `}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

async function importMembersExcel(button) {
    const fileInput = document.getElementById('member-import-file');
    const file = fileInput?.files?.[0];
    if (!file) {
        Swal.fire('Pilih File', 'Pilih file Excel (.xlsx) atau CSV terlebih dahulu.', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    const originalButtonContent = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah...';
    }
    if (fileInput) fileInput.disabled = true;

    Swal.fire({
        title: 'Mengunggah Data Member',
        text: 'Mohon tunggu, file sedang diproses.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
    });

    try {
        const response = await apiCall('/admin/members/import', 'POST', formData);
        fileInput.value = '';
        Swal.fire('Import Berhasil', response.message, 'success');
        void loadAdminMembers();
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Import Gagal',
            text: [error.message || 'Data siswa tidak berhasil diimpor.', ...(Array.isArray(error.errors) ? error.errors : [])].join('\n'),
        });
    } finally {
        if (button) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            button.innerHTML = originalButtonContent;
        }
        if (fileInput) fileInput.disabled = false;
    }
}

function downloadMemberImportTemplate() {
    const headers = 'nis,nama_siswa,kelas,angkatan_keluar,nomor_hp,gender';
    const blob = new Blob(['\uFEFF' + headers + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template-data-siswa.csv';
    link.click();
    URL.revokeObjectURL(url);
}

async function activateTellerMember(userId) {
    const result = await Swal.fire({
        title: 'Buat Akun Saver',
        html: `
            <div class="space-y-3 text-left">
                <label class="block text-sm font-semibold text-slate-700" for="teller-member-username">Username siswa</label>
                <input id="teller-member-username" type="text" maxlength="50" class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <label class="block text-sm font-semibold text-slate-700" for="teller-member-email">Email nasabah untuk OTP (opsional)</label>
                <input id="teller-member-email" type="email" maxlength="255" class="w-full rounded-lg border border-slate-300 px-3 py-2" autocomplete="email">
                <label class="block text-sm font-semibold text-slate-700" for="teller-member-password">Password</label>
                <div class="relative">
                    <input id="teller-member-password" type="password" minlength="8" maxlength="100" class="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10" autocomplete="new-password">
                    <button type="button" onclick="toggleCredentialVisibility('teller-member-password', this)" aria-label="Lihat password" title="Lihat password" class="absolute inset-y-0 right-0 px-3 text-slate-500"><i class="fa-solid fa-eye"></i></button>
                </div>
                <label class="block text-sm font-semibold text-slate-700" for="teller-member-pin">PIN keamanan nasabah (6 digit)</label>
                <div class="relative">
                    <input id="teller-member-pin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" class="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10" autocomplete="new-password">
                    <button type="button" onclick="toggleCredentialVisibility('teller-member-pin', this)" aria-label="Lihat PIN" title="Lihat PIN" class="absolute inset-y-0 right-0 px-3 text-slate-500"><i class="fa-solid fa-eye"></i></button>
                </div>
                <label class="block text-sm font-semibold text-slate-700" for="teller-member-opening-balance">Saldo awal (Rp)</label>
                <input id="teller-member-opening-balance" type="number" min="0" step="1000" value="0" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <p class="text-xs text-slate-500">Saldo awal di atas Rp 0 akan dicatat sebagai setoran pembukaan dan masuk ke jurnal.</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Buat Akun',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const username = document.getElementById('teller-member-username').value.trim();
            const email = document.getElementById('teller-member-email').value.trim();
            const password = document.getElementById('teller-member-password').value;
            const security_pin = document.getElementById('teller-member-pin').value.trim();
            const saldo_awal = document.getElementById('teller-member-opening-balance').value;
            if (!username || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || password.length < 8 || !/^\d{6}$/.test(security_pin) || saldo_awal === '' || !Number.isSafeInteger(Number(saldo_awal)) || Number(saldo_awal) < 0) {
                Swal.showValidationMessage('Isi username, email yang valid jika digunakan, password minimal 8 karakter, PIN keamanan 6 digit, dan saldo awal berupa angka minimal Rp 0.');
                return false;
            }
            return { username, email, password, security_pin, saldo_awal: Number(saldo_awal) };
        }
    });

    if (!result.isConfirmed) return;

    try {
        const response = await apiCall(`/teller/members/${userId}/activate`, 'POST', result.value);
        await loadTellerSavers();
        await loadTellerMembers();
        await Swal.fire(
            'Akun Saver Dibuat',
            `Akun untuk ${response.data.nama_siswa} sudah aktif. Username: ${response.data.username}; nomor rekening: ${response.data.no_rekening}; saldo awal: ${formatRupiah(response.data.saldo_awal)}.`,
            'success'
        );
        showKartuQR(response.data.no_rekening, response.data.nama_siswa, response.data.kelas);
    } catch (error) {
        Swal.fire('Gagal Membuat Akun', error.message || 'Akun siswa tidak berhasil dibuat.', 'error');
    }
}

async function toggleSaverStatus(saverId, isActive) {
    try {
        const response = await apiCall(`/admin/savers/${saverId}/status`, 'PATCH', { is_active: isActive });
        await loadAdminNasabah();
        Swal.fire('Status Diperbarui', response.message, 'success');
    } catch (error) {
        Swal.fire('Gagal Mengubah Status', error.message || 'Status akun saver tidak berhasil diubah.', 'error');
    }
}

async function deleteSaver(saverId, namaSiswa) {
    const result = await Swal.fire({
        title: 'Hapus akun Saver?',
        html: `Akun <strong>${escapeHtml(namaSiswa)}</strong> akan dihapus dari daftar aktif dan login akan dinonaktifkan. Akun hanya dapat dihapus jika saldonya sudah ditarik habis (saldo 0). Data rekening serta seluruh riwayat transaksi tetap disimpan untuk audit.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus dari Daftar Aktif',
        cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
        const response = await apiCall(`/admin/savers/${saverId}`, 'DELETE');
        await loadAdminNasabah();
        await Swal.fire('Akun Dihapus', response.message, 'success');
    } catch (error) {
        await Swal.fire('Tidak Dapat Menghapus', error.message || 'Akun Saver tidak dapat dihapus.', 'error');
    }
}

async function setSaverCredentials(saverId) {
    const result = await Swal.fire({
        title: 'Buat Akun Login Saver',
        html: `
            <div class="space-y-3 text-left">
                <label class="block text-sm font-semibold text-slate-700" for="saver-username">Username siswa</label>
                <input id="saver-username" type="text" maxlength="50" class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <label class="block text-sm font-semibold text-slate-700" for="saver-email">Email nasabah untuk OTP</label>
                <input id="saver-email" type="email" maxlength="255" class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <label class="block text-sm font-semibold text-slate-700" for="saver-phone">Nomor HP nasabah</label>
                <input id="saver-phone" type="tel" maxlength="20" class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <label class="block text-sm font-semibold text-slate-700" for="saver-password">Kata sandi awal (minimal 8 karakter)</label>
                <div class="relative">
                    <input id="saver-password" type="password" minlength="8" maxlength="100" class="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10" autocomplete="new-password">
                    <button type="button" onclick="toggleCredentialVisibility('saver-password', this)" aria-label="Lihat password" title="Lihat password" class="absolute inset-y-0 right-0 px-3 text-slate-500"><i class="fa-solid fa-eye"></i></button>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan Akun',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const username = document.getElementById('saver-username').value.trim();
            const email = document.getElementById('saver-email').value.trim();
            const nomor_hp = document.getElementById('saver-phone').value.trim();
            const password = document.getElementById('saver-password').value;
            if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
                Swal.showValidationMessage('Isi username, email valid, dan kata sandi minimal 8 karakter.');
                return false;
            }
            return { username, email, nomor_hp, password };
        }
    });

    if (!result.isConfirmed) return;

    try {
        const response = await apiCall(`/admin/savers/${saverId}/credentials`, 'POST', result.value);
        await loadAdminNasabah();
        Swal.fire('Akun Dibuat', response.message, 'success');
    } catch (error) {
        Swal.fire('Gagal Membuat Akun', error.message || 'Akun Saver tidak berhasil dibuat.', 'error');
    }
}

async function editMember(userId) {
    try {
        const response = await apiCall(`${memberManagementEndpoint()}/${userId}`);
        openMemberModal(response.data);
    } catch (error) {
        Swal.fire('Gagal Memuat Anggota', error.message || 'Terjadi kesalahan sistem.', 'error');
    }
}

function memberManagementEndpoint() {
    return Auth.getRole() === 'teller' ? '/teller/members' : '/admin/members';
}

function openMemberModal(member = null) {
    const editing = Boolean(member);
    Swal.fire({
        title: `<span class="text-lg font-bold text-slate-800">${editing ? 'Ubah Anggota' : 'Tambah Anggota'}</span>`,
        html: `
            <div class="space-y-3 text-left text-xs">
                <div>
                    <label class="block font-bold text-slate-600 mb-1">NIS</label>
                    <input id="member-number" type="text" value="${member?.student_number || ''}" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono" placeholder="Contoh: 10203050">
                </div>
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Nama Lengkap Siswa</label>
                    <input id="member-name" type="text" value="${member?.student_name || ''}" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="Contoh: Andi Pratama">
                </div>
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Nomor HP</label>
                    <input id="member-phone" type="tel" maxlength="20" value="${escapeHtml(member?.nomor_hp || '')}" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="08xxxxxxxxxx">
                </div>
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Jenis Kelamin</label>
                    <select id="member-gender" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white">
                        <option value="">Pilih jenis kelamin</option>
                        <option value="Laki-laki" ${member?.gender === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
                        <option value="Perempuan" ${member?.gender === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Kelas</label>
                    <input id="member-class" type="text" maxlength="20" value="${escapeHtml(member?.class || '')}" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="Contoh: XI RPL 1">
                </div>
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Angkatan Keluar</label>
                    <input id="member-graduation-year" type="number" min="2000" max="2100" value="${member?.graduation_year || new Date().getFullYear()}" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#138f9c',
        cancelButtonColor: '#64748b',
        confirmButtonText: editing ? 'Simpan Perubahan' : 'Simpan Anggota',
        cancelButtonText: 'Batal',
        preConfirm: async () => {
            const payload = {
                student_number: document.getElementById('member-number').value.trim(),
                student_name: document.getElementById('member-name').value.trim(),
                class: document.getElementById('member-class').value.trim() || null,
                nomor_hp: document.getElementById('member-phone').value.trim() || null,
                gender: document.getElementById('member-gender').value || null,
                graduation_year: Number(document.getElementById('member-graduation-year').value),
            };
            if (!payload.student_number || !payload.student_name || !payload.graduation_year) {
                Swal.showValidationMessage('Lengkapi NIS, nama siswa, dan angkatan keluar.');
                return false;
            }

            try {
                return await apiCall(`${memberManagementEndpoint()}${editing ? `/${member.user_id}` : ''}`, editing ? 'PUT' : 'POST', payload);
            } catch (err) {
                Swal.showValidationMessage(err.message || 'Gagal menyimpan anggota.');
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            Swal.fire('Berhasil', editing ? 'Data anggota berhasil diperbarui.' : 'Anggota berhasil ditambahkan.', 'success');
            if (Auth.getRole() === 'teller') {
                loadTellerMembers();
            } else {
                loadAdminMembers();
            }
        }
    });
}

async function deleteMember(userId) {
    const confirmation = await Swal.fire({
        icon: 'warning',
        title: 'Hapus anggota?',
        text: 'Akun siswa yang terkait juga akan dihapus.',
        showCancelButton: true,
        confirmButtonText: 'Hapus',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;

    try {
        await apiCall(`${memberManagementEndpoint()}/${userId}`, 'DELETE');
        if (Auth.getRole() === 'teller') {
            await loadTellerMembers();
        } else {
            await loadAdminMembers();
        }
        Swal.fire('Terhapus', 'Data anggota berhasil dihapus.', 'success');
    } catch (error) {
        Swal.fire('Gagal Menghapus', error.message || 'Terjadi kesalahan sistem.', 'error');
    }
}

// ============================================================================
// [FITUR 13] KELOLA PENGGUNA STAF INTERNAL (Admin, Supervisor, Teller)
// - Deskripsi : Menambah staf baru (role Teller / Supervisor), melihat daftar staf,
//               dan menghapus user staf dengan tetap menjaga histori transaksi.
// - Cari Cepat: FITUR_KELOLA_STAF
// ============================================================================
function openModalTambahUser() {
    Swal.fire({
        title: '<span class="text-lg font-bold text-slate-800">Tambah Pengguna Staf</span>',
        html: `
            <div class="space-y-3 text-left text-xs">
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Username</label>
                    <input id="swal-user-username" type="text" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="teller2 / spv2">
                </div>
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Nama Petugas</label>
                    <input id="swal-user-nama" type="text" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="Nama Lengkap & Gelar">
                </div>
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Role Jabatan</label>
                    <select id="swal-user-role" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white">
                        <option value="teller">Piket Teller Loket</option>
                        <option value="supervisor">Supervisor / Kepala Bank</option>
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-slate-600 mb-1">Kata Sandi (Minimal 6 Karakter)</label>
                    <div class="relative">
                        <input id="swal-user-password" type="password" class="w-full px-3 py-2 pr-10 border rounded-lg" placeholder="******">
                        <button type="button" onclick="toggleCredentialVisibility('swal-user-password', this)" aria-label="Lihat password" title="Lihat password" class="absolute inset-y-0 right-0 px-3 text-slate-500"><i class="fa-solid fa-eye"></i></button>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#138f9c',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Simpan User',
        cancelButtonText: 'Batal',
        preConfirm: async () => {
            const username = document.getElementById('swal-user-username').value.trim();
            const nama_petugas = document.getElementById('swal-user-nama').value.trim();
            const role = document.getElementById('swal-user-role').value;
            const password = document.getElementById('swal-user-password').value;

            if (!username || !nama_petugas || password.length < 6) {
                Swal.showValidationMessage('Semua field wajib diisi dan password minimal 6 karakter!');
                return false;
            }

            try {
                const res = await apiCall('/admin/users', 'POST', { username, nama_petugas, role, password });
                return res;
            } catch (err) {
                Swal.showValidationMessage(err.message || 'Gagal menyimpan user.');
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Berhasil', 'User staf baru berhasil didaftarkan.', 'success');
            loadAdminUsers();
        }
    });
}

function deleteUser(id) {
    Swal.fire({
        title: 'Hapus User Staf?',
        text: 'Akun akan dihapus dari daftar aktif dan akses login dicabut. Riwayat transaksi dan audit tetap tersimpan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await apiCall(`/admin/users/${id}`, 'DELETE');
                await Swal.fire('Terhapus', response.message || 'Akun staf berhasil dihapus.', 'success');
                await loadAdminUsers();
            } catch (err) {
                Swal.fire('Gagal Menghapus', err.message || 'Terjadi kesalahan sistem.', 'error');
            }
        }
    });
}

// ============================================================================
// [FITUR 14] KARTU DIGITAL & CETAK QR CODE NASABAH
// - Deskripsi : Menampilkan kartu digital siswa dengan QR Code dinamis berbasis nomor
//               rekening, unduh file gambar PNG QR, dan cetak kartu.
// - Cari Cepat: FITUR_KARTU_DIGITAL_QR
// ============================================================================
function showKartuQR(noRekening, namaSiswa, kelas) {
    Swal.fire({
        title: '<span class="text-base font-bold text-slate-800">Kartu Digital Nasabah</span>',
        html: `
            <div id="card-nasabah-preview" class="p-6 bg-gradient-to-br from-teal-600 to-cyan-800 rounded-2xl text-white shadow-xl max-w-sm mx-auto text-left relative overflow-hidden">
                <div class="flex justify-between items-center mb-4 border-b border-white/20 pb-3">
                    <div class="flex items-center gap-2">
                        <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="w-6 h-6 object-contain rounded-full bg-white p-0.5">
                        <span class="font-extrabold text-sm tracking-wider">BANK MINI</span>
                    </div>
                    <span class="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">KARTU SISWA</span>
                </div>

                <div class="flex items-center gap-4">
                    <div id="qrcode-container" class="bg-white p-2 rounded-xl shadow-md inline-block cursor-pointer" title="Klik untuk download QR"></div>
                    <div class="space-y-1">
                        <div class="text-[10px] text-emerald-200 uppercase font-bold tracking-wider">No. Rekening</div>
                        <div class="font-mono font-extrabold text-sm tracking-wider">${noRekening}</div>
                        <div class="text-xs font-bold pt-1">${namaSiswa}</div>
                        <div class="text-[11px] text-emerald-100">${kelas}</div>
                    </div>
                </div>
            </div>
        `,
        confirmButtonColor: '#138f9c',
        confirmButtonText: '<i class="fa-solid fa-print"></i> Cetak Kartu',
        showCloseButton: true,
        didOpen: () => {
            const qrPayload = `${window.location.origin}/profil/${encodeURIComponent(noRekening)}`;

            new QRCode(document.getElementById('qrcode-container'), {
                text: qrPayload, // <--- Payload URL IP yang baru
                width: 160,
                height: 160,
                colorDark: '#0f172a',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            document.getElementById('qrcode-container').addEventListener('click', () => {
                downloadQrCode('qrcode-container', `QR-${noRekening}`);
            });
        }
    }).then((res) => {
        if (res.isConfirmed) {
            printPage('card');
        }
    });
}

function printPage(mode, afterPrint = () => {}) {
    const printClass = `printing-${mode}`;
    document.body.classList.add(printClass);

    let cleanupTimer;
    const cleanup = () => {
        window.removeEventListener('afterprint', cleanup);
        window.clearTimeout(cleanupTimer);
        document.body.classList.remove(printClass);
        afterPrint();
        window.focus();
    };

    cleanupTimer = window.setTimeout(cleanup, 60000);
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
}

function downloadQrCode(containerId, fileName) {
    const qrElement = document.getElementById(containerId);
    const canvas = qrElement?.querySelector('canvas');
    const image = qrElement?.querySelector('img');
    const imageUrl = canvas ? canvas.toDataURL('image/png') : image?.src;

    if (!imageUrl) {
        Swal.fire('Gagal Download', 'QR belum selesai dibuat. Silakan coba lagi.', 'error');
        return;
    }

    Swal.fire({
        title: 'Download QR?',
        text: 'Simpan gambar QR rekening ini ke perangkat?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#138f9c',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fa-solid fa-download"></i> Download QR',
        cancelButtonText: 'Batal'
    }).then(result => {
        if (!result.isConfirmed) return;

        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${fileName}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
}

// ============================================================================
// [FITUR 15] VIEW: DASHBOARD LOKET TELLER
// - Deskripsi : Tampilan utama loket Teller: panel pencarian nasabah, pemindai QR kamera,
//               tab Setoran Tunai, tab Penarikan Tunai, dan panel Penutupan Kas Harian.
// - Cari Cepat: FITUR_TELLER_LAYOUT
// ============================================================================
Views.TellerLayout = () => {
    const user = Auth.getUser();
    return `
        <div class="min-h-screen bg-slate-100 flex flex-col">
            <!-- TOPBAR -->
            <header class="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                        <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="w-9 h-9 object-contain">
                    </div>
                    <div>
                        <h2 class="font-bold text-slate-800 text-base leading-tight">Loket Piket Teller</h2>
                        <p class="text-xs text-slate-500 font-medium">Transaksi Kas Loket & Penutupan Kas Harian</p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="text-right hidden sm:block">
                        <div class="text-xs font-bold text-slate-700">${user?.nama_petugas || 'Teller'}</div>
                        <span class="inline-block px-2 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-bold rounded-full uppercase">Piket Teller</span>
                    </div>
                    <button onclick="handleLogout()" class="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Logout">
                        <i class="fa-solid fa-right-from-bracket text-base"></i>
                    </button>
                </div>
            </header>

            <nav class="mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-4 pt-4 sm:px-6">
                <button id="teller-nav-transactions" onclick="switchTellerPage('transactions')" class="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white">
                    <i class="fa-solid fa-cash-register mr-1"></i> Loket
                </button>
                <button id="teller-nav-members" onclick="switchTellerPage('members')" class="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                    <i class="fa-solid fa-user-graduate mr-1"></i> Data Member
                </button>
                <button id="teller-nav-savers" onclick="switchTellerPage('savers')" class="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                    <i class="fa-solid fa-piggy-bank mr-1"></i> Data Saver
                </button>
            </nav>

            <!-- MAIN TELLER WORKSPACE -->
            <main id="teller-panel-transactions" class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section class="lg:col-span-12 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
                    <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div class="min-w-0 flex-1">
                            <h3 class="font-bold text-slate-800">Modal Awal & Status Layanan</h3>
                            <p id="teller-service-message" class="mt-1 text-xs text-slate-500">Masukkan modal awal kas untuk membuka layanan hari ini.</p>
                        </div>
                        <div class="flex justify-start sm:justify-end sm:ml-auto">
                            <span id="teller-service-status-badge" class="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-extrabold text-slate-700 bg-slate-100 border-slate-200">
                                Status: <span id="teller-service-status-label" role="status" aria-live="polite" class="ml-1">Memuat...</span>
                            </span>
                        </div>
                        <form id="form-teller-modal-awal" onsubmit="saveTellerOpeningCash(event)" class="flex flex-wrap items-end gap-2">
                            <label class="text-xs font-semibold text-slate-600">Modal awal (Rp)
                                <input id="input-teller-modal-awal" type="number" min="0" step="1" required class="mt-1 block w-48 rounded-lg border border-slate-300 px-3 py-2 font-mono">
                            </label>
                            <button type="submit" class="rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700">
                                <i class="fa-solid fa-door-open mr-1"></i> Simpan & Buka
                            </button>
                        </form>
                        <div id="teller-modal-awal-actions" class="hidden">
                            <button id="btn-teller-service-toggle" type="button" onclick="toggleTellerService()" class="rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600">
                                Istirahat
                            </button>
                        </div>
                    </div>
                </section>

                <div id="teller-transaction-workspace" class="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <!-- KOLOM KIRI: SCANNER & PROFIL NASABAH (5 KOLOM) -->
                <div class="lg:col-span-5 space-y-6">
                    
                    <!-- BOX SCANNER & PENCARIAN -->
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div class="flex items-center justify-between">
                            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <i class="fa-solid fa-qrcode text-teal-600"></i> Identifikasi Nasabah
                            </h3>
                            <div class="flex items-center gap-2">
                                <label for="input-foto-kartu" class="text-xs font-bold text-teal-600 hover:underline cursor-pointer">
                                    <i class="fa-solid fa-image"></i> Foto Kartu
                                </label>
                                <input id="input-foto-kartu" type="file" accept="image/*" capture="environment" class="hidden" onchange="cariNasabahDariFoto(event)">
                                <button id="btn-toggle-scanner" onclick="toggleCameraScanner()" class="text-xs font-bold text-teal-600 hover:underline">
                                    <i class="fa-solid fa-camera"></i> Nyalakan Kamera
                                </button>
                            </div>
                        </div>

                        <!-- LIVE CAMERA QR SCANNER CONTAINER -->
                        <div id="reader-container" class="hidden rounded-xl overflow-hidden border-2 border-dashed border-teal-500 bg-slate-50">
                            <div id="reader" class="w-full"></div>
                            <p id="scanner-status" role="status" aria-live="polite" class="border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                                Kamera belakang akan dipilih otomatis jika tersedia.
                            </p>
                        </div>

                        <!-- MANUAL SEARCH INPUT -->
                        <div class="flex gap-2">
                            <input type="text" id="teller-query-nasabah" placeholder="Ketik No Rekening atau NIS..."
                                class="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                            <button onclick="cariNasabahTeller()" class="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow transition">
                                <i class="fa-solid fa-search"></i>
                            </button>
                        </div>
                    </div>

                    <!-- BOX PROFIL NASABAH AKTIF -->
                    <div id="teller-box-profil" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div class="text-center py-8 text-slate-400 text-xs">
                            <i class="fa-solid fa-id-card text-4xl mb-2 text-slate-300"></i>
                            <p>Silakan scan QR kartu atau cari nomor rekening nasabah di atas.</p>
                        </div>
                    </div>
                </div>

                <!-- KOLOM KANAN: EKSEKUSI TRANSAKSI & PENUTUPAN KAS (7 KOLOM) -->
                <div class="lg:col-span-7 space-y-6">
                    
                    <!-- TAB AKSI TRANSAKSI LOKET -->
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div class="flex border-b border-slate-200 bg-slate-50">
                            <button onclick="switchTellerAction('setor')" id="tab-teller-setor"
                                class="flex-1 py-3.5 text-xs font-bold text-emerald-700 border-b-2 border-emerald-600 flex items-center justify-center gap-2">
                                <i class="fa-solid fa-circle-arrow-down"></i> Setoran Tunai Loket
                            </button>
                            <button onclick="switchTellerAction('tarik')" id="tab-teller-tarik"
                                class="flex-1 py-3.5 text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2">
                                <i class="fa-solid fa-circle-arrow-up"></i> Penarikan Tunai Loket
                            </button>
                            <button onclick="switchTellerAction('penutupan')" id="tab-teller-penutupan"
                                class="flex-1 py-3.5 text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2">
                                <i class="fa-solid fa-vault"></i> Penutupan Kas Harian
                            </button>
                        </div>

                        <div class="p-6">
                            <div class="mb-4 flex items-center justify-between gap-3 p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-xs">
                                <div>
                                    <strong class="block text-teal-800">Sisa Kas Tersedia</strong>
                                    <p class="text-teal-700 mt-0.5">Modal awal + setoran - penarikan tunai hari ini.</p>
                                </div>
                                <strong id="teller-modal-awal-status" role="status" aria-live="polite" class="font-mono font-extrabold text-teal-900">Memuat modal awal...</strong>
                            </div>
                            <!-- FORM SETORAN TUNAI -->
                            <form id="form-teller-setor" onsubmit="handleProsesSetoran(event)" class="space-y-4">
                                <div class="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-800">
                                    <i class="fa-solid fa-info-circle mr-1"></i> <strong>Setoran Tunai:</strong> Uang kas fisik diterima dari nasabah dan otomatis dicatat ke Jurnal (Debet 101 Kas, Kredit 201 Tabungan).
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Nominal Setoran (Rupiah)</label>
                                    <div class="relative">
                                        <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center font-bold text-slate-400 text-sm">Rp</span>
                                        <input type="number" id="input-setor-nominal" min="1000" step="500" required placeholder="0"
                                            class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                                    </div>
                                </div>

                                            <button type="submit" id="btn-proses-setor"
                                    class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-check-circle"></i> Proses Setoran Kas & Cetak Struk
                                </button>
                            </form>

                            <!-- FORM PENARIKAN TUNAI (HIDDEN DEFAULT) -->
                            <form id="form-teller-tarik" onsubmit="handleProsesPenarikan(event)" class="space-y-4 hidden">
                                <div class="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-800">
                                    <i class="fa-solid fa-shield-halved mr-1"></i> <strong>Penarikan Tunai:</strong> Memerlukan otorisasi PIN 6-digit nasabah dan wajib menyisakan saldo mengendap minimal <strong>Rp 10.000</strong>.
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Nominal Penarikan (Rupiah)</label>
                                    <div class="relative">
                                        <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center font-bold text-slate-400 text-sm">Rp</span>
                                        <input type="number" id="input-tarik-nominal" min="1000" step="500" required placeholder="0"
                                            class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-slate-700 mb-1.5">PIN Otorisasi Nasabah (6 Digit)</label>
                                    <div class="relative">
                                        <input type="password" id="input-tarik-pin" maxlength="6" pattern="[0-9]{6}" required placeholder="Nasabah mengetik PIN"
                                            class="w-full px-4 py-2.5 pr-11 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm tracking-widest focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                        <button type="button" onclick="toggleCredentialVisibility('input-tarik-pin', this)" aria-label="Lihat PIN" title="Lihat PIN" class="absolute inset-y-0 right-0 px-3 text-slate-500"><i class="fa-solid fa-eye"></i></button>
                                    </div>
                                    <button type="button" onclick="startCredentialRecovery('pin', currentNasabahAktif?.id)" class="mt-1.5 text-xs font-semibold text-amber-700 hover:underline">Lupa PIN? Kirim OTP ke email Saver</button>
                                </div>

                                <button type="submit" id="btn-proses-tarik"
                                    class="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-money-bill-wave"></i> Proses Penarikan Kas & Cetak Struk
                                </button>
                            </form>

                            <!-- PANEL PENUTUPAN KAS HARIAN (HIDDEN DEFAULT) -->
                            <div id="panel-teller-penutupan" class="space-y-4 hidden">
                                <div class="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-800">
                                    <i class="fa-solid fa-file-invoice-dollar mr-1"></i> <strong>Rekonsiliasi Kas Harian:</strong> Hitung total mutasi kas fisik di laci Anda dan serahkan ke Admin/Supervisor. Jika pengajuan ditolak, cocokkan uang fisik dengan saldo akhir sistem sebelum mengajukan ulang.
                                </div>

                                <div id="box-summary-penutupan" class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                                    <div class="text-center text-slate-400 py-3">Memuat ringkasan mutasi hari ini...</div>
                                </div>

                                <form onsubmit="handlePenutupanKasSubmit(event)" class="space-y-3">
                                    <div>
                                        <label class="block text-xs font-bold text-slate-700 mb-1">Uang Fisik Kas di Laci (Hasil Hitung Fisik)</label>
                                        <input type="number" id="penutupan-uang-fisik" oninput="updateCashClosureBalanceStatus()" required min="0" placeholder="Hitungan fisik kasir..."
                                            class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm">
                                        <p id="penutupan-balance-status" class="mt-1 text-[11px] text-slate-500">Masukkan uang fisik untuk membandingkan dengan saldo akhir sistem.</p>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-slate-700 mb-1">Catatan Teller (Opsional)</label>
                                        <textarea id="penutupan-catatan" rows="2" placeholder="Catatan kondisi kas jika ada selisih..."
                                            class="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs"></textarea>
                                    </div>
                                    <button type="submit" id="btn-submit-penutupan" class="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow transition">
                                        <i class="fa-solid fa-paper-plane mr-1"></i> Serahkan Laporan ke Supervisor
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
                <section class="lg:col-span-12 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <div>
                            <h3 class="font-bold text-slate-800">Riwayat Kas Harian</h3>
                            <p class="text-xs text-slate-500 mt-1">Kas yang sudah diserahkan ke Admin/Supervisor tidak lagi ditampilkan di sini.</p>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                <tr>
                                    <th class="py-3 px-4 font-bold">Tanggal</th>
                                    <th class="py-3 px-4 font-bold text-right">Saldo Awal</th>
                                    <th class="py-3 px-4 font-bold text-right">Setoran</th>
                                    <th class="py-3 px-4 font-bold text-right">Penarikan</th>
                                    <th class="py-3 px-4 font-bold text-right">Saldo Akhir Sistem</th>
                                    <th class="py-3 px-4 font-bold text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-teller-kas-history" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                <tr><td colspan="6" class="text-center py-6 text-slate-400">Memuat riwayat kas harian...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            <main id="teller-panel-members" class="hidden flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
                <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 class="text-lg font-bold text-slate-800">Data Member</h3>
                            <p class="text-xs text-slate-500">Lihat data member dan buat akun Saver untuk member yang sudah diimpor admin.</p>
                        </div>
                        <button id="btn-teller-member-service-toggle" type="button" onclick="toggleTellerService()" class="hidden rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600">
                            Istirahat
                        </button>
                    </div>
                    <input id="teller-member-search" type="search" oninput="searchTellerMembers()" placeholder="Cari berdasarkan NIS atau nama..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[900px] text-left text-xs">
                            <thead class="border-b bg-slate-50 text-slate-600">
                                <tr>
                                    <th class="px-4 py-3">NIS</th><th class="px-4 py-3">Nama</th><th class="px-4 py-3">Kelas</th>
                                    <th class="px-4 py-3">Angkatan Keluar</th><th class="px-4 py-3">Nomor HP</th><th class="px-4 py-3">Gender</th>
                                    <th class="px-4 py-3">Status</th><th class="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-teller-members" class="divide-y divide-slate-100">
                                <tr><td colspan="8" class="py-8 text-center text-slate-400">Memuat data Member...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            <main id="teller-panel-savers" class="hidden flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
                <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div>
                        <h3 class="text-lg font-bold text-slate-800">Data Saver</h3>
                        <p class="text-xs text-slate-500">Akun Saver bertambah setelah Teller mengaktifkan Member.</p>
                    </div>
                    <input id="teller-saver-search" type="search" oninput="searchTellerSavers()" placeholder="Cari nama, NIS, atau nomor rekening..."
                        class="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[900px] text-left text-xs">
                            <thead class="border-b bg-slate-50 text-slate-600">
                                <tr>
                                    <th class="px-4 py-3">No. Rekening</th><th class="px-4 py-3">NIS</th><th class="px-4 py-3">Nama</th>
                                    <th class="px-4 py-3">Kelas</th><th class="px-4 py-3">Username</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Saldo</th><th class="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-teller-savers" class="divide-y divide-slate-100">
                                <tr><td colspan="8" class="py-8 text-center text-slate-400">Memuat data Saver...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    `;
};

// ============================================================================
// [FITUR 16] TELLER: INISIALISASI & NAVIGASI LOKET
// - Deskripsi : Inisialisasi event teller, cek modal awal hari ini, load riwayat kas,
//               dan navigasi antar tab (Transaksi, Member, Saver).
// - Cari Cepat: FITUR_TELLER_NAVIGASI
// ============================================================================
let currentNasabahAktif = null;
let html5QrScanner = null;
let cameraScannerBusy = false;
let cameraScanHandled = false;
let currentCashClosureSummary = null;
let currentTellerServiceStatus = 'not_started';
let tellerMemberSearchTimeout;
let tellerSaverSearchTimeout;

function initTellerEvents() {
    currentNasabahAktif = null;
    if (html5QrScanner) {
        stopCameraScanner();
    }
    loadModalAwalKas();
    loadSummaryPenutupanToday();
    loadTellerCashHistory();
}

function switchTellerPage(page) {
    const pages = {
        transactions: document.getElementById('teller-panel-transactions'),
        members: document.getElementById('teller-panel-members'),
        savers: document.getElementById('teller-panel-savers'),
    };
    if (!pages[page]) return;

    Object.entries(pages).forEach(([name, element]) => {
        element.classList.toggle('hidden', name !== page);
        const button = document.getElementById(`teller-nav-${name}`);
        button.className = name === page
            ? 'rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white'
            : 'rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-600';
    });

    if (page === 'members') loadTellerMembers();
    if (page === 'savers') loadTellerSavers();
}

async function loadModalAwalKas() {
    try {
        const res = await apiCall('/teller/modal-awal');
        const data = res.data;
        const status = document.getElementById('teller-modal-awal-status');
        if (!status) return;
        currentTellerServiceStatus = data.status_layanan;
        status.textContent = data.sudah_diatur ? formatRupiah(data.sisa_modal ?? data.nominal) : 'Belum diatur';

        const form = document.getElementById('form-teller-modal-awal');
        const input = document.getElementById('input-teller-modal-awal');
        const actions = document.getElementById('teller-modal-awal-actions');
        const toggle = document.getElementById('btn-teller-service-toggle');
        const memberToggle = document.getElementById('btn-teller-member-service-toggle');
        const label = document.getElementById('teller-service-status-label');
        const statusBadge = document.getElementById('teller-service-status-badge');
        const message = document.getElementById('teller-service-message');
        const workspace = document.getElementById('teller-transaction-workspace');
        const closed = data.status_layanan === 'closed';
        const supportsServiceStatus = data.supports_service_status !== false;
        const statusStyles = {
            open: 'border-emerald-200 bg-emerald-100 text-emerald-800',
            resting: 'border-orange-200 bg-orange-100 text-orange-800',
            closed: 'border-red-200 bg-red-100 text-red-800',
            not_started: 'border-slate-200 bg-slate-100 text-slate-700',
        };

        form?.classList.toggle('hidden', data.sudah_diatur || closed);
        if (input && data.sudah_diatur) input.value = data.nominal;
        actions?.classList.toggle('hidden', !data.sudah_diatur || closed || !supportsServiceStatus);
        [toggle, memberToggle].forEach(button => {
            if (!button) return;
            button.classList.toggle('hidden', !data.sudah_diatur || closed || !supportsServiceStatus);
            button.textContent = data.status_layanan === 'resting' ? 'Mulai Layanan' : 'Istirahat';
            button.className = `${button.className.replace(/\b(?:bg-amber-500|hover:bg-amber-600|bg-emerald-600|hover:bg-emerald-700)\b/g, '').trim()} ${
                data.status_layanan === 'resting'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-500 hover:bg-amber-600'
            }`;
        });
        const labels = {
            not_started: 'Belum Buka',
            open: 'Buka',
            resting: 'Istirahat',
            closed: 'Tutup',
        };
        const serviceStatus = data.status_layanan || 'not_started';
        if (label) label.textContent = labels[serviceStatus] || 'Belum Buka';
        if (statusBadge) {
            statusBadge.className = `inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-extrabold ${statusStyles[serviceStatus] || statusStyles.not_started}`;
        }
        if (message) {
            message.textContent = data.status_layanan === 'open'
                ? supportsServiceStatus
                    ? 'Layanan teller aktif. Anda dapat menerima transaksi.'
                    : 'Layanan aktif. Perbarui struktur database untuk mengaktifkan tombol istirahat.'
                : data.status_layanan === 'resting'
                    ? 'Layanan teller sedang istirahat. Transaksi dinonaktifkan sampai layanan dimulai kembali.'
                    : closed
                        ? 'Kas hari ini sudah ditutup dan diserahkan.'
                        : 'Masukkan modal awal kas untuk membuka layanan hari ini.';
        }
        workspace?.classList.toggle('hidden', data.status_layanan !== 'open');
    } catch (error) {
        console.error(error);
        const label = document.getElementById('teller-service-status-label');
        if (label) label.textContent = error.message || 'Status tidak dapat dimuat';
    }
}

async function saveTellerOpeningCash(event) {
    event.preventDefault();
    const nominal = Number(document.getElementById('input-teller-modal-awal').value);
    if (!Number.isSafeInteger(nominal) || nominal < 0) {
        await Swal.fire('Nominal Tidak Valid', 'Masukkan modal awal berupa angka bulat minimal Rp 0.', 'warning');
        return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const response = await apiCall('/teller/modal-awal', 'POST', { nominal });
        await Swal.fire('Layanan Dibuka', response.message, 'success');
        await loadModalAwalKas();
        await loadSummaryPenutupanToday();
    } catch (error) {
        await Swal.fire('Gagal Membuka Layanan', error.message || 'Modal awal tidak dapat disimpan.', 'error');
    } finally {
        button.disabled = false;
    }
}

async function toggleTellerService() {
    const nextStatus = currentTellerServiceStatus === 'resting' ? 'open' : 'resting';
    const buttons = [
        document.getElementById('btn-teller-service-toggle'),
        document.getElementById('btn-teller-member-service-toggle')
    ].filter(Boolean);
    buttons.forEach(button => button.disabled = true);
    try {
        const response = await apiCall('/teller/layanan/status', 'PATCH', { status: nextStatus });
        await loadModalAwalKas();
        await Swal.fire(nextStatus === 'resting' ? 'Istirahat' : 'Layanan Dibuka', response.message, 'success');
    } catch (error) {
        await Swal.fire('Status Layanan Gagal Diubah', error.message || 'Silakan coba lagi.', 'error');
    } finally {
        buttons.forEach(button => button.disabled = false);
    }
}

// ============================================================================
// [FITUR 17] TELLER: PENCARIAN & PEMILIHAN NASABAH (Cari Member & Saver)
// - Deskripsi : Mencari nasabah secara instan berdasarkan nomor rekening, NIS,
//               atau nama siswa untuk dimasukkan ke form transaksi kas.
// - Cari Cepat: FITUR_TELLER_CARI_NASABAH
// ============================================================================
function searchTellerMembers() {
    clearTimeout(tellerMemberSearchTimeout);
    tellerMemberSearchTimeout = setTimeout(loadTellerMembers, 250);
}

async function loadTellerSavers() {
    const tbody = document.getElementById('tbody-teller-savers');
    if (!tbody) return;

    try {
        const response = await apiCall('/teller/savers');
        const query = document.getElementById('teller-saver-search')?.value.trim().toLowerCase() || '';
        const savers = (response.data || []).filter(item =>
            [item.no_rekening, item.nis, item.nama_siswa].some(value => String(value || '').toLowerCase().includes(query))
        );
        if (!savers.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">${query ? 'Saver tidak ditemukan.' : 'Belum ada data Saver.'}</td></tr>`;
            return;
        }
        tbody.innerHTML = savers.map(item => `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-mono">${escapeHtml(item.no_rekening || 'Belum ada rekening')}</td>
                <td class="px-4 py-3 font-mono">${escapeHtml(item.nis)}</td>
                <td class="px-4 py-3 font-semibold">${escapeHtml(item.nama_siswa)}</td>
                <td class="px-4 py-3">${escapeHtml(item.kelas || '-')}</td>
                <td class="px-4 py-3">${escapeHtml(item.username || '-')}</td>
                <td class="px-4 py-3">${!item.has_login ? 'Belum ada login' : item.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td class="px-4 py-3 text-right font-mono font-bold">${formatRupiah(item.saldo)}</td>
                <td class="px-4 py-3 text-center">${item.closure_pending
                    ? '<span class="whitespace-nowrap rounded-lg bg-amber-100 px-3 py-1.5 text-[10px] font-bold text-amber-800">Menunggu ACC Admin</span>'
                    : `<button type="button" data-saver-id="${item.id}" data-saver-name="${escapeHtml(item.nama_siswa)}" data-saver-balance="${Number(item.saldo) || 0}" onclick="closeTellerSaverAccount(this.dataset.saverId, this.dataset.saverName, Number(this.dataset.saverBalance))" class="whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-bold ${Number(item.saldo) > 0 ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}">${Number(item.saldo) > 0 ? 'Tarik & Ajukan Hapus' : 'Ajukan Hapus'}</button>`}</td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-red-600">${escapeHtml(error.message || 'Data Saver gagal dimuat.')}</td></tr>`;
    }
}

async function closeTellerSaverAccount(saverId, namaSiswa, saldo) {
    const perluTarik = saldo > 0;
    const result = await Swal.fire({
        title: perluTarik ? 'Tarik semua saldo & ajukan penghapusan?' : 'Ajukan penghapusan akun Saver?',
        html: `<div class="space-y-2 text-left"><p>Pengajuan penutupan akun <strong>${escapeHtml(namaSiswa)}</strong> akan dikirim ke Admin.</p>${perluTarik ? `<p>Seluruh saldo <strong>${formatRupiah(saldo)}</strong> akan ditarik sebagai transaksi Teller. Saldo mengendap Rp10.000 hanya dikecualikan untuk penutupan akun ini.</p>` : '<p>Saldo rekening saat ini Rp0.</p>'}<p>Akun tetap tersimpan sampai Admin menyetujui penghapusannya.</p><label for="close-saver-pin" class="mt-3 block text-sm font-semibold">PIN keamanan nasabah (6 digit)</label><input id="close-saver-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="swal2-input" placeholder="Masukkan PIN"></div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: perluTarik ? 'Tarik & Ajukan' : 'Ajukan Penghapusan',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const pin = document.getElementById('close-saver-pin')?.value.trim() || '';
            if (!/^\d{6}$/.test(pin)) {
                Swal.showValidationMessage('PIN nasabah harus terdiri dari 6 digit.');
                return false;
            }
            return { pin_keamanan: pin };
        }
    });

    if (!result.isConfirmed) return;

    try {
        const response = await apiCall(`/teller/savers/${saverId}/close-account`, 'POST', result.value);
        await loadTellerSavers();
        await loadModalAwalKas();
        await Swal.fire('Pengajuan Dikirim', `${response.message}${response.data.saldo_ditarik > 0 ? ` Jumlah penarikan: ${formatRupiah(response.data.saldo_ditarik)}.` : ''}`, 'success');
    } catch (error) {
        await Swal.fire('Penutupan Akun Gagal', error.message || 'Akun tidak berhasil ditutup.', 'error');
    }
}

function searchTellerSavers() {
    clearTimeout(tellerSaverSearchTimeout);
    tellerSaverSearchTimeout = setTimeout(loadTellerSavers, 250);
}

async function loadTellerCashHistory() {
    const tbody = document.getElementById('tbody-teller-kas-history');
    if (!tbody) return;

    try {
        const res = await apiCall('/teller/penutupan-kas/history');
        if (!res.data.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-slate-400">Belum ada riwayat kas yang dapat ditampilkan.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data.map(item => `
            <tr class="hover:bg-slate-50">
                <td class="py-3 px-4 font-mono">${escapeHtml(formatDate(item.tanggal))}</td>
                <td class="py-3 px-4 text-right font-mono">${formatRupiah(item.saldo_awal)}</td>
                <td class="py-3 px-4 text-right font-mono text-emerald-700">${formatRupiah(item.total_setoran)}</td>
                <td class="py-3 px-4 text-right font-mono text-amber-700">${formatRupiah(item.total_penarikan)}</td>
                <td class="py-3 px-4 text-right font-mono font-bold">${formatRupiah(item.saldo_akhir_sistem)}</td>
                <td class="py-3 px-4 text-center">
                    ${item.status_penutupan === 'rejected'
                        ? `<span class="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-bold uppercase" title="${escapeHtml(item.catatan_penolakan || '')}">Ditolak</span>`
                        : '<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">Belum Diserahkan</span>'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-red-600">${escapeHtml(error.message || 'Riwayat kas harian tidak dapat dimuat.')}</td></tr>`;
    }
}

function switchTellerAction(action) {
    const tabSetor = document.getElementById('tab-teller-setor');
    const tabTarik = document.getElementById('tab-teller-tarik');
    const tabPenutupan = document.getElementById('tab-teller-penutupan');

    const formSetor = document.getElementById('form-teller-setor');
    const formTarik = document.getElementById('form-teller-tarik');
    const panelPenutupan = document.getElementById('panel-teller-penutupan');

    [tabSetor, tabTarik, tabPenutupan].forEach(t => t.className = "flex-1 py-3.5 text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2");
    [formSetor, formTarik, panelPenutupan].forEach(f => f.classList.add('hidden'));

    if (action === 'setor') {
        tabSetor.className = "flex-1 py-3.5 text-xs font-bold text-emerald-700 border-b-2 border-emerald-600 flex items-center justify-center gap-2";
        formSetor.classList.remove('hidden');
    } else if (action === 'tarik') {
        tabTarik.className = "flex-1 py-3.5 text-xs font-bold text-amber-700 border-b-2 border-amber-600 flex items-center justify-center gap-2";
        formTarik.classList.remove('hidden');
    } else if (action === 'penutupan') {
        tabPenutupan.className = "flex-1 py-3.5 text-xs font-bold text-teal-700 border-b-2 border-teal-600 flex items-center justify-center gap-2";
        panelPenutupan.classList.remove('hidden');
        loadSummaryPenutupanToday();
    }
}

// ============================================================================
// [FITUR 18] TELLER: PEMINDAI QR CODE (Webcam & Upload File Foto QR)
// - Deskripsi : Mengaktifkan kamera scanner HTML5-QRCode, menangani izin browser,
//               membaca barcode gambar QR, dan mengurai nomor rekening nasabah.
// - Cari Cepat: FITUR_TELLER_SCAN_QR_KAMERA
// ============================================================================
function setCameraScannerStatus(message, isError = false) {
    const status = document.getElementById('scanner-status');
    if (!status) return;

    status.textContent = message;
    status.className = `border-t border-slate-200 px-3 py-2 text-xs ${isError ? 'text-red-700 bg-red-50' : 'text-slate-600'}`;
}

function getCameraScannerError(error) {
    const errorName = error?.name || '';
    const errorMessage = String(error?.message || error || '').toLowerCase();

    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || /permission denied|not allowed/.test(errorMessage)) {
        return 'Izin kamera ditolak. Buka pengaturan situs dari ikon di bilah alamat, izinkan Kamera, lalu tekan Coba Lagi.';
    }
    if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError' || /no camera|camera not found/.test(errorMessage)) {
        return 'Kamera tidak ditemukan. Sambungkan kamera atau gunakan Foto Kartu maupun pencarian manual.';
    }
    if (errorName === 'NotReadableError' || errorName === 'TrackStartError' || /could not start video source|device in use/.test(errorMessage)) {
        return 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.';
    }
    return 'Kamera gagal dibuka. Periksa izin browser dan pastikan kamera tidak sedang digunakan aplikasi lain.';
}

async function stopCameraScanner() {
    const scanner = html5QrScanner;
    html5QrScanner = null;

    if (scanner) {
        try {
            await scanner.stop();
        } catch (error) {
            console.debug('QR scanner stop:', error);
        }
        try {
            await scanner.clear();
        } catch (error) {
            console.debug('QR scanner cleanup:', error);
        }
    }

    const container = document.getElementById('reader-container');
    const btn = document.getElementById('btn-toggle-scanner');
    container?.classList.add('hidden');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-camera"></i> Nyalakan Kamera`;
    }
}

async function toggleCameraScanner() {
    if (cameraScannerBusy) return;

    if (html5QrScanner) {
        cameraScannerBusy = true;
        try {
            await stopCameraScanner();
        } finally {
            cameraScannerBusy = false;
        }
        return;
    }

    const container = document.getElementById('reader-container');
    const btn = document.getElementById('btn-toggle-scanner');
    container.classList.remove('hidden');

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraScannerStatus('Akses kamera memerlukan HTTPS atau localhost. Buka aplikasi melalui localhost di komputer ini, atau gunakan koneksi HTTPS.', true);
        btn.innerHTML = `<i class="fa-solid fa-camera"></i> Coba Lagi`;
        return;
    }
    if (typeof Html5Qrcode === 'undefined') {
        setCameraScannerStatus('Pemindai QR belum termuat. Periksa koneksi internet, muat ulang halaman, lalu coba lagi.', true);
        btn.innerHTML = `<i class="fa-solid fa-camera"></i> Coba Lagi`;
        return;
    }

    cameraScannerBusy = true;
    cameraScanHandled = false;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Meminta Izin...`;
    setCameraScannerStatus('Izinkan akses kamera pada dialog browser. Kamera belakang akan digunakan bila tersedia.');

    const scanConfig = {
        fps: 15,
        qrbox: { width: 280, height: 280 },
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    };
    const onScanSuccess = (decodedText) => {
        if (cameraScanHandled) return;
        cameraScanHandled = true;
        const queryInput = document.getElementById('teller-query-nasabah');
        if (queryInput) queryInput.value = decodedText;
        stopCameraScanner().finally(() => cariNasabahTeller(decodedText));
    };

    try {
        html5QrScanner = new Html5Qrcode('reader');
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        const rearCamera = cameras.find(camera => /back|rear|environment|belakang/i.test(camera.label));
        try {
            await html5QrScanner.start(rearCamera?.id || { facingMode: 'environment' }, scanConfig, onScanSuccess, () => {});
        } catch (preferredCameraError) {
            if (!['OverconstrainedError', 'NotFoundError', 'DevicesNotFoundError', 'TypeError'].includes(preferredCameraError?.name)) {
                throw preferredCameraError;
            }
            const fallbackCamera = rearCamera
                ? { facingMode: 'environment' }
                : cameras[0]?.id;
            if (!fallbackCamera) throw preferredCameraError;

            await html5QrScanner.start(fallbackCamera, scanConfig, onScanSuccess, () => {});
        }
        const cameraVideo = document.querySelector('#reader video');
        cameraVideo?.style.setProperty('transform', 'none', 'important');
        cameraVideo?.style.setProperty('-webkit-transform', 'none', 'important');
        setCameraScannerStatus('Kamera aktif. Arahkan QR kartu nasabah ke dalam bingkai.');
        btn.innerHTML = `<i class="fa-solid fa-stop"></i> Matikan Kamera`;
    } catch (error) {
        console.error('QR camera startup error:', error);
        const scanner = html5QrScanner;
        html5QrScanner = null;
        if (scanner) {
            try {
                await scanner.clear();
            } catch (cleanupError) {
                console.debug('QR scanner cleanup:', cleanupError);
            }
        }
        setCameraScannerStatus(getCameraScannerError(error), true);
        btn.innerHTML = `<i class="fa-solid fa-camera"></i> Coba Lagi`;
    } finally {
        cameraScannerBusy = false;
        btn.disabled = false;
    }
}

async function cariNasabahDariFoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const elementId = `foto-qr-${Date.now()}`;
    const container = document.createElement('div');
    container.id = elementId;
    container.setAttribute('aria-hidden', 'true');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);

    const scanner = new Html5Qrcode(elementId);
    try {
        const decodedText = await scanner.scanFile(file, true);
        document.getElementById('teller-query-nasabah').value = decodedText;
        await cariNasabahTeller(decodedText);
    } catch (error) {
        console.error('QR photo scan error:', error);
        Swal.fire('QR Tidak Terbaca', 'Foto harus memuat QR kartu nasabah yang jelas. Anda juga dapat memakai pencarian manual.', 'warning');
    } finally {
        try {
            await scanner.clear();
        } catch (cleanupError) {
            console.debug('QR scanner cleanup:', cleanupError);
        }
        container.remove();
    }
}

async function initPublicProfile(identifier) {
    try {
        const result = await apiCall(`/public/nasabah/${encodeURIComponent(identifier)}`);
        document.getElementById('app').innerHTML = Views.PublicProfile(result.data);
    } catch (error) {
        document.getElementById('app').innerHTML = Views.PublicProfileError(error.message || 'Data nasabah tidak tersedia.');
    }
}

async function cariNasabahTeller(queryValue = null) {
    const query = queryValue || document.getElementById('teller-query-nasabah').value.trim();
    if (!query) return;

    try {
        const endpoint = Auth.getRole() === 'teller' && Auth.isLoggedIn()
            ? '/teller/nasabah/scan'
            : '/public/nasabah/scan';
        const res = await apiCall(endpoint, 'POST', { query });
        currentNasabahAktif = res.data;
        renderProfilNasabah(res.data);
    } catch (err) {
        currentNasabahAktif = null;
        document.getElementById('input-setor-nominal').min = '1000';
        document.getElementById('teller-box-profil').innerHTML = `
            <div class="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl text-center">
                <i class="fa-solid fa-triangle-exclamation mb-1 text-base"></i>
                <p>${err.message || 'Nasabah tidak ditemukan.'}</p>
            </div>
        `;
    }
}

// ============================================================================
// [FITUR 19] TELLER: KARTU PROFIL & INFORMASI SALDO NASABAH
// - Deskripsi : Menampilkan kartu profil nasabah terpilih di loket teller
//               (nama, NIS, no rekening, saldo berjalan, saldo yang bisa ditarik).
// - Cari Cepat: FITUR_TELLER_PROFIL_NASABAH
// ============================================================================
function renderProfilNasabah(data) {
    const setoranInput = document.getElementById('input-setor-nominal');
    const depositButton = document.getElementById('btn-proses-setor');
    if (setoranInput) setoranInput.min = '1000';
    if (depositButton) depositButton.disabled = Boolean(data.is_member);

    document.getElementById('teller-box-profil').innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div class="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-lg">
                    ${data.nama_siswa.charAt(0)}
                </div>
                <div>
                    <h4 class="font-extrabold text-slate-800 text-sm">${data.nama_siswa}</h4>
                    <p class="text-xs text-slate-500 font-mono">${data.is_member ? `NIS ${data.nis} &bull; Belum dibuatkan akun` : `${data.no_rekening || 'Belum ada rekening'} &bull; ${data.kelas}`}</p>
                </div>
            </div>

            ${data.is_member ? `
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <i class="fa-solid fa-circle-info mr-1"></i> Member belum memiliki akun Saver. Minta Admin membuatkan akun terlebih dahulu sebelum transaksi di Teller.
                </div>
            ` : ''}
            ${!data.is_member && !data.has_account ? `
                <div class="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800">
                    <i class="fa-solid fa-circle-info mr-1"></i> Akun Saver sudah aktif. Setoran pertama minimal Rp 1.000 akan membuat nomor rekening.
                </div>
            ` : ''}

            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span class="text-[10px] text-slate-400 uppercase font-bold">${data.is_member ? 'Status Akun' : 'Saldo Berjalan'}</span>
                    <div class="font-mono font-extrabold text-emerald-700 text-sm mt-0.5">${data.is_member ? 'Belum dibuatkan' : formatRupiah(data.saldo_berjalan)}</div>
                </div>
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span class="text-[10px] text-slate-400 uppercase font-bold">${data.is_member ? 'Angkatan Keluar' : 'Maks. Bisa Ditarik'}</span>
                    <div class="font-mono font-extrabold text-slate-700 text-sm mt-0.5">${data.is_member ? (data.graduation_year || '-') : formatRupiah(data.batas_penarikan_maksimal)}</div>
                </div>
            </div>

            ${!data.is_member ? `<div class="text-[11px] text-slate-400 italic">
                *Saldo mengendap minimum Rp 10.000 wajib tersisa di rekening.
            </div>` : ''}
        </div>
    `;
}

// ============================================================================
// [FITUR 20] TELLER: TRANSAKSI SETORAN & PENARIKAN TUNAI
// - Deskripsi : Memproses setoran tunai (min Rp 1.000) dan penarikan tunai
//               dengan otorisasi PIN 6-digit serta proteksi saldo mengendap Rp 10.000.
// - Cari Cepat: FITUR_TELLER_TRANSAKSI_SETOR_TARIK
// ============================================================================
async function handleProsesSetoran(e) {
    e.preventDefault();
    if (!currentNasabahAktif) {
        Swal.fire('Perhatian', 'Silakan cari / scan nasabah terlebih dahulu.', 'warning');
        return;
    }

    const nominal = parseInt(document.getElementById('input-setor-nominal').value);
    const btn = document.getElementById('btn-proses-setor');
    if (currentNasabahAktif.is_member) {
        Swal.fire('Akun Belum Dibuat', 'Siswa belum terdaftar sebagai Saver. Minta Admin membuatkan akun terlebih dahulu.', 'warning');
        return;
    }

    btn.disabled = true;
    try {
        const res = await apiCall('/teller/transaksi/setor', 'POST', {
            id_nasabah: currentNasabahAktif.id,
            nominal,
        });

        document.getElementById('input-setor-nominal').value = '';
        await cariNasabahTeller(res.data.no_rekening);
        await loadModalAwalKas();
        tampilkanStrukTransaksi(res.data);
    } catch (err) {
        Swal.fire('Gagal Setor', err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
        btn.disabled = false;
    }
}

async function handleProsesPenarikan(e) {
    e.preventDefault();
    if (!currentNasabahAktif) {
        Swal.fire('Perhatian', 'Silakan cari / scan nasabah terlebih dahulu.', 'warning');
        return;
    }
    if (currentNasabahAktif.is_member) {
        Swal.fire('Rekening Belum Aktif', 'Saver perlu melakukan setoran pertama di Teller untuk mendapatkan rekening sebelum dapat melakukan penarikan.', 'warning');
        return;
    }

    const nominal = parseInt(document.getElementById('input-tarik-nominal').value);
    const pin_keamanan = document.getElementById('input-tarik-pin').value;
    const btn = document.getElementById('btn-proses-tarik');

    btn.disabled = true;
    try {
        const res = await apiCall('/teller/transaksi/tarik', 'POST', {
            id_nasabah: currentNasabahAktif.id,
            nominal,
            pin_keamanan
        });

        document.getElementById('input-tarik-nominal').value = '';
        document.getElementById('input-tarik-pin').value = '';
        await cariNasabahTeller(res.data.no_rekening);
        await loadModalAwalKas();
        tampilkanStrukTransaksi(res.data);
    } catch (err) {
        Swal.fire('Penarikan Gagal', err.message || 'PIN salah atau saldo tidak mencukupi.', 'error');
    } finally {
        btn.disabled = false;
    }
}

// ============================================================================
// [FITUR 21] TELLER: PENUTUPAN KAS HARIAN (CLOSING KAS LOKET)
// - Deskripsi : Menghitung saldo awal + setoran - penarikan = saldo akhir sistem,
//               membandingkan uang fisik di laci dengan sistem, dan submit closing kas.
// - Cari Cepat: FITUR_TELLER_CLOSING_KAS
// ============================================================================
async function loadSummaryPenutupanToday() {
    try {
        const res = await apiCall('/teller/penutupan-kas/summary-today');
        const d = res.data;
        currentCashClosureSummary = d;
        if (d.status_penutupan === 'rejected') {
            const user = Auth.getUser();
            const notificationKey = `bm_kas_rejection_seen_${user?.id}_${d.id_penutupan}`;
            if (localStorage.getItem(notificationKey) !== 'true') {
                localStorage.setItem(notificationKey, 'true');
                Swal.fire({
                    icon: 'warning',
                    title: 'Kas Terakhir Ditolak Admin',
                    text: `Pengajuan penutupan kas terakhir Anda ditolak. ${d.catatan_penolakan || 'Periksa kembali uang fisik dan saldo akhir sistem.'}`,
                    confirmButtonText: 'Periksa Kas',
                    confirmButtonColor: '#d97706'
                });
            }
        }

        document.getElementById('box-summary-penutupan').innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div class="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span class="text-slate-400 block text-[10px] uppercase font-bold">Saldo Awal</span>
                    <span class="font-mono font-bold text-slate-700">${formatRupiah(d.saldo_awal)}</span>
                </div>
                <div class="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span class="text-slate-400 block text-[10px] uppercase font-bold">Total Setoran (+)</span>
                    <span class="font-mono font-bold text-emerald-600">${formatRupiah(d.total_setoran)}</span>
                </div>
                <div class="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span class="text-slate-400 block text-[10px] uppercase font-bold">Total Penarikan (-)</span>
                    <span class="font-mono font-bold text-amber-600">${formatRupiah(d.total_penarikan)}</span>
                </div>
                <div class="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                    <span class="text-emerald-700 block text-[10px] uppercase font-bold">Saldo Akhir Sistem</span>
                    <span class="font-mono font-extrabold ${d.kas_sudah_diserahkan ? 'text-slate-600' : 'text-emerald-800'}">${formatRupiah(d.saldo_akhir_sistem)}</span>
                </div>
            </div>
            ${d.status_penutupan === 'rejected'
                ? `<div class="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong><i class="fa-solid fa-circle-exclamation mr-1"></i> Kas terakhir ditolak Admin/Supervisor:</strong> ${escapeHtml(d.catatan_penolakan || 'Kas harian tidak seimbang.')} Periksa saldo akhir sistem, seimbangkan uang fisik, lalu ajukan ulang.</div>`
                : d.kas_sudah_diserahkan
                    ? `<div class="mt-2 text-center font-bold ${d.status_penutupan === 'approved' ? 'text-emerald-700' : 'text-amber-700'}"><i class="fa-solid ${d.status_penutupan === 'approved' ? 'fa-circle-check' : 'fa-clock'} mr-1"></i> ${d.status_penutupan === 'approved' ? 'Kas disetujui dan diserahkan ke Supervisor.' : 'Kas sudah diserahkan dan menunggu persetujuan Supervisor.'} Saldo teller di-reset.</div>`
                    : ''}
        `;
        updateCashClosureBalanceStatus();
    } catch (e) {
        console.error(e);
    }
}

function updateCashClosureBalanceStatus() {
    const input = document.getElementById('penutupan-uang-fisik');
    const status = document.getElementById('penutupan-balance-status');
    const submitButton = document.getElementById('btn-submit-penutupan');
    if (!input || !status || !submitButton || !currentCashClosureSummary) return;

    const isResubmission = currentCashClosureSummary.status_penutupan === 'rejected';
    const hasAmount = input.value !== '';
    const selisih = hasAmount
        ? Number(input.value) - Number(currentCashClosureSummary.saldo_akhir_sistem)
        : null;
    const isBalanced = selisih === 0;

    if (!hasAmount) {
        status.className = 'mt-1 text-[11px] text-slate-500';
        status.textContent = 'Masukkan uang fisik untuk membandingkan dengan saldo akhir sistem.';
    } else if (isBalanced) {
        status.className = 'mt-1 text-[11px] font-bold text-emerald-700';
        status.textContent = `Seimbang dengan saldo akhir sistem (${formatRupiah(currentCashClosureSummary.saldo_akhir_sistem)}).${isResubmission ? ' Pengajuan ulang dapat diserahkan.' : ''}`;
    } else {
        status.className = 'mt-1 text-[11px] font-bold text-red-700';
        status.textContent = `Belum seimbang. Selisih: ${formatRupiah(selisih)}. Cocokkan dengan saldo akhir sistem.`;
    }

    submitButton.disabled = isResubmission && !isBalanced;
    submitButton.classList.toggle('opacity-50', submitButton.disabled);
    submitButton.classList.toggle('cursor-not-allowed', submitButton.disabled);
}

async function handlePenutupanKasSubmit(e) {
    e.preventDefault();
    const uang_fisik = parseInt(document.getElementById('penutupan-uang-fisik').value);
    const catatan = document.getElementById('penutupan-catatan').value;

    try {
        const modalRes = await apiCall('/teller/modal-awal');
        await apiCall('/teller/penutupan-kas/submit', 'POST', {
            saldo_awal: modalRes.data.nominal,
            uang_fisik,
            catatan
        });

        Swal.fire({
            icon: 'success',
            title: 'Penutupan Kas Diserahkan!',
            text: 'Laporan kas harian berhasil diserahkan ke Supervisor (Status: Pending Approval).',
            confirmButtonColor: '#138f9c'
        }).then(() => {
            document.getElementById('penutupan-uang-fisik').value = '';
            document.getElementById('penutupan-catatan').value = '';
            loadModalAwalKas();
            loadSummaryPenutupanToday();
            loadTellerCashHistory();
            switchTellerAction('setor');
        });
    } catch (err) {
        Swal.fire('Gagal Submit', err.message || 'Terjadi kesalahan sistem.', 'error');
    }
}

// ============================================================================
// [FITUR 22] TELLER: CETAK STRUK TRANSAKSI (Modal Struk & Format Termal)
// - Deskripsi : Menampilkan popup struk transaksi berhasil dan format cetak
//               kertas kasir termal (58mm/80mm) yang siap dicetak ke printer.
// - Cari Cepat: FITUR_TELLER_CETAK_STRUK
// ============================================================================
function tampilkanStrukTransaksi(data) {
    const isSetoran = data.jenis_transaksi === 'SETORAN TUNAI';
    const statusLabel = isSetoran ? 'SETORAN BERHASIL' : 'PENARIKAN BERHASIL';
    const transactionLabel = isSetoran ? 'Setoran Tunai' : 'Penarikan Tunai';

    Swal.fire({
        html: `
            <section class="overflow-hidden rounded-2xl border border-emerald-100 bg-white text-left shadow-sm">
                <header class="bg-gradient-to-br from-emerald-700 to-green-600 px-6 py-6 text-center text-white">
                    <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl">
                        <i class="fa-solid fa-building-columns"></i>
                    </div>
                    <h2 class="text-lg font-extrabold tracking-wide">BANK MINI SEKOLAH</h2>
                    <p class="mt-1 text-[11px] font-medium text-emerald-50">BUKTI TRANSAKSI TELLER</p>
                </header>
                <div class="px-6 py-5">
                    <div class="mb-5 text-center">
                        <div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <i class="fa-solid fa-check text-lg"></i>
                        </div>
                        <p class="text-xs font-extrabold tracking-widest text-emerald-700">${statusLabel}</p>
                        <p class="mt-1 text-[11px] text-slate-500">Transaksi berhasil dicatat dalam sistem.</p>
                    </div>
                    <div class="space-y-3 border-y border-dashed border-emerald-200 py-4 text-xs">
                        <div class="flex justify-between gap-4"><span class="text-slate-500">No. Transaksi</span><strong class="font-mono text-slate-800">TRX-${String(data.id_transaksi).padStart(6, '0')}</strong></div>
                        <div class="flex justify-between gap-4"><span class="text-slate-500">Tanggal</span><strong class="text-right text-slate-800">${escapeHtml(formatDate(data.tanggal))}</strong></div>
                        <div class="flex justify-between gap-4"><span class="text-slate-500">Nama Nasabah</span><strong class="text-right text-slate-800">${escapeHtml(data.nama_siswa)}</strong></div>
                        <div class="flex justify-between gap-4"><span class="text-slate-500">No. Rekening</span><strong class="font-mono text-slate-800">${escapeHtml(data.no_rekening)}</strong></div>
                        <div class="flex justify-between gap-4"><span class="text-slate-500">Teller</span><strong class="text-right text-slate-800">${escapeHtml(data.teller)}</strong></div>
                    </div>
                    <div class="mt-4 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                        <div>
                            <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">${transactionLabel}</p>
                            <p class="mt-1 text-lg font-extrabold text-emerald-800">${formatRupiah(data.nominal)}</p>
                        </div>
                        <i class="fa-solid ${isSetoran ? 'fa-circle-arrow-down' : 'fa-circle-arrow-up'} text-2xl text-emerald-600"></i>
                    </div>
                    <div class="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 px-4 py-3 text-xs">
                        <span class="font-semibold text-slate-600">Saldo Setelah Transaksi</span>
                        <strong class="text-sm font-extrabold text-emerald-700">${formatRupiah(data.saldo_akhir)}</strong>
                    </div>
                    <p class="mt-4 text-center text-[10px] leading-relaxed text-slate-500">Simpan struk ini sebagai bukti transaksi.<br>Terima kasih telah menggunakan Bank Mini Sekolah.</p>
                </div>
            </section>
            <div class="mt-4 grid grid-cols-2 gap-3">
                <button id="btn-struk-pdf" type="button" class="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white shadow-md transition hover:bg-emerald-700">
                    <i class="fa-solid fa-file-pdf mr-2"></i>Cetak Struk PDF
                </button>
                <button id="btn-struk-kembali" type="button" class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                    <i class="fa-solid fa-arrow-left mr-2"></i>Kembali
                </button>
            </div>
            <p class="mt-3 text-center text-[10px] text-slate-400">Pilih “Simpan sebagai PDF” pada dialog cetak untuk mengunduh PDF.</p>
        `,
        width: 460,
        padding: '16px',
        showConfirmButton: false,
        showCancelButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
            popup: 'rounded-3xl'
        },
        didOpen: () => {
            document.getElementById('btn-struk-pdf').addEventListener('click', () => cetakStrukThermal(data));
            document.getElementById('btn-struk-kembali').addEventListener('click', () => Swal.close());
        }
    });
}

function cetakStrukThermal(data) {
    const printArea = document.getElementById('print-area');
    const isSetoran = data.jenis_transaksi === 'SETORAN TUNAI';
    const statusLabel = isSetoran ? 'SETORAN BERHASIL' : 'PENARIKAN BERHASIL';
    const transactionLabel = isSetoran ? 'Setoran Tunai' : 'Penarikan Tunai';

    printArea.innerHTML = `
        <div class="receipt-header">
            <div class="receipt-mark">+</div>
            <div>
                <h1>BANK MINI SEKOLAH</h1>
                <p>E-TELLER & AKUNTANSI KAS LOKET</p>
            </div>
        </div>
        <div class="receipt-status">${statusLabel}</div>
        <div class="receipt-meta">
            <div><span>Tanggal</span><strong>${formatDate(data.tanggal)}</strong></div>
            <div><span>No. Transaksi</span><strong>TRX-${String(data.id_transaksi).padStart(6, '0')}</strong></div>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-customer">
            <div><span>Nama Nasabah</span><strong>${escapeHtml(data.nama_siswa)}</strong></div>
            <div><span>No. Rekening</span><strong>${escapeHtml(data.no_rekening)}</strong></div>
            <div><span>Teller</span><strong>${escapeHtml(data.teller)}</strong></div>
        </div>
        <div class="receipt-transaction">
            <span>${transactionLabel}</span>
            <strong>${formatRupiah(data.nominal)}</strong>
        </div>
        <div class="receipt-balance">
            <span>Saldo Setelah Transaksi</span>
            <strong>${formatRupiah(data.saldo_akhir)}</strong>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-footer">
            <strong>Transaksi berhasil dicatat.</strong>
            <p>Simpan struk ini sebagai bukti transaksi sah.</p>
            <p>Terima kasih telah menggunakan Bank Mini Sekolah.</p>
        </div>
    `;
    printPage('receipt', () => printArea.replaceChildren());
}

// ============================================================================
// [FITUR 23] VIEW: DASHBOARD SUPERVISOR & ADMIN
// - Deskripsi : Tata letak portal pengelola bank mini: tab Approval Penutupan Kas,
//               tab Audit Jurnal Akuntansi, tab Laporan Transaksi, Data Saver, & Member.
// - Cari Cepat: FITUR_SUPERVISOR_LAYOUT
// ============================================================================
Views.SupervisorLayout = () => {
    const user = Auth.getUser();
    const memberActions = memberImportPanel();
    return `
        <div class="min-h-screen bg-slate-100 flex flex-col">
            <!-- TOPBAR -->
            <header class="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                        <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="w-9 h-9 object-contain">
                    </div>
                    <div>
                        <h2 class="font-bold text-slate-800 text-base leading-tight">Portal Pengelola Bank Mini</h2>
                        <p class="text-xs text-slate-500 font-medium">Master Data, Pengawasan Kas & Audit</p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="text-right hidden sm:block">
                        <div class="text-xs font-bold text-slate-700">${user?.nama_petugas || 'Supervisor'}</div>
                        <span class="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full uppercase">${user?.role === 'admin' ? 'Akses Gabungan' : 'Supervisor'}</span>
                    </div>
                    <button onclick="handleLogout()" class="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Logout">
                        <i class="fa-solid fa-right-from-bracket text-base"></i>
                    </button>
                </div>
            </header>

            <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
                <!-- TABS SUPERVISOR -->
                <div class="flex flex-wrap border-b border-slate-200 gap-2 bg-white p-2 rounded-xl shadow-sm">
                    <button onclick="switchSpvTab('approval')" id="spv-tab-approval" 
                        class="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition flex items-center gap-2">
                        <i class="fa-solid fa-vault"></i> Pengajuan Penutupan Kas (Approval)
                    </button>
                    <button onclick="switchSpvTab('audit')" id="spv-tab-audit" 
                        class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2">
                        <i class="fa-solid fa-scale-balanced"></i> Audit Jurnal Akuntansi (101/201)
                    </button>
                    <button onclick="switchSpvTab('laporan')" id="spv-tab-laporan" 
                        class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2">
                        <i class="fa-solid fa-file-invoice"></i> Laporan Transaksi Teller
                    </button>
                    <button onclick="switchSpvTab('nasabah')" id="spv-tab-nasabah"
                        class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2">
                        <i class="fa-solid fa-piggy-bank"></i> Data Saver
                    </button>
                    <button onclick="switchSpvTab('members')" id="spv-tab-members"
                        class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2">
                        <i class="fa-solid fa-user-graduate"></i> Member
                    </button>
                    <button onclick="switchSpvTab('users')" id="spv-tab-users"
                        class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2">
                        <i class="fa-solid fa-user-gear"></i> Akun Staf
                    </button>
                </div>

                <!-- SECTION 1: APPROVAL PENUTUPAN KAS -->
                <div id="spv-sec-approval" class="space-y-4">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                            <div>
                                <h3 class="font-bold text-slate-800">Unduh Rekap Kas Akhir Bulanan</h3>
                                <p class="text-xs text-slate-500 mt-1">Cari rekap penutupan kas atau unduh PDF sesuai bulan dan tahun.</p>
                            </div>
                            <div class="flex flex-wrap items-end gap-2">
                                <label class="text-xs font-semibold text-slate-600">Bulan
                                    <select id="spv-cash-pdf-month" class="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                        ${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${index + 1 === new Date().getMonth() + 1 ? 'selected' : ''}>${new Date(2000, index).toLocaleString('id-ID', { month: 'long' })}</option>`).join('')}
                                    </select>
                                </label>
                                <label class="text-xs font-semibold text-slate-600">Tahun
                                    <input id="spv-cash-pdf-year" type="number" min="2000" max="2100" value="${new Date().getFullYear()}" class="mt-1 block w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                </label>
                                <button onclick="searchMonthlyCashClosure()" class="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow transition">
                                    <i class="fa-solid fa-magnifying-glass mr-1"></i> Cari Rekap
                                </button>
                                <button onclick="downloadMonthlyCashClosurePdf()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow transition">
                                    <i class="fa-solid fa-file-pdf mr-1"></i> Download PDF Bulanan
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="spv-monthly-cash-results" class="hidden"></div>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <h3 class="font-bold text-slate-800 text-base">Riwayat Kas Harian dari Loket Teller</h3>
                        <p class="text-xs text-slate-500 mt-1 mb-4">Laporan yang diserahkan teller tercatat di sini untuk menunggu persetujuan atau melihat hasilnya.</p>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th class="py-3 px-4 font-bold">Tanggal</th>
                                        <th class="py-3 px-4 font-bold">Teller</th>
                                        <th class="py-3 px-4 font-bold text-right">Saldo Sistem</th>
                                        <th class="py-3 px-4 font-bold text-right">Uang Fisik</th>
                                        <th class="py-3 px-4 font-bold text-right">Selisih</th>
                                        <th class="py-3 px-4 font-bold text-center">Status</th>
                                        <th class="py-3 px-4 font-bold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-spv-penutupan" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                    <tr><td colspan="7" class="text-center py-6 text-slate-400">Memuat laporan penutupan...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="spv-sec-laporan" class="space-y-4 hidden">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 class="font-bold text-slate-800 text-sm"><i class="fa-solid fa-filter mr-1"></i> Filter Rekap Riwayat Transaksi</h3>
                        <p class="text-xs text-slate-500 mt-1 mb-3">Rekap semua transaksi, harian (pilih tanggal), atau bulanan (bulan + tahun), dan riwayat per nasabah.</p>
                        <div class="flex flex-wrap items-end gap-2">
                            <label class="text-xs font-semibold text-slate-600">Mode
                                <select id="spv-laporan-mode" onchange="onSpvLaporanModeChange()" class="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                    <option value="semua">Semua Transaksi</option>
                                    <option value="harian">Harian (per tanggal)</option>
                                    <option value="bulanan">Bulanan (bulan + tahun)</option>
                                </select>
                            </label>
                            <label id="spv-laporan-wrap-tanggal" class="text-xs font-semibold text-slate-600 hidden">Tanggal
                                <input id="spv-laporan-tanggal" type="date" class="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                            </label>
                            <label id="spv-laporan-wrap-bulan" class="text-xs font-semibold text-slate-600 hidden">Bulan
                                <select id="spv-laporan-bulan" class="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                    ${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${index + 1 === new Date().getMonth() + 1 ? 'selected' : ''}>${new Date(2000, index).toLocaleString('id-ID', { month: 'long' })}</option>`).join('')}
                                </select>
                            </label>
                            <label id="spv-laporan-wrap-tahun" class="text-xs font-semibold text-slate-600 hidden">Tahun
                                <input id="spv-laporan-tahun" type="number" min="2000" max="2100" value="${new Date().getFullYear()}" class="mt-1 block w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                            </label>
                            <div class="relative w-full sm:w-72">
                                <label for="spv-laporan-nasabah-search" class="text-xs font-semibold text-slate-600">Nasabah</label>
                                <input id="spv-laporan-nasabah-search" type="search" autocomplete="off"
                                    oninput="searchSpvLaporanNasabah()" onblur="hideSpvLaporanNasabahResults()"
                                    placeholder="Ketik nama atau nomor rekening..."
                                    class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                <input id="spv-laporan-nasabah" type="hidden" value="">
                                <div id="spv-laporan-nasabah-results" class="absolute left-0 right-0 top-full z-40 mt-1 hidden max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"></div>
                            </div>
                            <button onclick="loadSpvLaporanTransaksi()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow transition">
                                <i class="fa-solid fa-magnifying-glass"></i> Terapkan
                            </button>
                            <button onclick="downloadSpvLaporanTransaksiPdf()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow transition">
                                <i class="fa-solid fa-file-pdf"></i> Unduh PDF
                            </button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                            <span class="text-xs font-bold uppercase text-emerald-700">Total Penyetoran Teller</span>
                            <strong id="spv-total-setoran" class="block mt-1 text-xl font-mono text-emerald-800">Rp 0</strong>
                        </div>
                        <div class="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                            <span class="text-xs font-bold uppercase text-amber-700">Total Penarikan Teller</span>
                            <strong id="spv-total-penarikan" class="block mt-1 text-xl font-mono text-amber-800">Rp 0</strong>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <h3 class="p-4 font-bold text-slate-800 border-b border-slate-200"><i class="fa-solid fa-arrow-down text-emerald-600 mr-1"></i> Laporan Penyetoran</h3>
                            <div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-50 uppercase"><tr><th class="py-3 px-4">Waktu</th><th class="py-3 px-4">Nasabah</th><th class="py-3 px-4">Teller</th><th class="py-3 px-4 text-right">Nominal</th></tr></thead><tbody id="tbody-spv-setoran" class="divide-y divide-slate-100"><tr><td colspan="4" class="text-center py-6 text-slate-400">Memuat laporan...</td></tr></tbody></table></div>
                        </div>
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <h3 class="p-4 font-bold text-slate-800 border-b border-slate-200"><i class="fa-solid fa-arrow-up text-amber-600 mr-1"></i> Laporan Penarikan</h3>
                            <div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-50 uppercase"><tr><th class="py-3 px-4">Waktu</th><th class="py-3 px-4">Nasabah</th><th class="py-3 px-4">Teller</th><th class="py-3 px-4 text-right">Nominal</th></tr></thead><tbody id="tbody-spv-penarikan" class="divide-y divide-slate-100"><tr><td colspan="4" class="text-center py-6 text-slate-400">Memuat laporan...</td></tr></tbody></table></div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: AUDIT JURNAL AKUNTANSI (HIDDEN DEFAULT) -->
                <div id="spv-sec-audit" class="space-y-4 hidden">
                    <!-- SUMMARY BALANCE INDICATOR -->
                    <div id="spv-balance-card" class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center text-xl">
                                <i class="fa-solid fa-scale-balanced"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800 text-sm">Status Keseimbangan Neraca (Debet vs Kredit)</h4>
                                <p id="spv-balance-status" class="text-xs font-bold text-emerald-600">Checking balance...</p>
                            </div>
                        </div>
                        <div class="flex gap-4 font-mono text-xs">
                            <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                <span class="text-slate-400 block text-[10px] uppercase font-bold">Total Debet (101/201)</span>
                                <span id="spv-total-debet" class="font-bold text-slate-800">Rp 0</span>
                            </div>
                            <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                <span class="text-slate-400 block text-[10px] uppercase font-bold">Total Kredit (101/201)</span>
                                <span id="spv-total-kredit" class="font-bold text-slate-800">Rp 0</span>
                            </div>
                        </div>
                    </div>

                    <!-- TABEL JURNAL AUDIT TRAIL -->
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th class="py-3 px-4 font-bold">Waktu</th>
                                        <th class="py-3 px-4 font-bold">Ref Transaksi</th>
                                        <th class="py-3 px-4 font-bold">Kode Akun</th>
                                        <th class="py-3 px-4 font-bold">Keterangan Akun</th>
                                        <th class="py-3 px-4 font-bold text-right">Debet</th>
                                        <th class="py-3 px-4 font-bold text-right">Kredit</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-spv-jurnal" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                    <tr><td colspan="6" class="text-center py-6 text-slate-400">Memuat jurnal akuntansi...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="spv-sec-members" class="space-y-4 hidden">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                        <div>
                            <h3 class="font-bold text-slate-800 text-lg">Daftar Member Belum Memiliki Akun</h3>
                            <p class="text-xs text-slate-500">${['admin', 'supervisor'].includes(Auth.getRole()) ? 'Upload data siswa satu angkatan. Buatkan akun siswa dari daftar Member; rekening tabungan dibuat Teller saat setoran pertama.' : 'Daftar siswa yang belum memiliki akun Saver.'}</p>
                        </div>
                        ${memberActions}
                    </div>
                    <div class="bg-white p-3 rounded-xl border border-slate-200">
                        <label for="admin-member-search" class="sr-only">Cari Member</label>
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input id="admin-member-search" type="search" oninput="searchAdminMembers()"
                                placeholder="Cari Member berdasarkan NIS atau nama siswa..."
                                class="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th class="py-3.5 px-4 font-bold">NIS</th>
                                        <th class="py-3.5 px-4 font-bold">Nama Siswa</th>
                                        <th class="py-3.5 px-4 font-bold">Kelas</th>
                                        <th class="py-3.5 px-4 font-bold">Angkatan Keluar</th>
                                        <th class="py-3.5 px-4 font-bold">Nomor HP</th>
                                        <th class="py-3.5 px-4 font-bold">Gender</th>
                                        <th class="py-3.5 px-4 font-bold">Status Akun</th>
                                        <th class="py-3.5 px-4 font-bold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-members" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                    <tr><td colspan="8" class="text-center py-8 text-slate-400">Pilih tab untuk memuat anggota.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="spv-sec-nasabah" class="space-y-4 hidden">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                        <div>
                            <h3 class="font-bold text-slate-800 text-lg">Daftar Saver</h3>
                            <p class="text-xs text-slate-500">Siswa yang sudah dibuatkan akun login. Rekening dan kartu QR dibuat saat akun diaktifkan; saldo bertambah saat setoran di Teller.</p>
                        </div>
                    </div>
                    <div class="bg-white p-3 rounded-xl border border-slate-200">
                        <label for="spv-saver-search" class="sr-only">Cari Saver</label>
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input id="spv-saver-search" type="search" oninput="searchAdminSavers()"
                                placeholder="Cari Saver berdasarkan nama, username, NIS, atau no. rekening..."
                                class="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        </div>
                    </div>
                    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th class="py-3.5 px-4 font-bold">No. Rekening</th>
                                        <th class="py-3.5 px-4 font-bold">NIS</th>
                                        <th class="py-3.5 px-4 font-bold">Nama Siswa</th>
                                        <th class="py-3.5 px-4 font-bold">Kelas</th>
                                        <th class="py-3.5 px-4 font-bold">Email</th>
                                        <th class="py-3.5 px-4 font-bold">Nomor HP</th>
                                        <th class="py-3.5 px-4 font-bold">Username</th>
                                        <th class="py-3.5 px-4 font-bold">Status Akun</th>
                                        <th class="py-3.5 px-4 font-bold text-right">Saldo Saat Ini</th>
                                        <th class="py-3.5 px-4 font-bold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-nasabah" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                    <tr><td colspan="10" class="text-center py-8 text-slate-400">Pilih tab untuk memuat data saver.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="spv-sec-users" class="space-y-4 hidden">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                        <div>
                            <h3 class="font-bold text-slate-800 text-lg">Daftar Pengguna Sistem Internal</h3>
                            <p class="text-xs text-slate-500">Kelola akun Supervisor dan Teller</p>
                        </div>
                        <button onclick="openModalTambahUser()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition">
                            <i class="fa-solid fa-user-shield"></i> Tambah User Staf
                        </button>
                    </div>
                    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                        <th class="py-3.5 px-4 font-bold">Username</th>
                                        <th class="py-3.5 px-4 font-bold">Nama Petugas</th>
                                        <th class="py-3.5 px-4 font-bold">Role Akses</th>
                                        <th class="py-3.5 px-4 font-bold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-users" class="divide-y divide-slate-100 text-slate-700 font-medium">
                                    <tr><td colspan="4" class="text-center py-8 text-slate-400">Pilih tab untuk memuat data staf.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;
};

// ============================================================================
// [FITUR 24] SUPERVISOR: INISIALISASI & NAVIGASI TAB PENGELOLA
// - Deskripsi : Navigasi antar tab supervisor (Approval Kas, Audit Jurnal,
//               Laporan Transaksi, Data Saver, Data Member, Akun Staf).
// - Cari Cepat: FITUR_SUPERVISOR_NAVIGASI
// ============================================================================
function initSupervisorEvents() {
    loadSpvPenutupan();
}

function switchSpvTab(tab) {
    const tabs = {
        approval: loadSpvPenutupan,
        audit: loadSpvAuditJurnal,
        laporan: loadSpvLaporanTransaksi,
        nasabah: loadAdminNasabah,
        members: loadAdminMembers,
        users: loadAdminUsers,
    };

    if (!tabs[tab]) return;

    Object.keys(tabs).forEach(tabName => {
        const button = document.getElementById(`spv-tab-${tabName}`);
        const section = document.getElementById(`spv-sec-${tabName}`);
        button.className = tabName === tab
            ? 'px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition flex items-center gap-2'
            : 'px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2';
        section.classList.toggle('hidden', tabName !== tab);
    });

    tabs[tab]();
}

// ============================================================================
// [FITUR 25] SUPERVISOR: LAPORAN REKAPITULASI TRANSAKSI
// - Deskripsi : Memuat seluruh riwayat transaksi setoran dan penarikan kas
//               beserta kalkulasi total uang masuk dan uang keluar.
// - Cari Cepat: FITUR_SUPERVISOR_LAPORAN
// ============================================================================
async function loadSpvLaporanTransaksi() {
    try {
        const mode = document.getElementById('spv-laporan-mode')?.value || 'semua';
        const nasabahId = document.getElementById('spv-laporan-nasabah')?.value || '';
        const nasabahSearch = document.getElementById('spv-laporan-nasabah-search')?.value.trim() || '';
        if (nasabahSearch && !nasabahId) {
            await Swal.fire('Pilih Nasabah', 'Pilih nama atau nomor rekening dari hasil pencarian terlebih dahulu.', 'warning');
            return;
        }
        const params = new URLSearchParams();
        if (mode === 'harian') {
            const tanggal = document.getElementById('spv-laporan-tanggal')?.value || '';
            if (!tanggal) {
                await Swal.fire('Tanggal Wajib', 'Pilih tanggal untuk rekap harian.', 'warning');
                return;
            }
            params.set('tanggal', tanggal);
        } else if (mode === 'bulanan') {
            const bulan = document.getElementById('spv-laporan-bulan')?.value || '';
            const tahun = document.getElementById('spv-laporan-tahun')?.value || '';
            if (!bulan || !tahun || Number(tahun) < 2000 || Number(tahun) > 2100) {
                await Swal.fire('Periode Tidak Valid', 'Pilih bulan dan tahun antara 2000 sampai 2100.', 'warning');
                return;
            }
            params.set('bulan', bulan);
            params.set('tahun', tahun);
        }
        if (nasabahId) params.set('nasabah_id', nasabahId);

        const qs = params.toString();
        const res = await apiCall(`/supervisor/laporan-transaksi${qs ? `?${qs}` : ''}`);

        syncSpvLaporanNasabahOptions(res.nasabah_list || []);

        document.getElementById('spv-total-setoran').innerText = formatRupiah(res.summary.total_setoran);
        document.getElementById('spv-total-penarikan').innerText = formatRupiah(res.summary.total_penarikan);
        const buatBaris = item => `<tr class="hover:bg-slate-50"><td class="py-2.5 px-4 font-mono text-[10px]">${escapeHtml(formatDate(item.tanggal))}</td><td class="py-2.5 px-4"><strong>${escapeHtml(item.nasabah)}</strong><span class="block text-[10px] text-slate-400 font-mono">${escapeHtml(item.no_rekening)}</span></td><td class="py-2.5 px-4">${escapeHtml(item.teller)}</td><td class="py-2.5 px-4 text-right font-mono font-bold">${formatRupiah(item.nominal)}</td></tr>`;
        document.getElementById('tbody-spv-setoran').innerHTML = res.setoran.length ? res.setoran.map(buatBaris).join('') : '<tr><td colspan="4" class="text-center py-6 text-slate-400">Belum ada penyetoran.</td></tr>';
        document.getElementById('tbody-spv-penarikan').innerHTML = res.penarikan.length ? res.penarikan.map(buatBaris).join('') : '<tr><td colspan="4" class="text-center py-6 text-slate-400">Belum ada penarikan.</td></tr>';
    } catch (error) {
        console.error(error);
        const message = escapeHtml(error.message || 'Laporan transaksi tidak dapat dimuat.');
        document.getElementById('spv-total-setoran').innerText = 'Gagal dimuat';
        document.getElementById('spv-total-penarikan').innerText = 'Gagal dimuat';
        document.getElementById('tbody-spv-setoran').innerHTML = `<tr><td colspan="4" class="text-center py-6 text-red-600">${message}</td></tr>`;
        document.getElementById('tbody-spv-penarikan').innerHTML = `<tr><td colspan="4" class="text-center py-6 text-red-600">${message}</td></tr>`;
    }
}

async function downloadSpvLaporanTransaksiPdf() {
    const mode = document.getElementById('spv-laporan-mode')?.value || 'semua';
    const nasabahId = document.getElementById('spv-laporan-nasabah')?.value || '';
    const nasabahSearch = document.getElementById('spv-laporan-nasabah-search')?.value.trim() || '';
    if (nasabahSearch && !nasabahId) {
        await Swal.fire('Pilih Nasabah', 'Pilih nama atau nomor rekening dari hasil pencarian terlebih dahulu.', 'warning');
        return;
    }

    const params = new URLSearchParams();
    let suffix = 'semua';
    if (mode === 'harian') {
        const tanggal = document.getElementById('spv-laporan-tanggal')?.value || '';
        if (!tanggal) {
            await Swal.fire('Tanggal Wajib', 'Pilih tanggal untuk rekap harian.', 'warning');
            return;
        }
        params.set('tanggal', tanggal);
        suffix = tanggal;
    } else if (mode === 'bulanan') {
        const bulan = document.getElementById('spv-laporan-bulan')?.value || '';
        const tahun = document.getElementById('spv-laporan-tahun')?.value || '';
        if (!bulan || !tahun || Number(tahun) < 2000 || Number(tahun) > 2100) {
            await Swal.fire('Periode Tidak Valid', 'Pilih bulan dan tahun antara 2000 sampai 2100.', 'warning');
            return;
        }
        params.set('bulan', bulan);
        params.set('tahun', tahun);
        suffix = `${tahun}-${String(bulan).padStart(2, '0')}`;
    }
    if (nasabahId) {
        params.set('nasabah_id', nasabahId);
        suffix += `-nasabah-${nasabahId}`;
    }

    try {
        const response = await fetch(`${API_BASE}/supervisor/laporan-transaksi/pdf?${params.toString()}`, {
            headers: {
                'Accept': 'application/pdf',
                'Authorization': `Bearer ${Auth.getToken()}`,
            },
        });
        if (!response.ok) {
            let message = 'PDF rekap transaksi tidak dapat diunduh.';
            try {
                const error = await response.json();
                message = error.message || message;
            } catch (parseError) {
                console.error('Gagal membaca respons error PDF:', parseError);
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `rekap-transaksi-${suffix}.pdf`;
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
        console.error(error);
        await Swal.fire('Unduhan Gagal', error.message || 'PDF rekap transaksi tidak dapat diunduh.', 'error');
    }
}

function onSpvLaporanModeChange() {
    const mode = document.getElementById('spv-laporan-mode')?.value || 'semua';
    document.getElementById('spv-laporan-wrap-tanggal')?.classList.toggle('hidden', mode !== 'harian');
    document.getElementById('spv-laporan-wrap-bulan')?.classList.toggle('hidden', mode !== 'bulanan');
    document.getElementById('spv-laporan-wrap-tahun')?.classList.toggle('hidden', mode !== 'bulanan');
}

function syncSpvLaporanNasabahOptions(nasabahList) {
    spvLaporanNasabahList = Array.isArray(nasabahList) ? nasabahList : [];
}

function searchSpvLaporanNasabah() {
    const input = document.getElementById('spv-laporan-nasabah-search');
    const results = document.getElementById('spv-laporan-nasabah-results');
    const selectedId = document.getElementById('spv-laporan-nasabah');
    if (!input || !results || !selectedId) return;

    selectedId.value = '';
    const query = input.value.trim().toLocaleLowerCase('id-ID');
    const matches = spvLaporanNasabahList.filter(item => {
        const name = String(item.nama_siswa || '').toLocaleLowerCase('id-ID');
        const account = String(item.no_rekening || '').toLocaleLowerCase('id-ID');
        return !query || name.includes(query) || account.includes(query);
    }).slice(0, 30);

    const optionButton = (item, label) => `<button type="button" onmousedown="event.preventDefault()" onclick="selectSpvLaporanNasabah('${item ? item.id : ''}')" class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50">${escapeHtml(label)}</button>`;
    const allOption = optionButton(null, 'Semua Nasabah');
    const saverOptions = matches.map(item => {
        const account = item.no_rekening ? ` (${item.no_rekening})` : '';
        const archived = item.is_archived ? ' (diarsipkan)' : '';
        return optionButton(item, `${item.nama_siswa || 'Tanpa nama'}${account}${archived}`);
    }).join('');
    const emptyMessage = matches.length ? '' : '<p class="px-3 py-2 text-sm text-slate-500">Nasabah tidak ditemukan.</p>';
    results.innerHTML = allOption + saverOptions + emptyMessage;
    results.classList.remove('hidden');
}

function selectSpvLaporanNasabah(id) {
    const selectedId = document.getElementById('spv-laporan-nasabah');
    const input = document.getElementById('spv-laporan-nasabah-search');
    const results = document.getElementById('spv-laporan-nasabah-results');
    if (!selectedId || !input || !results) return;

    selectedId.value = id;
    if (!id) {
        input.value = '';
    } else {
        const item = spvLaporanNasabahList.find(nasabah => String(nasabah.id) === String(id));
        if (item) {
            const account = item.no_rekening ? ` (${item.no_rekening})` : '';
            const archived = item.is_archived ? ' (diarsipkan)' : '';
            input.value = `${item.nama_siswa || 'Tanpa nama'}${account}${archived}`;
        }
    }
    results.classList.add('hidden');
}

function hideSpvLaporanNasabahResults() {
    setTimeout(() => document.getElementById('spv-laporan-nasabah-results')?.classList.add('hidden'), 120);
}

// ============================================================================
// [FITUR 26] SUPERVISOR: APPROVAL, REJEKSI, & UNDUH PDF PENUTUPAN KAS
// - Deskripsi : Memeriksa pengajuan penutupan kas harian Teller. Menyetujui jika seimbang,
//               menolak dengan alasan jika selisih, serta mengunduh laporan PDF resmi.
// - Cari Cepat: FITUR_SUPERVISOR_APPROVAL_REJEKSI_KAS
// ============================================================================
async function loadSpvPenutupan() {
    try {
        const res = await apiCall('/supervisor/penutupan-kas');
        const tbody = document.getElementById('tbody-spv-penutupan');
        if (!res.data || res.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">Belum ada pengajuan penutupan kas.</td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.map(item => `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono">${item.tanggal_penutupan}</td>
                <td class="py-3 px-4 font-bold text-slate-800">${item.teller?.nama_petugas || 'Teller'}</td>
                <td class="py-3 px-4 text-right font-mono">${formatRupiah(item.saldo_akhir_sistem)}</td>
                <td class="py-3 px-4 text-right font-mono font-bold">${formatRupiah(item.uang_fisik)}</td>
                <td class="py-3 px-4 text-right font-mono font-bold ${item.selisih === 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${formatRupiah(item.selisih)}
                </td>
                <td class="py-3 px-4 text-center">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                item.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : item.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }">${item.status === 'approved' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Menunggu'}</span>
                    ${item.status === 'rejected' && item.catatan_penolakan ? `<p class="mt-1 max-w-48 text-left text-[10px] text-red-700">${escapeHtml(item.catatan_penolakan)}</p>` : ''}
                </td>
                <td class="py-3 px-4 text-center">
                    ${item.status === 'pending' ? `
                                <div class="flex flex-col items-center gap-1.5">
                                    <button onclick="approvePenutupan(${item.id})" ${item.selisih !== 0 ? 'disabled title="Kas harus seimbang sebelum disetujui."' : ''} class="px-3 py-1.5 ${item.selisih === 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed'} text-white font-bold text-xs rounded-lg shadow transition">
                                        <i class="fa-solid fa-check"></i> Approved
                                    </button>
                                    <button onclick="rejectPenutupan(${item.id})" ${item.selisih === 0 ? 'disabled title="Kas seimbang; pengajuan dapat disetujui."' : ''} class="px-3 py-1.5 ${item.selisih !== 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300 cursor-not-allowed'} text-white font-bold text-xs rounded-lg shadow transition">
                                        <i class="fa-solid fa-xmark"></i> Tolak
                                    </button>
                                </div>
                            ` : item.status === 'approved'
                                ? `<button onclick="downloadPenutupanKasPdf(${item.id})" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow transition"><i class="fa-solid fa-file-pdf"></i> Download PDF</button>`
                                : '<span class="text-slate-400 text-xs italic"><i class="fa-solid fa-lock"></i> Selesai</span>'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

async function downloadPenutupanKasPdf(id) {
    try {
        const response = await fetch(`${API_BASE}/supervisor/penutupan-kas/${id}/pdf`, {
            headers: {
                'Accept': 'application/pdf',
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        if (!response.ok) {
            let message = 'PDF penutupan kas tidak dapat diunduh.';
            try {
                const error = await response.json();
                message = error.message || message;
            } catch (parseError) {
                console.error('Gagal membaca respons error PDF:', parseError);
            }
            throw new Error(message);
        }

        async function downloadMonthlyPenutupanKasPdf() {
            const month = document.getElementById('spv-cash-pdf-month')?.value;
            const year = document.getElementById('spv-cash-pdf-year')?.value;
            if (!month || !year || Number(year) < 2000 || Number(year) > 2100) {
                await Swal.fire('Periode Tidak Valid', 'Pilih bulan dan masukkan tahun antara 2000 sampai 2100.', 'warning');
                return;
            }

            await downloadPdfFile(
                `/supervisor/penutupan-kas/monthly-pdf?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`,
                `rekap-transaksi-bulanan-${year}-${String(month).padStart(2, '0')}.pdf`
            );
        }

        async function downloadPdfFile(endpoint, fallbackFilename) {
            try {
                const response = await fetch(`${API_BASE}${endpoint}`, {
                    headers: {
                        'Accept': 'application/pdf',
                        'Authorization': `Bearer ${Auth.getToken()}`
                    }
                });

                if (!response.ok) {
                    let message = 'PDF penutupan kas tidak dapat diunduh.';
                    try {
                        const error = await response.json();
                        message = error.message || message;
                    } catch (parseError) {
                        console.error('Gagal membaca respons error PDF:', parseError);
                    }
                    throw new Error(message);
                }

                const blob = await response.blob();
                const disposition = response.headers.get('Content-Disposition') || '';
                const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackFilename;
                const downloadUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
            } catch (error) {
                console.error(error);
                await Swal.fire('Unduhan Gagal', error.message || 'PDF penutupan kas tidak dapat diunduh.', 'error');
            }
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `penutupan-kas-${id}.pdf`;
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
        console.error(error);
        Swal.fire('Unduhan Gagal', error.message || 'PDF penutupan kas tidak dapat diunduh.', 'error');
    }
}

async function downloadMonthlyCashClosurePdf() {
    const month = document.getElementById('spv-cash-pdf-month')?.value;
    const year = document.getElementById('spv-cash-pdf-year')?.value;
    if (!month || !year || Number(year) < 2000 || Number(year) > 2100) {
        await Swal.fire('Periode Tidak Valid', 'Pilih bulan dan masukkan tahun antara 2000 sampai 2100.', 'warning');
        return;
    }

    await downloadCashClosurePdf(
        `/supervisor/penutupan-kas/monthly-pdf?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`,
        `rekap-transaksi-bulanan-${year}-${String(month).padStart(2, '0')}.pdf`
    );
}

async function searchMonthlyCashClosure() {
    const month = document.getElementById('spv-cash-pdf-month')?.value;
    const year = document.getElementById('spv-cash-pdf-year')?.value;
    const results = document.getElementById('spv-monthly-cash-results');
    if (!results) return;
    if (!month || !year || Number(year) < 2000 || Number(year) > 2100) {
        await Swal.fire('Periode Tidak Valid', 'Pilih bulan dan masukkan tahun antara 2000 sampai 2100.', 'warning');
        return;
    }

    results.classList.remove('hidden');
    results.innerHTML = '<div class="p-5 text-sm text-slate-500">Memuat rekap penutupan kas...</div>';

    try {
        const response = await apiCall(
            `/supervisor/penutupan-kas/monthly?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`
        );
        const summary = response.summary;
        const transactions = response.data;
        const summaryItems = [
            ['Jumlah Transaksi', summary.total_transaksi],
            ['Jumlah Setoran', summary.jumlah_setoran],
            ['Jumlah Penarikan', summary.jumlah_penarikan],
            ['Total Setoran', formatRupiah(summary.total_setoran)],
            ['Total Penarikan', formatRupiah(summary.total_penarikan)]
        ];

        results.innerHTML = `
            <section class="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="border-b border-slate-100 px-5 py-4">
                    <h3 class="font-bold text-slate-800">Rekap Transaksi ${escapeHtml(response.period.label)}</h3>
                </div>
                <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                    ${summaryItems.map(([label, value]) => `
                        <div class="rounded-xl bg-slate-50 p-3">
                            <p class="text-xs text-slate-500">${escapeHtml(label)}</p>
                            <p class="mt-1 text-sm font-bold text-slate-800">${escapeHtml(String(value))}</p>
                        </div>
                    `).join('')}
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[980px] text-left text-xs">
                        <thead class="bg-slate-50 text-slate-500">
                            <tr>
                                <th class="px-4 py-3">Tanggal &amp; Waktu</th><th class="px-4 py-3">Jenis</th>
                                <th class="px-4 py-3">Saver</th><th class="px-4 py-3">No. Rekening</th>
                                <th class="px-4 py-3">Teller</th><th class="px-4 py-3">Nominal</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${transactions.length ? transactions.map(item => `
                                <tr>
                                    <td class="whitespace-nowrap px-4 py-3">${escapeHtml(item.tanggal || '-')}</td>
                                    <td class="px-4 py-3">${item.jenis_trans === 'setor' ? 'Setoran' : 'Penarikan'}</td>
                                    <td class="px-4 py-3">${escapeHtml(item.nasabah)}</td>
                                    <td class="px-4 py-3">${escapeHtml(item.no_rekening)}</td>
                                    <td class="px-4 py-3">${escapeHtml(item.teller)}</td>
                                    <td class="whitespace-nowrap px-4 py-3 font-semibold">${formatRupiah(item.nominal)}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Tidak ada transaksi pada periode ini.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    } catch (error) {
        results.innerHTML = '';
        results.classList.add('hidden');
        await Swal.fire('Pencarian Gagal', error.message || 'Rekap penutupan kas tidak dapat dimuat.', 'error');
    }
}

async function downloadCashClosurePdf(endpoint, fallbackFilename) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Accept': 'application/pdf',
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });

        if (!response.ok) {
            let message = 'PDF penutupan kas tidak dapat diunduh.';
            try {
                const error = await response.json();
                message = error.message || message;
            } catch (parseError) {
                console.error('Gagal membaca respons error PDF:', parseError);
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackFilename;
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
        console.error(error);
        await Swal.fire('Unduhan Gagal', error.message || 'PDF penutupan kas tidak dapat diunduh.', 'error');
    }
}

function approvePenutupan(id) {
    Swal.fire({
        title: 'Setujui Penutupan Kas?',
        text: 'Kas fisik akan diverifikasi dan resmi dipindahkan ke Brankas Utama.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#257fb6',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Setujui & Pindahkan',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await apiCall(`/supervisor/penutupan-kas/${id}/approve`, 'POST');
                Swal.fire('Disetujui', 'Laporan penutupan kas berhasil disetujui.', 'success');
                loadSpvPenutupan();
            } catch (err) {
                Swal.fire('Gagal Approve', err.message || 'Terjadi kesalahan sistem.', 'error');
            }
        }
    });
}

async function rejectPenutupan(id) {
    const result = await Swal.fire({
        title: 'Tolak Penutupan Kas?',
        text: 'Kas tidak seimbang. Teller akan menerima notifikasi dan dapat mengajukan ulang setelah koreksi.',
        input: 'textarea',
        inputLabel: 'Alasan penolakan',
        inputPlaceholder: 'Jelaskan selisih atau hal yang perlu diperiksa Teller...',
        inputAttributes: { 'aria-label': 'Alasan penolakan penutupan kas' },
        inputValidator: value => value?.trim() ? undefined : 'Alasan penolakan wajib diisi.',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Tolak & Kirim Notifikasi',
        cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
        await apiCall(`/supervisor/penutupan-kas/${id}/reject`, 'POST', {
            alasan_penolakan: result.value.trim()
        });
        await Swal.fire('Kas Ditolak', 'Teller akan melihat notifikasi penolakan saat membuka ringkasan kas.', 'success');
        await loadSpvPenutupan();
    } catch (err) {
        Swal.fire('Gagal Menolak Kas', err.message || 'Terjadi kesalahan sistem.', 'error');
    }
}

// ============================================================================
// [FITUR 27] SUPERVISOR: AUDIT JURNAL AKUNTANSI (Double-Entry Balance)
// - Deskripsi : Memeriksa pembukuan akuntansi ganda kas loket (101) vs tabungan (201),
//               menghitung total debit dan kredit, serta menampilkan status neraca seimbang.
// - Cari Cepat: FITUR_SUPERVISOR_AUDIT_JURNAL
// ============================================================================
async function loadSpvAuditJurnal() {
    try {
        const res = await apiCall('/supervisor/jurnal-akuntansi');
        document.getElementById('spv-total-debet').innerText = formatRupiah(res.summary.total_debet);
        document.getElementById('spv-total-kredit').innerText = formatRupiah(res.summary.total_kredit);

        const balanceStatus = document.getElementById('spv-balance-status');
        if (res.summary.is_balanced) {
            balanceStatus.className = "text-xs font-bold text-emerald-600 flex items-center gap-1";
            balanceStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> NERACA SEIMBANG (BALANCED)`;
        } else {
            balanceStatus.className = "text-xs font-bold text-red-600 flex items-center gap-1";
            balanceStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> NERACA TIDAK SEIMBANG!`;
        }

        const tbody = document.getElementById('tbody-spv-jurnal');
        if (!res.data || res.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">Belum ada catatan jurnal.</td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.map(item => `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-2.5 px-4 font-mono text-[11px]">${formatDate(item.created_at)}</td>
                <td class="py-2.5 px-4 font-mono text-slate-600">TRX-${String(item.id_transaksi).padStart(6, '0')}</td>
                <td class="py-2.5 px-4 font-mono font-bold text-slate-800">${item.kode_akun}</td>
                <td class="py-2.5 px-4 text-slate-700">${item.kode_akun === '101' ? 'Kas Laci Teller' : 'Simpanan Tabungan Nasabah'}</td>
                <td class="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                    ${item.posisi === 'debit' ? formatRupiah(item.jumlah) : '-'}
                </td>
                <td class="py-2.5 px-4 text-right font-mono font-bold text-indigo-700">
                    ${item.posisi === 'kredit' ? formatRupiah(item.jumlah) : '-'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

// ============================================================================
// [FITUR 28] VIEW: PORTAL NASABAH / SISWA (E-PASSBOOK)
// - Deskripsi : Tata letak buku tabungan digital: kartu saldo, QR Code rekening,
//               status operasional bank mini, dan riwayat mutasi 30 hari terakhir.
// - Cari Cepat: FITUR_NASABAH_LAYOUT
// ============================================================================
Views.NasabahLayout = () => {
    const user = Auth.getUser();
    return `
        <div class="min-h-screen bg-slate-100 flex flex-col">
            <header class="bg-emerald-600 text-white px-4 sm:px-6 py-4 flex items-center justify-between shadow-md">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow-sm">
                        <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="w-full h-full object-contain">
                    </div>
                    <div>
                        <h2 class="font-extrabold text-base leading-tight">E-Teller Bank Mini</h2>
                        <p class="text-xs text-emerald-100 font-medium">Tabungan Siswa &bull; SMK Negeri 1 Bantul</p>
                    </div>
                </div>

                <button onclick="handleLogout()" class="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition" title="Logout">
                    <i class="fa-solid fa-right-from-bracket text-base"></i>
                </button>
            </header>

            <main class="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28">
                <section id="nasabah-panel-dashboard" class="space-y-6">
                    <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status Layanan Bank Mini</p>
                            <p id="siswa-bank-status" role="status" aria-live="polite" class="mt-1 text-sm font-extrabold text-slate-600">Memeriksa status layanan...</p>
                        </div>
                        <button onclick="loadNasabahBankStatus()" class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                            <i class="fa-solid fa-rotate mr-1"></i> Perbarui Status
                        </button>
                    </div>
                    <div class="bg-gradient-to-br from-teal-600 via-cyan-700 to-sky-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <span class="text-xs font-bold text-emerald-200 uppercase tracking-widest">Buku Tabungan Digital</span>
                                <h3 class="text-xl sm:text-2xl font-extrabold tracking-tight mt-1" id="siswa-nama-profil">${escapeHtml(user?.nama_siswa || 'Nasabah')}</h3>
                                <p class="text-xs text-emerald-100 font-mono mt-0.5" id="siswa-rek-profil">${escapeHtml(user?.no_rekening || 'Belum ada rekening')} &bull; ${escapeHtml(user?.kelas || '-')}</p>
                            </div>
                            <div id="siswa-qr-container" class="${user?.no_rekening ? 'bg-white p-2 rounded-2xl shadow-lg cursor-pointer' : 'hidden'}" title="Klik untuk download QR"></div>
                        </div>
                        <p id="siswa-account-status" class="text-xs text-emerald-100 ${user?.no_rekening ? 'hidden' : ''}">
                            Akun login sudah aktif. Silakan kunjungi Teller untuk setoran pertama dan pembuatan nomor rekening.
                        </p>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/20">
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">Total Saldo Tabungan</span>
                                <div id="siswa-saldo-total" class="text-xl sm:text-2xl font-black font-mono mt-1 text-white">Rp 0</div>
                            </div>
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">Saldo Mengendap (Wajib)</span>
                                <div class="text-sm font-bold font-mono mt-1 text-emerald-200">Rp 10.000</div>
                            </div>
                            <div>
                                <span class="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">Saldo Dapat Ditarik</span>
                                <div id="siswa-saldo-tersedia" class="text-sm font-bold font-mono mt-1 text-amber-300">Rp 0</div>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-2xl border border-slate-200 p-5">
                        <h4 class="font-bold text-slate-800">Selamat datang, <span id="siswa-dashboard-nama">${escapeHtml(user?.nama_siswa || 'Nasabah')}</span></h4>
                        <p class="mt-1 text-sm text-slate-500">Pantau saldo dan transaksi tabungan Anda melalui menu di bawah.</p>
                    </div>
                </section>

                <section id="nasabah-panel-history" class="hidden space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-lg font-extrabold text-slate-800">Riwayat 30 Hari Terakhir</h3>
                            <p class="text-xs text-slate-500">Transaksi dalam 30 hari terakhir.</p>
                        </div>
                        <button onclick="loadNasabahPortal()" class="text-xs font-bold text-emerald-600 hover:underline">
                            <i class="fa-solid fa-rotate"></i> Refresh
                        </button>
                    </div>
                    <div id="siswa-list-mutasi" class="space-y-2">
                        <div class="text-center py-6 text-slate-400 text-xs">Memuat riwayat transaksi...</div>
                    </div>
                </section>

                <section id="nasabah-panel-print" class="hidden space-y-4">
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 class="text-lg font-extrabold text-slate-800">Cetak Transaksi</h3>
                        <p class="mt-1 text-sm text-slate-500">Cetak riwayat transaksi 30 hari terakhir.</p>
                        <button type="button" onclick="printNasabahTransactions()" class="mt-4 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold">
                            <i class="fa-solid fa-print mr-2"></i>Cetak Transaksi 30 Hari
                        </button>
                    </div>
                    <div id="siswa-print-preview" class="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4"></div>
                </section>

                <section id="nasabah-panel-profile" class="hidden space-y-4">
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 class="text-lg font-extrabold text-slate-800">Profil</h3>
                        <dl class="mt-4 divide-y divide-slate-100">
                            <div class="py-3"><dt class="text-xs text-slate-500">Nama</dt><dd id="siswa-profile-nama" class="mt-1 text-sm font-semibold text-slate-800">-</dd></div>
                            <div class="py-3"><dt class="text-xs text-slate-500">Email</dt><dd id="siswa-profile-email" class="mt-1 text-sm font-semibold text-slate-800">-</dd></div>
                            <div class="py-3"><dt class="text-xs text-slate-500">No. Rekening</dt><dd id="siswa-profile-rekening" class="mt-1 text-sm font-semibold font-mono text-slate-800">-</dd></div>
                            <div class="py-3"><dt class="text-xs text-slate-500">Kelas</dt><dd id="siswa-profile-kelas" class="mt-1 text-sm font-semibold text-slate-800">-</dd></div>
                        </dl>
                    </div>
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h4 class="font-extrabold text-slate-800"><i class="fa-solid fa-shield-halved mr-2 text-emerald-600"></i>Keamanan</h4>
                        <div class="mt-4 grid sm:grid-cols-2 gap-3">
                            <button type="button" onclick="changeNasabahPassword()" class="px-4 py-3 border border-slate-200 rounded-xl text-left hover:border-emerald-400">
                                <span class="block text-sm font-bold text-slate-800">Ubah Kata Sandi</span>
                                <span class="block mt-1 text-xs text-slate-500">Perbarui kata sandi akun Anda.</span>
                            </button>
                            <button type="button" onclick="changeNasabahPin()" class="px-4 py-3 border border-slate-200 rounded-xl text-left hover:border-emerald-400">
                                <span class="block text-sm font-bold text-slate-800">Ubah PIN Transaksi</span>
                                <span class="block mt-1 text-xs text-slate-500">Perbarui PIN transaksi 6 digit.</span>
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            <nav class="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-[0_-4px_14px_rgba(15,23,42,0.08)]">
                <div class="max-w-4xl mx-auto grid grid-cols-4">
                    <button id="nasabah-tab-dashboard" onclick="switchNasabahTab('dashboard')" class="nasabah-bottom-tab flex flex-col items-center gap-1 py-3 text-emerald-700 text-[10px] font-bold" aria-current="page"><i class="fa-solid fa-house text-base"></i>Dashboard</button>
                    <button id="nasabah-tab-history" onclick="switchNasabahTab('history')" class="nasabah-bottom-tab flex flex-col items-center gap-1 py-3 text-slate-500 text-[10px] font-semibold"><i class="fa-solid fa-clock-rotate-left text-base"></i>Riwayat 30 Hari</button>
                    <button id="nasabah-tab-print" onclick="switchNasabahTab('print')" class="nasabah-bottom-tab flex flex-col items-center gap-1 py-3 text-slate-500 text-[10px] font-semibold"><i class="fa-solid fa-print text-base"></i>Cetak Transaksi</button>
                    <button id="nasabah-tab-profile" onclick="switchNasabahTab('profile')" class="nasabah-bottom-tab flex flex-col items-center gap-1 py-3 text-slate-500 text-[10px] font-semibold"><i class="fa-solid fa-user text-base"></i>Profil</button>
                </div>
            </nav>
        </div>
    `;
};

// ============================================================================
// [FITUR 29] NASABAH: MUTASI TABUNGAN, SALDO, & CETAK BUKU
// - Deskripsi : Memuat saldo berjalan, saldo mengendap, mutasi 30 hari terakhir,
//               dan fungsi cetak riwayat transaksi buku tabungan.
// - Cari Cepat: FITUR_NASABAH_MUTASI_PORTAL
// ============================================================================
let nasabahMutasi30Hari = [];
let nasabahBankStatusInterval;

function initNasabahEvents() {
    if (nasabahBankStatusInterval) clearInterval(nasabahBankStatusInterval);
    const user = Auth.getUser();
    if (user && user.no_rekening) {
        new QRCode(document.getElementById('siswa-qr-container'), {
            text: user.no_rekening,
            width: 70,
            height: 70,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
        document.getElementById('siswa-qr-container').addEventListener('click', () => {
            downloadQrCode('siswa-qr-container', `QR-${user.no_rekening}`);
        });
    }
    loadNasabahPortal();
    loadNasabahBankStatus();
    nasabahBankStatusInterval = setInterval(loadNasabahBankStatus, 60000);
}

async function loadNasabahBankStatus() {
    const element = document.getElementById('siswa-bank-status');
    if (!element) return;

    try {
        const response = await apiCall('/public/bank-status');
        const status = response.data.status;
        const styles = {
            open: 'text-emerald-700',
            resting: 'text-amber-700',
            closed: 'text-slate-600',
        };
        element.className = `mt-1 text-sm font-extrabold ${styles[status] || 'text-slate-600'}`;
        element.textContent = `${response.data.status_label || 'Tutup'}${response.data.active_tellers ? ` · ${response.data.active_tellers} teller siap` : ''}${response.data.resting_tellers ? ` · ${response.data.resting_tellers} istirahat` : ''}`;
    } catch (error) {
        element.className = 'mt-1 text-sm font-bold text-red-600';
        element.textContent = 'Status layanan tidak dapat dimuat. Coba perbarui kembali.';
        console.error('Gagal memuat status layanan Bank Mini:', error);
    }
}

async function loadNasabahPortal() {
    try {
        const resSaldo = await apiCall('/nasabah/saldo');
        document.getElementById('siswa-saldo-total').innerText = formatRupiah(resSaldo.data.saldo_berjalan);
        document.getElementById('siswa-saldo-tersedia').innerText = formatRupiah(resSaldo.data.saldo_tersedia_ditarik);
        document.getElementById('siswa-nama-profil').textContent = resSaldo.data.nama_siswa || 'Nasabah';
        document.getElementById('siswa-dashboard-nama').textContent = resSaldo.data.nama_siswa || 'Nasabah';
        document.getElementById('siswa-profile-nama').textContent = resSaldo.data.nama_siswa || '-';
        document.getElementById('siswa-profile-email').textContent = resSaldo.data.email || '-';
        document.getElementById('siswa-profile-rekening').textContent = resSaldo.data.no_rekening || 'Belum ada rekening';
        document.getElementById('siswa-profile-kelas').textContent = resSaldo.data.kelas || '-';
        document.getElementById('siswa-rek-profil').textContent = `${resSaldo.data.no_rekening || 'Belum ada rekening'} • ${resSaldo.data.kelas || '-'}`;
        if (resSaldo.data.no_rekening) {
            const qrContainer = document.getElementById('siswa-qr-container');
            qrContainer.classList.remove('hidden');
            if (!qrContainer.querySelector('canvas, img')) {
                new QRCode(qrContainer, {
                    text: resSaldo.data.no_rekening,
                    width: 70,
                    height: 70,
                    colorDark: '#0f172a',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                qrContainer.addEventListener('click', () => downloadQrCode('siswa-qr-container', `QR-${resSaldo.data.no_rekening}`));
            }
            document.getElementById('siswa-account-status')?.classList.add('hidden');
        }

        const resMutasi = await apiCall('/nasabah/mutasi-30-hari');
        nasabahMutasi30Hari = resMutasi.data || [];
        const container = document.getElementById('siswa-list-mutasi');
        const mutasiHtml = nasabahMutasi30Hari.length === 0
            ? `<div class="text-center py-6 text-slate-400 text-xs">Belum ada transaksi dalam 30 hari terakhir.</div>`
            : nasabahMutasi30Hari.map(item => `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center ${
                        item.jenis_trans === 'setor' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }">
                        <i class="fa-solid ${item.jenis_trans === 'setor' ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i>
                    </div>
                    <div>
                        <h5 class="font-bold text-xs text-slate-800 uppercase">${item.jenis_trans === 'setor' ? 'Setoran Tunai Loket' : 'Penarikan Tunai Loket'}</h5>
                        <p class="text-[10px] text-slate-400 font-mono">${formatDate(item.tanggal)} &bull; Teller: ${item.user?.nama_petugas || '-'}</p>
                    </div>
                </div>
                <div class="text-right font-mono font-bold text-xs ${item.jenis_trans === 'setor' ? 'text-emerald-600' : 'text-amber-600'}">
                    ${item.jenis_trans === 'setor' ? '+' : '-'} ${formatRupiah(item.nominal)}
                </div>
            </div>
        `).join('');
        container.innerHTML = mutasiHtml;
        const printPreview = document.getElementById('siswa-print-preview');
        printPreview.innerHTML = nasabahTransactionTable(nasabahMutasi30Hari);
    } catch (e) {
        console.error(e);
        const container = document.getElementById('siswa-list-mutasi');
        if (container) container.innerHTML = `<div class="text-center py-6 text-rose-600 text-xs">Riwayat transaksi gagal dimuat. Silakan coba refresh.</div>`;
    }
}

function switchNasabahTab(tab) {
    ['dashboard', 'history', 'print', 'profile'].forEach(name => {
        document.getElementById(`nasabah-panel-${name}`).classList.toggle('hidden', name !== tab);
        const button = document.getElementById(`nasabah-tab-${name}`);
        const active = name === tab;
        button.classList.toggle('text-emerald-700', active);
        button.classList.toggle('text-slate-500', !active);
        button.classList.toggle('font-bold', active);
        button.classList.toggle('font-semibold', !active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
}

function nasabahTransactionTable(transactions) {
    if (!transactions.length) {
        return '<p class="py-6 text-center text-sm text-slate-500">Belum ada transaksi dalam 30 hari terakhir.</p>';
    }

    return `
        <table class="w-full min-w-[560px] text-left text-xs">
            <thead class="border-b border-slate-200 text-slate-500 uppercase">
                <tr><th class="py-3 pr-3">Tanggal</th><th class="py-3 pr-3">Jenis</th><th class="py-3 pr-3">Teller</th><th class="py-3 text-right">Nominal</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                ${transactions.map(item => `
                    <tr>
                        <td class="py-3 pr-3 whitespace-nowrap">${escapeHtml(formatDate(item.tanggal))}</td>
                        <td class="py-3 pr-3">${item.jenis_trans === 'setor' ? 'Setoran tunai' : 'Penarikan tunai'}</td>
                        <td class="py-3 pr-3">${escapeHtml(item.user?.nama_petugas || '-')}</td>
                        <td class="py-3 text-right font-mono font-bold">${escapeHtml(formatRupiah(item.nominal))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function printNasabahTransactions() {
    const user = Auth.getUser();
    const printArea = document.getElementById('print-area');
    const dateRange = `${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID')} - ${new Date().toLocaleDateString('id-ID')}`;
    printArea.innerHTML = `
        <div class="nasabah-print-report">
            <header><h1>Laporan Transaksi Bank Mini</h1><p>Riwayat 30 hari terakhir</p></header>
            <div class="nasabah-print-meta">
                <p><strong>Nama:</strong> ${escapeHtml(user?.nama_siswa || 'Nasabah')}</p>
                <p><strong>No. Rekening:</strong> ${escapeHtml(user?.no_rekening || '-')}</p>
                <p><strong>Periode:</strong> ${escapeHtml(dateRange)}</p>
            </div>
            ${nasabahTransactionTable(nasabahMutasi30Hari)}
        </div>
    `;
    printPage('nasabah-history');
}

// ============================================================================
// [FITUR 30] NASABAH: UBAH PASSWORD & PIN MANDIRI
// - Deskripsi : Memungkinkan siswa mengubah kata sandi akun login dan PIN 6-digit
//               transaksi mereka sendiri melalui modal SweetAlert2.
// - Cari Cepat: FITUR_NASABAH_GANTI_PASSWORD_PIN
// ============================================================================
async function changeNasabahPassword() {
    const result = await Swal.fire({
        title: 'Ubah Kata Sandi',
        html: `
            <input id="current-password" type="password" class="swal2-input" placeholder="Kata sandi saat ini">
            <input id="new-password" type="password" minlength="8" class="swal2-input" placeholder="Kata sandi baru (min. 8 karakter)">
            <input id="confirm-password" type="password" minlength="8" class="swal2-input" placeholder="Konfirmasi kata sandi baru">
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmation = document.getElementById('confirm-password').value;
            if (!currentPassword || newPassword.length < 8) {
                Swal.showValidationMessage('Isi kata sandi saat ini dan kata sandi baru minimal 8 karakter.');
                return false;
            }
            if (newPassword !== confirmation) {
                Swal.showValidationMessage('Konfirmasi kata sandi baru tidak sama.');
                return false;
            }
            return { current_password: currentPassword, new_password: newPassword, new_password_confirmation: confirmation };
        }
    });
    if (!result.isConfirmed) return;

    try {
        const response = await apiCall('/nasabah/password', 'POST', result.value);
        await Swal.fire('Berhasil', response.message, 'success');
    } catch (error) {
        Swal.fire('Gagal Mengubah Kata Sandi', error.message || error.errors?.current_password?.[0] || 'Kata sandi tidak dapat diubah.', 'error');
    }
}

async function changeNasabahPin() {
    const result = await Swal.fire({
        title: 'Ubah PIN Transaksi',
        html: `
            <input id="current-pin" type="password" inputmode="numeric" maxlength="6" class="swal2-input" placeholder="PIN saat ini (6 digit)">
            <input id="new-pin" type="password" inputmode="numeric" maxlength="6" class="swal2-input" placeholder="PIN baru (6 digit)">
            <input id="confirm-pin" type="password" inputmode="numeric" maxlength="6" class="swal2-input" placeholder="Konfirmasi PIN baru">
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const currentPin = document.getElementById('current-pin').value;
            const newPin = document.getElementById('new-pin').value;
            const confirmation = document.getElementById('confirm-pin').value;
            if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin)) {
                Swal.showValidationMessage('PIN saat ini dan PIN baru harus terdiri dari 6 digit.');
                return false;
            }
            if (newPin !== confirmation) {
                Swal.showValidationMessage('Konfirmasi PIN baru tidak sama.');
                return false;
            }
            return { current_pin: currentPin, new_pin: newPin, new_pin_confirmation: confirmation };
        }
    });
    if (!result.isConfirmed) return;

    try {
        const response = await apiCall('/nasabah/pin', 'POST', result.value);
        Swal.fire('Berhasil', response.message, 'success');
    } catch (error) {
        Swal.fire('Gagal Mengubah PIN', error.message || error.errors?.current_pin?.[0] || 'PIN transaksi tidak dapat diubah.', 'error');
    }
}

// ============================================================================
// [FITUR 31] INISIALISASI APLIKASI (DOM Ready Auto-Boot)
// - Deskripsi : Memulai router utama saat seluruh halaman DOM selesai dimuat.
// - Cari Cepat: FITUR_INIT_APLIKASI
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    Router.render();
});
