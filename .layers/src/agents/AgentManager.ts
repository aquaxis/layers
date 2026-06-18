import { readFile } from 'fs/promises';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { TmuxController } from '../tmux/TmuxController.js';
import { Logger } from '../monitoring/Logger.js';
import { AgentCliController } from './AgentCliController.js';
import {
  AgentConfig,
  AgentStatus,
  AgentsConfig,
  BackendType,
  HealthCheckResult,
} from './types.js';

export class AgentManager {
  private agents: AgentConfig[] = [];
  private projectRoot: string;
  private _backend: BackendType;

  constructor(
    private tmux: TmuxController = new TmuxController(),
    private logger: Logger = new Logger(),
    private agentCli: AgentCliController = new AgentCliController(),
    projectRoot?: string,
    backend: BackendType = 'claude'
  ) {
    this.projectRoot = projectRoot || process.cwd();
    this._backend = backend;
  }

  /** Set the backend type for agent management */
  setBackend(backend: BackendType): void {
    this._backend = backend;
  }

  /** Get the current backend type */
  getBackend(): BackendType {
    return this._backend;
  }

  async loadConfig(configPath?: string): Promise<void> {
    const path = configPath || join(this.projectRoot, '.layers/src/config/agents.json');
    const content = await readFile(path, 'utf-8');
    const config: AgentsConfig = JSON.parse(content);
    this.agents = config.agents;
    await this.logger.info('AgentManager', `Loaded ${this.agents.length} agents from config (backend: ${this._backend})`);
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

    // Ensure .layers/registry directory exists (for agent-cli IPC)
    if (this._backend === 'agent-cli') {
      const registryDir = join(this.projectRoot, '.layers', 'registry');
      try {
        if (!existsSync(registryDir)) {
          mkdirSync(registryDir, { recursive: true });
          await this.logger.info('AgentManager', `Created registry directory: ${registryDir}`);
        }
      } catch (error) {
        await this.logger.error('AgentManager', `Failed to create registry directory: ${registryDir}`, { error: String(error) });
      }
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

    const agentBackend = this._backend || agent.backend || 'claude';

    if (agentBackend === 'agent-cli') {
      await this.agentCli.startAgent(agent, this.projectRoot);
    } else {
      await this.startClaudeAgent(agent);
    }
  }

  private async startClaudeAgent(agent: AgentConfig): Promise<void> {
    // Check if already running
    if (await this.tmux.hasSession(agent.sessionName)) {
      await this.logger.warn('AgentManager', `Session already exists: ${agent.sessionName}`);
      return;
    }

    // Create tmux session
    await this.tmux.newSession(agent.sessionName, {
      workingDir: this.projectRoot,
      detached: true,
    });

    // Wait for session to be ready
    await this.sleep(500);

    // Build claude command
    const claudeCmd = this.buildClaudeCommand(agent);
    await this.tmux.sendKeys(agent.sessionName, claudeCmd, { enter: true });

    await this.logger.info('AgentManager', `Started claude agent: ${agent.sessionName}`);
  }

  async stopAgent(sessionName: string): Promise<void> {
    const agent = this.agents.find((a) => a.sessionName === sessionName);
    if (!agent) {
      return;
    }

    const agentBackend = this._backend || agent.backend || 'claude';

    if (agentBackend === 'agent-cli') {
      await this.agentCli.stopAgent(sessionName);
    } else {
      if (await this.tmux.hasSession(sessionName)) {
        await this.tmux.killSession(sessionName);
        await this.logger.info('AgentManager', `Stopped claude agent: ${sessionName}`);
      }
    }
  }

  async getStatus(): Promise<AgentStatus[]> {
    const statuses: AgentStatus[] = [];

    for (const agent of this.agents) {
      const agentBackend = this._backend || agent.backend || 'claude';
      let isRunning: boolean;

      if (agentBackend === 'agent-cli') {
        isRunning = await this.agentCli.isRunning(agent.sessionName);
      } else {
        isRunning = await this.tmux.hasSession(agent.sessionName);
      }

      statuses.push({
        sessionName: agent.sessionName,
        role: agent.role,
        isRunning,
        superior: agent.superior,
        subordinates: agent.subordinates,
        backend: agentBackend,
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

    const agent = this.agents.find((a) => a.sessionName === sessionName);
    if (!agent) {
      throw new Error(`Agent not found: ${sessionName}`);
    }

    const agentBackend = this._backend || agent.backend || 'claude';

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Force stop if running
        await this.stopAgent(sessionName);
        await this.sleep(500);

        // Restart
        await this.startAgent(sessionName);

        // Verify
        await this.sleep(2000);
        let isRunning: boolean;
        if (agentBackend === 'agent-cli') {
          isRunning = await this.agentCli.isRunning(sessionName);
        } else {
          isRunning = await this.tmux.hasSession(sessionName);
        }

        if (isRunning) {
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