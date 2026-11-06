<?php

namespace Tests\Feature;

use App\Models\ModalAwalKas;
use App\Models\Nasabah;
use App\Models\PenutupanKas;
use App\Models\Transaksi;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashClosureReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_teller_daily_cash_history_hides_handed_over_days_and_admin_can_see_the_submissions(): void
    {
        $admin = User::create([
            'username' => 'admin-history',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $teller = User::create([
            'username' => 'teller-history',
            'password' => 'secret123',
            'nama_petugas' => 'Teller Riwayat',
            'role' => 'teller',
        ]);
        $otherTeller = User::create([
            'username' => 'other-teller-history',
            'password' => 'secret123',
            'nama_petugas' => 'Teller Lain',
            'role' => 'teller',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260007',
            'nis' => 'SAVER007',
            'nama_siswa' => 'Saver Riwayat',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
            'saldo' => 100000,
        ]);

        foreach ([
            ['tanggal' => '2026-04-14', 'nominal' => 80000],
            ['tanggal' => '2026-04-15', 'nominal' => 100000],
            ['tanggal' => '2026-04-16', 'nominal' => 50000],
            ['tanggal' => '2026-04-17', 'nominal' => 70000],
        ] as $modal) {
            ModalAwalKas::create([
                'id_teller' => $teller->id,
                'tanggal' => $modal['tanggal'],
                'nominal' => $modal['nominal'],
            ]);
        }

        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => '2026-04-15 09:00:00',
            'jenis_trans' => 'setor',
            'nominal' => 25000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => '2026-04-15 10:00:00',
            'jenis_trans' => 'tarik',
            'nominal' => 5000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $otherTeller->id,
            'tanggal' => '2026-04-18 10:00:00',
            'jenis_trans' => 'setor',
            'nominal' => 40000,
        ]);

        foreach ([
            ['tanggal' => '2026-04-15', 'status' => 'rejected'],
            ['tanggal' => '2026-04-16', 'status' => 'pending'],
            ['tanggal' => '2026-04-17', 'status' => 'approved'],
        ] as $closure) {
            PenutupanKas::create([
                'id_teller' => $teller->id,
                'tanggal_penutupan' => $closure['tanggal'],
                'saldo_awal' => 100000,
                'total_setoran' => 25000,
                'total_penarikan' => 5000,
                'saldo_akhir_sistem' => 120000,
                'uang_fisik' => $closure['status'] === 'rejected' ? 110000 : 120000,
                'selisih' => $closure['status'] === 'rejected' ? -10000 : 0,
                'status' => $closure['status'],
                'catatan_penolakan' => $closure['status'] === 'rejected' ? 'Periksa kembali uang fisik.' : null,
            ]);
        }

        Sanctum::actingAs($teller);
        $this->getJson('/api/teller/penutupan-kas/history')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.tanggal', '2026-04-15')
            ->assertJsonPath('data.0.total_setoran', 25000)
            ->assertJsonPath('data.0.total_penarikan', 5000)
            ->assertJsonPath('data.0.saldo_akhir_sistem', 120000)
            ->assertJsonPath('data.0.status_penutupan', 'rejected')
            ->assertJsonPath('data.1.tanggal', '2026-04-14')
            ->assertJsonPath('data.1.status_penutupan', 'belum_diserahkan');

        Sanctum::actingAs($admin);
        $this->getJson('/api/supervisor/penutupan-kas')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_can_reject_an_unbalanced_closure_and_teller_can_resubmit(): void
    {
        $admin = User::create([
            'username' => 'admin-cash',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $teller = User::create([
            'username' => 'teller-cash',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        $penutupan = PenutupanKas::create([
            'id_teller' => $teller->id,
            'tanggal_penutupan' => today(),
            'saldo_awal' => 100000,
            'total_setoran' => 0,
            'total_penarikan' => 0,
            'saldo_akhir_sistem' => 100000,
            'uang_fisik' => 90000,
            'selisih' => -10000,
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/supervisor/penutupan-kas/{$penutupan->id}/reject", [
            'alasan_penolakan' => 'Uang fisik kurang Rp 10.000.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.catatan_penolakan', 'Uang fisik kurang Rp 10.000.');

        Sanctum::actingAs($teller);
        $this->getJson('/api/teller/penutupan-kas/summary-today')
            ->assertOk()
            ->assertJsonPath('data.status_penutupan', 'rejected')
            ->assertJsonPath('data.catatan_penolakan', 'Uang fisik kurang Rp 10.000.')
            ->assertJsonPath('data.kas_sudah_diserahkan', false);

        $this->postJson('/api/teller/penutupan-kas/submit', [
            'saldo_awal' => 100000,
            'uang_fisik' => 90000,
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Pengajuan ulang hanya dapat diserahkan jika uang fisik sudah seimbang dengan saldo akhir sistem.');

        $this->postJson('/api/teller/penutupan-kas/submit', [
            'saldo_awal' => 100000,
            'uang_fisik' => 100000,
        ])->assertCreated();

        $this->assertDatabaseHas('penutupan_kas', [
            'id_teller' => $teller->id,
            'status' => 'pending',
            'selisih' => 0,
        ]);
    }

    public function test_only_unbalanced_pending_closures_can_be_rejected_or_approved_appropriately(): void
    {
        $supervisor = User::create([
            'username' => 'supervisor-balance',
            'password' => 'secret123',
            'nama_petugas' => 'Supervisor',
            'role' => 'supervisor',
        ]);
        $teller = User::create([
            'username' => 'teller-balance',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        $balancedClosure = PenutupanKas::create([
            'id_teller' => $teller->id,
            'tanggal_penutupan' => today(),
            'saldo_awal' => 100000,
            'saldo_akhir_sistem' => 100000,
            'uang_fisik' => 100000,
            'selisih' => 0,
            'status' => 'pending',
        ]);
        $unbalancedClosure = PenutupanKas::create([
            'id_teller' => $teller->id,
            'tanggal_penutupan' => today()->subDay(),
            'saldo_awal' => 100000,
            'saldo_akhir_sistem' => 100000,
            'uang_fisik' => 90000,
            'selisih' => -10000,
            'status' => 'pending',
        ]);

        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/penutupan-kas/{$balancedClosure->id}/reject", [
            'alasan_penolakan' => 'Kas seimbang.',
        ])->assertUnprocessable();
        $this->postJson("/api/supervisor/penutupan-kas/{$unbalancedClosure->id}/approve")
            ->assertUnprocessable();

        $this->postJson("/api/supervisor/penutupan-kas/{$balancedClosure->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.id_supervisor', $supervisor->id);

        $this->assertDatabaseHas('penutupan_kas', [
            'id' => $balancedClosure->id,
            'status' => 'approved',
            'id_supervisor' => $supervisor->id,
        ]);
        $this->assertDatabaseHas('penutupan_kas', [
            'id' => $unbalancedClosure->id,
            'status' => 'pending',
        ]);
    }

    public function test_admin_can_download_a_pdf_for_an_approved_cash_closure(): void
    {
        $admin = User::create([
            'username' => 'admin-pdf',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $teller = User::create([
            'username' => 'teller-pdf',
            'password' => 'secret123',
            'nama_petugas' => 'Teller PDF',
            'role' => 'teller',
        ]);
        $closure = PenutupanKas::create([
            'id_teller' => $teller->id,
            'id_supervisor' => $admin->id,
            'tanggal_penutupan' => today(),
            'saldo_awal' => 100000,
            'total_setoran' => 50000,
            'total_penarikan' => 0,
            'saldo_akhir_sistem' => 150000,
            'uang_fisik' => 150000,
            'selisih' => 0,
            'status' => 'approved',
            'catatan' => 'Kas sesuai.',
        ]);

        Sanctum::actingAs($admin);
        $response = $this->get("/api/supervisor/penutupan-kas/{$closure->id}/pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->assertStringContainsString(
            "filename=penutupan-kas-{$closure->tanggal_penutupan->format('Y-m-d')}-teller-{$teller->id}.pdf",
            $response->headers->get('content-disposition')
        );
        $this->assertStringStartsWith('%PDF-', $response->getContent());
    }

    public function test_pdf_download_is_not_available_for_unapproved_cash_closures(): void
    {
        $admin = User::create([
            'username' => 'admin-pdf-pending',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $teller = User::create([
            'username' => 'teller-pdf-pending',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        $closure = PenutupanKas::create([
            'id_teller' => $teller->id,
            'tanggal_penutupan' => today(),
            'saldo_awal' => 100000,
            'saldo_akhir_sistem' => 100000,
            'uang_fisik' => 90000,
            'selisih' => -10000,
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);
        $this->getJson("/api/supervisor/penutupan-kas/{$closure->id}/pdf")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'PDF hanya tersedia untuk penutupan kas yang sudah disetujui.');
    }

    public function test_supervisor_can_download_monthly_transaction_recap_pdf_for_selected_period(): void
    {
        $supervisor = User::create([
            'username' => 'supervisor-monthly-pdf',
            'password' => 'secret123',
            'nama_petugas' => 'Supervisor',
            'role' => 'supervisor',
        ]);
        $teller = User::create([
            'username' => 'teller-monthly-pdf',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260006',
            'nis' => 'SAVER006',
            'nama_siswa' => 'Saver PDF',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
            'saldo' => 140000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => '2026-04-15 09:00:00',
            'jenis_trans' => 'setor',
            'nominal' => 50000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => '2026-04-15 10:00:00',
            'jenis_trans' => 'tarik',
            'nominal' => 10000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => '2026-05-01 10:00:00',
            'jenis_trans' => 'setor',
            'nominal' => 200000,
        ]);

        Sanctum::actingAs($supervisor);
        $response = $this->get('/api/supervisor/penutupan-kas/monthly-pdf?month=4&year=2026')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->assertStringContainsString(
            'filename=rekap-transaksi-bulanan-2026-04.pdf',
            $response->headers->get('content-disposition')
        );
        $this->assertStringStartsWith('%PDF-', $response->getContent());
        $this->assertGreaterThan(1000, strlen($response->getContent()));
    }

    public function test_supervisor_can_search_monthly_transaction_recap(): void
    {
        $supervisor = User::create([
            'username' => 'supervisor-monthly-recap',
            'password' => 'secret123',
            'nama_petugas' => 'Supervisor',
            'role' => 'supervisor',
        ]);
        $teller = User::create([
            'username' => 'teller-monthly-recap',
            'password' => 'secret123',
            'nama_petugas' => 'Teller Rekap',
            'role' => 'teller',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260005',
            'nis' => 'SAVER005',
            'nama_siswa' => 'Saver Recap',
            'kelas' => 'XI RPL 1',
            'pin_keamanan' => '123456',
            'saldo' => 140000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => '2026-04-15 09:00:00',
            'jenis_trans' => 'setor',
            'nominal' => 50000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => '2026-04-15 10:00:00',
            'jenis_trans' => 'tarik',
            'nominal' => 10000,
        ]);
        Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => '2026-05-01 10:00:00',
            'jenis_trans' => 'setor',
            'nominal' => 200000,
        ]);

        Sanctum::actingAs($supervisor);
        $this->getJson('/api/supervisor/penutupan-kas/monthly?month=4&year=2026')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('period.month', 4)
            ->assertJsonPath('period.year', 2026)
            ->assertJsonPath('summary.total_transaksi', 2)
            ->assertJsonPath('summary.jumlah_setoran', 1)
            ->assertJsonPath('summary.jumlah_penarikan', 1)
            ->assertJsonPath('summary.total_setoran', 50000)
            ->assertJsonPath('summary.total_penarikan', 10000)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.nasabah', 'Saver Recap')
            ->assertJsonPath('data.0.no_rekening', 'REC20260005')
            ->assertJsonPath('data.0.teller', 'Teller Rekap');
    }

    public function test_monthly_transaction_recap_requires_valid_month_and_year(): void
    {
        $admin = User::create([
            'username' => 'admin-monthly-recap-invalid',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);

        Sanctum::actingAs($admin);
        $this->getJson('/api/supervisor/penutupan-kas/monthly?month=13&year=2026')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['month']);
    }

    public function test_monthly_cash_closure_pdf_requires_valid_month_and_year(): void
    {
        $admin = User::create([
            'username' => 'admin-monthly-pdf-invalid',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);

        Sanctum::actingAs($admin);
        $this->getJson('/api/supervisor/penutupan-kas/monthly-pdf?month=13&year=2026')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['month']);
    }
}
