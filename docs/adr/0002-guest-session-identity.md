# Guest Session Identity Model

Guests access the application without formal authentication (no email, passwords, SMS codes, or OAuth). Instead, each guest device is provisioned with a lightweight session identifier (cryptographically signed cookie / local token) paired with a user-provided friendly name (Alias/Apodo). This eliminates onboarding friction during the event while providing author attribution for photo uploads and enforcing single-vote rules per guest session in interactive contests. Formal authentication is strictly reserved for organizers.
