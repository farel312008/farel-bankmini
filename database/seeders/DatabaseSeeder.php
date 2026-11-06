<?php

namespace Database\Seeders;

use App\Models\Nasabah;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Akun Internal (Admin, Teller, Supervisor)
        User::create([
            'username' => 'admin',
            'password' => Hash::make('password123'),
            'nama_petugas' => 'Drs. H. Ahmad Dahlan, M.M',
            'role' => 'admin',
        ]);

        User::create([
            'username' => 'teller1',
            'password' => Hash::make('password123'),
            'nama_petugas' => 'Siti Nurhaliza',
            'role' => 'teller',
        ]);

        User::create([
            'username' => 'spv1',
            'password' => Hash::make('password123'),
            'nama_petugas' => 'Drs. H. Ahmad Dahlan, M.M',
            'role' => 'supervisor',
        ]);

        // 2. Akun Nasabah Siswa Dummy (PIN: 123456)
        $rizky = User::create([
            'username' => 'rizky',
            'password' => Hash::make('password123'),
            'nama_petugas' => 'Muhammad Rizky Pratama',
            'role' => 'nasabah',
            'is_active' => true,
        ]);

        Nasabah::create([
            'user_id' => $rizky->id,
            'no_rekening' => 'REC20260001',
            'nis' => '10203040',
            'nama_siswa' => 'Muhammad Rizky Pratama',
            'kelas' => 'XII RPL 1',
            'pin_keamanan' => Hash::make('123456'),
        ]);

        $aulia = User::create([
            'username' => 'aulia',
            'password' => Hash::make('password123'),
            'nama_petugas' => 'Aulia Putri Maharani',
            'role' => 'nasabah',
            'is_active' => true,
        ]);

        Nasabah::create([
            'user_id' => $aulia->id,
            'no_rekening' => 'REC20260002',
            'nis' => '10203041',
            'nama_siswa' => 'Aulia Putri Maharani',
            'kelas' => 'XII RPL 2',
            'pin_keamanan' => Hash::make('654321'),
        ]);
    }
}
