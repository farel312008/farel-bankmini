<?php

namespace Tests\Feature;

use App\Models\Nasabah;
use App\Models\PenutupanKas;
use App\Models\Transaksi;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_remove_staff_access_without_deleting_audit_history(): void
    {
        $admin = User::create([
            'username' => 'admin-staff-test',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $teller = User::create([
            'username' => 'teller-staff-test',
            'password' => 'secret123',
            'nama_petugas' => 'Teller Test',
            'role' => 'teller',
            'is_active' => true,
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20261101',
            'nis' => 'SAVER1101',
            'nama_siswa' => 'Saver Test',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);
        $transaction = Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now(),
            'jenis_trans' => 'setor',
            'nominal' => 10000,
        ]);
        $closure = PenutupanKas::create([
            'id_teller' => $teller->id,
            'tanggal_penutupan' => today(),
            'saldo_awal' => 0,
            'total_setoran' => 10000,
            'total_penarikan' => 0,
            'saldo_akhir_sistem' => 10000,
            'uang_fisik' => 10000,
            'selisih' => 0,
            'status' => 'approved',
        ]);
        $teller->createToken('staff-test-token');

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/admin/users/{$teller->id}")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Akun staf berhasil dihapus dari daftar aktif. Riwayat audit tetap tersimpan.');

        $this->assertDatabaseHas('users', ['id' => $teller->id, 'is_active' => false]);
        $this->assertDatabaseHas('transaksi', ['id' => $transaction->id, 'id_user' => $teller->id]);
        $this->assertDatabaseHas('penutupan_kas', ['id' => $closure->id, 'id_teller' => $teller->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $teller->id]);
        $this->getJson('/api/admin/users')->assertOk()->assertJsonMissing(['id' => $teller->id]);
        $this->postJson('/api/auth/login', [
            'username' => 'teller-staff-test',
            'password' => 'secret123',
        ])->assertUnauthorized();
    }

    public function test_staff_cannot_remove_their_own_current_account(): void
    {
        $admin = User::create([
            'username' => 'admin-own-delete',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/admin/users/{$admin->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Anda tidak dapat menghapus akun yang sedang digunakan.');

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'is_active' => true]);
    }
}
