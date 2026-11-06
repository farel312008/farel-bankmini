<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JurnalAkuntansi extends Model
{
    use HasFactory;

    protected $table = 'jurnal_akuntansi';

    protected $fillable = [
        'id_transaksi',
        'kode_akun',
        'posisi',
        'jumlah',
    ];

    protected $casts = [
        'jumlah' => 'integer',
    ];

    public function transaksi()
    {
        return $this->belongsTo(Transaksi::class, 'id_transaksi');
    }
}