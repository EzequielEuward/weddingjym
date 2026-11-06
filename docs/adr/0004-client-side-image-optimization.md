# Client-Side Image Compression and Format Normalization

All guest photos are compressed, resized (e.g., max 1920px dimension), and normalized to web-compatible formats (WebP/JPEG, converting iOS HEIC on-device) in the mobile browser before upload. Venue cellular connectivity is often congested or weak; uploading raw 8–15 MB camera files causes high failure rates, slow UX, and heavy bandwidth/CPU load on the server. Accepting ~300–600 KB client-optimized images ensures near-instant uploads, universal browser rendering without backend transcoding overhead, and minimal disk usage.
