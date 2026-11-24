<?php

namespace App\Http\Controllers\Api\Teller;

use App\Http\Controllers\Controller;
use App\Models\ModalAwalKas;
use App\Models\PenutupanKas;
use App\Models\Transaksi;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PenutupanKasController extends Controller
{
    public function getModalAwal(Request $request)
    {
        $modal = ModalAwalKas::where('id_teller', $request->user()->id)
            ->whereDate('tanggal', Carbon::today())
            ->first();
        $supportsServiceStatus = ModalAwalKas::supportsServiceStatus();
        $transaksiHariIni = Transaksi::where('id_user', $request->user()->id)
            ->whereDate('tanggal', Carbon::today());
        $totalSetoran = (int) (clone $transaksiHariIni)
            ->where('jenis_trans', 'setor')
            ->sum('nominal');
        $totalPenarikan = (int) (clone $transaksiHariIni)
            ->where('jenis_trans', 'tarik')
            ->sum('nominal');
        $kasSudahDiserahkan = $this->hasSubmittedCashClosure($request);
        $sisaModal = $modal ? max(0, (int) $modal->nominal + $totalSetoran - $totalPenarikan) : 0;
        if ($kasSudahDiserahkan) {
            $sisaModal = 0;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'tanggal' => Carbon::today()->toDateString(),
                'nominal' => (int) ($modal?->nominal ?? 0),
                'total_setoran' => $totalSetoran,
                'sisa_modal' => $sisaModal,
                'total_penarikan' => $totalPenarikan,
                'sudah_diatur' => (bool) $modal,
                'status_layanan' => $this->serviceStatus($request),
                'supports_service_status' => $supportsServiceStatus,
            ],
        ]);
    }

    public function setModalAwal(Request $request)
    {
        $validated = $request->validate([
            'nominal' => 'required|integer|min:0',
        ]);

        if ($this->hasSubmittedCashClosure($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Kas hari ini sudah ditutup dan diserahkan. Modal awal tidak dapat diubah.',
            ], 422);
        }

        $defaults = ['nominal' => $validated['nominal']];
        if (ModalAwalKas::supportsServiceStatus()) {
            $defaults['status_layanan'] = 'open';
        }

        $modal = ModalAwalKas::firstOrCreate(
            ['id_teller' => $request->user()->id, 'tanggal' => Carbon::today()],
            $defaults
        );
        if (! $modal->wasRecentlyCreated) {
            return response()->json([
                'success' => false,
                'message' => 'Modal awal hari ini sudah tersimpan. Gunakan tombol layanan untuk mengatur status teller.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Modal awal kas tersimpan dan layanan teller berhasil dibuka.',
            'data' => [
                'tanggal' => $modal->tanggal->toDateString(),
                'nominal' => (int) $modal->nominal,
                'total_setoran' => 0,
                'sisa_modal' => (int) $modal->nominal,
                'total_penarikan' => 0,
                'sudah_diatur' => true,
                'status_layanan' => 'open',
            ],
        ]);
    }

    public function setServiceStatus(Request $request)
    {
        $validated = $request->validate([
            'status' => 'required|in:open,resting',
        ]);
        if (! ModalAwalKas::supportsServiceStatus()) {
            return response()->json([
                'success' => false,
                'message' => 'Fitur status istirahat belum tersedia. Perbarui struktur database melalui migration terbaru.',
            ], 503);
        }

        if ($this->hasSubmittedCashClosure($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Kas hari ini sudah ditutup dan diserahkan. Layanan tidak dapat dibuka kembali.',
            ], 422);
        }

        $modal = ModalAwalKas::where('id_teller', $request->user()->id)
            ->whereDate('tanggal', Carbon::today())
            ->first();

        if (! $modal) {
            return response()->json([
                'success' => false,
                'message' => 'Isi modal awal terlebih dahulu sebelum membuka layanan.',
            ], 422);
        }

        $modal->status_layanan = $validated['status'];
        $modal->save();

        return response()->json([
            'success' => true,
            'message' => $validated['status'] === 'resting'
                ? 'Layanan teller dijeda untuk istirahat.'
                : 'Layanan teller kembali dibuka.',
            'data' => ['status_layanan' => $modal->status_layanan],
        ]);
    }

    private function serviceStatus(Request $request): string
    {
        if ($this->hasSubmittedCashClosure($request)) {
            return 'closed';
        }

        $modal = ModalAwalKas::where('id_teller', $request->user()->id)
            ->whereDate('tanggal', Carbon::today())
            ->first();

        if (! $modal) {
            return 'not_started';
        }

        return ModalAwalKas::supportsServiceStatus()
            ? $modal->status_layanan
            : 'open';
    }

    private function hasSubmittedCashClosure(Request $request): bool
    {
        return PenutupanKas::where('id_teller', $request->user()->id)
            ->whereDate('tanggal_penutupan', Carbon::today())
            ->whereIn('status', ['pending', 'approved'])
            ->exists();
    }

    /**
     * Ringkasan Mutasi Kas Hari Ini untuk Teller
     */
    public function ringkasanHariIni(Request $request)
    {
        $teller = $request->user();
        $hariIni = Carbon::today();

        $totalSetor = Transaksi::where('id_user', $teller->id)
            ->where('jenis_trans', 'setor')
            ->whereDate('tanggal', $hariIni)
            ->sum('nominal');

        $totalTarik = Transaksi::where('id_user', $teller->id)
            ->where('jenis_trans', 'tarik')
            ->whereDate('tanggal', $hariIni)
            ->sum('nominal');

        $saldoAwal = (int) (ModalAwalKas::where('id_teller', $teller->id)
            ->whereDate('tanggal', $hariIni)->value('nominal') ?? 0);
        $saldoAkhirSistem = $saldoAwal + $totalSetor - $totalTarik;
        $penutupan = PenutupanKas::where('id_teller', $teller->id)
            ->whereDate('tanggal_penutupan', $hariIni)
            ->latest('id')
            ->first();
        $kasSudahDiserahkan = $penutupan && in_array($penutupan->status, ['pending', 'approved'], true);

        return response()->json([
            'success' => true,
            'data' => [
                'tanggal' => $hariIni->toDateString(),
                'teller' => $teller->nama_petugas,
                'saldo_awal' => $kasSudahDiserahkan ? 0 : $saldoAwal,
                'total_setoran' => $kasSudahDiserahkan ? 0 : (int) $totalSetor,
                'total_penarikan' => $kasSudahDiserahkan ? 0 : (int) $totalTarik,
                'saldo_akhir_sistem' => $kasSudahDiserahkan ? 0 : (int) $saldoAkhirSistem,
                'kas_sudah_diserahkan' => $kasSudahDiserahkan,
                'status_penutupan' => $penutupan?->status,
                'id_penutupan' => $penutupan?->id,
                'catatan_penolakan' => $penutupan?->status === 'rejected' ? $penutupan->catatan_penolakan : null,
            ],
        ]);
    }

    public function riwayat(Request $request)
    {
        $tellerId = $request->user()->id;
        $transaksiPerHari = DB::table('transaksi')
            ->where('id_user', $tellerId)
            ->selectRaw('DATE(tanggal) as tanggal')
            ->selectRaw("SUM(CASE WHEN jenis_trans = 'setor' THEN nominal ELSE 0 END) as total_setoran")
            ->selectRaw("SUM(CASE WHEN jenis_trans = 'tarik' THEN nominal ELSE 0 END) as total_penarikan")
            ->groupByRaw('DATE(tanggal)')
            ->get()
            ->keyBy('tanggal');
        $modalPerHari = ModalAwalKas::where('id_teller', $tellerId)
            ->get()
            ->keyBy(fn (ModalAwalKas $modal) => $modal->tanggal->toDateString());
        $penutupanPerHari = PenutupanKas::where('id_teller', $tellerId)
            ->orderByDesc('id')
            ->get()
            ->unique(fn (PenutupanKas $penutupan) => $penutupan->tanggal_penutupan->toDateString())
            ->keyBy(fn (PenutupanKas $penutupan) => $penutupan->tanggal_penutupan->toDateString());

        $tanggalRiwayat = collect($transaksiPerHari->keys())
            ->merge($modalPerHari->keys())
            ->merge($penutupanPerHari->keys())
            ->unique()
            ->sortDesc();

        $riwayat = $tanggalRiwayat->map(function (string $tanggal) use ($transaksiPerHari, $modalPerHari, $penutupanPerHari) {
            $penutupan = $penutupanPerHari->get($tanggal);
            if ($penutupan && in_array($penutupan->status, ['pending', 'approved'], true)) {
                return null;
            }

            $transaksi = $transaksiPerHari->get($tanggal);
            $saldoAwal = (int) ($modalPerHari->get($tanggal)?->nominal ?? $penutupan?->saldo_awal ?? 0);
            $totalSetoran = (int) ($transaksi?->total_setoran ?? 0);
            $totalPenarikan = (int) ($transaksi?->total_penarikan ?? 0);

            return [
                'tanggal' => $tanggal,
                'saldo_awal' => $saldoAwal,
                'total_setoran' => $totalSetoran,
                'total_penarikan' => $totalPenarikan,
                'saldo_akhir_sistem' => $saldoAwal + $totalSetoran - $totalPenarikan,
                'status_penutupan' => $penutupan?->status ?? 'belum_diserahkan',
                'catatan_penolakan' => $penutupan?->catatan_penolakan,
            ];
        })->filter()->values();

        return response()->json(['success' => true, 'data' => $riwayat]);
    }

    /**
     * Submit Draf Penutupan Kas Harian oleh Teller
     */
    public function submit(Request $request)
    {
        $validated = $request->validate([
            'saldo_awal' => 'required|integer|min:0',
            'uang_fisik' => 'required|integer|min:0',
            'catatan' => 'nullable|string',
        ]);

        $teller = $request->user();
        $hariIni = Carbon::today();
        $modalHariIni = ModalAwalKas::where('id_teller', $teller->id)
            ->whereDate('tanggal', $hariIni)
            ->first();

        if (! $modalHariIni) {
            return response()->json([
                'success' => false,
                'message' => 'Isi modal awal kas sebelum mengajukan penutupan.',
            ], 422);
        }

        $penutupanTerakhir = PenutupanKas::where('id_teller', $teller->id)
            ->whereDate('tanggal_penutupan', $hariIni)
            ->latest('id')
            ->first();

        if ($penutupanTerakhir && $penutupanTerakhir->status !== 'rejected') {
            return response()->json([
                'success' => false,
                'message' => 'Kas hari ini sudah diajukan dan belum dapat diajukan ulang.',
            ], 422);
        }

        $totalSetor = (int) Transaksi::where('id_user', $teller->id)
            ->where('jenis_trans', 'setor')
            ->whereDate('tanggal', $hariIni)
            ->sum('nominal');

        $totalTarik = (int) Transaksi::where('id_user', $teller->id)
            ->where('jenis_trans', 'tarik')
            ->whereDate('tanggal', $hariIni)
            ->sum('nominal');

        $saldoAwal = (int) (ModalAwalKas::where('id_teller', $teller->id)
            ->whereDate('tanggal', $hariIni)->value('nominal') ?? $validated['saldo_awal']);
        $saldoAkhirSistem = $saldoAwal + $totalSetor - $totalTarik;
        $uangFisik = (int) $validated['uang_fisik'];
        $selisih = $uangFisik - $saldoAkhirSistem;

        if ($penutupanTerakhir?->status === 'rejected' && $selisih !== 0) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan ulang hanya dapat diserahkan jika uang fisik sudah seimbang dengan saldo akhir sistem.',
            ], 422);
        }

        $penutupan = PenutupanKas::create([
            'id_teller' => $teller->id,
            'tanggal_penutupan' => $hariIni,
            'saldo_awal' => $saldoAwal,
            'total_setoran' => $totalSetor,
            'total_penarikan' => $totalTarik,
            'saldo_akhir_sistem' => $saldoAkhirSistem,
            'uang_fisik' => $uangFisik,
            'selisih' => $selisih,
            'status' => 'pending',
            'catatan' => $validated['catatan'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Laporan penutupan kas berhasil diserahkan ke Supervisor (Status: Pending Approval).',
            'data' => $penutupan,
        ], 201);
    }
}
