<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Rekap Transaksi Bulanan {{ $monthLabel }}</title>
    <style>
        body {
            color: #1e293b;
            font-family: DejaVu Sans, sans-serif;
            font-size: 9px;
            line-height: 1.4;
        }
        h1 {
            margin: 0;
            color: #0f172a;
            font-size: 18px;
        }
        .subtitle {
            margin: 3px 0 16px;
            color: #64748b;
            font-size: 11px;
        }
        .summary, .transactions {
            width: 100%;
            border-collapse: collapse;
        }
        .summary {
            margin-bottom: 16px;
        }
        .summary td {
            width: 25%;
            padding: 7px;
            border: 1px solid #cbd5e1;
            background: #f8fafc;
        }
        .summary strong {
            display: block;
            margin-top: 3px;
            font-size: 11px;
        }
        .transactions th, .transactions td {
            padding: 5px;
            border: 1px solid #cbd5e1;
            text-align: left;
        }
        .transactions th {
            background: #f1f5f9;
        }
        .number {
            text-align: right !important;
            white-space: nowrap;
        }
        .footer {
            margin-top: 18px;
            color: #64748b;
            font-size: 8px;
        }
    </style>
</head>
<body>
    <h1>Rekap Transaksi Bulanan</h1>
    <p class="subtitle">Bank Mini Sekolah &mdash; Periode {{ $monthLabel }}</p>

    <table class="summary">
        <tr>
            <td>Jumlah transaksi<strong>{{ $summary['total_transaksi'] }}</strong></td>
            <td>Jumlah setoran<strong>{{ $summary['jumlah_setoran'] }}</strong></td>
            <td>Jumlah penarikan<strong>{{ $summary['jumlah_penarikan'] }}</strong></td>
            <td>Total setoran<strong>Rp {{ number_format($summary['total_setoran'], 0, ',', '.') }}</strong></td>
        </tr>
        <tr>
            <td colspan="3"></td>
            <td>Total penarikan<strong>Rp {{ number_format($summary['total_penarikan'], 0, ',', '.') }}</strong></td>
        </tr>
    </table>

    <h2>Riwayat Transaksi Bulan {{ $monthLabel }}</h2>
    <table class="transactions">
        <thead>
            <tr>
                <th>Tanggal &amp; Waktu</th>
                <th>Jenis</th>
                <th>Saver</th>
                <th>No. Rekening</th>
                <th>Teller</th>
                <th class="number">Nominal</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($transactions as $item)
                <tr>
                    <td>{{ $item['tanggal']->format('d-m-Y H:i:s') }}</td>
                    <td>{{ $item['jenis_trans'] === 'setor' ? 'Setoran' : 'Penarikan' }}</td>
                    <td>{{ $item['nasabah'] }}</td>
                    <td>{{ $item['no_rekening'] }}</td>
                    <td>{{ $item['teller'] }}</td>
                    <td class="number">Rp {{ number_format($item['nominal'], 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" style="text-align: center;">Tidak ada transaksi pada periode ini.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <p class="footer">Dokumen ini diunduh dari sistem Bank Mini Sekolah.</p>
</body>
</html>
