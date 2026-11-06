# Shared QR Gate Token and Photo Lifecycle Policy

Access to the application separates venue entry verification from individual device identity using a two-layer mechanism:
1. **Shared QR Gate Token**: A single static secret embedded in the printed QR URL (`?evento=<token>`) shared across all physical signs at the wedding. Scanning it proves physical access to the QR without typing passwords, blocking external internet bots that hit the bare domain.
2. **Per-Device Guest Session**: Upon passing the QR gate, the server automatically issues a unique, signed `HttpOnly` cookie (`guest_session_id`) per mobile browser.

Guests may download shared photos and delete only photos uploaded from their own `guest_session_id`, while the Moderator (via PIN) can delete any photo. After the celebration, switching the event state from `live` to `read_only` freezes uploads and votes while allowing guests to view and download memories until the server is retired.
