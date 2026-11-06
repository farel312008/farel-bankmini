<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('savers', function (Blueprint $table) {
            $table->string('email')->nullable()->unique();
            $table->string('nomor_hp', 20)->nullable();
        });

        Schema::table('members', function (Blueprint $table) {
            $table->string('email')->nullable()->unique();
            $table->string('nomor_hp', 20)->nullable();
        });

        $saverEmails = DB::table('savers')
            ->join('users', 'savers.user_id', '=', 'users.id')
            ->whereNotNull('users.email')
            ->select('savers.id', 'users.email')
            ->get();
        foreach ($saverEmails as $saver) {
            DB::table('savers')->where('id', $saver->id)->update(['email' => $saver->email]);
        }

        $memberEmails = DB::table('members')
            ->join('users', 'members.user_id', '=', 'users.id')
            ->whereNotNull('users.email')
            ->select('members.user_id', 'users.email')
            ->get();
        foreach ($memberEmails as $member) {
            DB::table('members')->where('user_id', $member->user_id)->update(['email' => $member->email]);
        }
    }

    public function down(): void
    {
        Schema::table('savers', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->dropColumn(['email', 'nomor_hp']);
        });

        Schema::table('members', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->dropColumn(['email', 'nomor_hp']);
        });
    }
};
