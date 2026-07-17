# Changelog

All notable changes to `webscraping-ai-mcp` are documented in this file.

## 1.0.6 — 2026-07-17

### Changed

- Documentation: expanded README — API docs, signup/dashboard links, badges, and links to the other official clients; package metadata homepage now points to https://webscraping.ai where it previously pointed at GitHub.

## 1.0.5 — 2026-06-21

### Fixed

- A custom API endpoint is now honored: the server reads `WEBSCRAPING_AI_API_URL`, and Smithery's `webscrapingAiApiUrl` config is forwarded to it (previously the production URL was hardcoded).
- Added `hk` (Hong Kong) and `tr` (Turkey) to the `country` enum to match the canonical API.
- The release workflow now verifies the hardcoded server version in `src/index.js` matches the release tag, preventing a stale protocol version.

## 1.0.4 and earlier

Earlier releases predate this changelog.
