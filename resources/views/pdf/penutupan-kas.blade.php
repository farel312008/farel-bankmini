<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Penutupan Kas</title>
    <style>
        body {
            color: #1e293b;
            font-family: DejaVu Sans, sans-serif;
            font-size: 12px;
            line-height: 1.5;
        }
        h1 {
            margin: 0;
            color: #0f172a;
            font-size: 20px;
        }
        .subtitle {
            margin: 4px 0 24px;
            color: #64748b;
        }
        .status {
            display: inline-block;
            margin-bottom: 16px;
            padding: 5px 10px;
            border-radius: 12px;
            background: #dcfce7;
            color: #166534;
            font-size: 10px;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 9px 10px;
            border: 1px solid #cbd5e1;
            text-align: left;
        }
        th {
            width: 38%;
            background: #f1f5f9;
        }
        .footer {
            margin-top: 28px;
            color: #64748b;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <h1>Laporan Penutupan Kas Harian</h1>
    <p class="subtitle">Bank Mini Sekolah</p>
    <span class="status">DISETUJUI</span>

    <table>
        <tbody>
            <tr><th>Tanggal Penutupan</th><td>{{ $penutupan->tanggal_penutupan->format('d-m-Y') }}</td></tr>
            <tr><th>Teller</th><td>{{ $penutupan->teller?->nama_petugas ?? '-' }}</td></tr>
            <tr><th>Disetujui Oleh</th><td>{{ $penutupan->supervisor?->nama_petugas ?? '-' }}</td></tr>
            <tr><th>Saldo Awal</th><td>Rp {{ number_format($penutupan->saldo_awal, 0, ',', '.') }}</td></tr>
            <tr><th>Total Setoran</th><td>Rp {{ number_format($penutupan->total_setoran, 0, ',', '.') }}</td></tr>
            <tr><th>Total Penarikan</th><td>Rp {{ number_format($penutupan->total_penarikan, 0, ',', '.') }}</td></tr>
            <tr><th>Saldo Akhir Sistem</th><td>Rp {{ number_format($penutupan->saldo_akhir_sistem, 0, ',', '.') }}</td></tr>
            <tr><th>Uang Fisik</th><td>Rp {{ number_format($penutupan->uang_fisik, 0, ',', '.') }}</td></tr>
            <tr><th>Selisih</th><td>Rp {{ number_format($penutupan->selisih, 0, ',', '.') }}</td></tr>
            <tr><th>Catatan Teller</th><td>{{ $penutupan->catatan ?: '-' }}</td></tr>
        </tbody>
    </table>

    <p class="footer">Dokumen ini diunduh dari sistem Bank Mini Sekolah.</p>
</body>
</html>
