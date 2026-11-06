<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('nasabah') && ! Schema::hasTable('savers')) {
            Schema::rename('nasabah', 'savers');
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('teller')->change();
        });

        Schema::table('savers', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->nullable()
                ->unique()
                ->constrained('users')
                ->nullOnDelete();
        });

        Schema::create('members', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->primary()
                ->constrained('users')
                ->cascadeOnDelete();
            $table->string('student_number', 20)->unique();
            $table->string('student_name', 100);
            $table->string('class', 20);
            $table->enum('gender', ['Laki-laki', 'Perempuan'])->nullable();
            $table->unsignedSmallInteger('graduation_year');
            $table->string('security_pin');
            $table->enum('status', ['active', 'inactive'])->default('inactive');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('members');

        if (Schema::hasTable('savers')) {
            Schema::table('savers', function (Blueprint $table) {
                $table->dropConstrainedForeignId('user_id');
            });
        }

        if (Schema::hasTable('savers') && ! Schema::hasTable('nasabah')) {
            Schema::rename('savers', 'nasabah');
        }
    }
};
