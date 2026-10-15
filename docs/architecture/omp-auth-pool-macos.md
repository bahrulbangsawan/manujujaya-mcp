# OMP OAuth account pools on macOS

This runbook configures a local OMP auth broker, keeps it running as a macOS LaunchAgent, and limits Grok OAuth routing to an explicit account pool. It also covers adding accounts, verification, quota failures, logs, and removal.

## Result

After setup:

- macOS starts `omp auth-broker serve` automatically at login;
- `launchd` restarts the broker after a crash;
- OMP clients connect to `http://127.0.0.1:8765`;
- OAuth access and refresh tokens stay in the broker credential store;
- the client sees only the Grok OAuth identities listed in the pool file;
- separate OMP sessions can use different eligible accounts while retaining per-session affinity.

The LaunchAgent stays active for the macOS login session. It does not start and stop with each OMP process. This avoids startup races when several OMP sessions or subagents connect at once.

## Security model

An account pool is a **trusted-client routing policy, not an authorization boundary**. The client still has the broker bearer token and receives broker responses before applying its local account filter. Do not use a pool to isolate mutually untrusted users.

Other invariants:

- Keep the broker on `127.0.0.1` unless transport security and server-side authorization are configured separately.
- Never commit `~/.omp/auth-broker.token`, OAuth credential data, or real account identity keys.
- The pool file contains token-free identity keys, but they are still account identifiers. Keep it outside the repository with mode `0600`.
- API-key credentials are not filtered by OAuth account pools.
- A pool file is parsed once when an OMP client initializes broker-backed auth. Restart the client after changing it.

## Prerequisites

```bash
command -v omp
omp --version
```

Each Grok account must have an active SuperGrok or eligible X Premium+ subscription. Pooling does not create credits or bypass provider subscription limits.

This runbook uses OMP's default profile. Named profiles isolate auth, sessions, settings, and caches and need their own deliberate configuration.

## 1. Connect Grok OAuth accounts

Grok subscription OAuth uses provider ID `xai-oauth`. Connect each account separately on the broker host:

```bash
omp auth-broker login xai-oauth
```

OMP displays an RFC 8628 device authorization URL and code. For every login:

1. Open the URL in the browser profile for the intended Grok account, or use a private window.
2. Confirm the browser is signed into the correct xAI account.
3. Enter the device code and authorize OMP.
4. Repeat the command for the secondary account.

Do not use `/login xai-oauth` when the intention is to populate a shared broker from a remote/headless client. `omp auth-broker login xai-oauth` writes the account into the broker credential store.

### List token-free Grok identities

OMP intentionally has no account-listing CLI that prints credential payloads. On a local broker host, project only the safe metadata from SQLite:

```bash
AGENT_DIR="$(omp config path)"
sqlite3 -header -column "$AGENT_DIR/agent.db" \
  "SELECT id, provider, identity_key, disabled_cause
   FROM auth_credentials
   WHERE provider = 'xai-oauth'
   ORDER BY id;"
```

Expected shape:

```text
id  provider   identity_key          disabled_cause
--  ---------  --------------------  --------------
6   xai-oauth  account:<primary-id>
10  xai-oauth  account:<secondary-id>
```

Never select or print the `data` column; it contains credential material.

## 2. Create the Grok account pool

Create `~/.omp/xai-oauth-account-pool.json` using the exact `identity_key` values returned above:

```bash
umask 077
cat > "$HOME/.omp/xai-oauth-account-pool.json" <<'JSON'
{
  "xai-oauth": [
    "account:<primary-id>",
    "account:<secondary-id>"
  ]
}
JSON
chmod 600 "$HOME/.omp/xai-oauth-account-pool.json"
```

Validate it:

```bash
jq -e '."xai-oauth" | type == "array" and length > 0' \
  "$HOME/.omp/xai-oauth-account-pool.json"
```

Pool semantics:

| Entry | Effect |
| --- | --- |
| Provider omitted | All OAuth identities for that provider are visible |
| `"xai-oauth": []` | No Grok OAuth identity is visible |
| Non-empty array | Only exact matching Grok identity keys are visible |
| API key | Unaffected by the OAuth pool |

To add a third account, run the broker login again, obtain its `identity_key`, append it to the array, validate the JSON, and restart all OMP clients that should see it.

## 3. Start the broker once and create its token

A first foreground start creates `~/.omp/auth-broker.token` if it does not exist:

```bash
omp auth-broker serve
```

The default local endpoint is `http://127.0.0.1:8765`. Once the log reports `auth-broker listening`, stop this temporary foreground process with `Ctrl-C`. The LaunchAgent installed next replaces it.

The token file must remain private:

```bash
chmod 600 "$HOME/.omp/auth-broker.token"
```

Do not export the token manually unless a non-default configuration requires it. When `OMP_AUTH_BROKER_URL` or `auth.broker.url` is set, OMP automatically falls back to `~/.omp/auth-broker.token` if no explicit token setting is present.

## 4. Install the macOS LaunchAgent

Discover the installed OMP executable and generate the plist with absolute paths. `launchd` does not expand `$HOME` inside plist string values.

```bash
OMP_BIN="$(command -v omp)"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.omp/logs"

cat > "$HOME/Library/LaunchAgents/com.oh-my-pi.auth-broker.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.oh-my-pi.auth-broker</string>

  <key>ProgramArguments</key>
  <array>
    <string>${OMP_BIN}</string>
    <string>auth-broker</string>
    <string>serve</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${HOME}</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>ProcessType</key>
  <string>Background</string>

  <key>ThrottleInterval</key>
  <integer>5</integer>

  <key>StandardOutPath</key>
  <string>${HOME}/.omp/logs/auth-broker.log</string>

  <key>StandardErrorPath</key>
  <string>${HOME}/.omp/logs/auth-broker.error.log</string>
</dict>
</plist>
PLIST

plutil -lint "$HOME/Library/LaunchAgents/com.oh-my-pi.auth-broker.plist"
```

Load and start it:

```bash
launchctl bootstrap \
  "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.oh-my-pi.auth-broker.plist"

launchctl kickstart -k \
  "gui/$(id -u)/com.oh-my-pi.auth-broker"
```

If `bootstrap` reports that the service is already loaded, do not start another foreground broker. Use the restart command in [Service management](#service-management).

## 5. Configure OMP clients

Persist the broker URL in OMP's global configuration:

```bash
omp config set auth.broker.url http://127.0.0.1:8765
```

OMP stores global configuration in `~/.omp/agent/config.yml` for the default profile. The equivalent YAML is:

```yaml
auth:
  broker:
    url: http://127.0.0.1:8765
```

Persist the account-pool path for terminal-launched OMP clients:

```bash
printf '%s\n' \
  'export OMP_AUTH_BROKER_ACCOUNT_POOL_FILE="$HOME/.omp/xai-oauth-account-pool.json"' \
  >> "$HOME/.zshrc"

source "$HOME/.zshrc"
```

Do not add the same export repeatedly. Check first with:

```bash
grep -F 'OMP_AUTH_BROKER_ACCOUNT_POOL_FILE' "$HOME/.zshrc"
```

The broker token does not need to be placed in `.zshrc`; OMP reads the protected token file automatically. Environment variables take precedence over `config.yml`, so remove stale values if they point to another broker:

```bash
unset OMP_AUTH_BROKER_URL OMP_AUTH_BROKER_TOKEN
export OMP_AUTH_BROKER_ACCOUNT_POOL_FILE="$HOME/.omp/xai-oauth-account-pool.json"
```

Also remove or unset `XAI_OAUTH_TOKEN` and `XAI_API_KEY` when the intended behavior is broker-selected Grok OAuth. A usable stored OAuth credential takes precedence, but an environment credential can be used when broker OAuth does not resolve, bypassing the pool.

Open a new terminal after making the persistent shell change. Then launch OMP normally:

```bash
omp --model xai-oauth/grok-4.6
```

No terminal running `omp auth-broker serve` is needed.

## 6. Verify the complete setup

### Broker health

```bash
curl -fsS http://127.0.0.1:8765/v1/healthz
```

Expected shape:

```json
{"ok":true,"version":"<installed-version>"}
```

### LaunchAgent state

```bash
launchctl print "gui/$(id -u)/com.oh-my-pi.auth-broker"
```

Look for:

```text
state = running
properties = keepalive | runatload
```

### OMP configuration

```bash
omp config get auth.broker.url
printf '%s\n' "$OMP_AUTH_BROKER_ACCOUNT_POOL_FILE"
jq . "$OMP_AUTH_BROKER_ACCOUNT_POOL_FILE"
```

### Logs

```bash
tail -f "$HOME/.omp/logs/auth-broker.log"
tail -f "$HOME/.omp/logs/auth-broker.error.log"
```

Normal messages include:

- `auth-broker listening`;
- `auth-broker bearer token loaded`;
- `auth-broker stream entry` after credential snapshot changes;
- `auth-broker credential block upserted` when a provider temporarily blocks an account.

A stream entry is not another login attempt and does not mean a credential was duplicated.

## Account selection and quota behavior

OMP preserves session affinity: a session normally keeps using the same eligible credential. Different sessions may select different accounts from the visible pool.

If xAI returns a quota error such as:

```text
403 personal-team-blocked:spending-limit
```

the broker records a temporary block for that credential. Other unblocked identities in the pool remain eligible. Start a new OMP session if an existing session remains pinned to the exhausted account.

Inspect Grok blocks without reading credentials:

```bash
AGENT_DIR="$(omp config path)"
sqlite3 -header -column "$AGENT_DIR/agent.db" \
  "SELECT credential_id,
          provider_key,
          block_scope,
          datetime(blocked_until_ms / 1000, 'unixepoch', 'localtime') AS blocked_until_local
   FROM auth_credential_blocks
   WHERE provider_key = 'xai-oauth:oauth'
   ORDER BY credential_id;"
```

A block only changes routing. It cannot grant credits, upgrade a subscription, or override xAI's spending limits.

## Service management

### Restart

Use this after changing the plist or upgrading the OMP executable path:

```bash
launchctl kickstart -k \
  "gui/$(id -u)/com.oh-my-pi.auth-broker"
```

### Stop and disable automatic startup

```bash
launchctl bootout \
  "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.oh-my-pi.auth-broker.plist"
```

### Re-enable

```bash
launchctl bootstrap \
  "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.oh-my-pi.auth-broker.plist"
```

### Uninstall

```bash
launchctl bootout \
  "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.oh-my-pi.auth-broker.plist"
rm "$HOME/Library/LaunchAgents/com.oh-my-pi.auth-broker.plist"
```

Uninstalling the LaunchAgent does not delete credentials, the token, or the account-pool file.

## Remove a Grok account

To stop routing work to one account, remove its `identity_key` from `~/.omp/xai-oauth-account-pool.json`, validate the file, and restart affected OMP clients. The credential remains stored in the broker but is invisible to clients using that pool.

`omp auth-broker logout xai-oauth` removes **every** stored credential for the provider; it is not a single-account logout. To revoke one account's stored token using the CLI:

1. Run `omp auth-broker logout xai-oauth`.
2. Reconnect every account that should remain with `omp auth-broker login xai-oauth`.
3. Rebuild the pool from the new identity keys.

Do not delete credential rows manually unless recovering a broken store from a known backup.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `connection refused` on port `8765` | LaunchAgent is not running | Check `launchctl print`, then `kickstart`; inspect both log files |
| `Address already in use` | A foreground broker and LaunchAgent are both trying to bind | Stop the foreground `omp auth-broker serve`; keep only the LaunchAgent |
| OMP says no broker is configured | Neither `auth.broker.url` nor `OMP_AUTH_BROKER_URL` is set | Run `omp config set auth.broker.url http://127.0.0.1:8765` |
| OMP cannot resolve the broker token | Token file is missing or unreadable | Start the broker once, confirm `~/.omp/auth-broker.token`, and enforce mode `0600` |
| New account is never selected | Its identity is missing from the pool, or the client loaded an older pool | Add the exact key, validate JSON, and start a new OMP process |
| Primary account keeps being selected | Existing session affinity still points to it | Start a new session; inspect broker blocks and pool membership |
| `403 personal-team-blocked:spending-limit` | Selected xAI account has no usable subscription quota | Wait for the reported reset or fund/upgrade that account; let another unblocked pooled identity serve new sessions |
| Broker logs repeatedly show `stream entry` | Snapshot generation changed | Normal; no action required |
| Broker immediately exits after an OMP upgrade | LaunchAgent points to an old executable path | Regenerate the plist using the current `command -v omp`, validate, boot out, and bootstrap |
| Pool works in one terminal but not another | The second shell did not load `.zshrc` | Open a new terminal or `source ~/.zshrc`; print the variable |

## Current local file layout

```text
~/.omp/agent/agent.db                         broker credential database
~/.omp/auth-broker.token                     broker bearer token (0600)
~/.omp/xai-oauth-account-pool.json           allowed Grok OAuth identities (0600)
~/.omp/logs/auth-broker.log                   LaunchAgent standard output
~/.omp/logs/auth-broker.error.log             LaunchAgent standard error
~/Library/LaunchAgents/com.oh-my-pi.auth-broker.plist
                                              macOS automatic service definition
```

## Daily use

Once setup is complete:

```bash
omp
```

Do not run `omp auth-broker serve` manually. The LaunchAgent owns the broker process and restarts it automatically.
