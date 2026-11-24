<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Nasabah;
use App\Models\SaverClosureRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaverClosureRequestController extends Controller
{
    public function index(Request $request)
    {
        abort_unless(in_array($request->user()->role, ['admin', 'supervisor'], true), 403);

        $requests = SaverClosureRequest::with([
            'saver:id,nama_siswa,no_rekening,nis,deleted_at',
            'teller:id,nama_petugas,username',
            'transaksi:id,tanggal,nominal',
        ])
            ->where('status', 'pending')
            ->latest()
            ->get()
            ->map(fn (SaverClosureRequest $item) => [
                'id' => $item->id,
                'status' => $item->status,
                'jumlah_penarikan' => $item->jumlah_penarikan,
                'created_at' => $item->created_at,
                'saver' => $item->saver ? [
                    'id' => $item->saver->id,
                    'nama_siswa' => $item->saver->nama_siswa,
                    'no_rekening' => $item->saver->no_rekening,
                    'nis' => $item->saver->nis,
                ] : null,
                'teller' => $item->teller?->nama_petugas ?? $item->teller?->username ?? '-',
                'transaksi' => $item->transaksi ? [
                    'id' => $item->transaksi->id,
                    'tanggal' => $item->transaksi->tanggal,
                    'nominal' => $item->transaksi->nominal,
                ] : null,
            ]);

        return response()->json(['success' => true, 'data' => $requests]);
    }

    public function approve(Request $request, int $id)
    {
        abort_unless(in_array($request->user()->role, ['admin', 'supervisor'], true), 403);

        $result = DB::transaction(function () use ($request, $id) {
            $closureRequest = SaverClosureRequest::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($closureRequest->status !== 'pending') {
                return ['error' => 'Pengajuan ini sudah diproses sebelumnya.', 'status' => 409];
            }

            $saver = Nasabah::withTrashed()->with('user')->whereKey($closureRequest->id_saver)->lockForUpdate()->first();
            if (! $saver || $saver->trashed()) {
                return ['error' => 'Akun Saver sudah dihapus atau tidak ditemukan.', 'status' => 409];
            }
            if ($saver->saldo !== 0) {
                return ['error' => 'Persetujuan ditolak karena saldo Saver belum menjadi Rp0.', 'status' => 422];
            }

            $saverUser = $saver->user;
            if ($saverUser && $saverUser->role !== 'nasabah') {
                return ['error' => 'Akun Saver terhubung ke akun yang bukan akun nasabah.', 'status' => 409];
            }

            $saverUser?->tokens()->delete();
            $saver->forceFill(['user_id' => null])->save();
            $saver->delete();
            $saverUser?->delete();

            $closureRequest->update([
                'status' => 'approved',
                'id_admin' => $request->user()->id,
                'catatan_admin' => null,
            ]);

            return ['success' => true];
        });

        if (isset($result['error'])) {
            return response()->json(['success' => false, 'message' => $result['error']], $result['status']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Penghapusan akun disetujui. Riwayat transaksi dan jurnal tetap tersimpan untuk audit.',
        ]);
    }

    public function reject(Request $request, int $id)
    {
        abort_unless(in_array($request->user()->role, ['admin', 'supervisor'], true), 403);
        $validated = $request->validate([
            'catatan_admin' => 'nullable|string|max:500',
        ]);

        $result = DB::transaction(function () use ($request, $id, $validated) {
            $closureRequest = SaverClosureRequest::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($closureRequest->status !== 'pending') {
                return false;
            }

            $closureRequest->update([
                'status' => 'rejected',
                'id_admin' => $request->user()->id,
                'catatan_admin' => $validated['catatan_admin'] ?? null,
            ]);

            return true;
        });

        if (! $result) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan ini sudah diproses sebelumnya.',
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan penghapusan ditolak. Akun Saver tetap aktif dengan saldo yang sudah ditarik.',
        ]);
    }
}
