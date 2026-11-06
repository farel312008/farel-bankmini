<?php

namespace Tests\Feature;

use App\Models\Nasabah;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MobileNasabahApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_mobile_nasabah_can_log_in_read_saldo_and_mutasi_then_log_out(): void
    {
        $user = User::create([
            'username' => 'mobile-student',
            'password' => 'secret123',
            'nama_petugas' => 'Mobile Student',
            'role' => 'nasabah',
            'is_active' => true,
        ]);

        Nasabah::create([
            'user_id' => $user->id,
            'no_rekening' => 'REC-MOBILE-001',
            'nis' => 'MOBILE001',
            'nama_siswa' => 'Mobile Student',
            'kelas' => 'XII RPL 1',
            'pin_keamanan' => '123456',
        ]);

        $login = $this->postJson('/api/auth/login-nasabah', [
            'username' => 'mobile-student',
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.nasabah.username', 'mobile-student')
            ->assertJsonStructure(['data' => ['token']]);

        $token = $login->json('data.token');

        $this->withToken($token)
            ->getJson('/api/nasabah/saldo')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.no_rekening', 'REC-MOBILE-001')
            ->assertJsonPath('data.saldo_berjalan', 0)
            ->assertJsonPath('data.saldo_tersedia_ditarik', 0);

        $this->withToken($token)
            ->getJson('/api/nasabah/mutasi')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data', []);

        $this->withToken($token)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => explode('|', $token, 2)[0],
        ]);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->getJson('/api/nasabah/saldo')
            ->assertUnauthorized();
    }
}
