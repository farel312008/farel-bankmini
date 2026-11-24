<?php

namespace App\Http\Controllers\Api\Supervisor;

use App\Http\Controllers\Controller;
use App\Models\JurnalAkuntansi;
use App\Models\Nasabah;
use App\Models\PenutupanKas;
use App\Models\Transaksi;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection as SupportCollection;

class SupervisorController extends Controller
{
    /**
     * Filter opsional laporan transaksi teller:
     * - tanggal            : rekap harian (YYYY-MM-DD)
     * - bulan + tahun      : rekap bulanan
     * - nasabah_id         : riwayat per nasabah
     */
    public function laporanTransaksi(Request $request)
    {
        $validated = $request->validate([
            'tanggal' => 'nullable|date_format:Y-m-d',
            'bulan' => 'nullable|integer|between:1,12',
            'tahun' => 'nullable|integer|between:2000,2100',
            'nasabah_id' => 'nullable|integer',
        ]);

        if (filled($validated['bulan'] ?? null) xor filled($validated['tahun'] ?? null)) {
            return response()->json([
                'success' => false,
                'message' => 'Filter bulanan memerlukan bulan dan tahun sekaligus.',
            ], 422);
        }

        $query = Transaksi::query()->with([
            'user:id,nama_petugas,username',
            'nasabah' => fn ($relation) => $relation->withTrashed(),
        ]);

        if (filled($validated['tanggal'] ?? null)) {
            $query->whereDate('tanggal', $validated['tanggal']);
        }

        if (filled($validated['bulan'] ?? null) && filled($validated['tahun'] ?? null)) {
            $query->whereMonth('tanggal', $validated['bulan'])
                ->whereYear('tanggal', $validated['tahun']);
        }

        if (filled($validated['nasabah_id'] ?? null)) {
            $query->where('id_nasabah', $validated['nasabah_id']);
        }

        $transaksi = $query->orderByDesc('tanggal')->orderByDesc('id')->get();

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
            'filter' => [
                'tanggal' => $validated['tanggal'] ?? null,
                'bulan' => $validated['bulan'] ?? null,
                'tahun' => $validated['tahun'] ?? null,
                'nasabah_id' => $validated['nasabah_id'] ?? null,
            ],
            'nasabah_list' => Nasabah::withTrashed()
                ->orderBy('nama_siswa')
                ->get(['id', 'nama_siswa', 'no_rekening', 'deleted_at'])
                ->map(fn (Nasabah $nasabah) => [
                    'id' => $nasabah->id,
                    'nama_siswa' => $nasabah->nama_siswa,
                    'no_rekening' => $nasabah->no_rekening,
                    'is_archived' => $nasabah->trashed(),
                ]),
            'summary' => [
                'total_setoran' => (int) $setoran->sum('nominal'),
                'total_penarikan' => (int) $penarikan->sum('nominal'),
            ],
            'setoran' => $setoran,
            'penarikan' => $penarikan,
        ]);
    }

    public function downloadLaporanTransaksiPdf(Request $request)
    {
        $validated = $request->validate([
            'tanggal' => 'nullable|date_format:Y-m-d',
            'bulan' => 'nullable|integer|between:1,12',
            'tahun' => 'nullable|integer|between:2000,2100',
            'nasabah_id' => 'nullable|integer',
        ]);

        if (filled($validated['bulan'] ?? null) xor filled($validated['tahun'] ?? null)) {
            return response()->json([
                'success' => false,
                'message' => 'Filter bulanan memerlukan bulan dan tahun sekaligus.',
            ], 422);
        }

        $query = Transaksi::query()->with([
            'user:id,nama_petugas,username',
            'nasabah' => fn ($relation) => $relation->withTrashed(),
        ]);

        if (filled($validated['tanggal'] ?? null)) {
            $query->whereDate('tanggal', $validated['tanggal']);
        }
        if (filled($validated['bulan'] ?? null) && filled($validated['tahun'] ?? null)) {
            $query->whereMonth('tanggal', $validated['bulan'])
                ->whereYear('tanggal', $validated['tahun']);
        }
        if (filled($validated['nasabah_id'] ?? null)) {
            $query->where('id_nasabah', $validated['nasabah_id']);
        }

        $transactions = $query->orderByDesc('tanggal')->orderByDesc('id')->get();
        $nasabah = filled($validated['nasabah_id'] ?? null)
            ? Nasabah::withTrashed()->find($validated['nasabah_id'])
            : null;
        $period = 'Semua Transaksi';
        if (filled($validated['tanggal'] ?? null)) {
            $period = 'Harian - '.date('d-m-Y', strtotime($validated['tanggal']));
        } elseif (filled($validated['bulan'] ?? null)) {
            $period = 'Bulanan - '.sprintf('%02d/%04d', $validated['bulan'], $validated['tahun']);
        }
        $nasabahLabel = $nasabah
            ? $nasabah->nama_siswa.' ('.$nasabah->no_rekening.')'
            : 'Semua Nasabah';
        $summary = [
            'total_transaksi' => $transactions->count(),
            'jumlah_setoran' => $transactions->where('jenis_trans', 'setor')->count(),
            'jumlah_penarikan' => $transactions->where('jenis_trans', 'tarik')->count(),
            'total_setoran' => (int) $transactions->where('jenis_trans', 'setor')->sum('nominal'),
            'total_penarikan' => (int) $transactions->where('jenis_trans', 'tarik')->sum('nominal'),
        ];
        $rows = $transactions->map(fn (Transaksi $transaction) => [
            'tanggal' => $transaction->tanggal,
            'jenis_trans' => $transaction->jenis_trans,
            'nasabah' => $transaction->nasabah?->nama_siswa ?? '-',
            'no_rekening' => $transaction->nasabah?->no_rekening ?? '-',
            'teller' => $transaction->user?->nama_petugas ?? $transaction->user?->username ?? '-',
            'nominal' => (int) $transaction->nominal,
        ])->values();

        $filenameSuffix = filled($validated['tanggal'] ?? null)
            ? $validated['tanggal']
            : (filled($validated['bulan'] ?? null)
                ? sprintf('%04d-%02d', $validated['tahun'], $validated['bulan'])
                : 'semua');
        if ($nasabah) {
            $filenameSuffix .= '-nasabah-'.$nasabah->id;
        }

        return Pdf::loadView('pdf.laporan-transaksi', [
            'period' => $period,
            'nasabahLabel' => $nasabahLabel,
            'summary' => $summary,
            'transactions' => $rows,
        ])->setPaper('a4', 'landscape')->download('rekap-transaksi-'.$filenameSuffix.'.pdf');
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
