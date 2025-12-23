# Claude Matrix

#### NOT an official Anthropic tool

**Persistent memory for Claude Code** - Learn from past solutions, avoid repeated mistakes.

Supports **Claude Code** and **Cursor**.


https://github.com/user-attachments/assets/0e43c647-071d-4a7d-9de4-633fee5c5e34



## Getting Started

```bash
matrix follow the white rabbit
```

Interactive Matrix-themed onboarding that teaches you all the features. Navigate through portals, learn the tools, follow the rabbit.

## Why Matrix?

- **Recall solutions** - Search past implementations semantically
- **Learn from failures** - Record errors to prevent repeating them
- **Context aware** - Solutions boosted by repo/stack similarity
- **Automatic context injection** - Hooks inject relevant memories into prompts
- **Package auditing** - CVE and deprecation warnings before installing

## Screenshots

### Checking Matrix (matrix_recall)
<img width="1068" alt="Matrix recall in action" src="https://github.com/user-attachments/assets/bccbb0d2-f84d-4b92-b444-16a2acca24cc" />

### Rewarding Solutions (matrix_reward)
<img width="1582" alt="Matrix reward feedback" src="https://github.com/user-attachments/assets/5e818c6b-0652-42f6-8f0d-03579ac955cc" />

## Installation

### Quick Install (Recommended)

**macOS / Linux / WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/ojowwalker77/Claude-Matrix/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr https://raw.githubusercontent.com/ojowwalker77/Claude-Matrix/main/install.ps1 | iex
```

Auto-detects your OS, installs Bun if needed, and sets everything up.

### Homebrew (macOS)

```bash
brew tap ojowwalker77/matrix
brew install matrix
matrix init
```

### Manual (Git Clone)

```bash
git clone https://github.com/ojowwalker77/Claude-Matrix.git ~/.claude/matrix
cd ~/.claude/matrix && bun install
matrix init
```

The `init` command will prompt you to choose your editor:
- **Claude Code** - Registers MCP server, hooks, and configures `~/.claude/CLAUDE.md`
- **Cursor** - Configures `~/.cursor/mcp.json` and `~/.cursorrules`
- **Both** - Configures both editors (shared memory)

### Upgrading

```bash
# Check for updates
matrix upgrade --check

# Install updates (includes database migrations)
matrix upgrade
```

Matrix automatically checks for updates and notifies you when a new version is available.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `matrix_recall(query)` | Search for relevant solutions |
| `matrix_store(problem, solution, scope)` | Save a solution |
| `matrix_reward(solutionId, outcome)` | Give feedback (success/partial/failure) |
| `matrix_failure(errorType, message, fix)` | Record an error pattern |
| `matrix_status()` | Check memory stats |
| `matrix_warn_check(type, target)` | Check if file/package has warnings |
| `matrix_warn_add(type, target, reason)` | Add a warning |
| `matrix_warn_list()` | List all warnings |
| `matrix_warn_remove(id)` | Remove a warning |

## Hooks Integration

Matrix integrates with Claude Code hooks for automatic context injection and protection:

| Hook | Trigger | Action |
|------|---------|--------|
| **UserPromptSubmit** | User sends prompt | Estimates complexity, injects relevant memories if >= 5 |
| **PreToolUse:Bash** | Before package install | Audits for CVEs, deprecation, size warnings |
| **PreToolUse:Edit** | Before file edit | Checks for file warnings |
| **PostToolUse:Bash** | After package install | Logs installation for audit trail |
| **Stop** | Session ends | Prompts to store significant sessions |

### Package Auditor

When you install packages, Matrix automatically checks:
- **CVEs** via [OSV.dev](https://osv.dev)
- **Deprecation** status from npm registry
- **Bundle size** via Bundlephobia (npm)
- **Local warnings** from your Matrix database

### Warning System

Mark problematic files or packages:

```bash
# Add file warning (supports glob patterns)
matrix warn add file "src/legacy/*" --reason "Deprecated, do not modify"

# Add package warning
matrix warn add package lodash --ecosystem npm --reason "Use native methods instead"

# Block severity (stops Claude from proceeding)
matrix warn add file "config/secrets.ts" --reason "Contains credentials" --severity block

# List all warnings
matrix warn list
```

## CLI Commands

```bash
# Memory
matrix search "OAuth implementation"   # Search solutions
matrix list solutions                  # List all solutions
matrix list failures                   # List all failures
matrix edit <id>                       # Edit a solution/failure

# Warnings
matrix warn list                       # List warnings
matrix warn add <type> <target>        # Add warning
matrix warn remove <id>                # Remove warning

# Hooks
matrix hooks status                    # Check hook installation
matrix hooks install                   # Install/reinstall hooks
matrix hooks uninstall                 # Remove hooks

# Maintenance
matrix stats                           # Memory statistics
matrix export --format=json            # Export database
matrix merge                           # Dedupe similar solutions
matrix config                          # View/edit configuration
matrix upgrade                         # Check and install updates
matrix migrate                         # Run database migrations
```

## Configuration

```bash
# View all settings
matrix config list

# Change complexity threshold for memory injection
matrix config set hooks.complexityThreshold 7

# Disable deprecation warnings
matrix config set hooks.skipDeprecationWarnings true

# Set package size warning threshold (bytes)
matrix config set hooks.sizeWarningThreshold 1000000
```

## Privacy

- 100% local - no data leaves your machine
- No API calls for memory - embeddings computed locally
- Package auditing uses public APIs (OSV.dev, npm, Bundlephobia)
- Single SQLite file - easy to backup or delete

## Links

- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)
- [Architecture](docs/architecture.md)
- [CLI Reference](docs/cli.md)
- [Shell Completions](docs/shell-completions.md)

## Contributors

<!-- CONTRIBUTORS-START -->
<a href="https://github.com/CairoAC"><img src="https://github.com/CairoAC.png" width="50" height="50" alt="CairoAC"/></a>
<!-- CONTRIBUTORS-END -->

## License

MIT
