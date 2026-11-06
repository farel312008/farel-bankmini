<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CredentialResetOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $otp,
        public string $credential
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Kode OTP Pemulihan Akun Bank Mini');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.credential-reset-otp',
            with: [
                'otp' => $this->otp,
                'credentialName' => $this->credential === 'pin' ? 'PIN' : 'password',
            ],
        );
    }
}
