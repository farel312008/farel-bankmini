<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaverClosureRequest extends Model
{
    protected $fillable = [
        'id_saver',
        'id_teller',
        'id_transaksi',
        'jumlah_penarikan',
        'status',
        'id_admin',
        'catatan_admin',
    ];

    protected $casts = [
        'jumlah_penarikan' => 'integer',
    ];

    public function saver()
    {
        return $this->belongsTo(Nasabah::class, 'id_saver')->withTrashed();
    }

    public function teller()
    {
        return $this->belongsTo(User::class, 'id_teller');
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'id_admin');
    }

    public function transaksi()
    {
        return $this->belongsTo(Transaksi::class, 'id_transaksi');
    }
}
