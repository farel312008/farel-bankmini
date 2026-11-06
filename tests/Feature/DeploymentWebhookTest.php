<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class DeploymentWebhookTest extends TestCase
{
    public function test_migration_webhook_rejects_requests_without_the_configured_secret(): void
    {
        config(['app.deploy_secret' => 'a-strong-deployment-secret']);
        Artisan::shouldReceive('call')->never();

        $this->postJson('/api/deploy-migrate')
            ->assertForbidden()
            ->assertJsonPath('message', 'Akses ditolak.');
    }

    public function test_migration_webhook_fails_closed_when_no_secret_is_configured(): void
    {
        config(['app.deploy_secret' => null]);
        Artisan::shouldReceive('call')->never();

        $this->postJson('/api/deploy-migrate', [], [
            'X-Deploy-Secret' => 'any-value',
        ])->assertServiceUnavailable()
            ->assertJsonPath('message', 'Endpoint deployment belum dikonfigurasi.');
    }

    public function test_migration_webhook_runs_migrations_and_seeds_only_when_requested(): void
    {
        config(['app.deploy_secret' => 'a-strong-deployment-secret']);
        Artisan::shouldReceive('call')
            ->once()
            ->with('migrate', ['--force' => true])
            ->andReturn(0);
        Artisan::shouldReceive('output')
            ->once()
            ->andReturn('Migrations completed.');
        Artisan::shouldReceive('call')
            ->once()
            ->with('storage:link', [])
            ->andReturn(0);
        Artisan::shouldReceive('call')
            ->once()
            ->with('optimize:clear', [])
            ->andReturn(0);
        Artisan::shouldReceive('output')
            ->twice()
            ->andReturn('Storage linked.', 'Caches cleared.');

        $this->postJson('/api/deploy-migrate', [], [
            'X-Deploy-Secret' => 'a-strong-deployment-secret',
        ])->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('migrate_output', 'Migrations completed.')
            ->assertJsonPath('seed_output', 'Seeding dilewati.')
            ->assertJsonPath('storage_output', 'Storage linked.')
            ->assertJsonPath('optimize_output', 'Caches cleared.');
    }

    public function test_migration_webhook_can_run_seeders_when_explicitly_requested(): void
    {
        config(['app.deploy_secret' => 'a-strong-deployment-secret']);
        Artisan::shouldReceive('call')
            ->once()
            ->with('migrate', ['--force' => true])
            ->andReturn(0);
        Artisan::shouldReceive('call')
            ->once()
            ->with('db:seed', ['--force' => true])
            ->andReturn(0);
        Artisan::shouldReceive('output')
            ->twice()
            ->andReturn('Migrations completed.', 'Seeders completed.');
        Artisan::shouldReceive('call')
            ->once()
            ->with('storage:link', [])
            ->andReturn(0);
        Artisan::shouldReceive('call')
            ->once()
            ->with('optimize:clear', [])
            ->andReturn(0);
        Artisan::shouldReceive('output')
            ->twice()
            ->andReturn('Storage linked.', 'Caches cleared.');

        $this->postJson('/api/deploy-migrate', ['seed' => true], [
            'X-Deploy-Secret' => 'a-strong-deployment-secret',
        ])->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('seed_output', 'Seeders completed.');
    }
}
