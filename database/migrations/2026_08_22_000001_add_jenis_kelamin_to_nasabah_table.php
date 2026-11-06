<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tableName = Schema::hasTable('savers') ? 'savers' : 'nasabah';
        Schema::table($tableName, function (Blueprint $table) {
            $table->enum('jenis_kelamin', ['Laki-laki', 'Perempuan'])
                ->nullable()
                ->after('nama_siswa');
        });
    }

    public function down(): void
    {
        $tableName = Schema::hasTable('savers') ? 'savers' : 'nasabah';
        Schema::table($tableName, function (Blueprint $table) {
            $table->dropColumn('jenis_kelamin');
        });
    }
};
