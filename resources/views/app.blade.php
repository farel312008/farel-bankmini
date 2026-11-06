<!DOCTYPE html>
<html lang="id" class="h-full bg-slate-50">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>E-Teller Bank Mini</title>
    <link rel="icon" type="image/png" href="{{ asset('images/logo-smkn1-bantul.png') }}">

    <!-- 1. Google Font Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

    <!-- 2. Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace'],
                    },
                    colors: {
                        bank: {
                            50: '#effdfc',
                            100: '#d7f8f5',
                            500: '#22b3bd',
                            600: '#138f9c',
                            700: '#147681',
                            800: '#195e68',
                            900: '#174b54',
                        },
                        emerald: {
                            50: '#effcfb',
                            100: '#d4f7f2',
                            200: '#b2eee8',
                            300: '#82dfdc',
                            400: '#4ccbd0',
                            500: '#22b3bd',
                            600: '#138f9c',
                            700: '#147681',
                            800: '#195e68',
                            900: '#174b54',
                        },
                        teal: {
                            50: '#effcff',
                            100: '#d6f7fc',
                            200: '#b4eff8',
                            300: '#85e1f1',
                            400: '#52cce5',
                            500: '#2bb4d4',
                            600: '#148fb5',
                            700: '#157493',
                            800: '#195d78',
                            900: '#194b63',
                        },
                        indigo: {
                            50: '#effbff',
                            100: '#d8f4ff',
                            200: '#b7eaff',
                            300: '#8ad8fa',
                            400: '#5cbfea',
                            500: '#379fd4',
                            600: '#257fb6',
                            700: '#216895',
                            800: '#205978',
                            900: '#1f485e',
                        }
                    }
                }
            }
        }
    </script>

    <!-- 3. FontAwesome 6 Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="{{ asset('css/print.css') }}?v={{ filemtime(public_path('css/print.css')) }}">

    <!-- 4. SweetAlert2 CDN -->
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

    <!-- 5. HTML5 QR Code Scanner CDN -->
    <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>

    <!-- 6. QRCode.js CDN (Untuk Menampilkan QR Code Nasabah) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

    <style>
        #reader video {
            transform: none !important;
            -webkit-transform: none !important;
        }
    </style>
</head>
<body class="h-full font-sans text-slate-800 antialiased flex flex-col">

    <!-- APP CONTAINER -->
    <div id="app" class="min-h-full flex flex-col flex-1">
        <!-- Content will be rendered here dynamically via JavaScript -->
    </div>

    <!-- AREA CETAK STRUK KHUSUS PRINT -->
    <div id="print-area" class="hidden font-mono text-xs text-black"></div>

    <script>
        window.bankMiniApkUrl = @json(file_exists(public_path('downloads/bank-mini.apk')) ? asset('downloads/bank-mini.apk') : null);
    </script>

    <!-- LOAD APP JS SCRIPTS -->
    <script src="{{ asset('js/app-bank.js') }}?v={{ filemtime(public_path('js/app-bank.js')) }}"></script>
</body>
</html>