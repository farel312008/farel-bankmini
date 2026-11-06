<?php

use App\Http\Controllers\Api\Admin\MemberController;
use App\Http\Controllers\Api\Admin\NasabahController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Nasabah\NasabahPortalController;
use App\Http\Controllers\Api\PublicNasabahController;
use App\Http\Controllers\Api\Supervisor\SupervisorController;
use App\Http\Controllers\Api\Teller\PenutupanKasController;
use App\Http\Controllers\Api\Teller\TransaksiController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| 1. PORTAL OTENTIKASI & PROFIL PUBLIK (PUBLIC)
|--------------------------------------------------------------------------
*/
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/login-user', [AuthController::class, 'loginUser']);       // Admin, Teller, Supervisor
    Route::post('/login-nasabah', [AuthController::class, 'loginNasabah']); // Siswa (No Rek / NIS + PIN)
    Route::post('/forgot-credential', [AuthController::class, 'sendCredentialResetOtp']);
    Route::post('/verify-credential-reset-otp', [AuthController::class, 'verifyCredentialResetOtp']);
    Route::post('/reset-credential', [AuthController::class, 'resetCredential']);
});

Route::prefix('public')->group(function () {
    Route::get('/nasabah/{identifier}', [PublicNasabahController::class, 'show']);
    Route::post('/nasabah/scan', [PublicNasabahController::class, 'scan']);
    Route::get('/bank-status', [PublicNasabahController::class, 'bankStatus']);
});

/*
|--------------------------------------------------------------------------
| 2. ENDPOINTS TERPROTEKSI SANCTUM (TOKEN GUARD)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // Auth Shared Endpoints
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // =========================================================================
    // A. MODUL MASTER DATA (Role admin lama dan supervisor)
    // =========================================================================
    Route::middleware('role:admin,supervisor')->prefix('admin')->group(function () {
        Route::apiResource('/users', UserController::class);
        Route::get('/savers', [NasabahController::class, 'index']);
        Route::get('/savers/{id}', [NasabahController::class, 'show']);
        Route::delete('/savers/{id}', [NasabahController::class, 'destroy']);
        Route::post('/savers/{id}/credentials', [NasabahController::class, 'setCredentials']);
        Route::post('/members/import', [MemberController::class, 'import']);
        Route::post('/members/{id}/activate', [MemberController::class, 'activate']);
        Route::patch('/savers/{id}/status', [MemberController::class, 'setSaverStatus']);
        Route::apiResource('/members', MemberController::class);
        Route::get('/nasabah', [NasabahController::class, 'index']);
        Route::get('/jurnal-akuntansi', [SupervisorController::class, 'auditJurnal']);
    });

    // =========================================================================
    // B. MODUL PIKET TELLER (Hanya Role 'teller')
    // =========================================================================
    Route::middleware('role:teller')->prefix('teller')->group(function () {
        Route::get('/modal-awal', [PenutupanKasController::class, 'getModalAwal']);
        Route::post('/modal-awal', [PenutupanKasController::class, 'setModalAwal']);
        Route::post('/nasabah/scan', [TransaksiController::class, 'scanNasabah']);
        Route::post('/savers/{id}/forgot-pin', [AuthController::class, 'sendSaverPinResetOtp']);
        Route::post('/transaksi/setor', [TransaksiController::class, 'setorTunai']);
        Route::post('/transaksi/tarik', [TransaksiController::class, 'tarikTunai']);
        Route::get('/penutupan-kas/summary-today', [PenutupanKasController::class, 'ringkasanHariIni']);
        Route::get('/penutupan-kas/history', [PenutupanKasController::class, 'riwayat']);
        Route::post('/penutupan-kas/submit', [PenutupanKasController::class, 'submit']);
    });

    // =========================================================================
    // C. MODUL SUPERVISOR (Role admin lama dan supervisor)
    // =========================================================================
    Route::middleware('role:admin,supervisor')->prefix('supervisor')->group(function () {
        Route::get('/laporan-transaksi', [SupervisorController::class, 'laporanTransaksi']);
        Route::get('/penutupan-kas', [SupervisorController::class, 'listPenutupanKas']);
        Route::get('/penutupan-kas/monthly', [SupervisorController::class, 'monthlyTransactionRecap']);
        Route::get('/penutupan-kas/monthly-pdf', [SupervisorController::class, 'downloadMonthlyPenutupanKasPdf']);
        Route::get('/penutupan-kas/{id}/pdf', [SupervisorController::class, 'downloadPenutupanKasPdf']);
        Route::post('/penutupan-kas/{id}/approve', [SupervisorController::class, 'approvePenutupanKas']);
        Route::post('/penutupan-kas/{id}/reject', [SupervisorController::class, 'rejectPenutupanKas']);
        Route::get('/jurnal-akuntansi', [SupervisorController::class, 'auditJurnal']);
    });

    // =========================================================================
    // D. MODUL NASABAH / SISWA (Hanya Role 'nasabah')
    // =========================================================================
    Route::middleware('role:nasabah')->prefix('nasabah')->group(function () {
        Route::get('/saldo', [NasabahPortalController::class, 'getSaldo']);
        Route::get('/mutasi', [NasabahPortalController::class, 'getMutasi']);
        Route::get('/mutasi-30-hari', [NasabahPortalController::class, 'getMutasi30Hari']);
        Route::post('/password', [NasabahPortalController::class, 'updatePassword']);
        Route::post('/pin', [NasabahPortalController::class, 'updatePin']);
    });
});
