<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'username',
        'email',
        'password',
        'nama_petugas',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    // Relasi: User (Teller) melayani banyak transaksi
    public function transaksi()
    {
        return $this->hasMany(Transaksi::class, 'id_user');
    }

    // Relasi: User (Teller) mengajukan penutupan kas
    public function penutupanKasTeller()
    {
        return $this->hasMany(PenutupanKas::class, 'id_teller');
    }

    // Relasi: User (Supervisor) menyetujui penutupan kas
    public function penutupanKasSupervisor()
    {
        return $this->hasMany(PenutupanKas::class, 'id_supervisor');
    }

    public function member()
    {
        return $this->hasOne(Member::class);
    }

    public function saver()
    {
        return $this->hasOne(Nasabah::class);
    }
}
