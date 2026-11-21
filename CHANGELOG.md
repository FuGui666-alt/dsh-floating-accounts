# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [1.3.0] — 2026-11-21

Interface consistency, import-wizard information architecture, and two functional
correctness fixes found by an independent source audit. The interface and import
changes are behaviour-preserving; the two fixes change what the import path does.

### Fixed

- **Same-origin providers in one batch no longer create duplicate sites.**
  Previously, several providers sharing an origin in a single import each created
  their own site, and every later import of that origin then failed permanently
  with `IMPORT_CONFLICT` — contradicting the "merge into the existing site"
  behaviour promised in the interface. The three-valued target semantics are now
  carried through unchanged, so a batch of two same-origin providers yields one
  site and two accounts, later imports of that origin merge into it, and an
  explicit "create a new site" still creates a separate site. (`src/host-providers.js`)
- **An unchecked provider could be submitted and stored.** A provider identifier
  colliding with an `Object.prototype` key (`constructor`, `__proto__`,
  `toString`, `valueOf`, `hasOwnProperty`) escaped the selection check: the
  provider was submitted and written to the encrypted vault even when the user
  had not ticked it, breaking the explicit two-step consent contract. All
  provider-id keyed lookups are now prototype-safe, so unchecked providers never
  reach the submission path and checked ones submit only themselves.
  (`src/client.js`)

### Added

- Import wizard step indicator, count badges, a preview summary with per-item
  result badges, and a per-item result list after a successful import.
- Three graded empty states (nothing configured, a site without accounts, no
  importable providers), each with a focusable primary action.
- Errors are scoped to the step that failed, render next to that step and offer a
  local retry; an unreachable host renders an explicit offline state.
- Ball and panel are ARIA-linked and expose an open state; the ball is movable
  and resettable from the keyboard; view switches migrate focus and return it to
  the trigger; conflict radio groups use `fieldset`/`legend`; heading levels run
  `h2 → h3 → h4` without skips.
- English README (`README.en.md`), a changelog, bilingual display metadata
  (`locale/en.json`, `locale/zh.json`) and an icon.
- A Git repository with `.gitignore`.

### Changed

- The interface now reads the host `--dsw-*` theme tokens (primary, state,
  focus ring, elevation, radius, scrollbar) with the previous values kept as
  fallbacks, so plain Web viewports do not regress. The light-theme bug where
  site and account cards shared one background is fixed.
- The offline archive is packed deterministically (fixed member order, zeroed
  timestamps and ownership), so identical sources repack to an identical
  SHA256. The build manifest carries a content-derived `buildId` instead of a
  wall-clock timestamp.
- Package metadata declares `engines.dsh`, `dsh.manifestVersion`, and exports
  `./locale/*.json` and `./icon`.

### Not changed

- No RPC method, parameter shape or error code changed.
- The import path still performs no network access, and plaintext keys still
  never enter the DTOs, the logs, the error messages or the front-end state.
- The "确认导入" confirmation text is unchanged, and selection plus confirmation
  are still validated before any vault I/O or credential resolution.

## [1.2.0] — 2026-11-20

- Added "import providers from DSH": the host lists the providers of the current
  profile read-only; nothing is written until the user ticks providers, reviews
  a preview and explicitly confirms it; keys are encrypted with the Windows
  DPAPI current user.
- Same-origin merge: one existing site for the origin receives the new account;
  several same-origin sites produce a conflict list the user resolves.
- Listing and importing add no network traffic.

## [1.1.1] — 2026-11-19

- Manual "detect protocol" runs only after confirmation, only against fixed
  read-only paths on the same origin, at most two sequential GETs, and applies
  a single strict match only after a second confirmation.

## [1.1.0] — 2026-11-18

- Multiple accounts per site and multiple keys per account, with one model key
  selected explicitly for balance queries.
- A separate balance protocol per site: Sub2API, New API token usage, DeepSeek
  official balance.
- Account balance and key quota reported separately; legacy schema 1 accounts
  can be previewed and migrated.

## [1.0.2] and earlier

See the repository history and the reports under `docs/`.
