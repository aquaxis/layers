# Layers - 階層的マルチエージェントシステム

tmux + Claude Code CLIを活用した、ゲーム開発組織の階層構造を模倣した自律型マルチエージェントシステム。

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

- Node.js 20.x LTS 以上
- pnpm（推奨パッケージマネージャ）
- tmux 3.x 以上
- Claude Code CLI（`claude`コマンド）
- Claude Max/Pro サブスクリプション または Anthropic API Key

### pnpmのインストール

```bash
# npmでインストール
npm install -g pnpm

# または corepack で有効化
corepack enable pnpm
```

## インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd layers

# 依存パッケージのインストール
pnpm install
```

## ビルド

```bash
# TypeScriptのビルド
pnpm run build

# リント
pnpm run lint

# テスト
pnpm run test
```

## 使用方法

### システムの起動

```bash
pnpm run start
```

全14エージェントがtmuxセッションとして起動します。

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

リアルタイムでエージェントの状態を監視します。Ctrl+Cで終了。

### エージェントへの接続

```bash
# プロデューサーに接続
tmux attach -t producer

# ディレクターに接続
tmux attach -t director

# セッションからデタッチ: Ctrl+b d
```

### セッション一覧

```bash
tmux ls
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
├── src/
│   ├── index.ts              # CLIエントリーポイント
│   ├── agents/               # エージェント管理
│   │   ├── AgentManager.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── communication/        # メッセージング
│   │   ├── MessageBroker.ts
│   │   ├── TmuxTransport.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── tmux/                 # tmux操作
│   │   ├── TmuxController.ts
│   │   ├── ShellExecutor.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── monitoring/           # 監視・ログ
│   │   ├── Monitor.ts
│   │   ├── Logger.ts
│   │   └── index.ts
│   └── config/
│       └── agents.json       # エージェント設定
├── .layers/
│   └── prompts/              # エージェントプロンプト
│       ├── producer.md
│       ├── director.md
│       ├── lead_design.md
│       ├── lead_prog.md
│       ├── lead_qa.md
│       ├── designer.md
│       ├── programmer.md
│       └── tester.md
├── dist/                     # ビルド成果物
├── logs/                     # ログファイル
├── package.json
├── tsconfig.json
├── pnpm-lock.yaml
└── README.md
```

## 設定ファイル

### agents.json

各エージェントの設定は `src/config/agents.json` で管理されます。

```json
{
  "sessionName": "producer",
  "role": "producer",
  "superior": null,
  "subordinates": ["director"],
  "promptFile": ".layers/prompts/producer.md",
  "permissionMode": "dangerouslySkip"
}
```

### エージェントプロンプト

各エージェントの行動指針は `.layers/prompts/` 配下のMarkdownファイルで定義されています。

## トラブルシューティング

### セッションが起動しない

```bash
# tmuxの確認
tmux -V

# Claude Codeの確認
claude --version

# pnpmの確認
pnpm --version
```

### メッセージが届かない

```bash
# セッションの確認
tmux ls

# 特定セッションの内容確認
tmux capture-pane -t producer -p
```

### エージェントが応答しない

```bash
# セッションの再起動
tmux kill-session -t <session_name>
pnpm run start
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

```bash
# コマンド1: メッセージ送信
tmux send-keys -t "target" 'メッセージ'
```

```bash
# コマンド2: Enter送信（必ず別のbash実行で）
tmux send-keys -t "target" Enter
```

## 注意事項

- 14エージェント同時稼働は大量のAPI呼び出しを発生させます
- 必要なエージェントのみを稼働させることを推奨します
- `--dangerously-skip-permissions`の使用は本番環境では非推奨です
- Anthropic APIには5時間あたりの利用制限があります

## ライセンス

MIT
