<?php

namespace App\Services;

use App\Models\Nasabah;

class SaverAccountNumberGenerator
{
    public function next(): string
    {
        $prefix = 'REC'.now()->format('Y');
        // Nomor rekening tetap menjadi reservasi permanen meskipun akun Saver
        // sudah diarsipkan, jadi akun soft-deleted juga harus dihitung.
        $accountNumbers = Nasabah::withTrashed()
            ->where('no_rekening', 'LIKE', $prefix.'%')
            ->lockForUpdate()
            ->pluck('no_rekening');

        $lastSequence = $accountNumbers
            ->map(function (?string $accountNumber) use ($prefix) {
                $suffix = substr((string) $accountNumber, strlen($prefix));

                return ctype_digit($suffix) ? (int) $suffix : 0;
            })
            ->max() ?? 0;
        $sequence = $lastSequence + 1;

        return $prefix.str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }
}
