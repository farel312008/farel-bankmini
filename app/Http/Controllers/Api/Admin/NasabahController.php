<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Nasabah;
use App\Models\SaverClosureRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class NasabahController extends Controller
{
    public function index()
    {
        $nasabah = Nasabah::with('user:id,username,is_active,email')
            ->orderBy('nama_siswa')
            ->get();
        $pendingSaverRequests = SaverClosureRequest::whereIn('id_saver', $nasabah->pluck('id'))
            ->where('status', 'pending')
            ->pluck('id', 'id_saver')
            ->map(fn ($id) => (int) $id)
            ->all();
        $nasabah = $nasabah->map(function ($item) use ($pendingSaverRequests) {
                return [
                    'id' => $item->id,
                    'no_rekening' => $item->no_rekening,
                    'nis' => $item->nis,
                    'username' => $item->user?->username,
                    'nama_siswa' => $item->nama_siswa,
                    'jenis_kelamin' => $item->jenis_kelamin,
                    'kelas' => $item->kelas,
                    'email' => $item->email ?? $item->user?->email,
                    'nomor_hp' => $item->nomor_hp,
                    'saldo' => $item->saldo,
                    'is_active' => (bool) $item->user?->is_active,
                    'has_login' => $item->user !== null,
                    'has_email' => filled($item->email ?? $item->user?->email),
                    'closure_pending' => isset($pendingSaverRequests[$item->id]),
                    'closure_request_id' => $pendingSaverRequests[$item->id] ?? null,
                    'created_at' => $item->created_at,
                ];
            });

        return response()->json(['success' => true, 'data' => $nasabah]);
    }

    public function setCredentials(Request $request, int $id)
    {
        $saver = Nasabah::with('user')->findOrFail($id);
        $validated = $request->validate([
            'username' => [
                'required',
                'string',
                'max:50',
                Rule::unique('users', 'username')->ignore($saver->user_id),
            ],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($saver->user_id), Rule::unique('savers', 'email')->ignore($saver->id)],
            'password' => 'required|string|min:8|max:100',
            'nomor_hp' => 'nullable|string|max:20',
        ]);

        if ($saver->user && $saver->user->role !== 'nasabah') {
            return response()->json([
                'success' => false,
                'message' => 'Saver ini terhubung ke akun yang bukan akun siswa.',
            ], 409);
        }

        DB::transaction(function () use ($saver, $validated) {
            $user = $saver->user ?? new User;
            $user->username = $validated['username'];
            $email = $validated['email'] ?? $saver->email ?? $user->email;
            $user->email = $email ? mb_strtolower($email) : null;
            $saver->email = $email ? mb_strtolower($email) : null;
            if (array_key_exists('nomor_hp', $validated)) {
                $saver->nomor_hp = $validated['nomor_hp'];
            }
            $user->password = Hash::make($validated['password']);
            $user->nama_petugas = $saver->nama_siswa;
            $user->role = 'nasabah';
            $user->is_active = true;
            $user->save();
            $saver->user_id = $user->id;
            $saver->save();
        });

        return response()->json([
            'success' => true,
            'message' => 'Username dan password akun Saver berhasil dibuat.',
        ]);
    }

    public function show($id)
    {
        $nasabah = Nasabah::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $nasabah->id,
                'no_rekening' => $nasabah->no_rekening,
                'nis' => $nasabah->nis,
                'nama_siswa' => $nasabah->nama_siswa,
                'jenis_kelamin' => $nasabah->jenis_kelamin,
                'kelas' => $nasabah->kelas,
                'email' => $nasabah->email ?? $nasabah->user?->email,
                'nomor_hp' => $nasabah->nomor_hp,
                'saldo' => $nasabah->saldo,
                'is_active' => (bool) $nasabah->user?->is_active,
                'riwayat_transaksi' => $nasabah->transaksi()->orderBy('tanggal', 'desc')->get(),
            ],
        ]);
    }

    public function destroy(int $id)
    {
        return DB::transaction(function () use ($id) {
            $saver = Nasabah::with('user')->lockForUpdate()->findOrFail($id);

            if (SaverClosureRequest::where('id_saver', $saver->id)->where('status', 'pending')->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pengajuan penghapusan Saver masih menunggu persetujuan Admin. Setujui atau tolak pengajuan tersebut terlebih dahulu.',
                ], 409);
            }
            if (SaverClosureRequest::where('id_saver', $saver->id)->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akun ini sudah melalui proses pengajuan penutupan. Penghapusan hanya dapat dilakukan melalui persetujuan Admin atas pengajuan Teller.',
                ], 409);
            }

            if ($saver->saldo !== 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Akun masih memiliki saldo ' . number_format($saver->saldo, 0, ',', '.') . '. Tarik seluruh saldo di Teller sebelum menghapus akun.',
                ], 422);
            }

            if ($saver->user && $saver->user->role !== 'nasabah') {
                abort(409, 'Akun Saver terhubung ke akun yang bukan akun nasabah dan tidak dapat diarsipkan.');
            }

            if ($saver->user) {
                $saver->user->tokens()->delete();
            }

            $saver->forceFill(['user_id' => null])->save();
            $saver->delete();
            $saver->user?->delete();

            return response()->json([
                'success' => true,
                'message' => 'Akun Saver dihapus dari daftar aktif. Data rekening dan seluruh riwayat transaksi tetap tersimpan untuk audit.',
            ]);
        });
    }
}
