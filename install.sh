#!/usr/bin/env bash
set -e

# =============================================================================
# Layers - インストールスクリプト
# マルチエージェントシステムの前提条件チェックとプロジェクトセットアップを自動化
#
# 使用方法:
#   curl -fsSL https://raw.githubusercontent.com/aquaxis/layers/main/install.sh | sh
#
#   既存プロジェクトディレクトリ内で実行する場合（上書きインストール）:
#     bash install.sh
# =============================================================================

# 設定
REPO_URL="https://github.com/aquaxis/layers.git"
INSTALL_DIR="${LAYERS_INSTALL_DIR:-$(pwd)}"

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# メッセージ関数
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "============================================="
echo "  Layers - インストールスクリプト"
echo "============================================="
echo ""

# -------------------------------------------------------------------------
# 1. 実行モード判定
# -------------------------------------------------------------------------
EXEC_MODE="pipe"
PROJECT_DIR=""

if [ -f "package.json" ] && grep -q '"name": "layers"' package.json 2>/dev/null; then
  # カレントディレクトリがLayersプロジェクト
  EXEC_MODE="local"
  PROJECT_DIR="$(pwd)"
elif [ -f "$(cd "$(dirname "$0")" 2>/dev/null && pwd)/package.json" ] 2>/dev/null && \
     grep -q '"name": "layers"' "$(cd "$(dirname "$0")" 2>/dev/null && pwd)/package.json" 2>/dev/null; then
  # スクリプトファイルの場所がLayersプロジェクト
  EXEC_MODE="local"
  PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
else
  # パイプ実行またはプロジェクト外からの実行
  EXEC_MODE="pipe"
fi

if [ "$EXEC_MODE" = "local" ]; then
  warn "既存のLayersプロジェクトディレクトリで実行されています: $PROJECT_DIR"
  info "上書きインストール（アップデート）モードで続行します。"

  # Git pull to update source code
  cd "$PROJECT_DIR" || { error "ディレクトリに移動できません: $PROJECT_DIR"; exit 1; }
  if [ -d "$PROJECT_DIR/.git" ]; then
    info "ローカル変更をリセットしています..."
    git checkout . 2>/dev/null || true
    git clean -fd 2>/dev/null || true
    info "リポジトリを更新しています（git pull）..."
    git pull || {
      warn "git pull に失敗しました。既存のコードをそのまま使用します。"
    }
    success "リポジトリの更新が完了しました"
  else
    warn ".gitディレクトリが見つかりません。ソースコードの更新をスキップします。"
  fi
  echo ""
else
  info "実行モード: リモート（リポジトリをクローンします）"
fi

# -------------------------------------------------------------------------
# 2. OS検出
# -------------------------------------------------------------------------
detect_os() {
  case "$(uname -s)" in
    Linux*)  OS="linux" ;;
    Darwin*) OS="macos" ;;
    *)
      error "未対応のOSです: $(uname -s)"
      error "Layersは Linux および macOS のみ対応しています。"
      error "Windowsをご利用の場合は WSL2 環境で実行してください。"
      exit 1
      ;;
  esac
  success "OS検出: $OS"
}

detect_os

# -------------------------------------------------------------------------
# 3. Git確認
# -------------------------------------------------------------------------
info "Git の確認..."
if command -v git &> /dev/null; then
  success "Git: $(git --version)"
else
  error "Git がインストールされていません。"
  if [ "$OS" = "linux" ]; then
    echo "  インストール方法: sudo apt install -y git"
  elif [ "$OS" = "macos" ]; then
    echo "  インストール方法: xcode-select --install"
  fi
  exit 1
fi

# -------------------------------------------------------------------------
# 4. リポジトリクローン（パイプ実行時のみ）
# -------------------------------------------------------------------------

# Layersリポジトリかどうかを検証する関数
is_layers_repo() {
  local dir="$1"
  if [ ! -d "$dir/.git" ]; then
    return 1
  fi
  local remote_url
  remote_url=$(cd "$dir" && git remote get-url origin 2>/dev/null || echo "")
  case "$remote_url" in
    *aquaxis/layers* | *layers.git)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# インストール先にLayersをクローンまたは更新する関数
# 非空ディレクトリの場合は一時ディレクトリ経由でファイルをコピー（既存ファイルは保持）
clone_to_subdir() {
  info "Layersを $INSTALL_DIR にインストールします..."
  if [ -d "$INSTALL_DIR/.git" ] && is_layers_repo "$INSTALL_DIR"; then
    # 既存のLayersリポジトリがある場合は更新
    info "既存のLayersリポジトリを更新しています: $INSTALL_DIR"
    cd "$INSTALL_DIR" || { error "ディレクトリに移動できません: $INSTALL_DIR"; exit 1; }
    git pull || {
      warn "git pull に失敗しました。既存のリポジトリをそのまま使用します。"
    }
  else
    # ディレクトリが空でない、または別のGitリポジトリの場合は
    # 一時ディレクトリにクローンしてからファイルをコピー（既存ファイルは保持）
    local tmp_dir
    tmp_dir=$(mktemp -d)
    info "一時ディレクトリにクローンしています: $tmp_dir"
    git clone "$REPO_URL" "$tmp_dir" || {
      error "リポジトリのクローンに失敗しました。"
      error "URL: $REPO_URL"
      error "ネットワーク接続とURLを確認してください。"
      rm -rf "$tmp_dir"
      exit 1
    }
    mkdir -p "$INSTALL_DIR"
    info "ファイルを $INSTALL_DIR にコピーしています（既存ファイルは保持）..."
    # .gitはコピーしない（インストール完了後に.gitを削除する方針のため）
    rm -rf "$tmp_dir/.git"
    shopt -s dotglob
    cp -rn "$tmp_dir"/* "$INSTALL_DIR/" 2>/dev/null || true
    shopt -u dotglob
    rm -rf "$tmp_dir"
    success "インストール完了: $INSTALL_DIR"
  fi
}

if [ "$EXEC_MODE" = "pipe" ]; then
  echo ""
  info "リポジトリのセットアップ..."

  if [ -d "$INSTALL_DIR/.git" ]; then
    if is_layers_repo "$INSTALL_DIR"; then
      # LayersのGitリポジトリの場合は更新
      info "既存のLayersリポジトリを更新しています: $INSTALL_DIR"
      cd "$INSTALL_DIR" || { error "ディレクトリに移動できません: $INSTALL_DIR"; exit 1; }
      git pull || {
        warn "git pull に失敗しました。既存のリポジトリをそのまま使用します。"
      }
    else
      # Layers以外のGitリポジトリの場合は一時ディレクトリ経由でインストール
      warn "カレントディレクトリは別のGitリポジトリです。既存リポジトリを保護します。"
      clone_to_subdir
    fi
  elif [ -z "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    # 空ディレクトリまたは存在しないディレクトリの場合はクローン
    info "リポジトリをクローンしています: $INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR" || {
      error "リポジトリのクローンに失敗しました。"
      error "URL: $REPO_URL"
      error "ネットワーク接続とURLを確認してください。"
      exit 1
    }
    success "クローン完了: $INSTALL_DIR"
  else
    # 非空ディレクトリだがGitリポジトリでない場合は一時ディレクトリ経由でインストール
    warn "カレントディレクトリは空ではありません。既存ファイルを保護します。"
    clone_to_subdir
  fi

  PROJECT_DIR="$INSTALL_DIR"
fi

# -------------------------------------------------------------------------
# 5. Node.js (nvm経由)
# -------------------------------------------------------------------------
install_node() {
  info "Node.js の確認..."

  # nvm の読み込み（既にインストール済みの場合）
  export NVM_DIR="${HOME}/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
  fi

  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -ge 20 ]; then
      success "Node.js: $NODE_VERSION (要件を満たしています)"
      return
    else
      warn "Node.js $NODE_VERSION がインストールされていますが、v20.x 以上が必要です。"
    fi
  else
    info "Node.js が見つかりません。nvm 経由でインストールします。"
  fi

  # nvm のインストール（未インストールの場合）
  if ! command -v nvm &> /dev/null; then
    info "nvm をインストールしています..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

    # nvm を読み込み
    export NVM_DIR="${HOME}/.nvm"
    . "$NVM_DIR/nvm.sh"

    if ! command -v nvm &> /dev/null; then
      error "nvm のインストールに失敗しました。"
      exit 1
    fi
    success "nvm をインストールしました。"
  fi

  # Node.js 20 のインストール
  info "Node.js 20 をインストールしています..."
  nvm install 20
  nvm use 20
  success "Node.js: $(node -v)"
}

install_node

# -------------------------------------------------------------------------
# 6. pnpm
# -------------------------------------------------------------------------
install_pnpm() {
  info "pnpm の確認..."

  if command -v pnpm &> /dev/null; then
    success "pnpm: $(pnpm -v)"
    return
  fi

  info "pnpm をインストールしています..."
  npm install -g pnpm

  if command -v pnpm &> /dev/null; then
    success "pnpm: $(pnpm -v)"
  else
    error "pnpm のインストールに失敗しました。"
    exit 1
  fi
}

install_pnpm

# -------------------------------------------------------------------------
# 7. tmux
# -------------------------------------------------------------------------
install_tmux() {
  info "tmux の確認..."

  if command -v tmux &> /dev/null; then
    success "tmux: $(tmux -V)"
    return
  fi

  info "tmux をインストールしています..."

  if [ "$OS" = "linux" ]; then
    if command -v apt-get &> /dev/null; then
      sudo apt-get update && sudo apt-get install -y tmux
    else
      error "apt-get が見つかりません。手動で tmux をインストールしてください。"
      exit 1
    fi
  elif [ "$OS" = "macos" ]; then
    if command -v brew &> /dev/null; then
      brew install tmux
    else
      error "Homebrew がインストールされていません。"
      echo "  Homebrew のインストール方法:"
      echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      echo "  Homebrew インストール後、再度このスクリプトを実行してください。"
      exit 1
    fi
  fi

  if command -v tmux &> /dev/null; then
    success "tmux: $(tmux -V)"
  else
    error "tmux のインストールに失敗しました。"
    exit 1
  fi
}

install_tmux

# -------------------------------------------------------------------------
# 8. プロジェクトセットアップ
# -------------------------------------------------------------------------
echo ""
info "プロジェクトセットアップを開始します..."

cd "$PROJECT_DIR" || { error "プロジェクトディレクトリに移動できません: $PROJECT_DIR"; exit 1; }

info "依存パッケージをインストールしています..."
pnpm install
if [ ! -d "node_modules" ]; then
  warn "node_modules が作成されませんでした。再インストールを試みます..."
  pnpm install --force
fi
if [ ! -d "node_modules" ]; then
  error "node_modules のインストールに失敗しました。"
  exit 1
fi
success "pnpm install 完了"

info "ビルドしています..."
pnpm run build
success "pnpm run build 完了"

# -------------------------------------------------------------------------
# 9. agent-cli 設定ファイルの生成
# -------------------------------------------------------------------------
generate_agent_cli_config() {
  local config_file="$PROJECT_DIR/.layers/agent-cli.toml"
  local template_file="$PROJECT_DIR/.layers/agent-cli.toml.template"

  if [ -f "$config_file" ]; then
    info "agent-cli設定ファイルが既に存在します: $config_file"
    info "ユーザーカスタマイズを保持するため、上書きしません。"
  elif [ -f "$template_file" ]; then
    info "agent-cli設定ファイルをテンプレートから生成しています: $config_file"
    cp "$template_file" "$config_file"
    success "agent-cli設定ファイルを生成しました: $config_file"
  else
    warn "agent-cli設定テンプレートが見つかりません: $template_file"
    warn "agent-cli設定ファイルは生成されませんでした。"
  fi
}

generate_agent_cli_config

# -------------------------------------------------------------------------
# 10. layers コマンドの作成
# -------------------------------------------------------------------------
create_layers_command() {
  local layers_cmd="$PROJECT_DIR/layers"
  info "layers コマンドスクリプトを作成しています..."

  cat > "$layers_cmd" << 'LAYERS_CMD_EOF'
#!/usr/bin/env bash
# layers - Layers マルチエージェントシステム制御コマンド

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# バックエンドの選択（環境変数で変更可能）
LAYERS_BACKEND="${LAYERS_BACKEND:-tmux}"

case "${1:-}" in
  start)
    shift
    cd "$PROJECT_DIR" && pnpm run start -- --backend "$LAYERS_BACKEND" "$@"
    ;;
  stop)
    shift
    cd "$PROJECT_DIR" && pnpm run stop -- --backend "$LAYERS_BACKEND" "$@"
    ;;
  send)
    shift
    cd "$PROJECT_DIR" && pnpm run send -- "$@"
    ;;
  status)
    cd "$PROJECT_DIR" && pnpm run status -- --backend "$LAYERS_BACKEND"
    ;;
  live)
    shift
    cd "$PROJECT_DIR" && pnpm run live -- --backend "$LAYERS_BACKEND" "$@"
    ;;
  apoint)
    tmux attach -t producer
    ;;
  "")
    cd "$PROJECT_DIR" && pnpm run monitor
    ;;
  *)
    echo "Usage: layers [start|stop|send|status|live|apoint]"
    echo ""
    echo "Commands:"
    echo "  (none)   Start monitor mode"
    echo "  start    Start all agents"
    echo "  stop     Stop all agents"
    echo "  send     Send a message to an agent"
    echo "  status   Show the status of agents"
    echo "  live     Start live status view"
    echo "  apoint   Attach to producer session"
    echo ""
    echo "Environment variables:"
    echo "  LAYERS_BACKEND  Backend type: tmux (default) or agent-cli"
    exit 1
    ;;
esac
LAYERS_CMD_EOF

  chmod +x "$layers_cmd"
  success "layers コマンドを作成しました: $layers_cmd"
}

create_layers_command

# -------------------------------------------------------------------------
# 11. 動作確認チェック
# -------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  動作確認チェック"
echo "============================================="
echo ""

CHECK_PASSED=true

if command -v node &> /dev/null; then
  success "node: $(node -v)"
else
  error "node が見つかりません"
  CHECK_PASSED=false
fi

if command -v pnpm &> /dev/null; then
  success "pnpm: $(pnpm -v)"
else
  error "pnpm が見つかりません"
  CHECK_PASSED=false
fi

if command -v tmux &> /dev/null; then
  success "tmux: $(tmux -V)"
else
  warn "tmux が見つかりません（agent-cliバックエンド使用時は不要です）"
fi

if [ -d "$PROJECT_DIR/.layers/dist" ]; then
  success "ビルド成果物 (.layers/dist/) が存在します"
else
  error "ビルド成果物 (.layers/dist/) が見つかりません"
  CHECK_PASSED=false
fi

# -------------------------------------------------------------------------
# 12. Claude Code CLI / agent-cli の案内
# -------------------------------------------------------------------------
echo ""
echo "=== エージェントバックエンド ==="
echo ""
echo "  Layersは以下の2つのバックエンドをサポートしています:"
echo ""
echo "  1. tmux + Claude Code CLI (デフォルト)"
echo "     従来のtmuxベースのマルチエージェントシステム"
echo ""

if command -v claude &> /dev/null; then
  success "Claude Code CLI: インストール済み"
else
  warn "Claude Code CLI がインストールされていません。"
  echo ""
  echo "  インストール方法:"
  echo "    npm install -g @anthropic-ai/claude-code"
  echo ""
  echo "  認証（初回のみ・必須）:"
  echo "    claude login"
  echo ""
  echo "  ※ Claude Max/Pro サブスクリプション または Anthropic API Key が必要です。"
fi

echo ""
echo "  2. agent-cli (代替バックエンド)"
echo "     tmux不要のスタンドアロンバックエンド。UnixドメインソケットによるIPC通信"
echo ""

if command -v agent-cli &> /dev/null; then
  success "agent-cli: インストール済み ($(agent-cli --version 2>/dev/null || echo 'version unknown'))"
else
  echo "  agent-cliはインストールされていません（オプション）"
  echo ""
  echo "  インストール方法:"
  echo "    curl -fsSL https://raw.githubusercontent.com/aquaxis/agent-cli/main/install.sh | sh"
  echo ""
  echo "  ※ agent-cliを使用する場合は、LAYERS_BACKEND=agent-cli を設定してください"
  echo "    例: LAYERS_BACKEND=agent-cli ./layers start"
fi

# -------------------------------------------------------------------------
# 13. .gitディレクトリの削除
# -------------------------------------------------------------------------
# インストール完了後、Git履歴を削除してクリーンなコピーにする
# （localモードのgit pull完了後、pipeモードのgit clone完了後に実行）
if [ -d "$PROJECT_DIR/.git" ]; then
  info "Git履歴（.gitディレクトリ）を削除しています..."
  rm -rf "$PROJECT_DIR/.git"
  success ".gitディレクトリを削除しました。プロジェクトはクリーンなコピーです。"
fi

# -------------------------------------------------------------------------
# 14. 完了メッセージ
# -------------------------------------------------------------------------
echo ""
echo "============================================="
if [ "$CHECK_PASSED" = true ]; then
  success "Layers のインストールが完了しました!"
else
  warn "一部のチェックに失敗しました。上記のエラーを確認してください。"
fi
echo "============================================="
echo ""
if [ "$EXEC_MODE" = "pipe" ]; then
  echo "  プロジェクトディレクトリ:"
  echo "    cd $PROJECT_DIR"
  echo ""
fi
echo "  次のステップ:"
echo "    ./layers          # モニターモードを開始（tmuxバックエンド）"
echo "    ./layers start    # 全エージェントを起動（tmuxバックエンド）"
echo "    ./layers stop     # 全エージェントを停止"
echo ""
echo "  agent-cliバックエンドを使用する場合:"
echo "    LAYERS_BACKEND=agent-cli ./layers start"
echo ""
echo "  より詳細なコマンド:"
echo "    pnpm run status   # ステータス確認"
echo "    pnpm run live     # リアルタイム実行状況表示"
echo ""
