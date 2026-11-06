<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CorsConfigurationTest extends TestCase
{
    use RefreshDatabase;

    public function test_flutter_web_localhost_origin_can_preflight_nasabah_login(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:60312',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'content-type',
        ])->options('/api/auth/login-nasabah')
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:60312')
            ->assertHeaderContains('Access-Control-Allow-Methods', 'POST')
            ->assertHeaderContains('Access-Control-Allow-Headers', 'content-type');
    }

    public function test_flutter_web_origin_is_returned_on_api_login_response(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:60312',
            'Accept' => 'application/json',
        ])->postJson('/api/auth/login-nasabah', [
            'username' => 'invalid-user',
            'password' => 'invalid-password',
        ])->assertUnauthorized()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:60312');
    }
}
