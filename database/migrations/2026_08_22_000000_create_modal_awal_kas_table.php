<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modal_awal_kas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_teller')->constrained('users')->onDelete('restrict');
            $table->date('tanggal');
            $table->unsignedBigInteger('nominal');
            $table->timestamps();
            $table->unique(['id_teller', 'tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modal_awal_kas');
    }
};
