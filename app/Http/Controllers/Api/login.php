<?php
// Mengizinkan akses dari aplikasi luar (CORS)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

// Menangkap data yang dikirim dari Flutter
$username = isset($_POST['username']) ? $_POST['username'] : '';
$password = isset($_POST['password']) ? $_POST['password'] : '';

// TODO: Koneksikan dengan database MySQL Anda di sini. 
// Ini adalah contoh validasi statis untuk uji coba:
if ($username === "admin" && $password === "12345") {
    // Jika login benar
    echo json_encode([
        "status" => "success",
        "message" => "Login berhasil",
        "data" => [
            "id" => 1,
            "nama" => "Administrator",
            "role" => "admin"
        ]
    ]);
} else {
    // Jika login salah
    echo json_encode([
        "status" => "error",
        "message" => "Username atau password salah!"
    ]);
}
?>