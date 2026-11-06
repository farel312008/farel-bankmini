<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('penutupan_kas', function (Blueprint $table) {
            $table->string('status', 20)->default('pending')->change();
            $table->text('catatan_penolakan')->nullable();
        });
    }

    public function down(): void
    {
        DB::table('penutupan_kas')
            ->where('status', 'rejected')
            ->update(['status' => 'pending']);

        Schema::table('penutupan_kas', function (Blueprint $table) {
            $table->dropColumn('catatan_penolakan');
            $table->enum('status', ['draft', 'pending', 'approved'])->default('pending')->change();
        });
    }
};
