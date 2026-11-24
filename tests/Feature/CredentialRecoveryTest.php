<?php

namespace Tests\Feature;

use App\Mail\CredentialResetOtpMail;
use App\Models\Nasabah;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CredentialRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_nasabah_can_reset_password_using_email_otp(): void
    {
        Mail::fake();
        $user = User::create([
            'username' => 'student-reset-password',
            'email' => 'student.password@example.com',
            'password' => 'old-password',
            'nama_petugas' => 'Student Password',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        Nasabah::create([
            'user_id' => $user->id,
            'nis' => 'RESET001',
            'nama_siswa' => 'Student Password',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);

        $this->postJson('/api/auth/forgot-credential', [
            'email' => $user->email,
            'username' => $user->username,
            'credential' => 'password',
        ])->assertOk()->assertJsonPath('success', true);

        $otp = null;
        Mail::assertSent(CredentialResetOtpMail::class, function (CredentialResetOtpMail $mail) use (&$otp, $user) {
            $otp = $mail->otp;

            return $mail->hasTo($user->email) && $mail->credential === 'password';
        });
        $this->assertNotNull($otp);

        $this->postJson('/api/auth/verify-credential-reset-otp', [
            'email' => $user->email,
            'username' => $user->username,
            'credential' => 'password',
            'otp' => $otp,
        ])->assertOk()->assertJsonPath('success', true);

        $this->postJson('/api/auth/reset-credential', [
            'email' => $user->email,
            'username' => $user->username,
            'credential' => 'password',
            'otp' => $otp,
            'new_password' => 'new-password-123',
            'new_password_confirmation' => 'different-password',
        ])->assertUnprocessable();
        $this->assertDatabaseCount('credential_reset_otps', 1);

        $this->postJson('/api/auth/reset-credential', [
            'email' => $user->email,
            'username' => $user->username,
            'credential' => 'password',
            'otp' => $otp,
            'new_password' => 'new-password-123',
            'new_password_confirmation' => 'new-password-123',
        ])->assertOk()->assertJsonPath('success', true);

        $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'new-password-123',
        ])->assertOk();
        $this->assertDatabaseCount('credential_reset_otps', 0);
    }

    public function test_nasabah_can_reset_password_using_only_the_email_registered_on_saver(): void
    {
        Mail::fake();
        RateLimiter::clear('credential-reset:'.hash('sha256', 'saver.reset@example.com|password'));
        RateLimiter::clear('credential-reset-ip:'.hash(
            'sha256',
            (string) $this->app['request']->ip()
        ));
        $user = User::create([
            'username' => 'student-saver-email-reset',
            'email' => 'account.reset@example.com',
            'password' => 'old-password',
            'nama_petugas' => 'Student Saver Email Reset',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        Nasabah::create([
            'user_id' => $user->id,
            'email' => 'saver.reset@example.com',
            'nis' => 'RESET005',
            'nama_siswa' => 'Student Saver Email Reset',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);

        $this->postJson('/api/auth/forgot-credential', [
            'email' => 'SAVER.RESET@example.com',
            'credential' => 'password',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath(
                'message',
                'Kode OTP telah dikirim ke email yang terdaftar pada data Saver.'
            );

        $otp = null;
        Mail::assertSent(CredentialResetOtpMail::class, function (CredentialResetOtpMail $mail) use (&$otp) {
            $otp = $mail->otp;

            return $mail->hasTo('saver.reset@example.com')
                && $mail->credential === 'password';
        });
        $this->assertNotNull($otp);

        $this->postJson('/api/auth/verify-credential-reset-otp', [
            'email' => 'saver.reset@example.com',
            'credential' => 'password',
            'otp' => $otp,
        ])->assertOk()->assertJsonPath('success', true);

        $this->postJson('/api/auth/reset-credential', [
            'email' => 'saver.reset@example.com',
            'credential' => 'password',
            'otp' => $otp,
            'new_password' => 'new-saver-password',
            'new_password_confirmation' => 'new-saver-password',
        ])->assertOk()->assertJsonPath('success', true);

        $this->assertTrue(Hash::check('new-saver-password', $user->fresh()->password));
    }

    public function test_password_recovery_reports_mail_delivery_failure(): void
    {
        $email = 'saver.mail-failure@example.com';
        RateLimiter::clear('credential-reset:'.hash('sha256', $email.'|password'));
        RateLimiter::clear('credential-reset-ip:'.hash(
            'sha256',
            (string) $this->app['request']->ip()
        ));
        $user = User::create([
            'username' => 'student-mail-failure',
            'email' => 'account.mail-failure@example.com',
            'password' => 'old-password',
            'nama_petugas' => 'Student Mail Failure',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        Nasabah::create([
            'user_id' => $user->id,
            'email' => $email,
            'nis' => 'RESETMAIL',
            'nama_siswa' => 'Student Mail Failure',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);
        Mail::shouldReceive('to')
            ->once()
            ->with($email)
            ->andThrow(new \RuntimeException('SMTP unavailable'));

        $this->postJson('/api/auth/forgot-credential', [
            'email' => $email,
            'credential' => 'password',
        ])->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath(
                'message',
                'Email OTP gagal dikirim. Periksa konfigurasi email server, lalu coba kembali.'
            );

        $this->assertDatabaseCount('credential_reset_otps', 0);
    }

    public function test_password_recovery_rejects_email_not_registered_on_a_saver(): void
    {
        Mail::fake();
        $user = User::create([
            'username' => 'student-account-email-only',
            'email' => 'account.only@example.com',
            'password' => 'secret123',
            'nama_petugas' => 'Student Account Email Only',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        Nasabah::create([
            'user_id' => $user->id,
            'email' => 'saver.only@example.com',
            'nis' => 'RESET006',
            'nama_siswa' => 'Student Account Email Only',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);

        $this->postJson('/api/auth/forgot-credential', [
            'email' => 'account.only@example.com',
            'credential' => 'password',
        ])->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'Email belum terdaftar pada data Saver. Periksa kembali alamat email.'
            );

        Mail::assertNothingSent();
    }

    public function test_nasabah_can_reset_pin_using_email_otp(): void
    {
        Mail::fake();
        $user = User::create([
            'username' => 'student-reset-pin',
            'email' => 'student.pin@example.com',
            'password' => 'secret123',
            'nama_petugas' => 'Student Pin',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        $saver = Nasabah::create([
            'user_id' => $user->id,
            'email' => 'student.pin@example.com',
            'nis' => 'RESET002',
            'nama_siswa' => 'Student Pin',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);

        Sanctum::actingAs(User::create([
            'username' => 'teller-reset-pin',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]));

        $this->postJson("/api/teller/savers/{$saver->id}/forgot-pin")
            ->assertOk()
            ->assertJsonPath('message', 'Kode OTP telah dikirim ke email yang terdaftar pada data Saver.');

        $otp = null;
        Mail::assertSent(CredentialResetOtpMail::class, function (CredentialResetOtpMail $mail) use (&$otp) {
            $otp = $mail->otp;

            return $mail->hasTo('student.pin@example.com') && $mail->credential === 'pin';
        });

        $this->postJson('/api/auth/reset-credential', [
            'saver_id' => $saver->id,
            'credential' => 'pin',
            'otp' => $otp,
            'new_pin' => '654321',
        ])->assertOk()->assertJsonPath('success', true);

        $this->assertTrue(Hash::check('654321', $saver->fresh()->pin_keamanan));
        $this->assertDatabaseCount('credential_reset_otps', 0);
    }

    public function test_pin_recovery_only_uses_the_email_registered_on_saver(): void
    {
        Mail::fake();
        $user = User::create([
            'username' => 'student-saver-email',
            'email' => 'account.email@example.com',
            'password' => 'secret123',
            'nama_petugas' => 'Student Saver Email',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        $saver = Nasabah::create([
            'user_id' => $user->id,
            'email' => 'saver.email@example.com',
            'nis' => 'RESET003',
            'nama_siswa' => 'Student Saver Email',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);

        Sanctum::actingAs(User::create([
            'username' => 'teller-saver-email',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]));

        $this->postJson('/api/auth/forgot-credential', [
            'email' => $user->email,
            'username' => $user->username,
            'credential' => 'pin',
        ])->assertUnprocessable();
        Mail::assertNothingSent();

        $this->postJson("/api/teller/savers/{$saver->id}/forgot-pin")->assertOk();
        Mail::assertSent(CredentialResetOtpMail::class, function (CredentialResetOtpMail $mail) {
            return $mail->hasTo('saver.email@example.com') && $mail->credential === 'pin';
        });
    }

    public function test_teller_pin_recovery_requires_email_registered_on_saver(): void
    {
        Mail::fake();
        $user = User::create([
            'username' => 'student-no-saver-email',
            'password' => 'secret123',
            'nama_petugas' => 'Student Without Saver Email',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        $saver = Nasabah::create([
            'user_id' => $user->id,
            'nis' => 'RESET004',
            'nama_siswa' => 'Student Without Saver Email',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);
        Sanctum::actingAs(User::create([
            'username' => 'teller-no-saver-email',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]));

        $this->postJson("/api/teller/savers/{$saver->id}/forgot-pin")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Email belum terdaftar pada data Saver. Perbarui data email Saver terlebih dahulu.');
        Mail::assertNothingSent();
    }

    public function test_recovery_request_does_not_disclose_unregistered_email(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/forgot-credential', [
            'email' => 'unknown@example.com',
            'username' => 'unknown-user',
            'credential' => 'password',
        ])->assertOk()->assertJsonPath(
            'message',
            'Jika email terdaftar, kode OTP akan dikirim. Periksa kotak masuk atau folder spam.'
        );

        Mail::assertNothingSent();
    }

    public function test_password_recovery_requires_matching_username_and_email(): void
    {
        Mail::fake();
        $user = User::create([
            'username' => 'student-matched-identity',
            'email' => 'student.matched@example.com',
            'password' => 'secret123',
            'nama_petugas' => 'Student Matched',
            'role' => 'nasabah',
            'is_active' => true,
        ]);

        $this->postJson('/api/auth/forgot-credential', [
            'email' => $user->email,
            'username' => 'different-username',
            'credential' => 'password',
        ])->assertOk();
        Mail::assertNothingSent();
    }

    public function test_five_incorrect_otp_attempts_invalidate_the_code(): void
    {
        Mail::fake();
        $user = User::create([
            'username' => 'student-invalid-otp',
            'email' => 'student.invalid@example.com',
            'password' => 'secret123',
            'nama_petugas' => 'Student Invalid',
            'role' => 'teller',
        ]);

        $this->postJson('/api/auth/forgot-credential', [
            'email' => $user->email,
            'username' => $user->username,
            'credential' => 'password',
        ])->assertOk();

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/auth/reset-credential', [
                'email' => $user->email,
                'username' => $user->username,
                'credential' => 'password',
                'otp' => '000000',
                'new_password' => 'new-password-123',
                'new_password_confirmation' => 'new-password-123',
            ])->assertUnprocessable();
        }

        $this->assertDatabaseCount('credential_reset_otps', 0);
        $this->assertTrue(Hash::check('secret123', $user->fresh()->password));
    }
}
