<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('penutupan_kas', function (Blueprint $table) {
            $table->id();

            $table->foreignId('id_teller')
                  ->constrained('users')
                  ->onDelete('restrict');

            $table->foreignId('id_supervisor')
                  ->nullable()
                  ->constrained('users')
                  ->onDelete('restrict');

            $table->date('tanggal_penutupan');
            $table->bigInteger('saldo_awal')->default(0);
            $table->bigInteger('total_setoran')->default(0);
            $table->bigInteger('total_penarikan')->default(0);
            $table->bigInteger('saldo_akhir_sistem');
            $table->bigInteger('uang_fisik');
            $table->bigInteger('selisih')->default(0);
            $table->enum('status', ['draft', 'pending', 'approved'])->default('pending');
            $table->text('catatan')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('penutupan_kas');
    }
};