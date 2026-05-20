# Changelog

All notable changes to urBackend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [v0.9.0] - 2026-04-08

### Added
- Webhook system with BullMQ retry logic for reliable event delivery
- Bring Your Own Key (BYOK) support for transactional mail via Resend

### Fixed
- Follow-up issues from Social Auth PR #81 (social auth edge cases)

---

## [v0.8.0] - 2026-04-06

### Added
- GitHub and Google OAuth 2.0 social login support
- Secure one-time `rtCode` token exchange mechanism
- Automatic account linking when provider email matches an existing user
- Auto-generated, read-only provider callback URLs in the dashboard
- Encrypted storage for OAuth client secrets
- `/api/userAuth/social/exchange` endpoint for frontend callback handling
- Aria labels for improved accessibility in `CollectionsTable.jsx` and `DatabaseSidebar.jsx`
- Working example added at `examples/social-demo/`

### Fixed
- Email collision protection — rejects social login if email exists but provider email is unverified
- OAuth error forwarding — provider errors now redirect to frontend with `?error=...`

### Security
- Site URL must be configured before enabling social auth providers
- API key verification enforced on the `/social/exchange` endpoint

---

## [v0.7.0] - 2026-04-04

### Added
- Row-Level Security (RLS) read modes: `public-read` and `private`
- Unique field constraints on collections enforced at the database level
- Backward compatibility for existing `owner-write-only` RLS rules

### Changed
- JWT refresh flow now uses rotating sessions
- Documentation updated for new RLS security patterns

### Fixed
- Synchronized monorepo versioning across all core apps
- Duplicate key issues in package manifests

---

## [v0.6.0] - 2026-03-31

### Added
- AWS S3 storage integration with full region support
- Cloudflare R2 storage integration (S3-compatible)
- Storage Adapter Pattern — consistent `.upload()`, `.remove()`, `.list()`, `.getPublicUrl()` API across all providers
- `publicUrlHost` field for mapping custom CDN/CloudFront domains to storage assets
- Dynamic Project Settings form that adapts based on the selected storage provider

### Fixed
- `package-lock.json` integrity mismatch causing CI/CD failures
- S3 root directory listing bug (trailing slash appended incorrectly)
- UI label typos in Storage Configuration panel

### Security
- All external storage credentials encrypted at rest using AES-256-GCM

---

## [v0.5.0] - 2026-03-29

### Added
- `POST /api/userAuth/refresh-token` endpoint
- `POST /api/userAuth/logout` endpoint
- Redis-backed refresh session store
- Refresh token rotation on each successful refresh
- Replay detection and full session-chain revocation on token reuse
- Rate checks for refresh attempts (per IP, token, and user)
- Mobile/non-browser support via `x-refresh-token` header

### Changed
- `token` retained as backward-compatible alias; `accessToken` is now the canonical field
- Docs updated: `docs/authentication.md`, `docs/api-reference.md`

---

## [v0.4.0] - 2026-03-29

### Added
- Row-Level Security (RLS) for collection writes (`owner-write-only` mode)
- Publishable key write guardrails — `pk_live` writes now require RLS + user JWT
- Automatic owner field injection on document create
- Protection on `/api/data/users*` routes
- Auth schema validation hardening: `email` and `password` required as string fields

### Fixed
- Owner mismatch blocking for write operations
- Schema key normalization hardening (handles hidden/BOM character edge cases)

---

## [v0.3.0] - 2026-03-21

### Added
- NPM Workspaces monorepo structure with `apps/*` and `packages/*` directories
- `@urbackend/common` shared package — Mongoose models, Express middlewares, Redis queues, DB configs
- `dashboard-api` (Control Plane) — dedicated backend for admin dashboard
- `public-api` (Data Plane) — scalable backend for project data routing
- Concurrent dev mode via `npm run dev` at root
- Full Docker Compose setup

### Changed
- Legacy monolithic `legacy-backend` deprecated and removed

---

## [v0.2.0] - 2026-03-07

### Added
- Bring Your Own Database (BYOD) — connect an external MongoDB URI to any project
- Dual API key system: `pk_live_` (publishable) and `sk_live_` (secret)
- CORS Allowed Domains — `pk_live` requests rejected from un-whitelisted origins
- Dynamic Auth setup — Auth activation blocked until a valid `users` collection is defined
- Brute-force protection via dedicated `authLimiter`
- Deep schema nesting: `Object`, `Array`, and `Ref` (relational) types supported
- Advanced query engine: filter operators, `sort`, and pagination
- `docker-compose.yml` for full local self-hosting

### Fixed
- Double OTP issue during developer signups
- Redis caching bug where raw Mongoose documents corrupted application state
- Analytics visit counter now persists across server restarts

### Security
- Docker containers now run as non-root users
- Internal database and cache ports fully isolated

---

## [v0.1.0] - 2026-01-08

### Added
- Instant NoSQL database — create collections and manage JSON data through a visual dashboard
- Built-in authentication — signup, login (JWT), and profile management
- Integrated cloud storage — file and image uploads via Supabase with public CDN links
- Project dashboard — unified interface to manage multiple projects
- Developer analytics — real-time API traffic and usage monitoring
- API key-based access control

---

[v0.9.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.9.0
[v0.8.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.8.0
[v0.7.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.7.0
[v0.6.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.6.0
[v0.5.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.5.0
[v0.4.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.4.0
[v0.3.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.3.0
[v0.2.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.2.0
[v0.1.0]: https://github.com/geturbackend/urBackend/releases/tag/v0.1.0
