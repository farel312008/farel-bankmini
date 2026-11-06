<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ModalAwalKas extends Model
{
    use HasFactory;

    protected $table = 'modal_awal_kas';

    protected $fillable = [
        'id_teller',
        'tanggal',
        'nominal',
    ];

    protected $casts = [
        'tanggal' => 'date',
        'nominal' => 'integer',
    ];

    public function teller()
    {
        return $this->belongsTo(User::class, 'id_teller');
    }
}
