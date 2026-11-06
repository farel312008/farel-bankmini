<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Transaksi extends Model
{
    use HasFactory;

    protected $table = 'transaksi';

    protected $fillable = [
        'id_nasabah',
        'id_user',
        'tanggal',
        'jenis_trans',
        'nominal',
    ];

    protected $casts = [
        'tanggal' => 'datetime',
        'nominal' => 'integer',
    ];

    public function nasabah()
    {
        return $this->belongsTo(Nasabah::class, 'id_nasabah')->withTrashed();
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'id_user');
    }

    public function jurnalAkuntansi()
    {
        return $this->hasMany(JurnalAkuntansi::class, 'id_transaksi');
    }
}
