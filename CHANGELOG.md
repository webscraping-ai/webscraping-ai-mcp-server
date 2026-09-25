# Changelog

All notable changes to `webscraping-ai-mcp` are documented in this file.

## 1.1.0 — 2026-09-25

### Added

- `webscraping_ai_serp` tool for the new `/serp` endpoint: Google search results as parsed JSON (`organic_results`, `related_searches`, `search_information`, `pagination`). Params `q` (required), `engine`, `gl`, `hl`, `page`; the scraping options (`js`, `proxy`, `timeout`...) don't apply. 15 credits per search, failed searches not charged. With `WEBSCRAPING_AI_ENABLE_CONTENT_SANDBOXING=true` the result is sandboxed like the other content tools, with `Source: https://www.google.com/search?q=<query>` (RFC 3986 encoding, matching the remote server byte for byte).

## 1.0.7 — 2026-07-23

### Added

- Official MCP Registry support: `mcpName` (`io.github.webscraping-ai/webscraping-ai`) in `package.json` and a `server.json` manifest for `mcp-publisher`. Publishing to the official registry makes registry aggregators (PulseMCP etc.) sync correct metadata.

### Changed

- README: "Available Tools" section renamed to "Tools" (recognized by mcp.so's tool-list parser).

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
