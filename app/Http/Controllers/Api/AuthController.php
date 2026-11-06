<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\CredentialResetOtpMail;
use App\Models\Nasabah;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function sendCredentialResetOtp(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'username' => 'required|string|max:50',
            'credential' => ['required', Rule::in(['password'])],
        ]);

        $email = mb_strtolower($validated['email']);
        $username = $validated['username'];
        $credential = $validated['credential'];
        $emailKey = 'credential-reset:'.hash('sha256', $email.'|'.$credential);
        $ipKey = 'credential-reset-ip:'.hash('sha256', (string) $request->ip());

        if (RateLimiter::tooManyAttempts($emailKey, 1) || RateLimiter::tooManyAttempts($ipKey, 5)) {
            return $this->credentialResetRequestAccepted();
        }

        RateLimiter::hit($emailKey, 60);
        RateLimiter::hit($ipKey, 60);
        DB::table('credential_reset_otps')->where('expires_at', '<', now())->delete();

        $user = User::where('email', $email)->where('username', $username)->first();
        if (! $user) {
            return $this->credentialResetRequestAccepted();
        }

        $otp = (string) random_int(100000, 999999);
        DB::table('credential_reset_otps')->updateOrInsert(
            ['user_id' => $user->id, 'credential' => $credential],
            [
                'otp_hash' => Hash::make($otp),
                'expires_at' => now()->addMinutes(10),
                'attempts' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        try {
            Mail::to($user->email)->send(new CredentialResetOtpMail($otp, $credential));
        } catch (\Throwable $exception) {
            DB::table('credential_reset_otps')
                ->where('user_id', $user->id)
                ->where('credential', $credential)
                ->delete();

            throw $exception;
        }

        return $this->credentialResetRequestAccepted();
    }

    public function sendSaverPinResetOtp(Request $request, int $id)
    {
        $saver = Nasabah::with('user')->findOrFail($id);
        if (! $saver->user || $saver->user->role !== 'nasabah') {
            return response()->json([
                'success' => false,
                'message' => 'Saver belum memiliki akun login yang aktif.',
            ], 422);
        }
        if (! $saver->email) {
            return response()->json([
                'success' => false,
                'message' => 'Email belum terdaftar pada data Saver. Perbarui data email Saver terlebih dahulu.',
            ], 422);
        }

        $emailKey = 'credential-reset:'.hash('sha256', mb_strtolower($saver->email).'|pin');
        $ipKey = 'credential-reset-ip:'.hash('sha256', (string) $request->ip());
        if (RateLimiter::tooManyAttempts($emailKey, 1) || RateLimiter::tooManyAttempts($ipKey, 5)) {
            return response()->json([
                'success' => true,
                'message' => 'Jika email Saver terdaftar, kode OTP akan dikirim. Periksa kotak masuk atau folder spam.',
            ]);
        }

        RateLimiter::hit($emailKey, 60);
        RateLimiter::hit($ipKey, 60);
        DB::table('credential_reset_otps')->where('expires_at', '<', now())->delete();

        $otp = (string) random_int(100000, 999999);
        DB::table('credential_reset_otps')->updateOrInsert(
            ['user_id' => $saver->user->id, 'credential' => 'pin'],
            [
                'otp_hash' => Hash::make($otp),
                'expires_at' => now()->addMinutes(10),
                'attempts' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        try {
            Mail::to($saver->email)->send(new CredentialResetOtpMail($otp, 'pin'));
        } catch (\Throwable $exception) {
            DB::table('credential_reset_otps')
                ->where('user_id', $saver->user->id)
                ->where('credential', 'pin')
                ->delete();

            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Kode OTP telah dikirim ke email yang terdaftar pada data Saver.',
        ]);
    }

    public function verifyCredentialResetOtp(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'username' => 'required|string|max:50',
            'credential' => ['required', Rule::in(['password'])],
            'otp' => 'required|digits:6',
        ]);

        $user = User::where('email', mb_strtolower($validated['email']))
            ->where('username', $validated['username'])
            ->first();

        if (! $user) {
            return $this->invalidCredentialResetOtp();
        }

        $valid = DB::transaction(function () use ($user, $validated) {
            $reset = DB::table('credential_reset_otps')
                ->where('user_id', $user->id)
                ->where('credential', 'password')
                ->lockForUpdate()
                ->first();

            if (! $reset || now()->greaterThan($reset->expires_at) || $reset->attempts >= 5) {
                DB::table('credential_reset_otps')
                    ->where('user_id', $user->id)
                    ->where('credential', 'password')
                    ->delete();

                return false;
            }

            if (! Hash::check($validated['otp'], $reset->otp_hash)) {
                $attempts = $reset->attempts + 1;
                if ($attempts >= 5) {
                    DB::table('credential_reset_otps')->where('id', $reset->id)->delete();
                } else {
                    DB::table('credential_reset_otps')->where('id', $reset->id)->update(['attempts' => $attempts]);
                }

                return false;
            }

            return true;
        });

        if (! $valid) {
            return $this->invalidCredentialResetOtp();
        }

        return response()->json([
            'success' => true,
            'message' => 'Kode OTP berhasil dikonfirmasi.',
        ]);
    }

    public function resetCredential(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required_if:credential,password|nullable|email',
            'username' => 'required_if:credential,password|nullable|string|max:50',
            'saver_id' => 'required_if:credential,pin|nullable|integer|exists:savers,id',
            'credential' => ['required', Rule::in(['password', 'pin'])],
            'otp' => 'required|digits:6',
            'new_password' => 'required_if:credential,password|nullable|string|min:8|max:100|confirmed',
            'new_pin' => 'required_if:credential,pin|nullable|digits:6',
        ]);

        $credential = $validated['credential'];
        $saver = $credential === 'pin'
            ? Nasabah::with('user')->whereKey($validated['saver_id'])->first()
            : null;
        $user = $credential === 'pin'
            ? $saver?->user
            : User::where('email', mb_strtolower($validated['email']))
                ->where('username', $validated['username'])
                ->first();

        if (! $user || ($credential === 'pin' && ($user->role !== 'nasabah' || ! $saver->email))) {
            return response()->json([
                'success' => false,
                'message' => 'Kode OTP tidak valid atau sudah kedaluwarsa.',
            ], 422);
        }

        $updated = DB::transaction(function () use ($user, $saver, $credential, $validated) {
            $reset = DB::table('credential_reset_otps')
                ->where('user_id', $user->id)
                ->where('credential', $credential)
                ->lockForUpdate()
                ->first();

            if (! $reset || now()->greaterThan($reset->expires_at) || $reset->attempts >= 5) {
                DB::table('credential_reset_otps')
                    ->where('user_id', $user->id)
                    ->where('credential', $credential)
                    ->delete();

                return false;
            }

            if (! Hash::check($validated['otp'], $reset->otp_hash)) {
                $attempts = $reset->attempts + 1;
                if ($attempts >= 5) {
                    DB::table('credential_reset_otps')->where('id', $reset->id)->delete();
                } else {
                    DB::table('credential_reset_otps')->where('id', $reset->id)->update(['attempts' => $attempts]);
                }

                return false;
            }

            if ($credential === 'password') {
                $user->password = $validated['new_password'];
                $user->save();
                $user->tokens()->delete();
            } else {
                $saver->pin_keamanan = $validated['new_pin'];
                $saver->save();
            }

            DB::table('credential_reset_otps')->where('id', $reset->id)->delete();

            return true;
        });

        if (! $updated) {
            return response()->json([
                'success' => false,
                'message' => 'Kode OTP tidak valid atau sudah kedaluwarsa.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => $credential === 'password'
                ? 'Password berhasil diubah. Silakan masuk menggunakan password baru.'
                : 'PIN berhasil diubah.',
        ]);
    }

    private function credentialResetRequestAccepted()
    {
        return response()->json([
            'success' => true,
            'message' => 'Jika email terdaftar, kode OTP akan dikirim. Periksa kotak masuk atau folder spam.',
        ]);
    }

    private function invalidCredentialResetOtp()
    {
        return response()->json([
            'success' => false,
            'message' => 'Kode OTP tidak valid atau sudah kedaluwarsa.',
        ], 422);
    }

    /**
     * Login all account types using only a username and password.
     */
    public function login(Request $request)
    {
        $validated = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::with('saver')
            ->where('username', $validated['username'])
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Kredensial username atau password salah.',
            ], 401);
        }

        if ($user->is_active === false) {
            return response()->json([
                'success' => false,
                'message' => 'Akun ini sedang dinonaktifkan. Hubungi administrator.',
            ], 401);
        }

        if ($user->role === 'nasabah') {
            if (! $user->is_active || ! $user->saver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Username atau password salah, atau akun belum aktif.',
                ], 401);
            }

            $saver = $user->saver;
            $loginUser = [
                'id' => $saver->id,
                'user_id' => $user->id,
                'username' => $user->username,
                'no_rekening' => $saver->no_rekening,
                'nis' => $saver->nis,
                'nama_siswa' => $saver->nama_siswa,
                'kelas' => $saver->kelas,
                'saldo' => $saver->saldo,
                'role' => 'nasabah',
            ];
            $token = $user->createToken('auth-token-nasabah', ['role:nasabah'])->plainTextToken;
        } elseif (in_array($user->role, ['admin', 'teller', 'supervisor'], true)) {
            $loginUser = [
                'id' => $user->id,
                'username' => $user->username,
                'nama_petugas' => $user->nama_petugas,
                'role' => $user->role,
            ];
            $tokenRole = $user->role === 'admin' ? 'supervisor' : $user->role;
            $token = $user->createToken('auth-token', ['role:'.$tokenRole])->plainTextToken;
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Kredensial username atau password salah.',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil.',
            'data' => [
                'user' => $loginUser,
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    /**
     * 1. Login Staf Internal (Admin, Teller, Supervisor)
     */
    public function loginUser(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
            'role' => 'sometimes|required|in:teller,supervisor',
        ]);

        $user = User::where('username', $request->username)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Kredensial username atau password salah.',
            ], 401);
        }

        $loginRole = $user->role === 'admin' ? 'supervisor' : $user->role;
        if ($request->filled('role') && $request->input('role') !== $loginRole) {
            return response()->json([
                'success' => false,
                'message' => 'Role yang dipilih tidak sesuai dengan akun staf ini.',
            ], 401);
        }

        // Buat token dengan kemampuan (abilities) sesuai role
        $token = $user->createToken('auth-token', ['role:'.$loginRole])->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil sebagai '.ucfirst($loginRole),
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'nama_petugas' => $user->nama_petugas,
                    'role' => $user->role,
                ],
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    /**
     * 2. Login Nasabah (Siswa) via NIS/No Rekening + PIN 6 Digit
     */
    public function loginNasabah(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)
            ->where('role', 'nasabah')
            ->with('saver')
            ->first();

        if (! $user || ! $user->is_active || ! Hash::check($request->password, $user->password) || ! $user->saver) {
            return response()->json([
                'success' => false,
                'message' => 'Username atau password salah, atau akun belum aktif.',
            ], 401);
        }

        $saver = $user->saver;
        $token = $user->createToken('auth-token-nasabah', ['role:nasabah'])->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login nasabah berhasil.',
            'data' => [
                'nasabah' => [
                    'id' => $saver->id,
                    'user_id' => $user->id,
                    'username' => $user->username,
                    'no_rekening' => $saver->no_rekening,
                    'nis' => $saver->nis,
                    'nama_siswa' => $saver->nama_siswa,
                    'kelas' => $saver->kelas,
                    'saldo' => $saver->saldo,
                ],
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    /**
     * 3. Profil Pengguna yang Sedang Login
     */
    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    /**
     * 4. Logout (Revoke Token Aktif)
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil. Sesi token telah dihapus.',
        ]);
    }
}
