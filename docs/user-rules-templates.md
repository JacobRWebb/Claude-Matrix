# User Rules Templates

Ready-to-use rule templates for `hooks.userRules.rules[]` in your Matrix config.

## How Rules Work

```json
{
  "name": "rule-name",
  "enabled": true,
  "event": "bash | edit | read | write | prompt",
  "pattern": "regex pattern",
  "action": "block | warn | allow",
  "message": "Custom message shown to user",
  "priority": 10
}
```

| Field | Description |
|-------|-------------|
| `event` | When to check: `bash`, `edit`, `read`, `write`, `prompt` |
| `pattern` | Regex to match against command/file/content |
| `action` | `block` (stop), `warn` (continue with warning), `allow` (whitelist) |
| `priority` | Higher = checked first (default: 0) |

---

## Security Rules

### Block Dangerous Shell Commands

```json
{
  "name": "block-rm-rf-root",
  "enabled": true,
  "event": "bash",
  "pattern": "rm\\s+(-[rfRF]+\\s+)*/(\\s|$)",
  "action": "block",
  "message": "Blocked: rm on root directory"
}
```

```json
{
  "name": "block-chmod-777",
  "enabled": true,
  "event": "bash",
  "pattern": "chmod\\s+777",
  "action": "block",
  "message": "Blocked: chmod 777 is insecure. Use specific permissions."
}
```

```json
{
  "name": "block-curl-pipe-sh",
  "enabled": true,
  "event": "bash",
  "pattern": "curl.*\\|.*sh|wget.*\\|.*sh",
  "action": "block",
  "message": "Blocked: Piping remote scripts to shell is dangerous"
}
```

```json
{
  "name": "warn-sudo",
  "enabled": true,
  "event": "bash",
  "pattern": "^sudo\\s",
  "action": "warn",
  "message": "Warning: Running with sudo privileges"
}
```

```json
{
  "name": "block-env-echo",
  "enabled": true,
  "event": "bash",
  "pattern": "echo.*\\$[A-Z_]*KEY|echo.*\\$[A-Z_]*SECRET|echo.*\\$[A-Z_]*TOKEN",
  "action": "block",
  "message": "Blocked: Don't echo secrets to terminal"
}
```

### Protect Sensitive Files

```json
{
  "name": "block-edit-env",
  "enabled": true,
  "event": "edit",
  "pattern": "\\.env$|\\.env\\.",
  "action": "block",
  "message": "Blocked: Use environment variables, don't edit .env files directly"
}
```

```json
{
  "name": "warn-edit-config",
  "enabled": true,
  "event": "edit",
  "pattern": "config\\.(json|yaml|yml|toml)$",
  "action": "warn",
  "message": "Warning: Editing configuration file"
}
```

```json
{
  "name": "block-read-private-keys",
  "enabled": true,
  "event": "read",
  "pattern": "id_rsa$|id_ed25519$|\\.pem$|\\.key$",
  "action": "block",
  "message": "Blocked: Private keys should not be read"
}
```

---

## Code Quality Rules

### Prevent Debug Code

```json
{
  "name": "warn-console-log",
  "enabled": true,
  "event": "edit",
  "pattern": "console\\.(log|debug|info)\\(",
  "action": "warn",
  "message": "Warning: console.log detected. Use a proper logger in production."
}
```

```json
{
  "name": "warn-debugger",
  "enabled": true,
  "event": "edit",
  "pattern": "\\bdebugger\\b",
  "action": "warn",
  "message": "Warning: debugger statement detected"
}
```

```json
{
  "name": "warn-todo-fixme",
  "enabled": true,
  "event": "edit",
  "pattern": "TODO|FIXME|HACK|XXX",
  "action": "warn",
  "message": "Warning: TODO/FIXME comment added. Track in issue tracker instead."
}
```

### Prevent Anti-patterns

```json
{
  "name": "warn-any-type",
  "enabled": true,
  "event": "edit",
  "pattern": ":\\s*any\\b|as\\s+any\\b|<any>",
  "action": "warn",
  "message": "Warning: 'any' type detected. Consider using a specific type."
}
```

```json
{
  "name": "warn-eslint-disable",
  "enabled": true,
  "event": "edit",
  "pattern": "eslint-disable|@ts-ignore|@ts-nocheck",
  "action": "warn",
  "message": "Warning: Linter/type suppression detected. Fix the underlying issue."
}
```

```json
{
  "name": "block-eval",
  "enabled": true,
  "event": "edit",
  "pattern": "\\beval\\s*\\(|new\\s+Function\\s*\\(",
  "action": "block",
  "message": "Blocked: eval() and new Function() are security risks"
}
```

---

## Project-Specific Rules

### Enforce Architecture

```json
{
  "name": "warn-direct-db-access",
  "enabled": true,
  "event": "edit",
  "pattern": "import.*from\\s+['\"].*prisma|import.*from\\s+['\"].*drizzle",
  "action": "warn",
  "message": "Warning: Direct DB imports. Use repository pattern via /lib/db"
}
```

```json
{
  "name": "block-edit-generated",
  "enabled": true,
  "event": "edit",
  "pattern": "/generated/|/\\.generated\\.|/__generated__/",
  "action": "block",
  "message": "Blocked: Don't edit generated files. Modify the source and regenerate."
}
```

```json
{
  "name": "warn-edit-vendor",
  "enabled": true,
  "event": "edit",
  "pattern": "/vendor/|/third_party/|/external/",
  "action": "warn",
  "message": "Warning: Editing vendored code. Consider upstreaming changes."
}
```

### Lock Critical Files

```json
{
  "name": "block-edit-lockfiles",
  "enabled": true,
  "event": "edit",
  "pattern": "package-lock\\.json$|yarn\\.lock$|pnpm-lock\\.yaml$|bun\\.lockb$",
  "action": "block",
  "message": "Blocked: Don't edit lockfiles manually. Use package manager commands."
}
```

```json
{
  "name": "warn-edit-migrations",
  "enabled": true,
  "event": "edit",
  "pattern": "/migrations/.*\\.(sql|ts|js)$",
  "action": "warn",
  "message": "Warning: Editing existing migration. Create a new migration instead.",
  "priority": 5
}
```

---

## Workflow Rules

### Package Management

```json
{
  "name": "warn-npm-install-global",
  "enabled": true,
  "event": "bash",
  "pattern": "npm\\s+i(nstall)?\\s+-g|npm\\s+i(nstall)?\\s+--global",
  "action": "warn",
  "message": "Warning: Global npm install. Consider using npx or local install."
}
```

```json
{
  "name": "warn-force-flags",
  "enabled": true,
  "event": "bash",
  "pattern": "--force|--legacy-peer-deps|-f\\s",
  "action": "warn",
  "message": "Warning: Force flag detected. Resolve dependency conflicts properly."
}
```

### Git Safety

```json
{
  "name": "block-force-push-main",
  "enabled": true,
  "event": "bash",
  "pattern": "git\\s+push.*--force.*main|git\\s+push.*-f.*main|git\\s+push.*main.*--force|git\\s+push.*main.*-f",
  "action": "block",
  "message": "Blocked: Force push to main is not allowed"
}
```

```json
{
  "name": "warn-git-reset-hard",
  "enabled": true,
  "event": "bash",
  "pattern": "git\\s+reset\\s+--hard",
  "action": "warn",
  "message": "Warning: Hard reset will discard uncommitted changes"
}
```

```json
{
  "name": "warn-git-clean",
  "enabled": true,
  "event": "bash",
  "pattern": "git\\s+clean\\s+-[dfx]",
  "action": "warn",
  "message": "Warning: git clean will delete untracked files"
}
```

---

## Language-Specific Rules

### Python

```json
{
  "name": "warn-python-print",
  "enabled": true,
  "event": "edit",
  "pattern": "\\bprint\\s*\\(",
  "action": "warn",
  "message": "Warning: print() detected. Use logging module in production."
}
```

```json
{
  "name": "block-python-exec",
  "enabled": true,
  "event": "edit",
  "pattern": "\\bexec\\s*\\(|\\bcompile\\s*\\(",
  "action": "block",
  "message": "Blocked: exec() and compile() are security risks"
}
```

### SQL

```json
{
  "name": "warn-sql-injection-risk",
  "enabled": true,
  "event": "edit",
  "pattern": "\\$\\{.*\\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)|`.*\\$\\{.*\\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)",
  "action": "warn",
  "message": "Warning: Possible SQL injection. Use parameterized queries."
}
```

```json
{
  "name": "block-drop-table",
  "enabled": true,
  "event": "bash",
  "pattern": "DROP\\s+TABLE|DROP\\s+DATABASE",
  "action": "block",
  "message": "Blocked: DROP TABLE/DATABASE commands require manual execution"
}
```

---

## Prompt Rules

### Control Claude's Behavior

```json
{
  "name": "warn-yolo-mode",
  "enabled": true,
  "event": "prompt",
  "pattern": "\\byolo\\b|\\bship\\s*it\\b|\\bjust\\s*do\\s*it\\b",
  "action": "warn",
  "message": "Warning: YOLO mode detected. Proceeding with reduced safety checks."
}
```

```json
{
  "name": "block-ignore-errors",
  "enabled": true,
  "event": "prompt",
  "pattern": "ignore.*error|skip.*test|don't.*test|no.*test",
  "action": "warn",
  "message": "Warning: Request to skip error handling or tests detected"
}
```

---

## Allowlist Rules

Use `allow` action with high priority to whitelist specific patterns:

```json
{
  "name": "allow-test-console-log",
  "enabled": true,
  "event": "edit",
  "pattern": "\\.(test|spec)\\.(ts|js|tsx|jsx)$",
  "action": "allow",
  "priority": 100,
  "message": "Console.log allowed in test files"
}
```

```json
{
  "name": "allow-scripts-force",
  "enabled": true,
  "event": "bash",
  "pattern": "^scripts/.*--force",
  "action": "allow",
  "priority": 100,
  "message": "Force flag allowed in project scripts"
}
```

---

## Starter Pack

Copy this complete starter config to your `~/.claude/matrix/matrix.config`:

```json
{
  "hooks": {
    "userRules": {
      "enabled": true,
      "rules": [
        {
          "name": "block-rm-rf-root",
          "enabled": true,
          "event": "bash",
          "pattern": "rm\\s+(-[rfRF]+\\s+)*/(\\s|$)",
          "action": "block",
          "message": "Blocked: rm on root directory"
        },
        {
          "name": "block-force-push-main",
          "enabled": true,
          "event": "bash",
          "pattern": "git\\s+push.*--force.*main|git\\s+push.*-f.*main",
          "action": "block",
          "message": "Blocked: Force push to main"
        },
        {
          "name": "warn-console-log",
          "enabled": true,
          "event": "edit",
          "pattern": "console\\.(log|debug)\\(",
          "action": "warn",
          "message": "Warning: console.log detected"
        },
        {
          "name": "warn-todo",
          "enabled": true,
          "event": "edit",
          "pattern": "TODO|FIXME",
          "action": "warn",
          "message": "Warning: TODO/FIXME added"
        },
        {
          "name": "block-edit-env",
          "enabled": true,
          "event": "edit",
          "pattern": "\\.env$",
          "action": "block",
          "message": "Blocked: Don't edit .env directly"
        }
      ]
    }
  }
}
```

---

## Tips

1. **Test patterns first** — Use [regex101.com](https://regex101.com) to validate
2. **Start with `warn`** — Switch to `block` once confident
3. **Use `priority`** — Higher priority rules are checked first
4. **Allowlists override** — High-priority `allow` rules bypass lower `block`/`warn` rules
5. **Escape backslashes** — JSON needs `\\s` for regex `\s`

---

## Contributing

Have a useful rule? Submit a PR to add it to this collection.
