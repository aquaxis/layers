import { AgentManager } from '../agents/AgentManager.js';
import { AgentStatus, AgentRole } from '../agents/types.js';
import { Monitor } from './Monitor.js';

export interface LiveViewOptions {
  interval?: number; // 更新間隔（ミリ秒）、デフォルト: 3000
}

interface AgentLiveStatus extends AgentStatus {
  latestActivity: string;
}

export class LiveView {
  private timeoutId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // 定数定義
  private static readonly DEFAULT_INTERVAL = 3000;
  private static readonly CLEAR_SCREEN_ANSI = '\x1b[2J\x1b[H';
  private static readonly ACTIVITY = {
    IDLE: '-',
    WAITING: '待機中',
    UNAVAILABLE: '取得不可',
  };

  constructor(
    private agentManager: AgentManager,
    private monitor: Monitor,
    private options: LiveViewOptions = {}
  ) {}

  /**
   * リアルタイム表示を開始
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // 前の処理の完了を待ってから次の処理をスケジュール（setTimeoutで再帰）
    const tick = async () => {
      if (!this.isRunning) return;
      await this.render();
      this.timeoutId = setTimeout(tick, this.options.interval ?? LiveView.DEFAULT_INTERVAL);
    };

    tick();

    // Ctrl+C ハンドラ
    process.on('SIGINT', this.handleSigint);
  }

  /**
   * リアルタイム表示を停止
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    process.removeListener('SIGINT', this.handleSigint);
    console.log('\nリアルタイム表示を終了しました。');
  }

  /**
   * SIGINTシグナルハンドラ
   */
  private handleSigint = (): void => {
    this.stop();
    process.exit(0);
  };

  /**
   * 画面描画
   */
  private async render(): Promise<void> {
    // 画面クリア（ANSIエスケープシーケンス）
    process.stdout.write(LiveView.CLEAR_SCREEN_ANSI);

    // 全エージェントの状態取得
    const statuses = await this.getAllStatuses();

    // 表示出力
    this.printHeader();
    this.printTable(statuses);
    this.printFooter(statuses);
  }

  /**
   * 全エージェントの状態を取得（並列処理で高速化）
   */
  private async getAllStatuses(): Promise<AgentLiveStatus[]> {
    const agents = await this.agentManager.getStatus();

    const statusPromises = agents.map(async (agent) => {
      let latestActivity = LiveView.ACTIVITY.IDLE;
      if (agent.isRunning) {
        try {
          const pane = await this.monitor.captureLog(agent.sessionName, 3);
          latestActivity = this.extractActivity(pane) || LiveView.ACTIVITY.WAITING;
        } catch {
          latestActivity = LiveView.ACTIVITY.UNAVAILABLE;
        }
      }
      return { ...agent, latestActivity };
    });

    return Promise.all(statusPromises);
  }

  /**
   * ペイン内容からアクティビティを抽出
   */
  private extractActivity(paneContent: string): string {
    const lines = paneContent.trim().split('\n').filter((line) => line.trim());
    if (lines.length === 0) return '';

    // 最新の意味のある行を取得
    const lastLine = lines[lines.length - 1] || '';
    const cleaned = lastLine.trim();

    // 長すぎる場合は切り詰め
    const maxLen = 25;
    if (cleaned.length > maxLen) {
      return cleaned.slice(0, maxLen) + '...';
    }
    return cleaned;
  }

  /**
   * ヘッダー出力
   */
  private printHeader(): void {
    const now = new Date().toLocaleString('ja-JP');
    const interval = this.options.interval ?? LiveView.DEFAULT_INTERVAL;

    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│                    Layers - リアルタイム実行状況                            │');
    console.log(`│                    更新間隔: ${(interval / 1000).toFixed(0)}秒 | 最終更新: ${now.padEnd(20)}│`);
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');
    console.log('│ セッション名     │ 役割            │ 状態   │ 最新アクティビティ           │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  }

  /**
   * テーブル出力
   */
  private printTable(statuses: AgentLiveStatus[]): void {
    for (const status of statuses) {
      const sessionName = status.sessionName.padEnd(16);
      const role = this.formatRole(status.role).padEnd(15);
      const state = status.isRunning ? '\x1b[32m● 稼働\x1b[0m' : '\x1b[31m○ 停止\x1b[0m';
      const activity = status.latestActivity.padEnd(28);

      // 状態の文字列は色コードを含むため、パディング調整
      const stateDisplay = status.isRunning ? '● 稼働' : '○ 停止';
      const statePadded = stateDisplay.padEnd(6);

      console.log(
        `│ ${sessionName} │ ${role} │ ${status.isRunning ? '\x1b[32m' : '\x1b[31m'}${statePadded}\x1b[0m │ ${activity} │`
      );
    }
  }

  /**
   * フッター出力
   */
  private printFooter(statuses: AgentLiveStatus[]): void {
    const running = statuses.filter((s) => s.isRunning).length;
    const stopped = statuses.filter((s) => !s.isRunning).length;
    const total = statuses.length;

    console.log('├─────────────────────────────────────────────────────────────────────────────┤');
    console.log(`│ 稼働中: ${running}/${total} | 停止中: ${stopped}/${total}                                                │`);
    console.log('│ Ctrl+C で終了                                                               │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  }

  /**
   * 役割名を日本語にフォーマット
   */
  private formatRole(role: AgentRole): string {
    const roleNames: Record<AgentRole, string> = {
      producer: 'Producer',
      director: 'Director',
      lead_design: 'Lead Designer',
      lead_prog: 'Lead Prog',
      lead_qa: 'QA Lead',
      designer: 'Designer',
      programmer: 'Programmer',
      tester: 'Tester',
    };
    return roleNames[role] || role;
  }
}
