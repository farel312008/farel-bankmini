<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

class DeploymentController extends Controller
{
    public function migrate(Request $request)
    {
        $validated = $request->validate([
            'seed' => 'sometimes|boolean',
        ]);

        $expectedSecret = config('app.deploy_secret');
        $providedSecret = $request->header('X-Deploy-Secret');

        if (! is_string($expectedSecret) || $expectedSecret === '') {
            return response()->json([
                'status' => 'error',
                'message' => 'Endpoint deployment belum dikonfigurasi.',
            ], 503);
        }

        if (! is_string($providedSecret) || ! hash_equals($expectedSecret, $providedSecret)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak.',
            ], 403);
        }

        try {
            $migrateOutput = $this->runArtisanCommand('migrate', ['--force' => true]);
            $seedOutput = 'Seeding dilewati.';

            if ($request->boolean('seed')) {
                $seedOutput = $this->runArtisanCommand('db:seed', ['--force' => true]);
            }

            $storageOutput = $this->runArtisanCommand('storage:link');
            $optimizeOutput = $this->runArtisanCommand('optimize:clear');

            return response()->json([
                'status' => 'success',
                'message' => 'Migrasi dan inisialisasi aplikasi berhasil dijalankan.',
                'migrate_output' => $migrateOutput,
                'seed_output' => $seedOutput,
                'storage_output' => $storageOutput,
                'optimize_output' => $optimizeOutput,
            ]);
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json([
                'status' => 'error',
                'message' => 'Migrasi gagal dijalankan.',
            ], 500);
        }
    }

    private function runArtisanCommand(string $command, array $parameters = []): string
    {
        $exitCode = Artisan::call($command, $parameters);
        $output = trim(Artisan::output());

        if ($exitCode !== 0) {
            throw new \RuntimeException("Deployment command [{$command}] failed: {$output}");
        }

        return $output;
    }
}
