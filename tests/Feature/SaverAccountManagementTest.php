<?php

namespace Tests\Feature;

use App\Models\Nasabah;
use App\Models\Transaksi;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SaverAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_archive_a_saver_and_remove_its_login_without_transaction_history(): void
    {
        $admin = User::create([
            'username' => 'admin-saver-delete',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $saverUser = User::create([
            'username' => 'saver-delete',
            'password' => 'secret123',
            'nama_petugas' => 'Student Delete',
            'role' => 'nasabah',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260001',
            'nis' => 'SAVER001',
            'nama_siswa' => 'Student Delete',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
            'user_id' => $saverUser->id,
        ]);
        $saverUser->createToken('test-token');

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/admin/savers/{$saver->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('savers', ['id' => $saver->id]);
        $this->assertDatabaseMissing('users', ['id' => $saverUser->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $saverUser->id]);
    }

    public function test_admin_can_archive_a_saver_and_keep_its_transaction_history_visible(): void
    {
        $admin = User::create([
            'username' => 'admin-saver-protect',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $teller = User::create([
            'username' => 'teller-saver-protect',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        $saverUser = User::create([
            'username' => 'saver-history',
            'password' => 'secret123',
            'nama_petugas' => 'Student History',
            'role' => 'nasabah',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260002',
            'nis' => 'SAVER002',
            'nama_siswa' => 'Student History',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
            'user_id' => $saverUser->id,
        ]);
        $saverUser->createToken('test-token');
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now(),
            'jenis_trans' => 'setor',
            'nominal' => 10000,
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/admin/savers/{$saver->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('savers', ['id' => $saver->id]);
        $this->assertDatabaseHas('transaksi', ['id_nasabah' => $saver->id]);
        $this->assertDatabaseMissing('users', ['id' => $saverUser->id]);

        $this->assertDatabaseHas('users', ['id' => $teller->id, 'role' => 'teller']);

        $this->getJson('/api/admin/savers')
            ->assertOk()
            ->assertJsonMissing(['nis' => 'SAVER002']);

        $this->getJson('/api/supervisor/laporan-transaksi')
            ->assertOk()
            ->assertJsonPath('setoran.0.nasabah', 'Student History')
            ->assertJsonPath('setoran.0.no_rekening', 'REC20260002');
    }

    public function test_supervisor_can_delete_a_saver_account_as_an_admin(): void
    {
        $supervisor = User::create([
            'username' => 'supervisor-saver-delete',
            'password' => 'secret123',
            'nama_petugas' => 'Supervisor',
            'role' => 'supervisor',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260003',
            'nis' => 'SAVER003',
            'nama_siswa' => 'Student Protected',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);

        Sanctum::actingAs($supervisor);
        $this->deleteJson("/api/admin/savers/{$saver->id}")
            ->assertOk()
            ->assertJsonPath('success', true);
        $this->assertSoftDeleted('savers', ['id' => $saver->id]);
    }

    public function test_supervisor_can_manage_saver_login_status(): void
    {
        $supervisor = User::create([
            'username' => 'supervisor-saver-status',
            'password' => 'secret123',
            'nama_petugas' => 'Supervisor',
            'role' => 'supervisor',
        ]);
        $saverUser = User::create([
            'username' => 'saver-status',
            'password' => 'secret123',
            'nama_petugas' => 'Student Status',
            'role' => 'nasabah',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260004',
            'nis' => 'SAVER004',
            'nama_siswa' => 'Student Status',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
            'user_id' => $saverUser->id,
        ]);

        Sanctum::actingAs($supervisor);
        $this->postJson("/api/admin/savers/{$saver->id}/credentials", [
            'username' => 'saver-supervisor-managed',
            'password' => 'newSecret123',
            'email' => 'supervisor-managed@example.com',
        ])->assertOk();
        $this->patchJson("/api/admin/savers/{$saver->id}/status", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('users', ['id' => $saverUser->id, 'is_active' => false]);
        $this->assertDatabaseHas('users', [
            'id' => $saverUser->id,
            'username' => 'saver-supervisor-managed',
            'email' => 'supervisor-managed@example.com',
        ]);
    }
}
