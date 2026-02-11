#!/usr/bin/env bash
set -e

# =============================================================================
# Layers - インストールスクリプト
# マルチエージェントシステムの前提条件チェックとプロジェクトセットアップを自動化
#
# 使用方法:
#   curl -fsSL https://raw.githubusercontent.com/aquaxis/layers/main/install.sh | sh
#   または
#   chmod +x install.sh && ./install.sh
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
  info "実行モード: ローカル（プロジェクトディレクトリ: $PROJECT_DIR）"
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

# サブディレクトリにLayersをクローンまたは更新する関数
clone_to_subdir() {
  INSTALL_DIR="$INSTALL_DIR/layers"
  info "Layersを $INSTALL_DIR にクローンします..."
  if [ -d "$INSTALL_DIR/.git" ] && is_layers_repo "$INSTALL_DIR"; then
    # サブディレクトリに既にLayersリポジトリがある場合は更新
    info "既存のLayersリポジトリを更新しています: $INSTALL_DIR"
    cd "$INSTALL_DIR" || { error "ディレクトリに移動できません: $INSTALL_DIR"; exit 1; }
    git pull || {
      warn "git pull に失敗しました。既存のリポジトリをそのまま使用します。"
    }
  elif [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    # サブディレクトリが存在し空でない場合はエラー
    error "$INSTALL_DIR は既に存在し、空ではありません。"
    error "ディレクトリを削除するか、LAYERS_INSTALL_DIR 環境変数で別のインストール先を指定してください。"
    exit 1
  else
    git clone "$REPO_URL" "$INSTALL_DIR" || {
      error "リポジトリのクローンに失敗しました。"
      error "URL: $REPO_URL"
      error "ネットワーク接続とURLを確認してください。"
      exit 1
    }
    success "クローン完了: $INSTALL_DIR"
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
      # Layers以外のGitリポジトリの場合はサブディレクトリにクローン
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
    # 非空ディレクトリだがGitリポジトリでない場合はサブディレクトリにクローン
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
# 9. 動作確認チェック
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
  error "tmux が見つかりません"
  CHECK_PASSED=false
fi

if [ -d "$PROJECT_DIR/dist" ]; then
  success "ビルド成果物 (dist/) が存在します"
else
  error "ビルド成果物 (dist/) が見つかりません"
  CHECK_PASSED=false
fi

# -------------------------------------------------------------------------
# 10. Claude Code CLI の案内
# -------------------------------------------------------------------------
echo ""
if command -v claude &> /dev/null; then
  success "Claude Code CLI: インストール済み"
else
  warn "Claude Code CLI がインストールされていません。"
  echo ""
  echo "  Layers のエージェント機能を使用するには Claude Code CLI が必要です。"
  echo ""
  echo "  インストール方法:"
  echo "    npm install -g @anthropic-ai/claude-code"
  echo ""
  echo "  認証（初回のみ・必須）:"
  echo "    claude login"
  echo ""
  echo "  ※ Claude Max/Pro サブスクリプション または Anthropic API Key が必要です。"
fi

# -------------------------------------------------------------------------
# 11. 完了メッセージ
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
echo "    pnpm run start    # 全エージェントを起動"
echo "    pnpm run status   # ステータス確認"
echo "    pnpm run live     # リアルタイム実行状況表示"
echo ""
