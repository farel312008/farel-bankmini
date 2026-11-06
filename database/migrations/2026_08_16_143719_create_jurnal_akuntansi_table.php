<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jurnal_akuntansi', function (Blueprint $table) {
            $table->id();

            // Relasi ke transaksi, ON DELETE RESTRICT menjamin audit trail kekal
            $table->foreignId('id_transaksi')
                  ->constrained('transaksi')
                  ->onDelete('restrict');

            $table->string('kode_akun', 10); // '101' Kas / '201' Tabungan Nasabah
            $table->enum('posisi', ['debit', 'kredit']);
            $table->bigInteger('jumlah');
            $table->timestamps();
        });

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE jurnal_akuntansi ADD CONSTRAINT chk_jumlah_jurnal_positif CHECK (jumlah > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('jurnal_akuntansi');
    }
};