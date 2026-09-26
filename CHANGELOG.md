# Changelog

All notable changes to `webscraping-ai-mcp` are documented in this file.

## 1.2.1 — 2026-09-26

### Security

- Dependency updates for open Dependabot alerts: `@modelcontextprotocol/sdk` 1.7 → 1.30.1 (ReDoS, DNS-rebinding default, request body size limits; pulls patched `express`/`body-parser`/`qs`/`path-to-regexp`) and `axios` 1.8 → 1.20 (prototype-pollution gadgets, proxy/redirect credential leaks, DoS; pulls patched `form-data`/`follow-redirects`). Dev dependencies refreshed (`js-yaml`, `brace-expansion`, `@babel/core`, `browserslist`, …). No tool or behavior changes.
- `zod` is now a declared dependency (`^3.25.76`). It was imported but only available as the SDK's transitive dependency; SDK 1.30 accepts zod 3 or 4 as a peer, and zod 4 would break the existing schemas.

## 1.2.0 — 2026-09-25
### Added

- `webscraping_ai_data` tool for the new `/data` endpoint: structured JSON (`request_parameters` with `provider`/`type`, `parse_status`, `data`) for a page on a supported site, from its normal URL. Params `url` (required, non-blank), `country`, `transcript`, `transcript_language`, `params` (extra string/number/boolean query params sent as-is, for future site-specific params; keys `url`/`api_key`/`key`, a named parameter, a `from_*` marker, or anything outside `[A-Za-z0-9_-]{1,64}` are rejected before any request, with the same messages as the remote server) and `disable_content_sandboxing`. The URL is never checked against a site list client-side: sites are added on the server. An unsupported URL or page type returns a 400 that is not charged. Its message lists what is supported. The scraping options (`js`, `proxy`, `timeout`...) don't apply and the scraping defaults aren't sent. 15 credits per request. With content sandboxing on, the pretty-printed JSON is sandboxed with `Source: <url>`.
- API errors now redact the API key (and any `api_key=...`) from the error text, in case an upstream error body echoes the request URL.
- `bin/smoke.js`: one `/data` call on a YouTube video (asserts `parse_status` `ok`, provider `youtube`, non-empty `data.title`) and one on `https://example.com/` that must come back as the server's 400 with a message containing `Unsupported URL`.

## 1.1.0 — 2026-09-25

### Added

- `webscraping_ai_serp` tool for the new `/serp` endpoint: Google search results as parsed JSON (`organic_results`, `related_searches`, `search_information`, `pagination`). Params `q` (required), `engine`, `gl`, `hl`, `page`; the scraping options (`js`, `proxy`, `timeout`...) don't apply. 15 credits per search, failed searches not charged. With `WEBSCRAPING_AI_ENABLE_CONTENT_SANDBOXING=true` the result is sandboxed like the other content tools, with `Source: https://www.google.com/search?q=<query>` (RFC 3986 encoding, matching the remote server byte for byte).

### Fixed

- `webscraping_ai_selected_multiple` always returned `[[]]`: axios sent `selectors[]=h1&selectors[]=p`, which the API silently ignores. Arrays are now sent as repeated keys (`selectors=h1&selectors=p`).
- `webscraping_ai_serp` rejects a whitespace-only `q` with an error result `{"message":"q must be a non-empty search query"}` (same message as the remote server) before calling the API; the schema stays `minLength: 1` and `q` is sent untrimmed.
- `webscraping_ai_serp` no longer throws outside the error shape when `q` contains a lone surrogate ("URI malformed" while building the sandbox source URL); it now returns an `isError` result.
- `bin/smoke.js`: the serp case fails unless `organic_results` is non-empty and `search_parameters.q` equals the query; FAIL lines redact the API key.
- README: success response examples no longer show `"isError": false` (the server omits `isError` on success).
- Tests: new `src/stdio.test.js` spawns the real server over stdio against a local HTTP stub and asserts the exact `/serp` query string, `q` validation, and `selectors=h1&selectors=p` for `selected_multiple`. `ContentSanitizer`/`googleSearchUrl` moved to side-effect-free `src/lib.js` (still re-exported from `src/index.js`) so unit tests no longer start a server.

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
