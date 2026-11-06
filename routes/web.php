<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('app');
});

Route::get('/profil/{identifier?}', function () {
    return view('app');
});

Route::get('/scan', function () {
    return view('app');
});

// SPA Fallback Route
Route::fallback(function () {
    return view('app');
});
