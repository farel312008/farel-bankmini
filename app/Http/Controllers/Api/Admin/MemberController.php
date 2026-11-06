<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\JurnalAkuntansi;
use App\Models\Member;
use App\Models\Nasabah;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\MemberSpreadsheetReader;
use App\Services\SaverAccountNumberGenerator;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use RuntimeException;

class MemberController extends Controller
{
    public function index()
    {
        $query = Member::query();
        if (request()->filled('search')) {
            $search = request()->string('search')->trim()->toString();
            $query->where(function ($builder) use ($search) {
                $builder->where('student_number', 'like', "%{$search}%")
                    ->orWhere('student_name', 'like', "%{$search}%");
            });
        }

        $members = $query->orderBy('student_name')
            ->get()
            ->map(fn (Member $member) => $this->formatMember($member));

        return response()->json(['success' => true, 'data' => $members]);
    }

    public function import(Request $request, MemberSpreadsheetReader $reader)
    {
        $request->validate([
            'file' => 'required|file|max:5120',
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');
        if (! in_array(strtolower($file->getClientOriginalExtension()), ['xlsx', 'csv'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Gunakan file Excel .xlsx atau CSV yang dapat dibuka dengan Excel.',
            ], 422);
        }

        try {
            $rows = $reader->read($file);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        $headerRow = collect($rows)->first(fn (array $row) => collect($row['cells'])->contains(
            fn ($value) => trim((string) $value) !== ''
        ));
        if (! $headerRow) {
            return response()->json([
                'success' => false,
                'message' => 'File tidak memiliki baris judul kolom.',
            ], 422);
        }

        $headers = [];
        foreach ($headerRow['cells'] as $index => $value) {
            $header = strtolower(trim(ltrim((string) $value, "\xEF\xBB\xBF")));
            $header = str_replace([' ', '-'], '_', $header);
            $headers[$header][] = $index;
        }

        $headerAliases = [
            'nis' => ['nis', 'student_number'],
            'nama_siswa' => ['nama_siswa', 'student_name'],
            'class' => ['kelas', 'class'],
            'angkatan_keluar' => ['angkatan_keluar', 'graduation_year'],
            'nomor_hp' => ['nomor_hp'],
            'gender' => ['gender', 'jenis_kelamin', 'jk', 'sex'],
        ];
        $resolvedHeaders = [];
        foreach ($headerAliases as $field => $aliases) {
            foreach ($aliases as $alias) {
                if (array_key_exists($alias, $headers)) {
                    $resolvedHeaders[$field] = $headers[$alias][0];
                    break;
                }
            }
        }
        $genderColumns = [];
        foreach ($headerAliases['gender'] as $alias) {
            array_push($genderColumns, ...($headers[$alias] ?? []));
        }
        $requiredHeaders = ['nis', 'nama_siswa', 'angkatan_keluar', 'nomor_hp', 'gender'];
        $missingHeaders = array_values(array_diff($requiredHeaders, array_keys($resolvedHeaders)));
        if ($missingHeaders !== []) {
            return response()->json([
                'success' => false,
                'message' => 'Judul kolom tidak sesuai. Kolom yang wajib tersedia: nis, nama_siswa, angkatan_keluar, nomor_hp, gender. Kolom kelas bersifat opsional.',
            ], 422);
        }

        $dataRows = array_filter(
            $rows,
            fn (array $row) => $row['row'] > $headerRow['row'] && collect($row['cells'])->contains(
                fn ($value) => trim((string) $value) !== ''
            )
        );
        $errors = [];
        $students = [];
        $seenNumbers = [];
        foreach ($dataRows as $row) {
            $student = [
                'student_number' => trim((string) ($row['cells'][$resolvedHeaders['nis']] ?? '')),
                'student_name' => trim((string) ($row['cells'][$resolvedHeaders['nama_siswa']] ?? '')),
                'class' => isset($resolvedHeaders['class'])
                    ? (trim((string) ($row['cells'][$resolvedHeaders['class']] ?? '')) ?: null)
                    : null,
                'graduation_year' => trim((string) ($row['cells'][$resolvedHeaders['angkatan_keluar']] ?? '')),
                'nomor_hp' => trim((string) ($row['cells'][$resolvedHeaders['nomor_hp']] ?? '')) ?: null,
                'gender' => $this->firstNonEmptyCell($row['cells'], $genderColumns),
            ];
            $student['gender'] = $this->normalizeImportGender($student['gender']);

            $validator = Validator::make($student, [
                'student_number' => 'required|string|max:20',
                'student_name' => 'required|string|max:100',
                'class' => 'nullable|string|max:20',
                'gender' => ['required', Rule::in(['Laki-laki', 'Perempuan'])],
                'graduation_year' => 'required|integer|between:2000,2100',
                'nomor_hp' => 'nullable|string|max:20',
            ], [
                'gender.required' => 'Gender wajib diisi.',
                'gender.in' => 'Gender harus Laki-laki (L/pria) atau Perempuan (P/wanita).',
            ]);

            if ($validator->fails()) {
                foreach ($validator->errors()->all() as $message) {
                    $errors[] = 'Baris '.$row['row'].': '.$message;
                }

                continue;
            }

            $studentNumber = $student['student_number'];
            if (isset($seenNumbers[$studentNumber])) {
                $errors[] = 'Baris '.$row['row'].': NIS '.$studentNumber.' muncul lebih dari satu kali di file.';

                continue;
            }
            $seenNumbers[$studentNumber] = true;

            if (
                Member::where('student_number', $studentNumber)->exists()
                || DB::table('savers')->where('nis', $studentNumber)->exists()
            ) {
                $errors[] = 'Baris '.$row['row'].': NIS '.$studentNumber.' sudah terdaftar.';

                continue;
            }

            $students[] = $student;
        }

        if ($errors !== []) {
            return response()->json([
                'success' => false,
                'message' => 'Data belum diimpor. Perbaiki kesalahan berikut lalu upload kembali.',
                'errors' => $errors,
            ], 422);
        }

        DB::transaction(function () use ($students) {
            foreach ($students as $student) {
                $this->createMember($student);
            }
        });

        return response()->json([
            'success' => true,
            'message' => count($students).' data siswa berhasil diimpor sebagai anggota nonaktif.',
            'data' => ['imported' => count($students)],
        ], 201);
    }

    private function normalizeImportGender(string $gender): ?string
    {
        $normalized = mb_strtolower(trim($gender));
        if ($normalized === '') {
            return null;
        }

        $normalized = preg_replace('/[\s\p{Pd}]+/u', '', $normalized);

        return match ($normalized) {
            'l', 'm', 'lakilaki', 'pria', 'male' => 'Laki-laki',
            'p', 'f', 'perempuan', 'wanita', 'female' => 'Perempuan',
            default => trim($gender),
        };
    }

    private function firstNonEmptyCell(array $cells, array $columns): string
    {
        foreach ($columns as $column) {
            $value = trim((string) ($cells[$column] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'student_number' => [
                'required',
                'string',
                'max:20',
                Rule::unique('members', 'student_number'),
                Rule::unique('savers', 'nis'),
            ],
            'student_name' => 'required|string|max:100',
            'gender' => ['nullable', Rule::in(['Laki-laki', 'Perempuan'])],
            'graduation_year' => 'required|integer|between:2000,2100',
            'nomor_hp' => 'nullable|string|max:20',
        ]);

        $member = DB::transaction(fn () => $this->createMember($validated));

        return response()->json([
            'success' => true,
            'message' => 'Anggota berhasil didaftarkan.',
            'data' => $this->formatMember($member),
        ], 201);
    }

    public function activate(Request $request, int $id, SaverAccountNumberGenerator $accountNumberGenerator)
    {
        $member = Member::with('user')->findOrFail($id);
        $validated = $request->validate([
            'username' => [
                'required',
                'string',
                'max:50',
                Rule::unique('users', 'username')->ignore($member->user_id),
            ],
            'password' => 'required|string|min:8|max:100',
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('users', 'email'),
                Rule::unique('savers', 'email'),
            ],
            'security_pin' => 'required|digits:6',
            'saldo_awal' => 'required|integer|min:0',
        ]);

        $saver = DB::transaction(function () use ($member, $validated, $accountNumberGenerator, $request) {
            $user = $member->user;
            $user->username = $validated['username'];
            $email = isset($validated['email']) ? mb_strtolower(trim($validated['email'])) : null;
            $user->email = $email;
            $user->password = $validated['password'];
            $user->nama_petugas = $member->student_name;
            $user->role = 'nasabah';
            $user->is_active = true;
            $user->save();

            $saver = Nasabah::create([
                'user_id' => $user->id,
                'no_rekening' => $accountNumberGenerator->next(),
                'nis' => $member->student_number,
                'nama_siswa' => $member->student_name,
                'jenis_kelamin' => $member->gender,
                'kelas' => $member->class,
                'email' => $email,
                'pin_keamanan' => $validated['security_pin'],
                'nomor_hp' => $member->nomor_hp,
            ]);

            if ($validated['saldo_awal'] > 0) {
                $transaksi = Transaksi::create([
                    'id_nasabah' => $saver->id,
                    'id_user' => $request->user()->id,
                    'tanggal' => now(),
                    'jenis_trans' => 'setor',
                    'nominal' => $validated['saldo_awal'],
                ]);

                JurnalAkuntansi::create([
                    'id_transaksi' => $transaksi->id,
                    'kode_akun' => '101',
                    'posisi' => 'debit',
                    'jumlah' => $validated['saldo_awal'],
                ]);
                JurnalAkuntansi::create([
                    'id_transaksi' => $transaksi->id,
                    'kode_akun' => '201',
                    'posisi' => 'kredit',
                    'jumlah' => $validated['saldo_awal'],
                ]);
            }

            $member->delete();

            return $saver;
        });

        return response()->json([
            'success' => true,
            'message' => 'Akun siswa berhasil dibuat dengan nomor rekening dan kartu QR.',
            'data' => [
                'id' => $saver->id,
                'nis' => $saver->nis,
                'nama_siswa' => $saver->nama_siswa,
                'kelas' => $saver->kelas,
                'no_rekening' => $saver->no_rekening,
                'username' => $validated['username'],
                'saldo_awal' => (int) $validated['saldo_awal'],
                'saldo' => $saver->saldo,
            ],
        ], 201);
    }

    public function setSaverStatus(Request $request, int $id)
    {
        $validated = $request->validate([
            'is_active' => 'required|boolean',
        ]);
        $saver = Nasabah::with('user')->findOrFail($id);
        if (! $saver->user) {
            return response()->json([
                'success' => false,
                'message' => 'Akun login untuk saver ini tidak ditemukan.',
            ], 409);
        }

        $saver->user->is_active = $validated['is_active'];
        $saver->user->save();
        if (! $validated['is_active']) {
            $saver->user->tokens()->delete();
        }

        return response()->json([
            'success' => true,
            'message' => $validated['is_active'] ? 'Akun saver berhasil diaktifkan.' : 'Akun saver berhasil dinonaktifkan.',
            'data' => ['is_active' => (bool) $saver->user->is_active],
        ]);
    }

    public function show(int $id)
    {
        $member = Member::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatMember($member),
        ]);
    }

    public function update(Request $request, int $id)
    {
        $member = Member::with('user')->findOrFail($id);
        $validated = $request->validate([
            'student_number' => [
                'required',
                'string',
                'max:20',
                Rule::unique('members', 'student_number')->ignore($member->user_id, 'user_id'),
                Rule::unique('savers', 'nis'),
            ],
            'student_name' => 'required|string|max:100',
            'gender' => ['nullable', Rule::in(['Laki-laki', 'Perempuan'])],
            'graduation_year' => 'required|integer|between:2000,2100',
            'nomor_hp' => 'nullable|string|max:20',
        ]);

        DB::transaction(function () use ($member, $validated) {
            $member->student_number = $validated['student_number'];
            $member->student_name = $validated['student_name'];
            $member->gender = $validated['gender'] ?? null;
            $member->graduation_year = $validated['graduation_year'];
            if (array_key_exists('nomor_hp', $validated)) {
                $member->nomor_hp = $validated['nomor_hp'];
            }
            $member->save();

            $member->user->nama_petugas = $validated['student_name'];
            $member->user->save();
        });

        return response()->json([
            'success' => true,
            'message' => 'Data anggota berhasil diperbarui.',
            'data' => $this->formatMember($member->fresh()),
        ]);
    }

    public function destroy(int $id)
    {
        $member = Member::with('user')->findOrFail($id);
        DB::transaction(fn () => $member->user->delete());

        return response()->json([
            'success' => true,
            'message' => 'Anggota berhasil dihapus.',
        ]);
    }

    private function formatMember(Member $member): array
    {
        return [
            'user_id' => $member->user_id,
            'student_number' => $member->student_number,
            'student_name' => $member->student_name,
            'class' => $member->class,
            'gender' => $member->gender,
            'graduation_year' => $member->graduation_year,
            'nomor_hp' => $member->nomor_hp,
            'status' => $member->status,
            'created_at' => $member->created_at,
        ];
    }

    private function createMember(array $student): Member
    {
        $user = User::create([
            'username' => 'member-'.Str::uuid(),
            'email' => null,
            'password' => Hash::make(Str::random(40)),
            'nama_petugas' => $student['student_name'],
            'role' => 'member',
        ]);

        return Member::create([
            'user_id' => $user->id,
            'student_number' => $student['student_number'],
            'student_name' => $student['student_name'],
            'class' => $student['class'] ?? null,
            'gender' => $student['gender'] ?? null,
            'graduation_year' => $student['graduation_year'],
            'nomor_hp' => $student['nomor_hp'] ?? null,
            'status' => 'inactive',
        ]);
    }
}
