# Layers - 階層的マルチエージェントシステム

tmux + Claude Code CLI または agent-cli を活用した、ゲーム開発組織の階層構造を模倣した自律型マルチエージェントシステム。

## 概要

Layersは、14名のAIエージェントが階層的に連携してソフトウェア開発を行うシステムです。

```
COO（人間）
    │
    ▼
Producer（プロデューサー）
    │
    ▼
Director（ディレクター）
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
Lead Designer    Lead Programmer     QA Lead
    │                 │                 │
    ├───┐         ┌───┼───┬───┬───┐     ├───┐
    ▼   ▼         ▼   ▼   ▼   ▼   ▼     ▼   ▼
 D1  D2        PG1 PG2 PG3 PG4 PG5    T1  T2
```

## 必要環境

### 共通

- Git
- Node.js 20.x LTS 以上
- pnpm（推奨パッケージマネージャ）

### エージェントバックエンド（いずれかが必要）

| バックエンド | 必要なソフトウェア | 説明 |
|-------------|-------------------|------|
| agent-cli | agent-cli | Rust製スタンドアロンCLI。tmux不要。推奨。 |
| claude | Claude Code CLI + tmux | 従来のバックエンド。tmuxセッションを使用。 |

> **Note**: Windowsをご利用の場合は、WSL2（Windows Subsystem for Linux 2）環境が必要です。以下のコマンドはすべてWSL2のターミナル（Ubuntu等）で実行してください。

### Node.js のインストール

nvm（Node Version Manager）の利用を推奨します。

```bash
# nvm のインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# シェルの再読み込み
source ~/.bashrc  # または source ~/.zshrc

# Node.js 20.x LTS のインストール
nvm install 20
nvm use 20

# バージョン確認
node -v  # v20.x.x が表示されること
```

### pnpm のインストール

```bash
# npm でインストール
npm install -g pnpm

# または corepack で有効化（Node.js 16.13以降）
corepack enable pnpm

# バージョン確認
pnpm -v
```

### agent-cli のインストール（推奨バックエンド）

```bash
# ワンライナーインストール
curl -fsSL https://raw.githubusercontent.com/aquaxis/agent-cli/main/install.sh | sh

# または手動ビルド
git clone https://github.com/aquaxis/agent-cli.git
cd agent-cli
cargo install --path . --root "$HOME/.local"

# バージョン確認
agent-cli --version
```

agent-cliは以下の5つのAIバックエンドをサポートしています：

| 種類 | API | デフォルトモデル |
|------|-----|----------------|
| claude | Anthropic Claude (Messages, SSE) | `claude-opus-4-7` |
| codex | OpenAI Chat Completions (SSE) | `gpt-4.1` |
| ollama | Ollama `/api/chat` (NDJSON) | `glm-5.1:cloud` |
| opencode | OpenCode (ローカル/クラウド) | `claude-sonnet-4-5` |
| llama.cpp | OpenAI互換 `/v1/chat/completions` (SSE) | `default` |

### tmux のインストール（claude バックエンドを使用する場合）

```bash
# Linux（Debian/Ubuntu）
sudo apt update && sudo apt install -y tmux

# macOS（Homebrew）
brew install tmux

# バージョン確認（3.x 以上であること）
tmux -V
```

### Claude Code CLI のインストール（claude バックエンドを使用する場合）

```bash
# グローバルインストール
npm install -g @anthropic-ai/claude-code

# 認証（初回のみ・必須）
claude login

# バージョン確認
claude --version
```

## インストール

### ワンライナーインストール（推奨）

以下のコマンド1つで、リポジトリのクローンから前提条件のインストール、ビルドまですべて自動で行います。

```bash
curl -fsSL https://raw.githubusercontent.com/aquaxis/layers/main/install.sh | sh
```

インストール先はデフォルトでカレントディレクトリです。別のディレクトリにインストールする場合:

```bash
LAYERS_INSTALL_DIR=/path/to/dir curl -fsSL https://raw.githubusercontent.com/aquaxis/layers/main/install.sh | sh
```

### スクリプトによるインストール（ローカル実行）

すでにリポジトリをクローン済みの場合は、プロジェクトディレクトリ内でスクリプトを実行できます。

```bash
git clone https://github.com/aquaxis/layers.git
cd layers
chmod +x install.sh
./install.sh
```

## 使用方法

### エージェントバックエンドの選択

Layersは2つのエージェントバックエンドをサポートしています：

#### agent-cli バックエンド（推奨）

agent-cliを使用すると、tmuxなしでエージェントを実行できます。各エージェントは独立したプロセスとして動作し、Unixドメインソケット経由でIPC通信を行います。

```bash
# agent-cliバックエンドで全エージェントを起動
pnpm run start -- --backend agent-cli

# プロバイダーを指定して起動
pnpm run start -- --backend agent-cli --provider claude

# モデルを指定して起動
pnpm run start -- --backend agent-cli --provider ollama --model glm-5.1:cloud
```

#### claude バックエンド（従来）

tmux + Claude Code CLIを使用する従来のバックエンドです。

```bash
# claudeバックエンドで全エージェントを起動
pnpm run start -- --backend claude

# または（デフォルト）
pnpm run start
```

### システムの起動

```bash
# デフォルト（agent-cli）で起動
pnpm run start

# バックエンドを指定して起動
pnpm run start -- --backend agent-cli
pnpm run start -- --backend claude
```

### システムの停止

```bash
pnpm run stop
```

### ステータス確認

```bash
pnpm run status
```

### メッセージ送信

```bash
pnpm run send -- --to producer --type instruction --message "プロジェクトを開始してください"
```

オプション:

- `--to` : 送信先エージェント（必須）
- `--type` : メッセージタイプ（instruction, report, question, answer, status, error, complete）（必須）
- `--message` : メッセージ本文（必須）
- `--from` : 送信者名（デフォルト: coo）
- `--priority` : 優先度（low, normal, high, urgent）（デフォルト: normal）

### 監視モード

```bash
pnpm run monitor
```

### リアルタイム実行状況表示

```bash
pnpm run live
```

### layers コマンド

インストール後に `./layers` コマンドが利用可能になります。

```bash
./layers start --backend agent-cli   # agent-cliバックエンドで起動
./layers start --backend claude      # claudeバックエンドで起動
./layers stop                        # 全エージェントを停止
./layers status                      # ステータス確認
./layers send -- --to producer --type instruction --message "開始"
```

## エージェント設定

### agents.json

各エージェントの設定は `.layers/src/config/agents.json` で管理されます。

```json
{
  "sessionName": "producer",
  "role": "producer",
  "superior": null,
  "subordinates": ["director"],
  "promptFile": ".layers/prompts/producer.md",
  "permissionMode": "dangerouslySkip",
  "agentType": "agent-cli",
  "personaFile": ".layers/personas/producer.md",
  "provider": "claude",
  "model": "claude-opus-4-7",
  "autoApproveTools": true
}
```

#### 設定フィールド

| フィールド | 説明 | デフォルト |
|-----------|------|----------|
| `sessionName` | エージェントの識別名 | （必須） |
| `role` | エージェントの役割 | （必須） |
| `superior` | 上位エージェント名 | `null` |
| `subordinates` | 部下エージェント名のリスト | `[]` |
| `promptFile` | プロンプトファイルパス（claude バックエンド用） | （必須） |
| `permissionMode` | Claude Codeのパーミションモード | `"dangerouslySkip"` |
| `agentType` | エージェントタイプ: `"agent-cli"` または `"claude"` | `"agent-cli"` |
| `personaFile` | ペルソナファイルパス（agent-cli バックエンド用） | （自動生成） |
| `provider` | AIプロバイダー: `claude`, `codex`, `ollama`, `opencode`, `llama.cpp` | `"claude"` |
| `model` | モデル名（プロバイダーデフォルトを上書き） | プロバイダーデフォルト |
| `autoApproveTools` | ツール実行の自動承認 | `true` |

### ペルソナファイル

agent-cliバックエンドでは、各エージェントはYAMLフロントマター付きMarkdownファイル（ペルソナファイル）で設定されます。

```markdown
---
name: producer
role: Producer
skills:
  - Project management
  - Multi-agent coordination
  - Task delegation
allowed_tools:
  - shell
  - fs_read
  - fs_write
  - send_to
---

# You are the Producer Agent

...（エージェントの指示内容）
```

ペルソナファイルは `.layers/personas/` ディレクトリに配置されます。各ロールごとに英語版と日本語版があります：

- `producer.md`, `producer_ja.md`
- `director.md`, `director_ja.md`
- `lead_design.md`, `lead_design_ja.md`
- `lead_prog.md`, `lead_prog_ja.md`
- `lead_qa.md`, `lead_qa_ja.md`
- `designer.md`, `designer_ja.md`
- `programmer.md`, `programmer_ja.md`
- `tester.md`, `tester_ja.md`

### agent-cli 設定ファイル

agent-cliバックエンド使用時、共有設定ファイルが `.layers/agent-cli.toml` に生成されます：

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

## エージェント間通信

### agent-cli バックエンド

agent-cliバックエンドでは、エージェント間の通信に `send_to` ツールを使用します：

```
> /send director "指示内容"
```

各エージェントは共通の `registry_dir` を通じて他のエージェントを発見し、IPCソケット経由でメッセージを送受信します。

### claude バックエンド

claudeバックエンドでは、エージェント間の通信に tmux send-keys を使用します：

```bash
# メッセージ送信
tmux send-keys -t "director" 'メッセージ'

# Enter送信（別のbash実行で）
tmux send-keys -t "director" Enter
```

## エージェント構成

| 部門 | 役職 | セッション名 | 人数 |
|------|------|--------------|------|
| 統括 | プロデューサー | producer | 1 |
| 統括 | ディレクター | director | 1 |
| デザイン | リードデザイナー | lead_design | 1 |
| デザイン | デザイナー | designer_1, designer_2 | 2 |
| プログラム | リードプログラマー | lead_prog | 1 |
| プログラム | プログラマー | programmer_1〜5 | 5 |
| QA | QAリード | lead_qa | 1 |
| QA | テスター | tester_1, tester_2 | 2 |
| **合計** | | | **14** |

## ディレクトリ構造

```
layers/
├── .layers/                   # Layers固有コンテンツ統合ディレクトリ
│   ├── src/                   # TypeScriptソースコード
│   │   ├── index.ts           # CLIエントリーポイント
│   │   ├── agents/            # エージェント管理
│   │   │   ├── AgentManager.ts
│   │   │   ├── AgentCliController.ts  # agent-cli プロセス管理
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── communication/     # メッセージング
│   │   │   ├── MessageBroker.ts
│   │   │   ├── TmuxTransport.ts
│   │   │   ├── AgentCliTransport.ts   # agent-cli IPC通信
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tmux/              # tmux操作
│   │   │   ├── TmuxController.ts
│   │   │   ├── ShellExecutor.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── monitoring/        # 監視・ログ
│   │   │   ├── Monitor.ts
│   │   │   ├── LiveView.ts
│   │   │   ├── Logger.ts
│   │   │   └── index.ts
│   │   └── config/
│   │       └── agents.json    # エージェント設定
│   ├── dist/                  # ビルド成果物（自動生成）
│   ├── prompts/               # Claude Code用プロンプト
│   │   ├── producer.md
│   │   ├── director.md
│   │   ├── lead_design.md
│   │   ├── lead_prog.md
│   │   ├── lead_qa.md
│   │   ├── designer.md
│   │   ├── programmer.md
│   │   ├── tester.md
│   │   └── *_ja.md           # 日本語版
│   ├── personas/              # agent-cli用ペルソナ
│   │   ├── producer.md
│   │   ├── director.md
│   │   ├── lead_design.md
│   │   ├── lead_prog.md
│   │   ├── lead_qa.md
│   │   ├── designer.md
│   │   ├── programmer.md
│   │   ├── tester.md
│   │   └── *_ja.md           # 日本語版
│   ├── logs/                  # エージェント作業ログ（自動生成）
│   └── agent-cli.toml         # agent-cli設定（自動生成）
├── logs/                      # システムログファイル
├── package.json
├── tsconfig.json
├── pnpm-lock.yaml
├── install.sh                 # インストールスクリプト
├── layers                     # 便利コマンドスクリプト
└── README.md
```

## トラブルシューティング

### セッションが起動しない

**agent-cli バックエンドの場合:**

```bash
# agent-cliの確認
agent-cli --version

# レジストリの確認
agent-cli list

# 設定の確認
agent-cli doctor
```

**claude バックエンドの場合:**

```bash
# tmuxの確認
tmux -V

# セッションの確認
tmux ls

# Claude Codeの確認
claude --version
```

### メッセージが届かない

**agent-cli バックエンドの場合:**

```bash
# 起動中のエージェント一覧
agent-cli list

# 特定エージェントの確認
agent-cli send <peer> "ping"
```

**claude バックエンドの場合:**

```bash
# セッションの確認
tmux ls

# 特定セッションの内容確認
tmux capture-pane -t producer -p
```

### エージェントが応答しない

**agent-cli バックエンドの場合:**

```bash
# エージェントの再起動
pnpm run stop
pnpm run start -- --backend agent-cli
```

**claude バックエンドの場合:**

```bash
# セッションの再起動
tmux kill-session -t <session_name>
pnpm run start -- --backend claude
```

### ビルドエラー

```bash
# node_modulesを再インストール
rm -rf node_modules
pnpm install

# ビルド
pnpm run build
```

## 技術的な制約

### Claude Codeのbash実行制約

Claude Codeがbashコマンドを実行する際、`;`や`&&`で連結された複数コマンドの後半が実行されない場合があります。

**対策**: エージェントプロンプトでは、メッセージ送信とEnter送信を別々のbashコマンドブロックとして実行するよう指示しています。

### agent-cli バックエンドの制約

- 各エージェントは独立したプロセスとして動作するため、システムリソースの消費に注意してください
- `max_tool_iterations`（デフォルト24）に達すると、ツール呼び出しループが停止します。長時間の自律動作が必要な場合は、`.layers/agent-cli.toml`で値を増やしてください
- レジストリディレクトリ（`.layers/registry/`）は自動管理されます。手動で編集しないでください

## 注意事項

- 14エージェント同時稼働は大量のAPI呼び出しを発生させます
- 必要なエージェントのみを稼働させることを推奨します
- `--dangerously-skip-permissions`（claudeバックエンド）および`auto_approve_tools = true`（agent-cliバックエンド）の使用は本番環境では非推奨です
- Anthropic APIには5時間あたりの利用制限があります
- agent-cliバックエンドはtmux不要で動作しますが、各エージェントが独立したプロセスとなるため、システムリソースに余裕があることを確認してください

## ライセンス

MIT