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
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now(),
            'jenis_trans' => 'tarik',
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

    public function test_admin_cannot_delete_a_saver_that_still_has_balance(): void
    {
        $admin = User::create([
            'username' => 'admin-saver-balance',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $teller = User::create([
            'username' => 'teller-saver-balance',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260005',
            'nis' => 'SAVER005',
            'nama_siswa' => 'Student Balance',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now(),
            'jenis_trans' => 'setor',
            'nominal' => 50000,
        ]);

        Sanctum::actingAs($admin);
        $response = $this->deleteJson("/api/admin/savers/{$saver->id}");

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonFragment(['message' => 'Akun masih memiliki saldo 50.000. Tarik seluruh saldo di Teller sebelum menghapus akun.']);

        $this->assertDatabaseHas('savers', ['id' => $saver->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('transaksi', ['id_nasabah' => $saver->id]);
    }

    public function test_admin_can_delete_a_saver_after_the_balance_is_fully_withdrawn(): void
    {
        $admin = User::create([
            'username' => 'admin-saver-withdraw',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $teller = User::create([
            'username' => 'teller-saver-withdraw',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        $saverUser = User::create([
            'username' => 'saver-withdraw',
            'password' => 'secret123',
            'nama_petugas' => 'Student Withdraw',
            'role' => 'nasabah',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260006',
            'nis' => 'SAVER006',
            'nama_siswa' => 'Student Withdraw',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
            'user_id' => $saverUser->id,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now(),
            'jenis_trans' => 'setor',
            'nominal' => 10000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now(),
            'jenis_trans' => 'tarik',
            'nominal' => 10000,
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/admin/savers/{$saver->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('savers', ['id' => $saver->id]);
        $this->assertDatabaseHas('transaksi', ['id_nasabah' => $saver->id]);
        $this->assertDatabaseMissing('users', ['id' => $saverUser->id]);
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

    public function test_laporan_transaksi_supports_daily_monthly_and_nasabah_filters(): void
    {
        $admin = User::create([
            'username' => 'admin-laporan-filter',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $teller = User::create([
            'username' => 'teller-laporan-filter',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        $saverA = Nasabah::create([
            'no_rekening' => 'REC20260007',
            'nis' => 'SAVER007',
            'nama_siswa' => 'Student One',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);
        $saverB = Nasabah::create([
            'no_rekening' => 'REC20260008',
            'nis' => 'SAVER008',
            'nama_siswa' => 'Student Two',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
        ]);

        $buat = fn (Nasabah $saver, string $tanggal, string $jenis, int $nominal) => Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => $tanggal,
            'jenis_trans' => $jenis,
            'nominal' => $nominal,
        ]);

        $buat($saverA, '2026-05-10 09:00:00', 'setor', 20000);
        $buat($saverA, '2026-05-11 10:00:00', 'tarik', 5000);
        $buat($saverB, '2026-06-01 11:00:00', 'setor', 30000);
        $buat($saverB, '2026-06-01 12:00:00', 'tarik', 30000);

        Sanctum::actingAs($admin);

        // Harian: hanya transaksi tanggal 2026-06-01
        $this->getJson('/api/supervisor/laporan-transaksi?tanggal=2026-06-01')
            ->assertOk()
            ->assertJsonPath('summary.total_setoran', 30000)
            ->assertJsonPath('summary.total_penarikan', 30000)
            ->assertJsonCount(1, 'setoran');

        // Bulanan: hanya transaksi Mei 2026
        $this->getJson('/api/supervisor/laporan-transaksi?bulan=5&tahun=2026')
            ->assertOk()
            ->assertJsonPath('summary.total_setoran', 20000)
            ->assertJsonPath('summary.total_penarikan', 5000);

        // Per nasabah: hanya riwayat saverA
        $this->getJson("/api/supervisor/laporan-transaksi?nasabah_id={$saverA->id}")
            ->assertOk()
            ->assertJsonPath('summary.total_setoran', 20000)
            ->assertJsonPath('summary.total_penarikan', 5000)
            ->assertJsonMissing(['nasabah' => 'Student Two']);

        // Filter tanpa pasangan bulan/tahun ditolak
        $this->getJson('/api/supervisor/laporan-transaksi?bulan=5')
            ->assertStatus(422);

        // Dropdown nasabah tersedia di response
        $this->getJson('/api/supervisor/laporan-transaksi')
            ->assertOk()
            ->assertJsonFragment(['nama_siswa' => 'Student One']);
    }
}
