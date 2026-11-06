<?php

namespace App\Services;

use App\Models\Nasabah;

class SaverAccountNumberGenerator
{
    public function next(): string
    {
        $prefix = 'REC'.now()->format('Y');
        $lastSaver = Nasabah::where('no_rekening', 'LIKE', $prefix.'%')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->first();
        $sequence = $lastSaver
            ? (int) substr($lastSaver->no_rekening, strlen($prefix)) + 1
            : 1;

        return $prefix.str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }
}
