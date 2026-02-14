import { readFile } from 'fs/promises';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { TmuxController } from '../tmux/TmuxController.js';
import { Logger } from '../monitoring/Logger.js';
import {
  AgentConfig,
  AgentStatus,
  AgentsConfig,
  HealthCheckResult,
} from './types.js';

export class AgentManager {
  private agents: AgentConfig[] = [];
  private projectRoot: string;

  constructor(
    private tmux: TmuxController = new TmuxController(),
    private logger: Logger = new Logger(),
    projectRoot?: string
  ) {
    this.projectRoot = projectRoot || process.cwd();
  }

  async loadConfig(configPath?: string): Promise<void> {
    const path = configPath || join(this.projectRoot, '.layers/src/config/agents.json');
    const content = await readFile(path, 'utf-8');
    const config: AgentsConfig = JSON.parse(content);
    this.agents = config.agents;
    await this.logger.info('AgentManager', `Loaded ${this.agents.length} agents from config`);
  }

  async startAll(): Promise<void> {
    await this.logger.info('AgentManager', 'Starting all agents...');

    // Ensure .layers/logs directory exists
    const logsDir = join(this.projectRoot, '.layers', 'logs');
    try {
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
        await this.logger.info('AgentManager', `Created logs directory: ${logsDir}`);
      }
    } catch (error) {
      await this.logger.error('AgentManager', `Failed to create logs directory: ${logsDir}`, { error: String(error) });
    }

    // Start in order: producer -> director -> leads -> members
    const startOrder = [
      ['producer'],
      ['director'],
      ['lead_design', 'lead_prog', 'lead_qa'],
      [
        'designer_1',
        'designer_2',
        'programmer_1',
        'programmer_2',
        'programmer_3',
        'programmer_4',
        'programmer_5',
        'tester_1',
        'tester_2',
      ],
    ];

    for (const group of startOrder) {
      await Promise.all(
        group.map((sessionName) => this.startAgent(sessionName))
      );
      // Wait between groups
      await this.sleep(1000);
    }

    await this.logger.info('AgentManager', 'All agents started');
  }

  async stopAll(): Promise<void> {
    await this.logger.info('AgentManager', 'Stopping all agents...');

    for (const agent of this.agents) {
      await this.stopAgent(agent.sessionName);
    }

    await this.logger.info('AgentManager', 'All agents stopped');
  }

  async startAgent(sessionName: string): Promise<void> {
    const agent = this.agents.find((a) => a.sessionName === sessionName);
    if (!agent) {
      throw new Error(`Agent not found: ${sessionName}`);
    }

    // Check if already running
    if (await this.tmux.hasSession(sessionName)) {
      await this.logger.warn('AgentManager', `Session already exists: ${sessionName}`);
      return;
    }

    // Create session
    await this.tmux.newSession(sessionName, {
      workingDir: this.projectRoot,
      detached: true,
    });

    // Wait for session to be ready
    await this.sleep(500);

    // Build claude command
    const claudeCmd = this.buildClaudeCommand(agent);
    await this.tmux.sendKeys(sessionName, claudeCmd, { enter: true });

    await this.logger.info('AgentManager', `Started agent: ${sessionName}`);
  }

  async stopAgent(sessionName: string): Promise<void> {
    if (await this.tmux.hasSession(sessionName)) {
      await this.tmux.killSession(sessionName);
      await this.logger.info('AgentManager', `Stopped agent: ${sessionName}`);
    }
  }

  async getStatus(): Promise<AgentStatus[]> {
    const statuses: AgentStatus[] = [];

    for (const agent of this.agents) {
      const isRunning = await this.tmux.hasSession(agent.sessionName);
      statuses.push({
        sessionName: agent.sessionName,
        role: agent.role,
        isRunning,
        superior: agent.superior,
        subordinates: agent.subordinates,
      });
    }

    return statuses;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const statuses = await this.getStatus();
    const unhealthyCount = statuses.filter((s) => !s.isRunning).length;

    return {
      healthy: unhealthyCount === 0,
      agents: statuses.map((s) => ({
        sessionName: s.sessionName,
        isRunning: s.isRunning,
      })),
      unhealthyCount,
    };
  }

  async recover(sessionName: string, maxRetries: number = 3): Promise<void> {
    await this.logger.info('AgentManager', `Attempting to recover: ${sessionName}`);

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Force stop if exists
        if (await this.tmux.hasSession(sessionName)) {
          await this.tmux.killSession(sessionName);
          await this.sleep(500);
        }

        // Restart
        await this.startAgent(sessionName);

        // Verify
        await this.sleep(2000);
        if (await this.tmux.hasSession(sessionName)) {
          await this.logger.info('AgentManager', `Recovered: ${sessionName}`);
          return;
        }
      } catch (error) {
        await this.logger.warn(
          'AgentManager',
          `Recovery attempt ${i + 1} failed for ${sessionName}`,
          { error: String(error) }
        );
      }
    }

    throw new Error(`Failed to recover ${sessionName} after ${maxRetries} attempts`);
  }

  private buildClaudeCommand(agent: AgentConfig): string {
    const options: string[] = [];

    // System prompt file
    const promptPath = join(this.projectRoot, agent.promptFile);
    options.push(`--system-prompt-file "${promptPath}"`);

    // Permission mode
    switch (agent.permissionMode) {
      case 'acceptEdits':
        options.push('--permission-mode acceptEdits');
        break;
      case 'dangerouslySkip':
        options.push('--dangerously-skip-permissions');
        break;
      default:
        // default mode - no option needed
        break;
    }

    return `claude ${options.join(' ')}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
