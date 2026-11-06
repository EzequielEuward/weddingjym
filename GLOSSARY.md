# Wedding App

Web application for wedding guests to share photos, participate in contests, and interact during the celebration.

## Language

**Invitado (Guest)**:
Any attendee accessing the application from their mobile device to view or upload content, identified solely by a friendly name and a device session.
_Avoid_: User, customer, client, attendee

**Sesión de Invitado (Guest Session)**:
A lightweight, unique device-bound identifier ("individual wristband") provisioned automatically on each phone to track authorship and votes.
_Avoid_: Account, profile, login, QR token

**Código de Acceso QR (QR Gate Token)**:
The single shared secret embedded inside the printed QR link ("venue door key") that grants entry to any guest scanning the physical sign while blocking external bots.
_Avoid_: Personal invite code, user token, password

**Apodo / Nombre (Guest Alias)**:
The informal display name provided by a guest to attribute uploaded photos and community interactions.
_Avoid_: Username, handle, email

**Organizador / Moderador (Moderator)**:
The administrator (the groom's brother/technical steward) who can unlock management powers (deletion, category status) using a lightweight secret PIN or hidden route.
_Avoid_: Superuser, multi-role admin, tenant admin, back-office staff

**Evento (Event)**:
The specific wedding celebration instance encompassing all photos, interactions, and settings.
_Avoid_: Tenant, party, wedding-instance

**Muro General (General Gallery)**:
The primary shared photo stream for spontaneous memories from the celebration, supporting batch uploads without voting mechanics.
_Avoid_: Common gallery, wall, feed

**Competencia (Contest)**:
A dedicated interactive module (starting with *Best Outfit* in the MVP, extensible to *Best Bloopers*) where guests submit individual photos and vote on favorites.
_Avoid_: Category filter, tournament, poll

**Postulación (Contest Entry)**:
A single photo (with optional short caption) uploaded directly inside a Contest to compete for guest votes.
_Avoid_: Candidate, post, general photo

**Voto (Vote)**:
A reversible heart/approval given by a Guest Session to a specific Contest Entry (at most one per entry per guest, unlimited across different entries).
_Avoid_: Like, rating, ballot

**Bingo Musical (Musical Bingo)**:
An optional, deferred party game module based on randomized song cards (currently parked under a *"Próximamente"* placeholder).
_Avoid_: Number bingo, photo scavenger hunt

**Modo del Evento (Event Mode)**:
The operational phase of the celebration (`live` during the party for uploads and voting; `read_only` post-wedding for viewing and downloading memories; `closed` when retired).
_Avoid_: Tenant status, feature flag

**Presentación en Pantalla (Slideshow Mode)**:
Full-screen auto-advancing display mode (`/presentacion`) that renders every photo 100% uncropped (horizontal or vertical) over a soft blurred ambient backdrop of the same photo, usable on phones, laptops, or TVs.
_Avoid_: Cropped carousel, external projector app
