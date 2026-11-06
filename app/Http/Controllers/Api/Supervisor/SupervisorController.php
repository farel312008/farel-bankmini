<?php

namespace App\Http\Controllers\Api\Supervisor;

use App\Http\Controllers\Controller;
use App\Models\JurnalAkuntansi;
use App\Models\PenutupanKas;
use App\Models\Transaksi;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection as SupportCollection;

class SupervisorController extends Controller
{
    public function laporanTransaksi()
    {
        $transaksi = Transaksi::with([
            'user:id,nama_petugas,username',
            'nasabah:id,nama_siswa,no_rekening',
        ])->latest('tanggal')->get();

        $buatLaporan = static function ($item) {
            return [
                'id' => $item->id,
                'tanggal' => $item->tanggal,
                'teller' => $item->user?->nama_petugas ?? '-',
                'nasabah' => $item->nasabah?->nama_siswa ?? '-',
                'no_rekening' => $item->nasabah?->no_rekening ?? '-',
                'nominal' => (int) $item->nominal,
            ];
        };

        $setoran = $transaksi->where('jenis_trans', 'setor')->values()->map($buatLaporan);
        $penarikan = $transaksi->where('jenis_trans', 'tarik')->values()->map($buatLaporan);

        return response()->json([
            'success' => true,
            'summary' => [
                'total_setoran' => (int) $setoran->sum('nominal'),
                'total_penarikan' => (int) $penarikan->sum('nominal'),
            ],
            'setoran' => $setoran,
            'penarikan' => $penarikan,
        ]);
    }

    /**
     * Daftar Pengajuan Penutupan Kas Loket
     */
    public function listPenutupanKas()
    {
        $list = PenutupanKas::with(['teller:id,nama_petugas,username', 'supervisor:id,nama_petugas'])
            ->orderBy('id', 'desc')
            ->get();

        return response()->json(['success' => true, 'data' => $list]);
    }

    public function downloadPenutupanKasPdf($id)
    {
        $penutupan = PenutupanKas::with(['teller:id,nama_petugas,username', 'supervisor:id,nama_petugas'])
            ->findOrFail($id);

        if ($penutupan->status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'PDF hanya tersedia untuk penutupan kas yang sudah disetujui.',
            ], 422);
        }

        $filename = sprintf(
            'penutupan-kas-%s-teller-%d.pdf',
            $penutupan->tanggal_penutupan->format('Y-m-d'),
            $penutupan->id_teller
        );

        return Pdf::loadView('pdf.penutupan-kas', ['penutupan' => $penutupan])
            ->setPaper('a4')
            ->download($filename);
    }

    public function monthlyTransactionRecap(Request $request)
    {
        [$month, $year] = $this->validateMonthlyPeriod($request);
        $transactions = $this->getMonthlyTransactions($month, $year);

        return response()->json([
            'success' => true,
            'period' => [
                'month' => $month,
                'year' => $year,
                'label' => now()->setDate($year, $month, 1)->translatedFormat('F Y'),
            ],
            'summary' => $this->summarizeMonthlyTransactions($transactions),
            'data' => $this->mapMonthlyTransactions($transactions),
        ]);
    }

    public function downloadMonthlyPenutupanKasPdf(Request $request)
    {
        [$month, $year] = $this->validateMonthlyPeriod($request);
        $transactions = $this->getMonthlyTransactions($month, $year);

        $filename = sprintf('rekap-transaksi-bulanan-%04d-%02d.pdf', $year, $month);

        return Pdf::loadView('pdf.penutupan-kas-bulanan', [
            'transactions' => $this->mapMonthlyTransactions($transactions),
            'summary' => $this->summarizeMonthlyTransactions($transactions),
            'monthLabel' => now()->setDate($year, $month, 1)->translatedFormat('F Y'),
        ])->setPaper('a4', 'landscape')->download($filename);
    }

    private function validateMonthlyPeriod(Request $request): array
    {
        $validated = $request->validate([
            'month' => 'required|integer|between:1,12',
            'year' => 'required|integer|between:2000,2100',
        ]);

        return [(int) $validated['month'], (int) $validated['year']];
    }

    private function getMonthlyTransactions(int $month, int $year): Collection
    {
        return Transaksi::with([
            'user:id,nama_petugas,username',
            'nasabah:id,nama_siswa,no_rekening',
        ])
            ->whereYear('tanggal', $year)
            ->whereMonth('tanggal', $month)
            ->orderByDesc('tanggal')
            ->orderByDesc('id')
            ->get();
    }

    private function summarizeMonthlyTransactions(Collection $transactions): array
    {
        return [
            'total_transaksi' => $transactions->count(),
            'jumlah_setoran' => $transactions->where('jenis_trans', 'setor')->count(),
            'jumlah_penarikan' => $transactions->where('jenis_trans', 'tarik')->count(),
            'total_setoran' => (int) $transactions->where('jenis_trans', 'setor')->sum('nominal'),
            'total_penarikan' => (int) $transactions->where('jenis_trans', 'tarik')->sum('nominal'),
        ];
    }

    private function mapMonthlyTransactions(Collection $transactions): SupportCollection
    {
        return $transactions->map(fn (Transaksi $transaction) => [
            'id' => $transaction->id,
            'tanggal' => $transaction->tanggal,
            'jenis_trans' => $transaction->jenis_trans,
            'nominal' => (int) $transaction->nominal,
            'teller' => $transaction->user?->nama_petugas ?? $transaction->user?->username ?? '-',
            'nasabah' => $transaction->nasabah?->nama_siswa ?? '-',
            'no_rekening' => $transaction->nasabah?->no_rekening ?? '-',
        ])->values();
    }

    /**
     * Otorisasi & Approval Penutupan Kas Harian serta Pemindahan Kas ke Brankas Utama
     */
    public function approvePenutupanKas(Request $request, $id)
    {
        $supervisor = $request->user();
        $penutupan = PenutupanKas::findOrFail($id);

        if ($penutupan->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Laporan penutupan kas ini sudah diproses sebelumnya.',
            ], 422);
        }

        if ($penutupan->selisih !== 0) {
            return response()->json([
                'success' => false,
                'message' => 'Kas tidak dapat disetujui karena uang fisik dan saldo sistem tidak seimbang.',
            ], 422);
        }

        $penutupan->status = 'approved';
        $penutupan->id_supervisor = $supervisor->id;
        $penutupan->save();

        return response()->json([
            'success' => true,
            'message' => 'Laporan penutupan kas telah disetujui. Kas fisik resmi dipindahkan ke Brankas Utama.',
            'data' => $penutupan,
        ]);
    }

    public function rejectPenutupanKas(Request $request, $id)
    {
        $validated = $request->validate([
            'alasan_penolakan' => 'required|string|max:1000',
        ]);

        $penutupan = PenutupanKas::findOrFail($id);

        if ($penutupan->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Laporan penutupan kas ini sudah diproses sebelumnya.',
            ], 422);
        }

        if ($penutupan->selisih === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Penolakan hanya dapat dilakukan jika uang fisik dan saldo sistem tidak seimbang.',
            ], 422);
        }

        $penutupan->status = 'rejected';
        $penutupan->catatan_penolakan = $validated['alasan_penolakan'];
        $penutupan->id_supervisor = $request->user()->id;
        $penutupan->save();

        return response()->json([
            'success' => true,
            'message' => 'Penutupan kas ditolak. Teller akan menerima notifikasi dan dapat mengajukan ulang setelah melakukan koreksi.',
            'data' => $penutupan,
        ]);
    }

    /**
     * Audit Trail Jurnal Akuntansi (Debet vs Kredit Balance Check)
     */
    public function auditJurnal()
    {
        $jurnal = JurnalAkuntansi::with('transaksi.nasabah:id,nama_siswa,no_rekening')
            ->orderBy('id', 'desc')
            ->limit(100)
            ->get();

        $totalDebet = JurnalAkuntansi::where('posisi', 'debit')->sum('jumlah');
        $totalKredit = JurnalAkuntansi::where('posisi', 'kredit')->sum('jumlah');

        return response()->json([
            'success' => true,
            'summary' => [
                'total_debet' => (int) $totalDebet,
                'total_kredit' => (int) $totalKredit,
                'is_balanced' => ($totalDebet === $totalKredit),
            ],
            'data' => $jurnal,
        ]);
    }
}