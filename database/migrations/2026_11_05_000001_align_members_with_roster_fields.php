<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'member')
            ->update(['email' => null]);

        Schema::table('members', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->dropColumn('email');
            $table->string('class', 20)->nullable()->change();
            $table->string('security_pin')->nullable()->change();
        });

        Schema::table('savers', function (Blueprint $table) {
            $table->string('kelas', 20)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->string('email')->nullable()->unique();
        });
    }
};
