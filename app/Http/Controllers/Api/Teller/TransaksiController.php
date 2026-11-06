<?php

namespace App\Http\Controllers\Api\Teller;

use App\Http\Controllers\Controller;
use App\Models\JurnalAkuntansi;
use App\Models\Member;
use App\Models\Nasabah;
use App\Models\PenutupanKas;
use App\Models\Transaksi;
use App\Services\SaverAccountNumberGenerator;
use Carbon\Carbon;
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
        if ($this->kasSudahDiserahkan($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Kas hari ini sudah diserahkan ke Supervisor. Transaksi baru dibuka pada hari berikutnya.',
            ], 422);
        }

        if ($request->filled('id_member')) {
            return response()->json([
                'success' => false,
                'message' => 'Siswa harus lebih dulu dibuatkan akun oleh Admin sebelum dapat melakukan setoran.',
            ], 422);
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
        if ($this->kasSudahDiserahkan($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Kas hari ini sudah diserahkan ke Supervisor. Transaksi baru dibuka pada hari berikutnya.',
            ], 422);
        }

        $validated = $request->validate([
            'id_nasabah' => 'required|exists:savers,id',
            'nominal' => 'required|integer|min:1000',
            'pin_keamanan' => 'required|digits:6',
        ]);

        $user = $request->user();
        $nasabah = Nasabah::with('user')->findOrFail($validated['id_nasabah']);
        if ($nasabah->user && ! $nasabah->user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Akun siswa sedang dinonaktifkan oleh Admin.',
            ], 403);
        }
        $nominal = (int) $validated['nominal'];
        $saldoSaatIni = $nasabah->saldo;
        $batasSaldoMengendap = 10000; // Rp 10.000

        // 1. Verifikasi PIN Keamanan Nasabah 6-Digit
        if (! Hash::check($validated['pin_keamanan'], $nasabah->pin_keamanan)) {
            return response()->json([
                'success' => false,
                'message' => 'PIN Keamanan Nasabah salah. Penarikan dibatalkan.',
            ], 403);
        }

        // 2. Validasi Aturan Saldo Mengendap (Overdraft Protection)
        if (($saldoSaatIni - $nominal) < $batasSaldoMengendap) {
            $maksimalTarik = max(0, $saldoSaatIni - $batasSaldoMengendap);

            return response()->json([
                'success' => false,
                'message' => 'Penarikan gagal: Saldo tidak mencukupi. Batas saldo mengendap minimal Rp 10.000 wajib tersisa di rekening.',
                'saldo_saat_ini' => $saldoSaatIni,
                'maksimal_bisa_ditarik' => $maksimalTarik,
            ], 422);
        }

        DB::beginTransaction();
        try {
            // 3. Simpan Transaksi Penarikan
            $transaksi = Transaksi::create([
                'id_nasabah' => $nasabah->id,
                'id_user' => $user->id,
                'tanggal' => now(),
                'jenis_trans' => 'tarik',
                'nominal' => $nominal,
            ]);

            // 4. Double-Entry Accounting:
            // Baris A: Debet Tabungan Nasabah (201) - Kewajiban bank berkurang
            JurnalAkuntansi::create([
                'id_transaksi' => $transaksi->id,
                'kode_akun' => '201',
                'posisi' => 'debit',
                'jumlah' => $nominal,
            ]);

            // Baris B: Kredit Kas (101) - Kas di laci teller berkurang
            JurnalAkuntansi::create([
                'id_transaksi' => $transaksi->id,
                'kode_akun' => '101',
                'posisi' => 'kredit',
                'jumlah' => $nominal,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Transaksi penarikan tunai berhasil diproses.',
                'data' => [
                    'id_transaksi' => $transaksi->id,
                    'no_rekening' => $nasabah->no_rekening,
                    'nama_siswa' => $nasabah->nama_siswa,
                    'jenis_transaksi' => 'PENARIKAN TUNAI',
                    'nominal' => $nominal,
                    'saldo_akhir' => $nasabah->saldo,
                    'tanggal' => $transaksi->tanggal->toIso8601String(),
                    'teller' => $user->nama_petugas,
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses penarikan: '.$e->getMessage(),
            ], 500);
        }
    }

    private function kasSudahDiserahkan(Request $request): bool
    {
        return PenutupanKas::where('id_teller', $request->user()->id)
            ->whereDate('tanggal_penutupan', Carbon::today())
            ->exists();
    }
}
