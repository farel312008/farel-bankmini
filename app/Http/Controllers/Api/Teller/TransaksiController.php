<?php

namespace App\Http\Controllers\Api\Teller;

use App\Http\Controllers\Controller;
use App\Models\JurnalAkuntansi;
use App\Models\Member;
use App\Models\ModalAwalKas;
use App\Models\Nasabah;
use App\Models\PenutupanKas;
use App\Models\SaverClosureRequest;
use App\Models\Transaksi;
use App\Services\SaverAccountNumberGenerator;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class TransaksiController extends Controller
{
    /**
     * 1. Pencarian Profil Nasabah Cepat via QR Code Scanner / No Rekening
     */
    public function scanNasabah(Request $request)
    {
        $request->validate([
            'query' => 'required|string', // Payload QR Code, URL Profil, No Rekening, atau NIS
        ]);

        $query = $request->input('query');
        $decoded = urldecode($query);
        $cleanQuery = $decoded;

        // Ekstrak pola No Rekening (REC + angka) jika memindai URL lengkap
        if (preg_match('/(REC\d+)/i', $decoded, $matches)) {
            $cleanQuery = strtoupper($matches[1]);
        } else {
            $path = parse_url($decoded, PHP_URL_PATH) ?? $decoded;
            $cleanQuery = trim(basename($path));
        }

        $nasabah = Nasabah::with('user:id,is_active')->where('no_rekening', $cleanQuery)
            ->orWhere('nis', $cleanQuery)
            ->orWhere('no_rekening', $query)
            ->orWhere('nis', $query)
            ->first();

        if ($nasabah) {
            if ($nasabah->user && ! $nasabah->user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akun siswa sedang dinonaktifkan oleh Admin.',
                ], 403);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $nasabah->id,
                    'no_rekening' => $nasabah->no_rekening,
                    'nis' => $nasabah->nis,
                    'nama_siswa' => $nasabah->nama_siswa,
                    'kelas' => $nasabah->kelas,
                    'saldo_berjalan' => $nasabah->saldo,
                    'batas_penarikan_maksimal' => max(0, $nasabah->saldo - 10000),
                    'is_member' => false,
                    'has_account' => $nasabah->no_rekening !== null,
                ],
            ]);
        }

        $member = Member::where('student_number', $cleanQuery)
            ->orWhere('student_number', $query)
            ->first();

        if (! $member) {
            return response()->json([
                'success' => false,
                'message' => 'Data anggota atau penabung tidak ditemukan pada sistem.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $member->user_id,
                'id_member' => $member->user_id,
                'nis' => $member->student_number,
                'nama_siswa' => $member->student_name,
                'kelas' => $member->class,
                'graduation_year' => $member->graduation_year,
                'saldo_berjalan' => 0,
                'batas_penarikan_maksimal' => 0,
                'status' => $member->status,
                'is_member' => true,
            ],
        ]);
    }

    /**
     * 2. Eksekusi Setoran Tunai Loket
     */
    public function setorTunai(Request $request, SaverAccountNumberGenerator $accountNumberGenerator)
    {
        if ($request->filled('id_member')) {
            return response()->json([
                'success' => false,
                'message' => 'Siswa harus lebih dulu diaktifkan oleh Teller sebelum dapat melakukan setoran.',
            ], 422);
        }

        if ($response = $this->ensureServiceIsOpen($request)) {
            return $response;
        }

        $validated = $request->validate([
            'id_nasabah' => 'required|exists:savers,id',
            'nominal' => 'required|integer|min:1000',
        ]);

        $user = $request->user();
        $nominal = (int) $validated['nominal'];

        try {
            $receipt = DB::transaction(function () use ($validated, $user, $nominal, $accountNumberGenerator) {
                $nasabah = Nasabah::whereKey($validated['id_nasabah'])->lockForUpdate()->firstOrFail();
                if (SaverClosureRequest::where('id_saver', $nasabah->id)->where('status', 'pending')->exists()) {
                    return ['closure_pending' => true];
                }
                if ($nasabah->user && ! $nasabah->user->is_active) {
                    return ['inactive_account' => true];
                }
                if (! $nasabah->no_rekening) {
                    $nasabah->no_rekening = $accountNumberGenerator->next();
                    $nasabah->save();
                }

                $transaksi = Transaksi::create([
                    'id_nasabah' => $nasabah->id,
                    'id_user' => $user->id,
                    'tanggal' => now(),
                    'jenis_trans' => 'setor',
                    'nominal' => $nominal,
                ]);

                JurnalAkuntansi::create([
                    'id_transaksi' => $transaksi->id,
                    'kode_akun' => '101',
                    'posisi' => 'debit',
                    'jumlah' => $nominal,
                ]);

                JurnalAkuntansi::create([
                    'id_transaksi' => $transaksi->id,
                    'kode_akun' => '201',
                    'posisi' => 'kredit',
                    'jumlah' => $nominal,
                ]);

                return [
                    'transaksi' => $transaksi,
                    'nasabah' => $nasabah,
                ];
            });

            if (! empty($receipt['inactive_account'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akun siswa sedang dinonaktifkan oleh Admin.',
                ], 403);
            }
            if (! empty($receipt['closure_pending'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Transaksi diblokir karena akun sedang menunggu persetujuan penutupan dari Admin.',
                ], 409);
            }

            $nasabah = $receipt['nasabah'];
            $transaksi = $receipt['transaksi'];

            return response()->json([
                'success' => true,
                'message' => 'Transaksi setoran tunai berhasil diproses.',
                'data' => [
                    'id_transaksi' => $transaksi->id,
                    'no_rekening' => $nasabah->no_rekening,
                    'nama_siswa' => $nasabah->nama_siswa,
                    'jenis_transaksi' => 'SETORAN TUNAI',
                    'nominal' => $nominal,
                    'saldo_akhir' => $nasabah->saldo,
                    'tanggal' => $transaksi->tanggal->toIso8601String(),
                    'teller' => $user->nama_petugas,
                ],
            ], 201);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses setoran. Tidak ada perubahan data yang disimpan.',
            ], 500);
        }
    }

    /**
     * 3. Eksekusi Penarikan Tunai Loket (Dengan Validasi Saldo Mengendap & Verifikasi PIN)
     */
    public function tarikTunai(Request $request)
    {
        if ($response = $this->ensureServiceIsOpen($request)) {
            return $response;
        }

        $validated = $request->validate([
            'id_nasabah' => 'required|exists:savers,id',
            'nominal' => 'required|integer|min:1000',
            'pin_keamanan' => 'required|digits:6',
        ]);

        $user = $request->user();
        $nominal = (int) $validated['nominal'];

        try {
            $result = DB::transaction(function () use ($validated, $user, $nominal) {
                $modal = ModalAwalKas::where('id_teller', $user->id)
                    ->whereDate('tanggal', Carbon::today())
                    ->lockForUpdate()
                    ->first();

                if (! $modal) {
                    return ['error' => 'Isi modal awal dan buka layanan sebelum memproses transaksi.', 'status' => 422];
                }

                if (ModalAwalKas::supportsServiceStatus() && $modal->status_layanan !== 'open') {
                    return ['error' => 'Layanan teller sedang istirahat. Mulai layanan kembali sebelum memproses transaksi.', 'status' => 422];
                }

                if (PenutupanKas::where('id_teller', $user->id)
                    ->whereDate('tanggal_penutupan', Carbon::today())
                    ->whereIn('status', ['pending', 'approved'])
                    ->exists()) {
                    return ['error' => 'Kas hari ini sudah diserahkan ke Supervisor. Transaksi baru dibuka pada hari berikutnya.', 'status' => 422];
                }

                $transaksiHariIni = Transaksi::where('id_user', $user->id)
                    ->whereDate('tanggal', Carbon::today());
                $totalSetoran = (int) (clone $transaksiHariIni)
                    ->where('jenis_trans', 'setor')
                    ->sum('nominal');
                $totalPenarikan = (int) (clone $transaksiHariIni)
                    ->where('jenis_trans', 'tarik')
                    ->sum('nominal');
                $sisaModal = max(0, (int) $modal->nominal + $totalSetoran - $totalPenarikan);

                if ($nominal > $sisaModal) {
                    return [
                        'error' => 'Penarikan melebihi sisa kas Teller yang tersedia.',
                        'status' => 422,
                        'sisa_modal' => $sisaModal,
                        'maksimal_bisa_ditarik' => $sisaModal,
                    ];
                }

                $nasabah = Nasabah::with('user')
                    ->whereKey($validated['id_nasabah'])
                    ->lockForUpdate()
                    ->firstOrFail();
                if ($nasabah->user && ! $nasabah->user->is_active) {
                    return ['error' => 'Akun siswa sedang dinonaktifkan oleh Admin.', 'status' => 403];
                }

                if (! Hash::check($validated['pin_keamanan'], $nasabah->pin_keamanan)) {
                    return ['error' => 'PIN Keamanan Nasabah salah. Penarikan dibatalkan.', 'status' => 403];
                }
                if (SaverClosureRequest::where('id_saver', $nasabah->id)->where('status', 'pending')->exists()) {
                    return ['error' => 'Transaksi diblokir karena akun sedang menunggu persetujuan penutupan dari Admin.', 'status' => 409];
                }

                $saldoSaatIni = $nasabah->saldo;
                $batasSaldoMengendap = 10000;
                if (($saldoSaatIni - $nominal) < $batasSaldoMengendap) {
                    return [
                        'error' => 'Penarikan gagal: Saldo tidak mencukupi. Batas saldo mengendap minimal Rp 10.000 wajib tersisa di rekening.',
                        'status' => 422,
                        'saldo_saat_ini' => $saldoSaatIni,
                        'maksimal_bisa_ditarik' => max(0, $saldoSaatIni - $batasSaldoMengendap),
                    ];
                }

                $transaksi = Transaksi::create([
                    'id_nasabah' => $nasabah->id,
                    'id_user' => $user->id,
                    'tanggal' => now(),
                    'jenis_trans' => 'tarik',
                    'nominal' => $nominal,
                ]);

                JurnalAkuntansi::create([
                    'id_transaksi' => $transaksi->id,
                    'kode_akun' => '201',
                    'posisi' => 'debit',
                    'jumlah' => $nominal,
                ]);
                JurnalAkuntansi::create([
                    'id_transaksi' => $transaksi->id,
                    'kode_akun' => '101',
                    'posisi' => 'kredit',
                    'jumlah' => $nominal,
                ]);

                return [
                    'transaksi' => $transaksi,
                    'nasabah' => $nasabah,
                    'saldo_akhir' => $saldoSaatIni - $nominal,
                ];
            });

            if (isset($result['error'])) {
                return response()->json([
                    'success' => false,
                    'message' => $result['error'],
                    ...array_diff_key($result, ['error' => true, 'status' => true]),
                ], $result['status']);
            }

            $nasabah = $result['nasabah'];
            $transaksi = $result['transaksi'];

            return response()->json([
                'success' => true,
                'message' => 'Transaksi penarikan tunai berhasil diproses.',
                'data' => [
                    'id_transaksi' => $transaksi->id,
                    'no_rekening' => $nasabah->no_rekening,
                    'nama_siswa' => $nasabah->nama_siswa,
                    'jenis_transaksi' => 'PENARIKAN TUNAI',
                    'nominal' => $nominal,
                    'saldo_akhir' => $result['saldo_akhir'],
                    'tanggal' => $transaksi->tanggal->toIso8601String(),
                    'teller' => $user->nama_petugas,
                ],
            ], 201);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses penarikan. Tidak ada perubahan data yang disimpan.',
            ], 500);
        }
    }

    /**
     * Tarik seluruh saldo dan tutup akun Saver dalam satu transaksi.
     * Saldo mengendap Rp10.000 tidak berlaku hanya untuk penutupan akun.
     */
    public function closeSaverAccount(Request $request, int $id): JsonResponse
    {
        if ($response = $this->ensureServiceIsOpen($request)) {
            return $response;
        }

        $validated = $request->validate([
            'pin_keamanan' => 'required|digits:6',
        ]);
        $user = $request->user();

        try {
            $result = DB::transaction(function () use ($id, $validated, $user) {
                $modal = ModalAwalKas::where('id_teller', $user->id)
                    ->whereDate('tanggal', Carbon::today())
                    ->lockForUpdate()
                    ->first();

                if (! $modal || (ModalAwalKas::supportsServiceStatus() && $modal->status_layanan !== 'open')) {
                    return ['error' => 'Layanan Teller harus dibuka sebelum menutup akun Saver.', 'status' => 422];
                }

                if (PenutupanKas::where('id_teller', $user->id)
                    ->whereDate('tanggal_penutupan', Carbon::today())
                    ->whereIn('status', ['pending', 'approved'])
                    ->exists()) {
                    return ['error' => 'Kas hari ini sudah diserahkan. Penutupan akun hanya dapat dilakukan saat layanan dibuka.', 'status' => 422];
                }

                $nasabah = Nasabah::with('user')->whereKey($id)->lockForUpdate()->firstOrFail();
                if ($nasabah->user && ! $nasabah->user->is_active) {
                    return ['error' => 'Akun siswa sedang dinonaktifkan oleh Admin.', 'status' => 403];
                }
                if (! Hash::check($validated['pin_keamanan'], $nasabah->pin_keamanan)) {
                    return ['error' => 'PIN Keamanan Nasabah salah. Penutupan akun dibatalkan.', 'status' => 403];
                }
                $saverUser = $nasabah->user;
                if ($saverUser && $saverUser->role !== 'nasabah') {
                    return ['error' => 'Akun Saver terhubung ke akun yang bukan akun nasabah.', 'status' => 409];
                }
                if (SaverClosureRequest::where('id_saver', $nasabah->id)->where('status', 'pending')->exists()) {
                    return ['error' => 'Pengajuan penutupan akun ini masih menunggu persetujuan Admin.', 'status' => 409];
                }

                $saldo = $nasabah->saldo;
                if ($saldo < 0) {
                    return ['error' => 'Saldo rekening tidak valid. Akun tidak dapat ditutup.', 'status' => 422];
                }

                $transaksi = null;
                if ($saldo > 0) {
                    $transaksiHariIni = Transaksi::where('id_user', $user->id)->whereDate('tanggal', Carbon::today());
                    $sisaKas = max(0, (int) $modal->nominal
                        + (int) (clone $transaksiHariIni)->where('jenis_trans', 'setor')->sum('nominal')
                        - (int) (clone $transaksiHariIni)->where('jenis_trans', 'tarik')->sum('nominal'));

                    if ($saldo > $sisaKas) {
                        return ['error' => 'Kas Teller tidak cukup untuk menarik seluruh saldo Saver.', 'status' => 422];
                    }

                    $transaksi = Transaksi::create([
                        'id_nasabah' => $nasabah->id,
                        'id_user' => $user->id,
                        'tanggal' => now(),
                        'jenis_trans' => 'tarik',
                        'nominal' => $saldo,
                    ]);

                    JurnalAkuntansi::create([
                        'id_transaksi' => $transaksi->id,
                        'kode_akun' => '201',
                        'posisi' => 'debit',
                        'jumlah' => $saldo,
                    ]);
                    JurnalAkuntansi::create([
                        'id_transaksi' => $transaksi->id,
                        'kode_akun' => '101',
                        'posisi' => 'kredit',
                        'jumlah' => $saldo,
                    ]);
                }

                $closureRequest = SaverClosureRequest::create([
                    'id_saver' => $nasabah->id,
                    'id_teller' => $user->id,
                    'id_transaksi' => $transaksi?->id,
                    'jumlah_penarikan' => $saldo,
                    'status' => 'pending',
                ]);

                return [
                    'saldo_ditarik' => $saldo,
                    'id_transaksi' => $transaksi->id ?? null,
                    'id_pengajuan' => $closureRequest->id,
                    'no_rekening' => $nasabah->no_rekening,
                    'nama_siswa' => $nasabah->nama_siswa,
                ];
            });

            if (isset($result['error'])) {
                return response()->json([
                    'success' => false,
                    'message' => $result['error'],
                ], $result['status']);
            }

            return response()->json([
                'success' => true,
                'message' => $result['saldo_ditarik'] > 0
                    ? 'Seluruh saldo berhasil ditarik. Pengajuan penghapusan menunggu persetujuan Admin.'
                    : 'Pengajuan penghapusan akun tanpa saldo menunggu persetujuan Admin.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Penutupan akun gagal. Tidak ada perubahan yang disimpan.',
            ], 500);
        }
    }

    private function ensureServiceIsOpen(Request $request): ?JsonResponse
    {
        if (PenutupanKas::where('id_teller', $request->user()->id)
            ->whereDate('tanggal_penutupan', Carbon::today())
            ->whereIn('status', ['pending', 'approved'])
            ->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Kas hari ini sudah diserahkan ke Supervisor. Transaksi baru dibuka pada hari berikutnya.',
            ], 422);
        }

        $modal = ModalAwalKas::where('id_teller', $request->user()->id)
            ->whereDate('tanggal', Carbon::today())
            ->first();

        if (! $modal) {
            return response()->json([
                'success' => false,
                'message' => 'Isi modal awal dan buka layanan sebelum memproses transaksi.',
            ], 422);
        }

        if (ModalAwalKas::supportsServiceStatus() && $modal->status_layanan !== 'open') {
            return response()->json([
                'success' => false,
                'message' => 'Layanan teller sedang istirahat. Mulai layanan kembali sebelum memproses transaksi.',
            ], 422);
        }

        return null;
    }
}
