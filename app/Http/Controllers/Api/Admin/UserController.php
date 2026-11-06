<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        $users = User::whereIn('role', ['admin', 'teller', 'supervisor'])
            ->where(function ($query) {
                $query->where('is_active', true)->orWhereNull('is_active');
            })
            ->orderBy('id', 'desc')
            ->get();
        return response()->json(['success' => true, 'data' => $users]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'username' => 'required|string|max:50|unique:users,username',
            'password' => 'required|string|min:6',
            'nama_petugas' => 'required|string|max:100',
            'role' => 'required|in:teller,supervisor',
        ]);

        $user = User::create([
            'username' => $validated['username'],
            'password' => Hash::make($validated['password']),
            'nama_petugas' => $validated['nama_petugas'],
            'role' => $validated['role'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'User berhasil didaftarkan.',
            'data' => $user,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($user->role === 'member') {
            return response()->json([
                'success' => false,
                'message' => 'Akun siswa dikelola melalui data anggota.',
            ], 422);
        }

        $validated = $request->validate([
            'username' => 'required|string|max:50|unique:users,username,' . $user->id,
            'nama_petugas' => 'required|string|max:100',
            'role' => 'required|in:teller,supervisor',
            'password' => 'nullable|string|min:6',
        ]);

        $user->username = $validated['username'];
        $user->nama_petugas = $validated['nama_petugas'];
        $user->role = $validated['role'];

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Data user berhasil diperbarui.',
            'data' => $user,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if (! in_array($user->role, ['admin', 'teller', 'supervisor'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya akun staf yang dapat dihapus dari menu ini.',
            ], 422);
        }

        if ($request->user()->is($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat menghapus akun yang sedang digunakan.',
            ], 422);
        }

        $user->is_active = false;
        $user->save();
        $user->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Akun staf berhasil dihapus dari daftar aktif. Riwayat audit tetap tersimpan.',
        ]);
    }
}