<?php

namespace Tests\Feature;

use App\Models\Nasabah;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UnifiedLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_log_in_with_username_and_password_only(): void
    {
        User::create([
            'username' => 'teller-one',
            'password' => 'secret123',
            'nama_petugas' => 'Teller One',
            'role' => 'teller',
        ]);

        $this->postJson('/api/auth/login', [
            'username' => 'teller-one',
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('data.user.username', 'teller-one')
            ->assertJsonPath('data.user.role', 'teller')
            ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_nasabah_can_log_in_with_username_and_password_only(): void
    {
        $user = User::create([
            'username' => 'student-one',
            'password' => 'secret123',
            'nama_petugas' => 'Student One',
            'role' => 'nasabah',
            'is_active' => true,
        ]);

        Nasabah::create([
            'user_id' => $user->id,
            'nis' => 'STU001',
            'nama_siswa' => 'Student One',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);

        $this->postJson('/api/auth/login', [
            'username' => 'student-one',
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('data.user.username', 'student-one')
            ->assertJsonPath('data.user.nama_siswa', 'Student One')
            ->assertJsonPath('data.user.role', 'nasabah')
            ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_seeded_nasabah_can_log_in_with_seeded_credentials(): void
    {
        $this->seed();

        $this->postJson('/api/auth/login', [
            'username' => 'rizky',
            'password' => 'password123',
        ])->assertOk()
            ->assertJsonPath('data.user.nama_siswa', 'Muhammad Rizky Pratama')
            ->assertJsonPath('data.user.role', 'nasabah')
            ->assertJsonStructure(['data' => ['token']]);
    }
}
