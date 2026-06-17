import { TmuxController } from '../tmux/TmuxController.js';
import { AgentCliController } from '../agents/AgentCliController.js';
import { HealthCheckResult, BackendType } from '../agents/types.js';
import { Logger } from './Logger.js';

export class Monitor {
  private watchInterval: NodeJS.Timeout | null = null;
  private agentCli: AgentCliController;

  constructor(
    private tmux: TmuxController = new TmuxController(),
    private logger: Logger = new Logger(),
    agentCli?: AgentCliController
  ) {
    this.agentCli = agentCli || new AgentCliController();
  }

  async healthCheck(backend: BackendType = 'claude'): Promise<HealthCheckResult> {
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

    let agents: { sessionName: string; isRunning: boolean }[];

    if (backend === 'agent-cli') {
      // For agent-cli, check via agent-cli list and process map
      const runningNames = await this.agentCli.listAgents();
      agents = expectedSessions.map((sessionName) => ({
        sessionName,
        isRunning: runningNames.includes(sessionName) || this.agentCli.getRunningAgentNames().includes(sessionName),
      }));
    } else {
      // For claude/tmux, check via tmux sessions
      const sessions = await this.tmux.listSessions();
      agents = expectedSessions.map((sessionName) => ({
        sessionName,
        isRunning: sessions.some((s) => s.name === sessionName),
      }));
    }

    const unhealthyCount = agents.filter((a) => !a.isRunning).length;

    return {
      healthy: unhealthyCount === 0,
      agents,
      unhealthyCount,
    };
  }

  async captureLog(sessionName: string, lines: number = 100): Promise<string> {
    // Try tmux first
    try {
      return await this.tmux.capturePane(sessionName, {
        startLine: -lines,
      });
    } catch {
      // For agent-cli, read from log files
      try {
        const { readFile } = await import('fs/promises');
        const { join } = await import('path');
        const logFile = join('.layers', 'logs', `log_${sessionName}_latest.md`);
        const content = await readFile(logFile, 'utf-8');
        const contentLines = content.split('\n');
        return contentLines.slice(-lines).join('\n');
      } catch {
        return '';
      }
    }
  }

  async listAllSessions(backend: BackendType = 'claude'): Promise<
    { sessionName: string; isRunning: boolean; windows: number }[]
  > {
    if (backend === 'agent-cli') {
      const runningNames = await this.agentCli.listAgents();
      return runningNames.map((name) => ({
        sessionName: name,
        isRunning: true,
        windows: 1,
      }));
    } else {
      const sessions = await this.tmux.listSessions();
      return sessions.map((s) => ({
        sessionName: s.name,
        isRunning: true,
        windows: s.windows,
      }));
    }
  }

  startWatching(intervalMs: number = 5000, backend: BackendType = 'claude'): void {
    if (this.watchInterval) {
      this.stopWatching();
    }

    this.watchInterval = setInterval(async () => {
      const result = await this.healthCheck(backend);
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

  async displayStatus(backend: BackendType = 'claude'): Promise<void> {
    const result = await this.healthCheck(backend);

    console.log('\n=== Layers Agent Status ===\n');
    console.log(`Backend: ${backend}`);
    console.log(`Total Agents: 14`);
    console.log(`Running: ${14 - result.unhealthyCount}`);
    console.log(`Stopped: ${result.unhealthyCount}`);
    console.log(`Health: ${result.healthy ? 'OK' : 'DEGRADED'}`);
    console.log('\n--- Agent Details ---\n');

    const statusIcon = (running: boolean) => (running ? '[RUNNING]' : '[STOPPED]');

    // Group by role
    const groups = {
      'Management': ['producer', 'director'],
      'Lead': ['lead_design', 'lead_prog', 'lead_qa'],
      'Design': ['designer_1', 'designer_2'],
      'Programming': ['programmer_1', 'programmer_2', 'programmer_3', 'programmer_4', 'programmer_5'],
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