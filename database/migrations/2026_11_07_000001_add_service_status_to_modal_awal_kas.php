<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('modal_awal_kas', 'status_layanan')) {
            return;
        }

        Schema::table('modal_awal_kas', function (Blueprint $table) {
            $table->enum('status_layanan', ['open', 'resting'])->default('open');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('modal_awal_kas', 'status_layanan')) {
            return;
        }

        Schema::table('modal_awal_kas', function (Blueprint $table) {
            $table->dropColumn('status_layanan');
        });
    }
};
