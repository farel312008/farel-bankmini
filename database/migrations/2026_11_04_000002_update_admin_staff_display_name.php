<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'admin')
            ->where('nama_petugas', 'Budi Santoso, S.Kom')
            ->update(['nama_petugas' => 'Drs. H. Ahmad Dahlan, M.M']);
    }

    public function down(): void
    {
        // The corrected staff identity should not be reverted to the placeholder name.
    }
};
