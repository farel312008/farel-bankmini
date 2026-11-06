/**
 * ============================================================================
 * E-TELLER BANK MINI SEKOLAH - CORE FRONTEND JAVASCRIPT ENGINE
 * ============================================================================
 */

const API_BASE = '/api';

// ----------------------------------------------------------------------------
// 1. STATE & STORAGE MANAGEMENT
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 3. FORMATTER UTILITIES
// ----------------------------------------------------------------------------
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
// ----------------------------------------------------------------------------
// 4. ROUTER & PAGE RENDERER
// ----------------------------------------------------------------------------
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
            <p class="max-w-xl text-right text-[10px] text-slate-500">
                Kolom: nis, nama_siswa, kelas (opsional), angkatan_keluar, nomor_hp, gender.
                Gender wajib diisi: Laki-laki/Perempuan, L/P, atau Pria/Wanita. NIS sebaiknya diformat sebagai teks.
                Tidak ada batas minimum atau maksimum jumlah siswa per upload. Baris data yang diisi tetap harus valid.
            </p>
        </div>
    `;
}

// ----------------------------------------------------------------------------
// 5. VIEW: LOGIN PORTAL
// ----------------------------------------------------------------------------
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

    PublicLanding: () => `
        <div class="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-green-50">
            <header class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                <a href="/login" class="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-800 sm:text-sm">
                    <i class="fa-solid fa-user-tie"></i>
                    Login sebagai Pegawai
                </a>
                <div class="flex items-center gap-2.5">
                    <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="h-10 w-10 rounded-xl border border-emerald-100 bg-white object-contain p-1">
                    <div class="hidden text-right sm:block">
                        <p class="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700">Bank Mini Sekolah</p>
                        <p class="text-xs font-extrabold text-slate-800">SMK Negeri 1 Bantul</p>
                    </div>
                </div>
            </header>

            <main>
                <section class="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 md:pt-16 lg:grid-cols-2 lg:px-8 lg:pb-20">
                    <div class="text-center lg:text-left">
                        <span class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 shadow-sm">
                            <i class="fa-solid fa-shield-halved"></i> Layanan keuangan sekolah digital
                        </span>
                        <h1 class="mt-5 text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
                            Belajar mengelola uang dengan <span class="text-emerald-700">lebih mudah.</span>
                        </h1>
                        <p class="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-600 sm:text-base lg:mx-0">
                            Bank Mini Sekolah membantu siswa mengenal kebiasaan menabung dan menghadirkan pengelolaan transaksi sekolah yang tercatat, tertib, dan transparan.
                        </p>
                        <div class="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
                            <a href="#tentang" class="rounded-xl bg-emerald-700 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-800">
                                Kenali Bank Mini <i class="fa-solid fa-arrow-down ml-2"></i>
                            </a>
                            <a href="#keunggulan" class="rounded-xl border border-emerald-200 bg-white px-5 py-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50">
                                Lihat Keunggulan
                            </a>
                        </div>
                    </div>

                    <div class="mx-auto w-full max-w-md">
                        <div class="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-700 via-green-700 to-teal-800 p-1 shadow-2xl shadow-emerald-900/20">
                            <div class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"></div>
                            <div class="relative rounded-[1.8rem] bg-white p-6 text-center sm:p-8">
                                <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
                                    <img src="/images/logo-smkn1-bantul.png" alt="Logo SMK Negeri 1 Bantul" class="h-14 w-14 object-contain">
                                </div>
                                <p class="mt-5 text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700">Akses dalam genggaman</p>
                                <h2 class="mt-2 text-2xl font-black text-slate-900">Bank Mini Mobile</h2>
                                <p class="mx-auto mt-3 max-w-xs text-xs leading-6 text-slate-500">
                                    Gunakan aplikasi Android untuk mengakses layanan Bank Mini Sekolah dengan praktis.
                                </p>
                                ${window.bankMiniApkUrl
                                    ? `<a href="${window.bankMiniApkUrl}" download
                                        class="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-800">
                                        <i class="fa-solid fa-download"></i> Download APK
                                    </a>
                                    <p class="mt-3 text-[10px] text-slate-400">Unduh aplikasi Android Bank Mini Sekolah.</p>`
                                    : `<button type="button" disabled
                                        class="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-slate-300 px-5 py-3.5 text-sm font-extrabold text-white">
                                        <i class="fa-solid fa-clock"></i> APK Segera Tersedia
                                    </button>
                                    <p class="mt-3 text-[10px] text-slate-400">Letakkan file APK di <span class="font-mono">public/downloads/bank-mini.apk</span> untuk mengaktifkan unduhan.</p>`
                                }
                            </div>
                        </div>
                    </div>
                </section>

                <section id="tentang" class="border-y border-emerald-100 bg-white">
                    <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
                        <div class="mx-auto max-w-2xl text-center">
                            <p class="text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700">Tentang layanan</p>
                            <h2 class="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Apa itu Bank Mini Sekolah?</h2>
                            <p class="mt-4 text-sm leading-7 text-slate-600">
                                Bank Mini adalah sarana edukasi keuangan di lingkungan sekolah. Siswa dapat membangun kebiasaan menabung, sementara petugas mengelola setoran, penarikan, dan pencatatan kas melalui sistem yang terintegrasi.
                            </p>
                        </div>
                        <div id="keunggulan" class="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <article class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><i class="fa-solid fa-piggy-bank"></i></div>
                                <h3 class="mt-4 text-sm font-extrabold text-slate-800">Biasakan menabung</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Mendukung edukasi dan kebiasaan mengelola tabungan sejak di sekolah.</p>
                            </article>
                            <article class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><i class="fa-solid fa-bolt"></i></div>
                                <h3 class="mt-4 text-sm font-extrabold text-slate-800">Transaksi tercatat</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Setoran dan penarikan dicatat secara digital dengan bukti transaksi.</p>
                            </article>
                            <article class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><i class="fa-solid fa-chart-pie"></i></div>
                                <h3 class="mt-4 text-sm font-extrabold text-slate-800">Kas lebih terpantau</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Membantu petugas memantau saldo, jurnal, dan laporan kas sekolah.</p>
                            </article>
                            <article class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><i class="fa-solid fa-qrcode"></i></div>
                                <h3 class="mt-4 text-sm font-extrabold text-slate-800">Akses praktis</h3>
                                <p class="mt-2 text-xs leading-6 text-slate-600">Pencarian rekening dan kartu QR membantu layanan berjalan lebih cepat.</p>
                            </article>
                        </div>
                    </div>
                </section>
            </main>

            <footer class="px-4 py-6 text-center text-[11px] text-slate-500">
                Uji Kompetensi Keahlian RPL &copy; 2026 Bank Mini Sekolah
            </footer>
        </div>
    `,

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

// ----------------------------------------------------------------------------
// 6. VIEW: DASHBOARD ADMINISTRATOR
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// HANDLER & EVENT LOGIC: ADMINISTRATOR
// ----------------------------------------------------------------------------
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
    } catch (e) {
        console.error(e);
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
                        ${canManageSaver && !item.has_login ? `
                            <button onclick="setSaverCredentials(${item.id})"
                                class="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-bold rounded-lg border transition">
                                Buat Login
                            </button>
                        ` : canManageSaver ? `
                            <button onclick="toggleSaverStatus(${item.id}, ${!item.is_active})"
                                class="px-2.5 py-1.5 ${item.is_active ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'} font-bold rounded-lg border transition">
                                ${item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button onclick="deleteSaver(${item.id}, decodeURIComponent('${encodeURIComponent(item.nama_siswa)}'))"
                                class="px-2.5 py-1.5 bg-red-50 text-red-700 border-red-200 hover:bg-red-100 font-bold rounded-lg border transition">
                                <i class="fa-solid fa-trash"></i> Hapus
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
                    <button onclick="activateAdminMember(${item.user_id})" class="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold rounded-lg transition" title="Aktifkan akun dan pindahkan ke Saver">
                        <i class="fa-solid fa-user-check"></i> Aktifkan Akun
                    </button>
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
        console.error(error);
    }
}

let memberSearchTimeout;

function searchAdminMembers() {
    clearTimeout(memberSearchTimeout);
    memberSearchTimeout = setTimeout(loadAdminMembers, 250);
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

async function activateAdminMember(userId) {
    const result = await Swal.fire({
        title: 'Buat Akun Saver',
        html: `
            <div class="space-y-3 text-left">
                <label class="block text-sm font-semibold text-slate-700" for="admin-member-username">Username siswa</label>
                <input id="admin-member-username" type="text" maxlength="50" class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <label class="block text-sm font-semibold text-slate-700" for="admin-member-email">Email nasabah untuk OTP (opsional)</label>
                <input id="admin-member-email" type="email" maxlength="255" class="w-full rounded-lg border border-slate-300 px-3 py-2" autocomplete="email">
                <label class="block text-sm font-semibold text-slate-700" for="admin-member-password">Password</label>
                <div class="relative">
                    <input id="admin-member-password" type="password" minlength="8" maxlength="100" class="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10" autocomplete="new-password">
                    <button type="button" onclick="toggleCredentialVisibility('admin-member-password', this)" aria-label="Lihat password" title="Lihat password" class="absolute inset-y-0 right-0 px-3 text-slate-500"><i class="fa-solid fa-eye"></i></button>
                </div>
                <label class="block text-sm font-semibold text-slate-700" for="admin-member-pin">PIN keamanan nasabah (6 digit)</label>
                <div class="relative">
                    <input id="admin-member-pin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" class="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10" autocomplete="new-password">
                    <button type="button" onclick="toggleCredentialVisibility('admin-member-pin', this)" aria-label="Lihat PIN" title="Lihat PIN" class="absolute inset-y-0 right-0 px-3 text-slate-500"><i class="fa-solid fa-eye"></i></button>
                </div>
                <label class="block text-sm font-semibold text-slate-700" for="admin-member-opening-balance">Saldo awal (Rp)</label>
                <input id="admin-member-opening-balance" type="number" min="0" step="1000" value="0" required class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <p class="text-xs text-slate-500">Saldo awal di atas Rp 0 akan dicatat sebagai setoran pembukaan dan masuk ke jurnal.</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Buat Akun',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const username = document.getElementById('admin-member-username').value.trim();
            const email = document.getElementById('admin-member-email').value.trim();
            const password = document.getElementById('admin-member-password').value;
            const security_pin = document.getElementById('admin-member-pin').value.trim();
            const saldo_awal = document.getElementById('admin-member-opening-balance').value;
            if (!username || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || password.length < 8 || !/^\d{6}$/.test(security_pin) || saldo_awal === '' || !Number.isSafeInteger(Number(saldo_awal)) || Number(saldo_awal) < 0) {
                Swal.showValidationMessage('Isi username, email yang valid jika digunakan, password minimal 8 karakter, PIN keamanan 6 digit, dan saldo awal berupa angka minimal Rp 0.');
                return false;
            }
            return { username, email, password, security_pin, saldo_awal: Number(saldo_awal) };
        }
    });

    if (!result.isConfirmed) return;

    try {
        const response = await apiCall(`/admin/members/${userId}/activate`, 'POST', result.value);
        if (Auth.getRole() === 'admin') {
            switchAdminTab('savers');
        } else {
            switchSpvTab('nasabah');
        }
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
        html: `Akun <strong>${escapeHtml(namaSiswa)}</strong> akan dihapus dari daftar aktif dan login akan dinonaktifkan. Data rekening serta seluruh riwayat transaksi tetap disimpan untuk audit.`,
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
        const response = await apiCall(`/admin/members/${userId}`);
        openMemberModal(response.data);
    } catch (error) {
        Swal.fire('Gagal Memuat Anggota', error.message || 'Terjadi kesalahan sistem.', 'error');
    }
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
                nomor_hp: document.getElementById('member-phone').value.trim() || null,
                gender: document.getElementById('member-gender').value || null,
                graduation_year: Number(document.getElementById('member-graduation-year').value),
            };
            if (!payload.student_number || !payload.student_name || !payload.graduation_year) {
                Swal.showValidationMessage('Lengkapi NIS, nama siswa, dan angkatan keluar.');
                return false;
            }

            try {
                return await apiCall(`/admin/members${editing ? `/${member.user_id}` : ''}`, editing ? 'PUT' : 'POST', payload);
            } catch (err) {
                Swal.showValidationMessage(err.message || 'Gagal menyimpan anggota.');
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            Swal.fire('Berhasil', editing ? 'Data anggota berhasil diperbarui.' : 'Anggota berhasil ditambahkan.', 'success');
            loadAdminMembers();
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
        await apiCall(`/admin/members/${userId}`, 'DELETE');
        await loadAdminMembers();
        Swal.fire('Terhapus', 'Data anggota berhasil dihapus.', 'success');
    } catch (error) {
        Swal.fire('Gagal Menghapus', error.message || 'Terjadi kesalahan sistem.', 'error');
    }
}

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

// ----------------------------------------------------------------------------
// 7. VIEW: DASHBOARD PIKET TELLER
// ----------------------------------------------------------------------------
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

            <!-- MAIN TELLER WORKSPACE -->
            <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                
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
                                    <strong class="block text-teal-800">Modal awal kas hari ini</strong>
                                    <p class="text-teal-700 mt-0.5">Informasi modal awal yang dikonfirmasi saat login.</p>
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
        </div>
    `;
};

// ----------------------------------------------------------------------------
// HANDLER & EVENT LOGIC: PIKET TELLER
// ----------------------------------------------------------------------------
let currentNasabahAktif = null;
let html5QrScanner = null;
let cameraScannerBusy = false;
let cameraScanHandled = false;
let currentCashClosureSummary = null;

function initTellerEvents() {
    currentNasabahAktif = null;
    if (html5QrScanner) {
        stopCameraScanner();
    }
    loadModalAwalKas();
    loadSummaryPenutupanToday();
    loadTellerCashHistory();
}

async function loadModalAwalKas() {
    try {
        const res = await apiCall('/teller/modal-awal');
        const status = document.getElementById('teller-modal-awal-status');
        if (!status) return;
        status.textContent = res.data.sudah_diatur
            ? formatRupiah(res.data.nominal)
            : 'Belum diatur';
    } catch (error) {
        console.error(error);
    }
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
        tampilkanStrukTransaksi(res.data);
    } catch (err) {
        Swal.fire('Penarikan Gagal', err.message || 'PIN salah atau saldo tidak mencukupi.', 'error');
    } finally {
        btn.disabled = false;
    }
}

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
            loadSummaryPenutupanToday();
            loadTellerCashHistory();
            switchTellerAction('setor');
        });
    } catch (err) {
        Swal.fire('Gagal Submit', err.message || 'Terjadi kesalahan sistem.', 'error');
    }
}

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

// ----------------------------------------------------------------------------
// 8. VIEW: DASHBOARD SUPERVISOR
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// HANDLER & EVENT LOGIC: SUPERVISOR
// ----------------------------------------------------------------------------
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

async function loadSpvLaporanTransaksi() {
    try {
        const res = await apiCall('/supervisor/laporan-transaksi');
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

// ----------------------------------------------------------------------------
// 9. VIEW: PORTAL NASABAH / SISWA (E-PASSBOOK)
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// HANDLER & EVENT LOGIC: NASABAH / SISWA
// ----------------------------------------------------------------------------
let nasabahMutasi30Hari = [];

function initNasabahEvents() {
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

// ----------------------------------------------------------------------------
// 10. INISIALISASI APLIKASI SAAT HALAMAN SELESAI DIMUAT
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    Router.render();
});
