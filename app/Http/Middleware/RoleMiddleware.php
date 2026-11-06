<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Menangani request masuk dan memvalidasi kecocokan role pengguna.
     *
     * @param  Closure(Request): (Response)  $next
     * @param  string  ...$roles
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Token otentikasi tidak valid atau telah kedaluwarsa.',
            ], 401);
        }

        // Menentukan role pengguna aktif
        $currentRole = null;
        if (isset($user->role)) {
            $currentRole = $user->role; // Admin, Teller, Supervisor
        } else {
            $currentRole = 'nasabah'; // Model Nasabah
        }

        if ($user->is_active === false) {
            return response()->json([
                'success' => false,
                'message' => 'Akun ini sedang dinonaktifkan. Hubungi administrator.',
            ], 403);
        }

        // Cek apakah role user saat ini terdapat dalam daftar role yang diizinkan
        if (! in_array($currentRole, $roles)) {
            return response()->json([
                'success' => false,
                'message' => 'Akses Ditolak (403 Forbidden): Anda tidak memiliki izin untuk mengakses resource ini.',
                'user_role' => $currentRole,
                'required_roles' => $roles,
            ], 403);
        }

        return $next($request);
    }
}
