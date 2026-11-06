<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ModalAwalKas;
use App\Models\Nasabah;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class PublicNasabahController extends Controller
{
    public function bankStatus()
    {
        $activeTellerCount = ModalAwalKas::query()
            ->whereDate('tanggal', today())
            ->whereHas('teller', fn ($query) => $query
                ->where('role', 'teller')
                ->where('is_active', true))
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('penutupan_kas')
                    ->whereColumn('penutupan_kas.id_teller', 'modal_awal_kas.id_teller')
                    ->whereDate('penutupan_kas.tanggal_penutupan', today());
            })
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'is_open' => $activeTellerCount > 0,
                'status' => $activeTellerCount > 0 ? 'open' : 'closed',
                'active_tellers' => $activeTellerCount,
                'tanggal' => today()->toDateString(),
            ],
        ]);
    }

    /**
     * Helper untuk membersihkan dan mengekstrak No. Rekening atau NIS
     * baik dari URL lengkap, query string, ataupun input teks biasa.
     */
    private function extractIdentifier(string $raw): string
    {
        $decoded = urldecode($raw);

        // Jika terdapat pola REC diikuti angka (contoh: REC20260001)
        if (preg_match('/(REC\d+)/i', $decoded, $matches)) {
            return strtoupper($matches[1]);
        }

        // Jika berupa URL lengkap (contoh: http://192.168.1.5:8000/profil/REC20260001)
        $path = parse_url($decoded, PHP_URL_PATH) ?? $decoded;
        $segment = basename($path);

        return trim($segment);
    }

    /**
     * Mengambil data profil publik nasabah berdasarkan No Rekening atau NIS
     */
    public function show(string $identifier)
    {
        $clean = $this->extractIdentifier($identifier);

        $nasabah = Nasabah::where('no_rekening', $clean)
            ->orWhere('nis', $clean)
            ->orWhere('no_rekening', $identifier)
            ->orWhere('nis', $identifier)
            ->first();

        if (!$nasabah) {
            return response()->json([
                'success' => false,
                'message' => "Data nasabah dengan nomor '{$clean}' tidak ditemukan pada sistem Bank Mini.",
            ], 404);
        }

        $totalTransaksi = $nasabah->transaksi()->count();
        $transaksiTerakhir = $nasabah->transaksi()->orderBy('tanggal', 'desc')->first();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $nasabah->id,
                'no_rekening' => $nasabah->no_rekening,
                'nis' => $nasabah->nis,
                'nama_siswa' => $nasabah->nama_siswa,
                'kelas' => $nasabah->kelas,
                'saldo' => $nasabah->saldo,
                'saldo_mengendap' => 10000,
                'saldo_tersedia' => max(0, $nasabah->saldo - 10000),
                'status' => 'Aktif & Terverifikasi',
                'terdaftar_sejak' => $nasabah->created_at ? $nasabah->created_at->format('d M Y') : '2026',
                'total_transaksi' => $totalTransaksi,
                'transaksi_terakhir' => $transaksiTerakhir ? [
                    'tanggal' => $transaksiTerakhir->tanggal->toIso8601String(),
                    'jenis' => $transaksiTerakhir->jenis_trans,
                    'nominal' => $transaksiTerakhir->nominal,
                ] : null,
            ],
        ]);
    }

    /**
     * Endpoint Scan Publik (Menerima raw payload dari QR scanner)
     */
    public function scan(Request $request)
    {
        $request->validate([
            'query' => 'required|string',
        ]);

        return $this->show($request->input('query'));
    }
}
