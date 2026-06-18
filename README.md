# Layers - Hierarchical Multi-Agent System

A hierarchical multi-agent system for game/software development organization structure, using tmux + Claude Code CLI or agent-cli.

```
COO (Human)
    │
    ▼
Producer
    │
    ▼
Director
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
Lead Designer    Lead Programmer     QA Lead
    │                 │                 │
    ├───┐         ┌───┼───┬───┬───┐     ├───┐
    ▼   ▼         ▼   ▼   ▼   ▼   ▼     ▼   ▼
 D1  D2        PG1 PG2 PG3 PG4 PG5    T1  T2
```

## Features

- **Dual backend support**: Run agents with Claude Code CLI (tmux) or agent-cli (standalone processes)
- **14 hierarchical AI agents** collaborating in a development organization structure
- **Inter-agent communication**: tmux send-keys (Claude CLI) or send_to tool (agent-cli)
- **Real-time monitoring**: Dashboard view of all agent statuses
- **Automatic dependency installation**: Node.js, pnpm, tmux, and optionally agent-cli

## Prerequisites

### Common

- Git
- Node.js 20.x LTS or later
- pnpm (recommended package manager)

### For Claude Code CLI backend

- tmux 3.x or later
- Claude Code CLI (`claude` command)
- Claude Max/Pro subscription or Anthropic API Key

### For agent-cli backend

- agent-cli (installed automatically or manually via `install.sh`)
- Anthropic API Key (for Claude backend), or local Ollama (for Ollama backend)

> **Note**: On Windows, use WSL2 (Windows Subsystem for Linux 2). tmux and agent-cli require a Unix-like environment.

### Node.js Installation

We recommend using nvm (Node Version Manager).

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Reload shell
source ~/.bashrc  # or source ~/.zshrc

# Install Node.js 20.x LTS
nvm install 20
nvm use 20

# Verify
node -v  # Should show v20.x.x
```

### pnpm Installation

```bash
# Install via npm
npm install -g pnpm

# Or enable via corepack (Node.js 16.13+)
corepack enable pnpm

# Verify
pnpm -v
```

### tmux Installation (Claude CLI backend only)

```bash
# Linux (Debian/Ubuntu)
sudo apt update && sudo apt install -y tmux

# macOS (Homebrew)
brew install tmux

# Verify (3.x or later required)
tmux -V
```

### agent-cli Installation

agent-cli can be installed via the Layers install script (recommended) or manually:

```bash
# One-liner install (recommended)
curl -fsSL https://raw.githubusercontent.com/aquaxis/agent-cli/main/install.sh | sh

# Or build from source
git clone https://github.com/aquaxis/agent-cli.git
cd agent-cli
cargo install --path . --root "$HOME/.local"
```

See the [agent-cli documentation](https://github.com/aquaxis/agent-cli) for more details on configuration and backends (Claude, Codex, Ollama, OpenCode, llama.cpp).

## Installation

### One-liner install (recommended)

This clones the repository into the current directory and sets up everything automatically:

```bash
curl -fsSL https://raw.githubusercontent.com/aquaxis/layers/main/install.sh | sh
```

To install in a specific directory:

```bash
LAYERS_INSTALL_DIR=/path/to/dir curl -fsSL https://raw.githubusercontent.com/aquaxis/layers/main/install.sh | sh
```

### Local script install

If you have already cloned the repository:

```bash
git clone https://github.com/aquaxis/layers.git
cd layers
chmod +x install.sh
./install.sh
```

### What the install script does

- OS detection (Linux / macOS)
- Checks and installs Node.js, pnpm, tmux, and agent-cli as needed
- Clones the repository (one-liner mode only)
- Runs `pnpm install` and `pnpm run build`
- Runs health checks
- Provides guidance for Claude Code CLI if not installed

### Manual install

```bash
# 1. Clone the repository
git clone https://github.com/aquaxis/layers.git
cd layers

# 2. Install dependencies
pnpm install

# 3. Build
pnpm run build

# 4. Verify
pnpm run status
```

### Health check checklist

After installation, verify the following:

```bash
# Required tools
node -v          # v20.x.x
pnpm -v          # Version displayed

# Claude CLI backend only
tmux -V          # tmux 3.x
claude --version # Version displayed

# agent-cli backend only
agent-cli --version  # Version displayed

# Build verification
pnpm run build   # Completes without errors

# Status check
pnpm run status
```

## Build

```bash
# TypeScript build
pnpm run build

# Lint
pnpm run lint

# Test
pnpm run test
```

## Usage

### Starting the system

#### Claude Code CLI backend (default)

```bash
pnpm run start
# or explicitly:
pnpm run start -- --backend claude
```

All 14 agents start as tmux sessions running `claude` with system prompts.

#### agent-cli backend

```bash
pnpm run start -- --backend agent-cli
```

All 14 agents start as agent-cli processes using persona files for configuration.

#### Specifying a provider (agent-cli backend only)

```bash
# Use Claude (default)
pnpm run start -- --backend agent-cli --provider claude

# Use Ollama
pnpm run start -- --backend agent-cli --provider ollama

# Use Codex (OpenAI)
pnpm run start -- --backend agent-cli --provider codex

# Use a custom model
pnpm run start -- --backend agent-cli --provider claude --model claude-opus-4-7
```

### Stopping the system

```bash
pnpm run stop
# or with explicit backend:
pnpm run stop -- --backend agent-cli
```

### Status check

```bash
pnpm run status
```

### Sending messages

```bash
pnpm run send -- --to producer --type instruction --message "Start the project"
```

Options:

- `--to` : Target agent (required)
- `--type` : Message type (instruction, report, question, answer, status, error, complete) (required)
- `--message` : Message body (required)
- `--from` : Sender name (default: coo)
- `--priority` : Priority (low, normal, high, urgent) (default: normal)

### Monitoring

```bash
pnpm run monitor
```

Background agent health monitoring. Abnormal detections are logged. Press Ctrl+C to stop.

### Real-time dashboard

```bash
pnpm run live
```

Displays a real-time dashboard of all 14 agents with status and latest activity.

Options:

- `--interval <ms>` : Update interval in milliseconds (default: 3000)

```bash
# 5-second interval
pnpm run live -- --interval 5000
```

Press Ctrl+C to stop.

### Connecting to an agent (Claude CLI backend)

```bash
# Connect to producer
tmux attach -t producer

# Detach from session: Ctrl+b d
```

### Session list (Claude CLI backend)

```bash
tmux ls
```

### Convenience script

The `layers` script provides quick access to common operations:

```bash
./layers              # Start monitor mode
./layers start        # Start all agents (Claude CLI backend)
./layers start agent-cli  # Start all agents (agent-cli backend)
./layers stop         # Stop all agents
./layers send         # Send a message
./layers status       # Show agent status
```

## Agent Configuration

### Agent definition

Agents are configured in `.layers/src/config/agents.json`:

```json
{
  "agents": [
    {
      "sessionName": "producer",
      "role": "producer",
      "superior": null,
      "subordinates": ["director"],
      "promptFile": ".layers/prompts/producer.md",
      "permissionMode": "dangerouslySkip",
      "backend": "agent-cli",
      "provider": "claude",
      "model": "claude-opus-4-7"
    }
  ]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sessionName` | string | required | Agent identifier and process/session name |
| `role` | string | required | Agent role (producer, director, lead_design, etc.) |
| `superior` | string \| null | required | Superior agent name |
| `subordinates` | string[] | required | List of subordinate agent names |
| `promptFile` | string | required | Path to prompt file (Claude CLI) or persona file (agent-cli) |
| `permissionMode` | string | "dangerouslySkip" | Permission mode for Claude CLI |
| `backend` | string | "agent-cli" | Backend: "claude" or "agent-cli" |
| `provider` | string | "claude" | AI provider for agent-cli (claude, codex, ollama, opencode, llama.cpp) |
| `model` | string | undefined | Model override for agent-cli |
| `personaFile` | string | auto | Path to agent-cli persona file (auto-generated if not set) |
| `autoApproveTools` | boolean | true | Auto-approve tool usage in agent-cli |

### Backend comparison

| Feature | Claude CLI (`claude`) | agent-cli |
|---------|----------------------|-----------|
| Process model | tmux sessions | Standalone processes |
| Communication | `tmux send-keys` | `send_to` tool (IPC) |
| Configuration | `--system-prompt-file` | Persona files (YAML + Markdown) |
| Dependencies | tmux, Claude CLI | agent-cli binary |
| Backends | Anthropic only | Claude, Codex, Ollama, OpenCode, llama.cpp |
| Message format | JSON in tmux | Built-in IPC |

### Persona files

For the agent-cli backend, persona files are stored in `.layers/personas/`. Each persona file uses YAML frontmatter + Markdown body format:

```markdown
---
name: producer
role: Producer - Overall project oversight
skills:
  - Project management
  - Budget and schedule control
  - Multi-agent coordination
allowed_tools:
  - shell
  - fs_read
  - fs_write
  - send_to
---

# You are the Producer Agent

[Agent instructions...]
```

Persona files are auto-generated from prompt files if not present. You can also create custom persona files manually.

### agent-cli configuration

A shared configuration file is generated at `.layers/agent-cli.toml`:

```toml
[provider]
kind = "claude"

[provider.claude]
api_key_env = "ANTHROPIC_API_KEY"
model = "claude-opus-4-7"

[runtime]
registry_dir = ".layers/registry"
agents_dir = ".layers/personas"
auto_approve_tools = true
max_tool_iterations = 48

[tools]
enabled = ["shell", "fs_read", "fs_write", "send_to"]
```

## Agent Structure

| Department | Role | Session Name | Count |
|------------|------|-------------|-------|
| Executive | Producer | producer | 1 |
| Executive | Director | director | 1 |
| Design | Lead Designer | lead_design | 1 |
| Design | Designer | designer_1, designer_2 | 2 |
| Programming | Lead Programmer | lead_prog | 1 |
| Programming | Programmer | programmer_1〜5 | 5 |
| QA | QA Lead | lead_qa | 1 |
| QA | Tester | tester_1, tester_2 | 2 |
| **Total** | | | **14** |

## Directory Structure

```
layers/
├── .layers/                   # Layers content directory
│   ├── src/                   # TypeScript source code
│   │   ├── index.ts           # CLI entry point
│   │   ├── agents/            # Agent management
│   │   │   ├── AgentManager.ts
│   │   │   ├── AgentCliController.ts  # agent-cli process management
│   │   │   ├── types.ts       # Includes BackendType
│   │   │   └── index.ts
│   │   ├── communication/     # Messaging
│   │   │   ├── MessageBroker.ts
│   │   │   ├── TmuxTransport.ts
│   │   │   ├── AgentCliTransport.ts    # agent-cli IPC transport
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tmux/              # tmux operations
│   │   │   ├── TmuxController.ts
│   │   │   ├── ShellExecutor.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── monitoring/        # Monitoring & logging
│   │   │   ├── Monitor.ts
│   │   │   ├── LiveView.ts
│   │   │   ├── Logger.ts
│   │   │   └── index.ts
│   │   └── config/
│   │       └── agents.json    # Agent configuration
│   ├── dist/                  # Build output (auto-generated)
│   ├── prompts/               # Claude CLI prompt files
│   │   ├── producer.md
│   │   ├── director.md
│   │   ├── lead_design.md
│   │   ├── lead_prog.md
│   │   ├── lead_qa.md
│   │   ├── designer.md
│   │   ├── programmer.md
│   │   ├── tester.md
│   │   └── *_ja.md           # Japanese versions
│   ├── personas/              # agent-cli persona files
│   │   ├── producer.md
│   │   ├── director.md
│   │   ├── lead_design.md
│   │   ├── lead_prog.md
│   │   ├── lead_qa.md
│   │   ├── designer.md
│   │   ├── programmer.md
│   │   ├── tester.md
│   │   └── *_ja.md           # Japanese versions
│   ├── logs/                  # Agent work logs (auto-generated)
│   ├── registry/              # agent-cli IPC registry (auto-generated)
│   └── agent-cli.toml         # agent-cli configuration (auto-generated)
├── logs/                      # System log files
├── package.json
├── tsconfig.json
├── pnpm-lock.yaml
├── install.sh                 # Setup script
├── layers                     # Convenience command script
├── README.md
└── README_ja.md
```

## Configuration Files

### agents.json

Each agent's configuration is managed in `.layers/src/config/agents.json`.

```json
{
  "sessionName": "producer",
  "role": "producer",
  "superior": null,
  "subordinates": ["director"],
  "promptFile": ".layers/prompts/producer.md",
  "permissionMode": "dangerouslySkip",
  "backend": "agent-cli",
  "provider": "claude",
  "model": "claude-opus-4-7"
}
```

### agent-cli.toml

Shared configuration for all agent-cli instances. Auto-generated on first start.

```toml
[provider]
kind = "claude"

[provider.claude]
api_key_env = "ANTHROPIC_API_KEY"

[runtime]
registry_dir = ".layers/registry"
agents_dir = ".layers/personas"
auto_approve_tools = true

[tools]
enabled = ["shell", "fs_read", "fs_write", "send_to"]
```

### Agent prompts (Claude CLI backend)

Agent behavioral guidelines are defined in `.layers/prompts/*.md` Markdown files.

### Agent personas (agent-cli backend)

Agent behavioral guidelines are defined in `.layers/personas/*.md` using YAML frontmatter + Markdown body format. Persona files use `send_to` for inter-agent communication instead of `tmux send-keys`.

## Troubleshooting

### Sessions won't start (Claude CLI backend)

```bash
# Check tmux
tmux -V

# Check Claude Code
claude --version

# Check pnpm
pnpm --version
```

### Processes won't start (agent-cli backend)

```bash
# Check agent-cli
agent-cli --version

# List running peers
agent-cli list

# Check configuration
agent-cli doctor
```

### Messages not delivered (Claude CLI backend)

```bash
# Check sessions
tmux ls

# Check specific session content
tmux capture-pane -t producer -p
```

### Messages not delivered (agent-cli backend)

```bash
# List registered agents
agent-cli list

# Check agent status
agent-cli doctor
```

### Agent not responding

```bash
# Claude CLI: Restart sessions
tmux kill-session -t <session_name>
pnpm run start

# agent-cli: Restart processes
pnpm run stop -- --backend agent-cli
pnpm run start -- --backend agent-cli
```

### Build errors

```bash
# Reinstall node_modules
rm -rf node_modules
pnpm install

# Build
pnpm run build
```

## Technical Notes

### Claude Code bash execution constraints

When Claude Code executes bash commands, the latter half of multi-command sequences joined with `;` or `&&` may not execute.

**Workaround**: Agent prompts instruct sending messages and Enter as separate bash command blocks.

### agent-cli communication model

agent-cli uses Unix-domain socket IPC for inter-agent messaging via the `send_to` tool. Persona files instruct agents to use `send_to` for all inter-agent communication, replacing the `tmux send-keys` approach used in Claude CLI mode.

### Context limits

- 14 simultaneous agents generate significant API calls
- Consider running only needed agents
- `--dangerously-skip-permissions` is not recommended for production (Claude CLI)
- `auto_approve_tools = true` should be used cautiously in production (agent-cli)
- Anthropic API has 5-hour usage limits

## License

MIT