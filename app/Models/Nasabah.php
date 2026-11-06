<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;

class Nasabah extends Authenticatable
{
    use HasApiTokens, HasFactory, SoftDeletes;

    protected $table = 'savers';

    protected $fillable = [
        'no_rekening',
        'nis',
        'nama_siswa',
        'jenis_kelamin',
        'kelas',
        'pin_keamanan',
        'user_id',
        'email',
        'nomor_hp',
        'jenis_kelamin',
    ];

    protected $hidden = [
        'pin_keamanan',
    ];

    protected function casts(): array
    {
        return [
            'pin_keamanan' => 'hashed',
        ];
    }

    // Relasi: Nasabah memiliki banyak riwayat transaksi
    public function transaksi()
    {
        return $this->hasMany(Transaksi::class, 'id_nasabah');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Menghitung total saldo berjalan secara real-time dari riwayat transaksi
     * Rumus: Total Setor - Total Tarik
     */
    public function getSaldoAttribute(): int
    {
        $totalSetor = $this->transaksi()->where('jenis_trans', 'setor')->sum('nominal');
        $totalTarik = $this->transaksi()->where('jenis_trans', 'tarik')->sum('nominal');

        return (int) ($totalSetor - $totalTarik);
    }

    public function getNamaSiswaAttribute(): ?string
    {
        return $this->attributes['nama_siswa'] ?? $this->user?->nama_petugas;
    }
}
