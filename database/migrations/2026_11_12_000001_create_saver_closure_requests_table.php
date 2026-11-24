<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saver_closure_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_saver')->constrained('savers')->restrictOnDelete();
            $table->foreignId('id_teller')->constrained('users')->restrictOnDelete();
            $table->foreignId('id_transaksi')->nullable()->constrained('transaksi')->restrictOnDelete();
            $table->unsignedBigInteger('jumlah_penarikan')->default(0);
            $table->string('status', 20)->default('pending');
            $table->foreignId('id_admin')->nullable()->constrained('users')->nullOnDelete();
            $table->text('catatan_admin')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['id_saver', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saver_closure_requests');
    }
};
