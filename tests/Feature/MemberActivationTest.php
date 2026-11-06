<?php

namespace Tests\Feature;

use App\Models\Nasabah;
use App\Models\Transaksi;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MemberActivationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_members_and_their_linked_user_accounts(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $response = $this->postJson('/api/admin/members', [
            'student_number' => 'STU001',
            'student_name' => 'Student One',
            'gender' => 'Laki-laki',
            'graduation_year' => 2027,
            'nomor_hp' => '081234567801',
        ])->assertCreated();

        $userId = $response->json('data.user_id');
        $this->assertDatabaseHas('members', [
            'user_id' => $userId,
            'student_number' => 'STU001',
            'graduation_year' => 2027,
            'gender' => 'Laki-laki',
            'nomor_hp' => '081234567801',
            'status' => 'inactive',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'role' => 'member',
        ]);

        $this->putJson("/api/admin/members/{$userId}", [
            'student_number' => 'STU001',
            'student_name' => 'Updated Student',
            'gender' => 'Perempuan',
            'graduation_year' => 2027,
            'nomor_hp' => '081234567802',
        ])->assertOk();
        $this->assertDatabaseHas('members', [
            'user_id' => $userId,
            'student_name' => 'Updated Student',
        ]);

        $this->deleteJson("/api/admin/members/{$userId}")->assertOk();
        $this->assertDatabaseMissing('members', ['user_id' => $userId]);
        $this->assertDatabaseMissing('users', ['id' => $userId]);
    }

    public function test_member_phone_is_copied_to_saver_without_email_or_username_member_fields(): void
    {
        $admin = User::create([
            'username' => 'admin-member-contact',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        Sanctum::actingAs($admin);

        $memberResponse = $this->postJson('/api/admin/members', [
            'student_number' => 'CONTACT001',
            'student_name' => 'Contact Student',
            'gender' => 'Perempuan',
            'graduation_year' => 2027,
            'nomor_hp' => '081234567890',
        ])->assertCreated()
            ->assertJsonPath('data.nomor_hp', '081234567890');

        $this->assertArrayNotHasKey('username', $memberResponse->json('data'));
        $this->assertArrayNotHasKey('email', $memberResponse->json('data'));
        $userId = $memberResponse->json('data.user_id');
        $this->assertDatabaseHas('members', [
            'user_id' => $userId,
            'nomor_hp' => '081234567890',
        ]);
        $this->assertFalse(Schema::hasColumn('members', 'email'));
        $this->assertFalse(Schema::hasColumn('members', 'username'));
        $this->assertTrue(Schema::hasColumn('members', 'class'));
        $this->assertTrue(Schema::hasColumn('members', 'security_pin'));
        $this->assertNotSame('CONTACT001', User::findOrFail($userId)->username);

        $this->postJson("/api/admin/members/{$userId}/activate", [
            'username' => 'contact-student',
            'password' => 'studentPass123',
            'security_pin' => '654321',
            'saldo_awal' => 0,
        ])->assertCreated();

        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'email' => null,
        ]);
        $this->assertDatabaseHas('savers', [
            'user_id' => $userId,
            'nomor_hp' => '081234567890',
            'kelas' => null,
        ]);
        $this->assertTrue(Hash::check('654321', Nasabah::where('user_id', $userId)->firstOrFail()->pin_keamanan));
        $this->assertDatabaseMissing('members', ['user_id' => $userId]);
    }

    public function test_admin_activates_member_with_rekening_before_first_deposit(): void
    {
        $admin = User::create([
            'username' => 'admin',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        Sanctum::actingAs($admin);

        $memberResponse = $this->postJson('/api/admin/members', [
            'student_number' => 'STU002',
            'student_name' => 'Student Two',
            'gender' => 'Perempuan',
            'graduation_year' => 2027,
        ])->assertCreated();
        $userId = $memberResponse->json('data.user_id');

        $teller = User::create([
            'username' => 'teller',
            'password' => 'secret123',
            'nama_petugas' => 'Teller One',
            'role' => 'teller',
        ]);
        Sanctum::actingAs($teller);

        $this->postJson('/api/teller/nasabah/scan', ['query' => 'STU002'])
            ->assertOk()
            ->assertJsonPath('data.is_member', true)
            ->assertJsonPath('data.id_member', $userId);

        $this->postJson('/api/teller/transaksi/setor', [
            'id_member' => $userId,
            'nominal' => 10000,
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Siswa harus lebih dulu dibuatkan akun oleh Admin sebelum dapat melakukan setoran.');
        $this->assertDatabaseHas('members', ['user_id' => $userId]);
        $this->assertDatabaseCount('savers', 0);

        Sanctum::actingAs($admin);
        $activation = $this->postJson("/api/admin/members/{$userId}/activate", [
            'username' => 'student-two',
            'password' => 'studentPass123',
            'security_pin' => '222333',
            'saldo_awal' => 0,
        ])->assertCreated()
            ->assertJsonPath('data.kelas', null);
        $accountNumber = $activation->json('data.no_rekening');
        $this->assertStringStartsWith('REC', $accountNumber);
        $this->assertDatabaseMissing('members', ['user_id' => $userId]);
        $this->assertDatabaseHas('savers', [
            'user_id' => $userId,
            'nis' => 'STU002',
            'no_rekening' => $accountNumber,
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'username' => 'student-two',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        $this->assertTrue(Hash::check('studentPass123', User::findOrFail($userId)->password));
        $this->assertTrue(Hash::check('222333', Nasabah::where('user_id', $userId)->firstOrFail()->pin_keamanan));

        $login = $this->postJson('/api/auth/login-nasabah', [
            'username' => 'student-two',
            'password' => 'studentPass123',
        ])->assertOk()
            ->assertJsonPath('data.nasabah.no_rekening', $accountNumber);

        Sanctum::actingAs(User::findOrFail($userId));
        $this->getJson('/api/nasabah/saldo')
            ->assertOk()
            ->assertJsonPath('data.saldo_berjalan', 0)
            ->assertJsonPath('data.rekening_aktif', true);

        Sanctum::actingAs($teller);
        $saver = Nasabah::where('user_id', $userId)->firstOrFail();
        $this->postJson('/api/teller/nasabah/scan', ['query' => 'STU002'])
            ->assertOk()
            ->assertJsonPath('data.is_member', false)
            ->assertJsonPath('data.has_account', true);

        $deposit = $this->postJson('/api/teller/transaksi/setor', [
            'id_nasabah' => $saver->id,
            'nominal' => 10000,
        ])->assertCreated()
            ->assertJsonPath('data.saldo_akhir', 10000);

        $this->assertSame($accountNumber, $deposit->json('data.no_rekening'));
        $this->assertDatabaseHas('savers', [
            'user_id' => $userId,
            'nis' => 'STU002',
            'no_rekening' => $accountNumber,
        ]);
        $this->assertDatabaseHas('transaksi', [
            'id_nasabah' => Nasabah::where('no_rekening', $accountNumber)->value('id'),
            'jenis_trans' => 'setor',
            'nominal' => 10000,
        ]);
        $this->assertDatabaseCount('jurnal_akuntansi', 2);

        $login = $this->postJson('/api/auth/login-nasabah', [
            'username' => 'student-two',
            'password' => 'studentPass123',
        ])->assertOk()
            ->assertJsonPath('data.nasabah.no_rekening', $accountNumber);
        Sanctum::actingAs(User::findOrFail($userId));
        $this->getJson('/api/nasabah/saldo')
            ->assertOk()
            ->assertJsonPath('data.no_rekening', $accountNumber)
            ->assertJsonPath('data.saldo_berjalan', 10000);
    }

    public function test_existing_saver_can_still_make_a_regular_deposit(): void
    {
        $teller = User::create([
            'username' => 'teller',
            'password' => 'secret123',
            'nama_petugas' => 'Teller One',
            'role' => 'teller',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260001',
            'nis' => 'STU003',
            'nama_siswa' => 'Existing Saver',
            'jenis_kelamin' => 'Laki-laki',
            'kelas' => 'XII RPL 1',
            'pin_keamanan' => '123456',
        ]);
        Sanctum::actingAs($teller);

        $this->postJson('/api/teller/transaksi/setor', [
            'id_nasabah' => $saver->id,
            'nominal' => 1000,
        ])->assertCreated()
            ->assertJsonPath('data.no_rekening', 'REC20260001')
            ->assertJsonPath('data.saldo_akhir', 1000);
    }

    public function test_supervisor_transaction_report_loads_deposits_and_withdrawals(): void
    {
        $supervisor = User::create([
            'username' => 'supervisor-report',
            'password' => 'secret123',
            'nama_petugas' => 'Supervisor Report',
            'role' => 'supervisor',
        ]);
        $teller = User::create([
            'username' => 'teller-report',
            'password' => 'secret123',
            'nama_petugas' => 'Teller Report',
            'role' => 'teller',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => 'REC20260020',
            'nis' => 'STU020',
            'nama_siswa' => 'Student Report',
            'jenis_kelamin' => 'Perempuan',
            'kelas' => 'XII RPL 1',
            'pin_keamanan' => '123456',
        ]);
        $deposit = Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now(),
            'jenis_trans' => 'setor',
            'nominal' => 25000,
        ]);
        $withdrawal = Transaksi::create([
            'id_nasabah' => $saver->id,
            'id_user' => $teller->id,
            'tanggal' => now(),
            'jenis_trans' => 'tarik',
            'nominal' => 5000,
        ]);
        Sanctum::actingAs($supervisor);

        $this->getJson('/api/supervisor/laporan-transaksi')
            ->assertOk()
            ->assertJsonPath('summary.total_setoran', 25000)
            ->assertJsonPath('summary.total_penarikan', 5000)
            ->assertJsonPath('setoran.0.id', $deposit->id)
            ->assertJsonPath('setoran.0.teller', 'Teller Report')
            ->assertJsonPath('setoran.0.nasabah', 'Student Report')
            ->assertJsonPath('penarikan.0.id', $withdrawal->id)
            ->assertJsonPath('penarikan.0.teller', 'Teller Report');
    }

    public function test_admin_can_import_a_csv_roster_as_inactive_members(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-import',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $file = UploadedFile::fake()->createWithContent(
            'angkatan.csv',
            "nis,nama_siswa,angkatan_keluar,nomor_hp,gender\nSTU004,Student Four,2027,081234567804,Laki-laki\nSTU005,Student Five,2027,081234567805,Perempuan\n"
        );

        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertCreated()
            ->assertJsonPath('data.imported', 2);

        $this->assertDatabaseHas('members', [
            'student_number' => 'STU004',
            'student_name' => 'Student Four',
            'status' => 'inactive',
        ]);
        $this->assertDatabaseHas('members', [
            'student_number' => 'STU005',
            'status' => 'inactive',
        ]);
    }

    public function test_admin_can_import_more_than_500_members_in_one_upload(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-import-large',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $rows = ['nis,nama_siswa,angkatan_keluar,nomor_hp,gender'];
        for ($index = 1; $index <= 501; $index++) {
            $rows[] = sprintf('BULK%04d,Student %d,2027,081234567890,Laki-laki', $index, $index);
        }

        $file = UploadedFile::fake()->createWithContent('anggota.csv', implode("\n", $rows));
        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertCreated()
            ->assertJsonPath('data.imported', 501);

        $this->assertDatabaseCount('members', 501);
    }

    public function test_admin_can_upload_a_template_without_member_rows(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-import-empty',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $file = UploadedFile::fake()->createWithContent(
            'anggota-kosong.csv',
            "nis,nama_siswa,angkatan_keluar,nomor_hp,gender\n"
        );

        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertCreated()
            ->assertJsonPath('data.imported', 0);

        $this->assertDatabaseCount('members', 0);
    }

    public function test_supervisor_can_import_a_csv_roster_as_inactive_members(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'supervisor-import',
            'password' => 'secret123',
            'nama_petugas' => 'Supervisor',
            'role' => 'supervisor',
        ]));

        $file = UploadedFile::fake()->createWithContent(
            'angkatan.csv',
            "nis,nama_siswa,angkatan_keluar,nomor_hp,gender\nSTU010,Student Ten,2027,081234567890,Perempuan\n"
        );

        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertCreated()
            ->assertJsonPath('data.imported', 1);

        $this->assertDatabaseHas('members', [
            'student_number' => 'STU010',
            'student_name' => 'Student Ten',
            'gender' => 'Perempuan',
            'graduation_year' => 2027,
            'nomor_hp' => '081234567890',
            'status' => 'inactive',
        ]);
        $this->assertFalse(Schema::hasColumn('members', 'email'));
        $this->assertDatabaseMissing('savers', ['nis' => 'STU010']);
    }

    public function test_admin_import_normalizes_common_gender_values(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-import-gender',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $file = UploadedFile::fake()->createWithContent(
            'angkatan.csv',
            "nis,nama_siswa,angkatan_keluar,nomor_hp,gender\nSTU014,Student Fourteen,2027,081234567814,L\nSTU015,Student Fifteen,2027,081234567815, WANITA \n"
        );

        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertCreated()
            ->assertJsonPath('data.imported', 2);

        $this->assertDatabaseHas('members', [
            'student_number' => 'STU014',
            'gender' => 'Laki-laki',
            'graduation_year' => 2027,
            'nomor_hp' => '081234567814',
        ]);
        $this->assertDatabaseHas('members', [
            'student_number' => 'STU015',
            'gender' => 'Perempuan',
            'nomor_hp' => '081234567815',
        ]);
    }

    public function test_admin_import_uses_a_populated_gender_alias_when_the_gender_column_is_blank(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-import-gender-alias',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $file = UploadedFile::fake()->createWithContent(
            'angkatan.csv',
            "nis,nama_siswa,kelas,angkatan_keluar,nomor_hp,gender,Jenis Kelamin\nSTU017,Student Seventeen,XII IPA 1,2027,081234567817,,Perempuan\n"
        );

        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertCreated()
            ->assertJsonPath('data.imported', 1);

        $this->assertDatabaseHas('members', [
            'student_number' => 'STU017',
            'class' => 'XII IPA 1',
            'gender' => 'Perempuan',
        ]);
    }

    public function test_admin_import_rejects_rows_with_a_blank_gender(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-import-missing-gender',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $file = UploadedFile::fake()->createWithContent(
            'angkatan.csv',
            "nis,nama_siswa,angkatan_keluar,nomor_hp,gender\nSTU018,Student Eighteen,2027,081234567818,\n"
        );

        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonPath('errors.0', 'Baris 2: Gender wajib diisi.');

        $this->assertDatabaseCount('members', 0);
    }

    public function test_admin_import_reports_unsupported_gender_values_clearly(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-import-invalid-gender',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $file = UploadedFile::fake()->createWithContent(
            'angkatan.csv',
            "nis,nama_siswa,angkatan_keluar,nomor_hp,gender\nSTU016,Student Sixteen,2027,081234567816,Unknown\n"
        );

        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonPath('errors.0', 'Baris 2: Gender harus Laki-laki (L/pria) atau Perempuan (P/wanita).');

        $this->assertDatabaseCount('members', 0);
    }

    public function test_admin_can_import_an_xlsx_roster_with_a_nis_that_starts_with_zero(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-xlsx',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $path = tempnam(sys_get_temp_dir(), 'student-roster-');
        $archive = new \ZipArchive;
        $archive->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        $strings = [
            'nis',
            'nama_siswa',
            'angkatan_keluar',
            'nomor_hp',
            'gender',
            '001234',
            'Student Eight',
            '2027',
            '081234567808',
            'Laki-laki',
        ];
        $sharedStrings = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="10" uniqueCount="10">';
        foreach ($strings as $value) {
            $sharedStrings .= '<si><t>'.htmlspecialchars($value, ENT_XML1).'</t></si>';
        }
        $sharedStrings .= '</sst>';
        $archive->addFromString(
            'xl/workbook.xml',
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Students" sheetId="1" r:id="rId1"/></sheets></workbook>'
        );
        $archive->addFromString(
            'xl/_rels/workbook.xml.rels',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
        );
        $archive->addFromString('xl/sharedStrings.xml', $sharedStrings);
        $worksheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">';
        foreach (range(0, 4) as $column) {
            $worksheet .= '<c r="'.chr(65 + $column).'1" t="s"><v>'.$column.'</v></c>';
        }
        $worksheet .= '</row><row r="2">';
        foreach (range(5, 9) as $index => $stringIndex) {
            $worksheet .= '<c r="'.chr(65 + $index).'2" t="s"><v>'.$stringIndex.'</v></c>';
        }
        $worksheet .= '</row></sheetData></worksheet>';
        $archive->addFromString('xl/worksheets/sheet1.xml', $worksheet);
        $archive->close();

        try {
            $file = new UploadedFile(
                $path,
                'angkatan.xlsx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                null,
                true
            );
            $this->post('/api/admin/members/import', ['file' => $file])
                ->assertCreated()
                ->assertJsonPath('data.imported', 1);
        } finally {
            unlink($path);
        }

        $this->assertDatabaseHas('members', [
            'student_number' => '001234',
            'student_name' => 'Student Eight',
            'graduation_year' => 2027,
            'nomor_hp' => '081234567808',
            'gender' => 'Laki-laki',
        ]);
    }

    public function test_admin_import_does_not_save_any_rows_when_a_duplicate_is_found(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-import-duplicate',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $file = UploadedFile::fake()->createWithContent(
            'angkatan.csv',
            "nis,nama_siswa,angkatan_keluar,nomor_hp,gender\nSTU006,Student Six,2027,081234567806,\nSTU006,Duplicate Student,2027,081234567807,\n"
        );

        $this->post('/api/admin/members/import', ['file' => $file])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);

        $this->assertDatabaseCount('members', 0);
    }

    public function test_admin_can_activate_member_with_submitted_password_and_pin(): void
    {
        $admin = User::create([
            'username' => 'admin-activate',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        Sanctum::actingAs($admin);

        $memberResponse = $this->postJson('/api/admin/members', [
            'student_number' => 'STU007',
            'student_name' => 'Student Seven',
            'class' => 'XII RPL 1',
            'gender' => 'Laki-laki',
            'graduation_year' => 2027,
            'security_pin' => '123456',
        ])->assertCreated();

        $userId = $memberResponse->json('data.user_id');
        $activation = $this->postJson("/api/admin/members/{$userId}/activate", [
            'username' => 'student-seven',
            'password' => 'studentPass123',
            'security_pin' => '654321',
            'saldo_awal' => 25000,
        ])->assertCreated()
            ->assertJsonPath('data.nis', 'STU007')
            ->assertJsonPath('data.saldo_awal', 25000)
            ->assertJsonPath('data.saldo', 25000);

        $this->assertDatabaseMissing('members', ['user_id' => $userId]);
        $this->assertDatabaseHas('savers', [
            'user_id' => $userId,
            'nis' => 'STU007',
        ]);
        $this->assertNotNull(Nasabah::where('user_id', $userId)->value('no_rekening'));
        $saver = Nasabah::where('user_id', $userId)->firstOrFail();
        $this->assertDatabaseHas('transaksi', [
            'id_nasabah' => $saver->id,
            'id_user' => $admin->id,
            'jenis_trans' => 'setor',
            'nominal' => 25000,
        ]);
        $transactionId = Transaksi::where('id_nasabah', $saver->id)->value('id');
        $this->assertDatabaseHas('jurnal_akuntansi', [
            'id_transaksi' => $transactionId,
            'kode_akun' => '101',
            'posisi' => 'debit',
            'jumlah' => 25000,
        ]);
        $this->assertDatabaseHas('jurnal_akuntansi', [
            'id_transaksi' => $transactionId,
            'kode_akun' => '201',
            'posisi' => 'kredit',
            'jumlah' => 25000,
        ]);
        $this->getJson('/api/admin/savers')
            ->assertOk()
            ->assertJsonPath('data.0.username', 'student-seven');
        $this->postJson('/api/auth/login-nasabah', [
            'username' => 'student-seven',
            'password' => 'studentPass123',
        ])->assertOk();
        $this->assertTrue(Hash::check('654321', Nasabah::where('user_id', $userId)->firstOrFail()->pin_keamanan));
    }

    public function test_member_activation_saves_email_for_account_and_saver_otp(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'admin-activate-email',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]));

        $member = $this->postJson('/api/admin/members', [
            'student_number' => 'STU020',
            'student_name' => 'Student Twenty',
            'gender' => 'Perempuan',
            'graduation_year' => 2027,
        ])->assertCreated();
        $userId = $member->json('data.user_id');

        $this->postJson("/api/admin/members/{$userId}/activate", [
            'username' => 'student-twenty',
            'email' => '  Student.Twenty@example.com ',
            'password' => 'studentPass123',
            'security_pin' => '654321',
            'saldo_awal' => 0,
        ])->assertCreated();

        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'email' => 'student.twenty@example.com',
        ]);
        $this->assertDatabaseHas('savers', [
            'user_id' => $userId,
            'email' => 'student.twenty@example.com',
        ]);
    }

    public function test_supervisor_can_activate_a_member_and_move_it_to_savers(): void
    {
        Sanctum::actingAs(User::create([
            'username' => 'supervisor-activate',
            'password' => 'secret123',
            'nama_petugas' => 'Supervisor',
            'role' => 'supervisor',
        ]));

        $memberResponse = $this->postJson('/api/admin/members', [
            'student_number' => 'STU012',
            'student_name' => 'Student Twelve',
            'class' => 'XII RPL 1',
            'gender' => 'Laki-laki',
            'graduation_year' => 2027,
            'security_pin' => '123456',
            'email' => 'student12@example.com',
            'nomor_hp' => '081234567812',
        ])->assertCreated();

        $userId = $memberResponse->json('data.user_id');
        $activation = $this->postJson("/api/admin/members/{$userId}/activate", [
            'username' => 'student-twelve',
            'password' => 'studentPass123',
            'security_pin' => '234567',
            'saldo_awal' => 0,
        ])->assertCreated()
            ->assertJsonPath('data.nis', 'STU012');
        $accountNumber = $activation->json('data.no_rekening');
        $this->assertStringStartsWith('REC', $accountNumber);

        $this->assertDatabaseMissing('members', ['user_id' => $userId]);
        $this->assertDatabaseHas('savers', [
            'user_id' => $userId,
            'nis' => 'STU012',
            'no_rekening' => $accountNumber,
        ]);
        $this->assertTrue(Hash::check('234567', Nasabah::where('user_id', $userId)->firstOrFail()->pin_keamanan));
    }

    public function test_admin_can_disable_and_reenable_a_saver_login(): void
    {
        $admin = User::create([
            'username' => 'admin-status',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        Sanctum::actingAs($admin);

        $memberResponse = $this->postJson('/api/admin/members', [
            'student_number' => 'STU009',
            'student_name' => 'Student Nine',
            'class' => 'XII RPL 1',
            'gender' => 'Laki-laki',
            'graduation_year' => 2027,
            'security_pin' => '123456',
        ])->assertCreated();
        $userId = $memberResponse->json('data.user_id');

        $this->postJson("/api/admin/members/{$userId}/activate", [
            'username' => 'student-nine',
            'password' => 'studentPass123',
            'security_pin' => '345678',
            'saldo_awal' => 0,
        ])->assertCreated();
        $saverId = Nasabah::where('user_id', $userId)->value('id');

        $this->patchJson("/api/admin/savers/{$saverId}/status", ['is_active' => false])->assertOk();
        $this->assertDatabaseHas('users', ['id' => $userId, 'is_active' => false]);
        $this->postJson('/api/auth/login-nasabah', [
            'username' => 'student-nine',
            'password' => 'studentPass123',
        ])->assertUnauthorized();

        $saver = Nasabah::where('user_id', $userId)->firstOrFail();
        $teller = User::create([
            'username' => 'teller-disabled-check',
            'password' => 'secret123',
            'nama_petugas' => 'Teller',
            'role' => 'teller',
        ]);
        Sanctum::actingAs($teller);
        $this->postJson('/api/teller/nasabah/scan', ['query' => 'STU009'])
            ->assertForbidden();
        $this->postJson('/api/teller/transaksi/setor', [
            'id_nasabah' => $saver->id,
            'nominal' => 10000,
        ])->assertForbidden();

        Sanctum::actingAs($admin);
        $this->patchJson("/api/admin/savers/{$saverId}/status", ['is_active' => true])->assertOk();
        $this->postJson('/api/auth/login-nasabah', [
            'username' => 'student-nine',
            'password' => 'studentPass123',
        ])->assertOk();
    }

    public function test_admin_can_create_login_credentials_for_an_existing_saver_without_a_user(): void
    {
        $admin = User::create([
            'username' => 'admin-legacy-saver',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        $saver = Nasabah::create([
            'no_rekening' => null,
            'nis' => 'STU010',
            'nama_siswa' => 'Student Ten',
            'jenis_kelamin' => 'Laki-laki',
            'kelas' => 'XII RPL 1',
            'pin_keamanan' => '123456',
        ]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/savers/{$saver->id}/credentials", [
            'username' => 'student-ten',
            'password' => 'studentPass123',
        ])->assertOk();

        $this->assertDatabaseHas('users', [
            'username' => 'student-ten',
            'role' => 'nasabah',
            'is_active' => true,
        ]);
        $this->postJson('/api/auth/login-nasabah', [
            'username' => 'student-ten',
            'password' => 'studentPass123',
        ])->assertOk()
            ->assertJsonPath('data.nasabah.nis', 'STU010');
    }

    public function test_admin_can_search_members_by_name(): void
    {
        $admin = User::create([
            'username' => 'admin-search',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);
        Sanctum::actingAs($admin);

        foreach ([
            ['STU011', 'Student Eleven'],
            ['STU012', 'Student Twelve'],
        ] as [$studentNumber, $studentName]) {
            $this->postJson('/api/admin/members', [
                'student_number' => $studentNumber,
                'student_name' => $studentName,
                'class' => 'XII RPL 1',
                'gender' => 'Laki-laki',
                'graduation_year' => 2027,
                'security_pin' => '123456',
            ])->assertCreated();
        }

        $this->getJson('/api/admin/members?search=Eleven')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_number', 'STU011');
    }

    public function test_admin_login_keeps_admin_role_for_dashboard_permissions(): void
    {
        User::create([
            'username' => 'admin-dashboard',
            'password' => 'secret123',
            'nama_petugas' => 'Administrator',
            'role' => 'admin',
        ]);

        $this->postJson('/api/auth/login-user', [
            'username' => 'admin-dashboard',
            'password' => 'secret123',
            'role' => 'supervisor',
        ])->assertOk()
            ->assertJsonPath('data.user.role', 'admin');
    }
}
