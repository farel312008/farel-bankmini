<?php

namespace App\Http\Controllers\Api\Nasabah;

use App\Http\Controllers\Controller;
use App\Models\Nasabah;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class NasabahPortalController extends Controller
{
    public function getSaldo(Request $request)
    {
        $nasabah = Nasabah::where('user_id', $request->user()->id)->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => [
                'no_rekening' => $nasabah->no_rekening,
                'nama_siswa' => $nasabah->nama_siswa,
                'email' => $request->user()->email ?? $nasabah->email,
                'kelas' => $nasabah->kelas,
                'saldo_berjalan' => $nasabah->saldo,
                'saldo_mengendap_minimum' => 10000,
                'saldo_tersedia_ditarik' => max(0, $nasabah->saldo - 10000),
                'rekening_aktif' => $nasabah->no_rekening !== null,
            ],
        ]);
    }

    public function getMutasi(Request $request)
    {
        $nasabah = Nasabah::where('user_id', $request->user()->id)->firstOrFail();

        $mutasi = $nasabah->transaksi()
            ->with('user:id,nama_petugas')
            ->orderBy('tanggal', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $mutasi,
        ]);
    }

    public function getMutasi30Hari(Request $request)
    {
        $nasabah = Nasabah::where('user_id', $request->user()->id)->firstOrFail();

        $mutasi = $nasabah->transaksi()
            ->with('user:id,nama_petugas')
            ->where('tanggal', '>=', now()->subDays(30))
            ->orderBy('tanggal', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $mutasi,
        ]);
    }

    public function updatePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|max:100|confirmed',
        ]);

        $user = $request->user();
        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'Kata sandi saat ini tidak sesuai.',
            ]);
        }

        $user->password = $validated['new_password'];
        $user->save();
        $currentToken = $user->currentAccessToken();
        if ($currentToken instanceof \Laravel\Sanctum\PersonalAccessToken) {
            $user->tokens()->where('id', '!=', $currentToken->getKey())->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Kata sandi berhasil diubah.',
        ]);
    }

    public function updatePin(Request $request)
    {
        $validated = $request->validate([
            'current_pin' => 'required|digits:6',
            'new_pin' => 'required|digits:6|confirmed',
        ]);

        $nasabah = Nasabah::where('user_id', $request->user()->id)->firstOrFail();
        if (! Hash::check($validated['current_pin'], $nasabah->pin_keamanan)) {
            throw ValidationException::withMessages([
                'current_pin' => 'PIN transaksi saat ini tidak sesuai.',
            ]);
        }

        $nasabah->pin_keamanan = $validated['new_pin'];
        $nasabah->save();

        return response()->json([
            'success' => true,
            'message' => 'PIN transaksi berhasil diubah.',
        ]);
    }
}
