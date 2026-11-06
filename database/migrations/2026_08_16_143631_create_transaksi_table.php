<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaksi', function (Blueprint $table) {
            $table->id();
            
            // Relasi Foreign Key dengan aturan ON DELETE RESTRICT
            $table->foreignId('id_nasabah')
                  ->constrained('savers')
                  ->onDelete('restrict');

            $table->foreignId('id_user')
                  ->constrained('users')
                  ->onDelete('restrict');

            $table->dateTime('tanggal');
            $table->enum('jenis_trans', ['setor', 'tarik']);
            $table->bigInteger('nominal'); // Presisi Rupiah tanpa floating point error
            $table->timestamps();
        });

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE transaksi ADD CONSTRAINT chk_nominal_positif CHECK (nominal > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transaksi');
    }
};