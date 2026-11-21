# DSH Floating Accounts

A standalone floating panel for the DeepSeek Harness (DSH) Web UI: manage model accounts across multiple platforms by **site → account → credential**. Secrets are encrypted with the Windows DPAPI current user; **balances are queried manually only — no polling, no automatic retry, no model calls, no changes to other usage plugins.**

English | [中文](README.md)

## What 1.3.0 changes

- **Fixed a same-origin batch-import defect.** Several providers sharing one origin used to create duplicate sites in a single batch, after which importing that origin conflicted permanently. The documented behaviour is now honoured: two same-origin providers in one batch produce **one site and two accounts**; later imports of the same origin merge into it; an explicit "create a new site" still creates a separate site.
- **Fixed an import consent defect.** When a provider identifier collided with an `Object.prototype` key (`constructor`, `__proto__`, `toString`, …), an unchecked provider could still be submitted and written to encrypted storage. Unchecked providers now never enter the submission path, and checked ones submit only themselves.
- **Import wizard information architecture.** Added a step indicator and count badges, a preview summary with per-item result badges, a per-item result list after a successful import, three graded empty states (each with a focusable primary action), errors scoped to the step that failed with local retry, and an offline state when the host is unreachable.
- **Interface consistency.** Primary, state, focus-ring, elevation, radius and scrollbar colours now read the host `--dsw-*` theme tokens (with the previous values kept as fallbacks, so plain Web viewports do not regress). The light-theme bug where site and account cards shared one background is fixed. The ball and panel are now ARIA-linked and expose an open state; the ball is keyboard movable and resettable; view switches migrate and restore focus; conflict radio groups use `fieldset`/`legend`; heading levels run `h2 → h3 → h4` without skips.
- **Engineering.** Added a Git repository and `.gitignore`; the offline archive is now packed deterministically (fixed member order and timestamps), so the same sources repack to the same SHA256; added `engines.dsh`, `dsh.manifestVersion`, bilingual display metadata and an icon so plugin marketplaces can index it.

## What 1.2.0 changed

- Added "import providers from DSH": the host lists the providers of the current profile read-only (name, base URL, models, whether a key is configured); plaintext keys and reference names never appear in the list or in logs. Nothing is written until the user ticks providers, reviews a preview and explicitly confirms it (confirmation text is literally "确认导入"); keys are then encrypted with the Windows DPAPI current user into this plugin's vault.
- Same-origin merge: when the target origin maps to exactly one existing site, the account is added under it — no duplicate site, no site configuration change. With several sites on the same origin a conflict list is returned and the user picks a target site or a new one; nothing is merged automatically. A new site starts with no balance protocol.
- Listing and importing add no network traffic at all. The post-import "detect protocol" step remains the existing manual flow and needs its own confirmation and the original request limits.
- Imports are not de-duplicated: importing the same provider again creates a duplicate account. The confirmation text says so.

## What 1.1.1 changed

- Manual "detect protocol" only runs after the user confirms, and only sends the explicitly selected model key to a small set of read-only endpoints on the same origin, at most two sequential GETs. It installs nothing and never touches a real account.
- Detection results only offer candidate configuration and status; they return no amounts and no response bodies, and need a second confirmation before being applied.

## What 1.1.0 changed

- Several accounts per site: the account display name and an optional identity note only distinguish accounts; they are never used to log in and no email passwords are collected.
- Several keys per account: model API keys and group keys are separate; exactly one model key is selected explicitly for balance queries, and group keys never authenticate them.
- A separate query protocol per site: Sub2API, New API token usage, DeepSeek official balance. Protocols and units are never guessed from a domain or a model name.
- Account balance and the selected key's quota are reported separately. DeepSeek keeps CNY/USD total available, granted and topped-up amounts; currencies are never summed across and the same wallet is never counted twice.
- Legacy schema 1 accounts can be previewed and migrated; the encrypted backup is kept and schema 2 is committed only after the user confirms.

**Upgrading the sources or the offline package does not mean the real accounts were installed or migrated.** The earlier installation receipt only proves the old version. Installing the new package, migrating real data and querying a real provider each need explicit authorisation. The earlier wallet diagnostic output was redacted, so no claim of a verbatim replay verification is made.

Windows and DSH 0.2.x are supported, on Node 22.19+ or 24. ESM, React and Typert are provided by DSH; no extra dependency is installed. This is not a system-wide overlay — it renders only inside the DSH Web UI. After the host code changes, save the session, quit and restart DSH; refreshing the page alone does not prove the new host was loaded.

## Using multiple sites and accounts

1. Click the blue "账" ball; drag it to reposition. Only the non-sensitive coordinates are stored in browser cache.
2. Add a site with a name and the full model base URL. The balance protocol stays unconfigured by default; choose one only after confirming the platform's public specification.
3. Add an account inside the site with a display name and an optional identity note. Several mailboxes become several accounts; they are never merged automatically.
4. Add a "model API key" or a "group key" inside the account. Secrets are never echoed; editing an existing credential keeps the old value when the field is left blank, and clears this input after a replacement.
5. Select the model key used for balance queries, then press "query balance" on that account. Without a protocol or a selected key the panel states the exact reason and issues no request and shows no zero.
6. Deleting a site does not cascade to its accounts; deleting an account or credential asks for confirmation. A site that already holds credentials cannot change its origin — create a new site and re-enter the credentials instead, so old keys are never sent to a different provider.

NVIDIA trial limits, local or intranet endpoints, Maekuaiyun login authorisation, Volcano Engine AK/SK billing interfaces, WorkBuddy credits and unverified sites cannot be used as a model-key balance target yet. You may still register them, but they must stay unconfigured; an unknown or inapplicable state must never be shown as 0.

## Manual protocol detection

The detection RPC carries only `{id, revision}`. The explicitly selected model key is sent only to fixed candidate paths on that site's own origin; the official `https://api.deepseek.com` is only asked for `/user/balance`. At most two sequential GETs, detection works even without a configured protocol, and without a selected key no request is made. Detection is not a balance query: it returns no amounts and does not refresh balance state. Only a single strict match is shown, and applying it needs another confirmation. Detection on a schema 1 account never writes configuration back.

## Manual balance protocols

The query RPC still carries only the account id and revision: `args: { request: { id, revision } }`. The host reads the selected key and the owning site configuration; the browser cannot specify an arbitrary origin, path, header or key. Schema 2 does not fall back to the old global configuration.

| Protocol | Configuration | Balance semantics |
|---|---|---|
| `sub2api-usage` | fixed `/v1/usage`, explicit USD/CNY, multiplier 1 | `quota_limited` requires an active, complete quota; `unrestricted` requires strictly balance = remaining wallet; subscription and unknown modes are refused |
| `new-api-token-usage` | explicit root-relative token-usage path, unit and multiplier | `code=true`; `data.user_quota` is the optional account quota, `data.total_available` is the key quota; an unlimited key does not mean unlimited funds |
| `deepseek-balance` | fixed `/user/balance`, no unit or multiplier, official `https://api.deepseek.com` only | the response's per-currency total, granted and topped-up amounts; the key's own quota is "not provided" |
| unset | `null` | record only, no request, no guessing |

Sub2API and New API configuration shapes:

```json
{"protocol":"sub2api-usage","endpointPath":"/v1/usage","unit":"USD","quotaPerUnit":1}
```

DeepSeek official configuration shape (relay keys do not apply):

```json
{"protocol":"deepseek-balance","endpointPath":"/user/balance"}
```

Only QUOTA/USD/CNY are supported; a QUOTA multiplier must be 1 — 500000 is never assumed, no status probe, no currency conversion. One GET to a public HTTPS origin; DNS is pinned to a public address, loopback/private/reserved ranges are refused, and there are no cookies, redirects or proxies. Network budget 10s, JSON 64KiB, host budget 12s; 4 in flight globally and 1 per account. After a timeout the underlying attempt still holds its slot, and there is no automatic retry.

Failures never fabricate a zero; a legitimate zero, a negative wallet, decimals and very small amounts are preserved. A retained previous success is labelled "last successful result (not this run)". Editing, switching key, saving, migrating, deleting, reloading and closing the panel all invalidate it; the host re-checks the revision before finishing, and a late result cannot overwrite newer state. Amounts are not persisted and never enter browser cache.

## Legacy migration and rollback

Viewing schema 1 writes nothing and old queries still follow the original global configuration. While old accounts exist the panel asks for a migration before the three-layer structure can be edited.

1. "Preview migration" writes nothing and shows site, account and credential counts plus safe metadata.
2. After confirmation the host validates the revision, the approved preview's file snapshot, the full ciphertext digest and the fixed configuration/ID mapping under the original exclusive lock, keeps an exclusive backup of the old encrypted file and atomically commits schema 2. A missing same-instance preview, a rebuilt instance or a same-revision file change all require a new preview.
3. Old account ids, names, apiKey and groupKey are preserved in full; only an identical full base URL plus query configuration may share a site, and accounts or keys are never merged. An unconfirmed old query configuration stays unconfigured.
4. A conflict, a backup/DPAPI/capacity failure keeps the original file; "commit result unknown" is never retried blindly — reload first. A successful run returns the backup name; a failed partial backup is not a complete rollback backup.
5. Migrating an already-schema-2 vault creates no duplicate account or backup and still requires the current revision.

**Version 1.0.2 cannot read schema 2 and refuses rather than overwriting.** A downgrade is not just replacing code: stop every relevant instance, keep the current schema 2 file, check whether it was edited after the migration, and restore matching old ciphertext only with explicit authorisation. Never auto-rollback and lose migrated accounts or keys. Do not delete backups or remove a lock while running.

Storage is still only the original AccountVault/DPAPI encrypted file: by default `plugin-data/dsh-floating-accounts` under `DSH_HOME`. At most 100 accounts, 100 sites and 10 credentials per account, and 4MiB for the whole ciphertext. A corrupt or foreign-user file is never overwritten, and there is no plaintext fallback. Every modification commits under the same revision; a failed lock cleanup tells the user to check the state first.

## Build, test and offline package

Run in the source directory:

```powershell
node scripts/build.mjs
npm test
node scripts/pack.mjs
```

The build script produces the ModuleLoader client, the host modules and the manifest; the offline package carries the distribution files and a SHA256 manifest. The SDK tests need a local DSH SDK environment and run separately from the local suite:

```powershell
$env:DSH_CHECKOUT = 'D:\FUGUI\ai\guanfangdsh\dsh\resources\app.asar\dsh'
$env:ELECTRON_RUN_AS_NODE = '1'
& 'D:\FUGUI\ai\guanfangdsh\dsh\DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

Every test uses an isolated fixture or a synthetic transport; no running profile's login token is read and no real provider is contacted. The real SDK gateway proves the RPC descriptors and the persistence path, which does not replace an installed-GUI acceptance. Any browser test must state whether it renders in isolation or on the live DSH page, and must not start a replacement server and pass it off as the current GUI.

## Installation discipline

On a new environment the installer refuses to overwrite an existing directory; it only registers this plugin's dependency and bundle and backs up the original profile, and it never reads plaintext accounts. Install and uninstall take an exclusive lifecycle lock and check a snapshot, and uninstall keeps the encrypted data. Installing is a separately authorised action, and **an existing installation must not be force-overwritten by the first-time installer**. Check the upgrade package and the full backup first, then act under the authorisation for the current environment; no command that overwrites real data is provided here.

## Sources and specifications

[multi-site upgrade specification](<docs/multi-site-upgrade-spec.md>); [implementation plan](<Plan/2. 多站点升级_plan.md>); [storage](<src/vault.js>) and [data validation](<src/vault-model.js>); [query owner](<src/balance.js>) and [restricted HTTPS](<src/balance-http.js>); [host RPC](<src/index.js>); [interface](<src/client.js>); [provider import specification](<docs/provider-import-spec.md>); [import implementation plan](<Plan/4. 供应商导入_plan.md>); [import reader owner](<src/host-providers.js>).

The historical [balance plan](<docs/balance-query-plan.md>) describes the 1.0.2 scope; it exists only as old-version evidence and for schema 1 compatibility and is not the owner of the schema 2 site configuration.
