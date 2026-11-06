<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PenutupanKas extends Model
{
    use HasFactory;

    protected $table = 'penutupan_kas';

    protected $fillable = [
        'id_teller',
        'id_supervisor',
        'tanggal_penutupan',
        'saldo_awal',
        'total_setoran',
        'total_penarikan',
        'saldo_akhir_sistem',
        'uang_fisik',
        'selisih',
        'status',
        'catatan',
        'catatan_penolakan',
    ];

    protected $casts = [
        'tanggal_penutupan' => 'date',
        'saldo_awal' => 'integer',
        'total_setoran' => 'integer',
        'total_penarikan' => 'integer',
        'saldo_akhir_sistem' => 'integer',
        'uang_fisik' => 'integer',
        'selisih' => 'integer',
    ];

    public function teller()
    {
        return $this->belongsTo(User::class, 'id_teller');
    }

    public function supervisor()
    {
        return $this->belongsTo(User::class, 'id_supervisor');
    }
}
