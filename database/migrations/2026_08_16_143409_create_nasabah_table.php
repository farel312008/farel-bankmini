<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('savers', function (Blueprint $table) {
            $table->id();
            $table->string('no_rekening', 30)->unique();
            $table->string('nis', 20)->unique();
            $table->string('nama_siswa', 100);
            $table->string('kelas', 20);
            $table->string('pin_keamanan'); // 6-digit PIN Hashed
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('savers');
    }
};