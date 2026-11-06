<?php

namespace Tests\Feature;

use App\Models\Nasabah;
use App\Models\Transaksi;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NasabahPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_nasabah_can_read_profile_and_only_recent_transactions_then_update_credentials(): void
    {
        $user = User::create([
            'username' => 'portal-student',
            'email' => 'portal.student@example.com',
            'password' => 'secret123',
            'nama_petugas' => 'Portal Student',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        $saver = Nasabah::create([
            'user_id' => $user->id,
            'email' => $user->email,
            'no_rekening' => 'REC-PORTAL-001',
            'nis' => 'PORTAL001',
            'nama_siswa' => 'Portal Student',
            'kelas' => 'XII RPL 1',
            'pin_keamanan' => '123456',
        ]);
        $teller = User::create([
            'username' => 'portal-teller',
            'password' => 'secret123',
            'nama_petugas' => 'Portal Teller',
            'role' => 'teller',
        ]);

        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now()->subDays(29),
            'jenis_trans' => 'setor',
            'nominal' => 50000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now()->subDays(31),
            'jenis_trans' => 'tarik',
            'nominal' => 10000,
        ]);

        Sanctum::actingAs($user, ['role:nasabah']);

        $this->getJson('/api/nasabah/saldo')
            ->assertOk()
            ->assertJsonPath('data.nama_siswa', 'Portal Student')
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.no_rekening', 'REC-PORTAL-001')
            ->assertJsonPath('data.kelas', 'XII RPL 1');

        $this->getJson('/api/nasabah/mutasi-30-hari')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nominal', 50000);

        $this->postJson('/api/nasabah/password', [
            'current_password' => 'wrong-password',
            'new_password' => 'changed-password',
            'new_password_confirmation' => 'changed-password',
        ])->assertUnprocessable();

        $this->postJson('/api/nasabah/password', [
            'current_password' => 'secret123',
            'new_password' => 'changed-password',
            'new_password_confirmation' => 'changed-password',
        ])->assertOk();
        $this->assertTrue(Hash::check('changed-password', $user->fresh()->password));

        $this->postJson('/api/nasabah/pin', [
            'current_pin' => '000000',
            'new_pin' => '654321',
            'new_pin_confirmation' => '654321',
        ])->assertUnprocessable();

        $this->postJson('/api/nasabah/pin', [
            'current_pin' => '123456',
            'new_pin' => '654321',
            'new_pin_confirmation' => '654321',
        ])->assertOk();
        $this->assertTrue(Hash::check('654321', $saver->fresh()->pin_keamanan));
    }
}
