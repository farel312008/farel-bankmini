<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class ModalAwalKas extends Model
{
    use HasFactory;

    protected $table = 'modal_awal_kas';

    protected $fillable = [
        'id_teller',
        'tanggal',
        'nominal',
        'status_layanan',
    ];

    protected $casts = [
        'tanggal' => 'date',
        'nominal' => 'integer',
    ];

    public static function supportsServiceStatus(): bool
    {
        return Schema::hasColumn((new static)->getTable(), 'status_layanan');
    }

    public function teller()
    {
        return $this->belongsTo(User::class, 'id_teller');
    }
}
