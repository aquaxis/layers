import { TmuxController } from '../tmux/TmuxController.js';
import { HealthCheckResult } from '../agents/types.js';
import { Logger } from './Logger.js';

export class Monitor {
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(
    private tmux: TmuxController = new TmuxController(),
    private logger: Logger = new Logger()
  ) {}

  async healthCheck(): Promise<HealthCheckResult> {
    const sessions = await this.tmux.listSessions();
    const expectedSessions = [
      'producer',
      'director',
      'lead_design',
      'lead_prog',
      'lead_qa',
      'designer_1',
      'designer_2',
      'programmer_1',
      'programmer_2',
      'programmer_3',
      'programmer_4',
      'programmer_5',
      'tester_1',
      'tester_2',
    ];

    const agents = expectedSessions.map((sessionName) => ({
      sessionName,
      isRunning: sessions.some((s) => s.name === sessionName),
    }));

    const unhealthyCount = agents.filter((a) => !a.isRunning).length;

    return {
      healthy: unhealthyCount === 0,
      agents,
      unhealthyCount,
    };
  }

  async captureLog(sessionName: string, lines: number = 100): Promise<string> {
    try {
      return await this.tmux.capturePane(sessionName, {
        startLine: -lines,
      });
    } catch {
      return '';
    }
  }

  async listAllSessions(): Promise<
    { sessionName: string; isRunning: boolean; windows: number }[]
  > {
    const sessions = await this.tmux.listSessions();
    return sessions.map((s) => ({
      sessionName: s.name,
      isRunning: true,
      windows: s.windows,
    }));
  }

  startWatching(intervalMs: number = 5000): void {
    if (this.watchInterval) {
      this.stopWatching();
    }

    this.watchInterval = setInterval(async () => {
      const result = await this.healthCheck();
      if (!result.healthy) {
        await this.logger.warn(
          'Monitor',
          `Unhealthy agents detected: ${result.unhealthyCount}`,
          { agents: result.agents.filter((a) => !a.isRunning) }
        );
      }
    }, intervalMs);

    this.logger.info('Monitor', `Started watching with interval ${intervalMs}ms`);
  }

  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
      this.logger.info('Monitor', 'Stopped watching');
    }
  }

  async displayStatus(): Promise<void> {
    const result = await this.healthCheck();

    console.log('\n=== Layers Agent Status ===\n');
    console.log(`Total Agents: 14`);
    console.log(`Running: ${14 - result.unhealthyCount}`);
    console.log(`Stopped: ${result.unhealthyCount}`);
    console.log(`Health: ${result.healthy ? 'OK' : 'DEGRADED'}`);
    console.log('\n--- Agent Details ---\n');

    const statusIcon = (running: boolean) => (running ? '[RUNNING]' : '[STOPPED]');

    // Group by role
    const groups = {
      '統括': ['producer', 'director'],
      'リード': ['lead_design', 'lead_prog', 'lead_qa'],
      'デザイン': ['designer_1', 'designer_2'],
      'プログラム': ['programmer_1', 'programmer_2', 'programmer_3', 'programmer_4', 'programmer_5'],
      'QA': ['tester_1', 'tester_2'],
    };

    for (const [group, members] of Object.entries(groups)) {
      console.log(`${group}:`);
      for (const member of members) {
        const agent = result.agents.find((a) => a.sessionName === member);
        const status = agent ? statusIcon(agent.isRunning) : '[UNKNOWN]';
        console.log(`  ${status} ${member}`);
      }
      console.log('');
    }
  }
}
