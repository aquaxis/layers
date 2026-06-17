import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { Logger } from '../monitoring/Logger.js';
import { AgentConfig } from './types.js';

export interface IAgentCliController {
  startAgent(config: AgentConfig, projectRoot: string): Promise<void>;
  stopAgent(sessionName: string): Promise<void>;
  isRunning(sessionName: string): Promise<boolean>;
  listAgents(): Promise<string[]>;
}

export class AgentCliController implements IAgentCliController {
  private processes: Map<string, ChildProcess> = new Map();
  private logger: Logger;

  constructor(
    private configPath?: string,
    logger?: Logger
  ) {
    this.logger = logger || new Logger();
  }

  async startAgent(config: AgentConfig, projectRoot: string): Promise<void> {
    if (this.processes.has(config.sessionName)) {
      await this.logger.warn('AgentCliController', `Agent ${config.sessionName} is already running`);
      return;
    }

    const personaPath = join(projectRoot, config.personaFile || `.layers/personas/${config.role}.md`);

    const args: string[] = ['run'];

    if (config.provider) {
      args.push('--provider', config.provider);
    }

    if (config.model) {
      args.push('--model', config.model);
    }

    args.push('--name', config.sessionName);
    args.push('--persona', personaPath);
    args.push('--auto-approve-tools');

    if (this.configPath) {
      args.unshift('--config', this.configPath);
    }

    await this.logger.info('AgentCliController', `Starting agent-cli: agent-cli ${args.join(' ')}`);

    const child = spawn('agent-cli', args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    child.on('error', async (error) => {
      await this.logger.error('AgentCliController', `Agent ${config.sessionName} error: ${error.message}`);
      this.processes.delete(config.sessionName);
    });

    child.on('exit', async (code, signal) => {
      await this.logger.info(
        'AgentCliController',
        `Agent ${config.sessionName} exited with code ${code}, signal ${signal}`
      );
      this.processes.delete(config.sessionName);
    });

    // Capture stdout/stderr for logging
    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        // Log significant output at debug level to avoid flooding
        void this.logger.debug('AgentCliController', `[${config.sessionName}] ${output}`);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        void this.logger.warn('AgentCliController', `[${config.sessionName}] ${output}`);
      }
    });

    this.processes.set(config.sessionName, child);

    // Wait a bit for the process to initialize
    await this.sleep(1000);

    await this.logger.info('AgentCliController', `Started agent: ${config.sessionName} (PID: ${child.pid})`);
  }

  async stopAgent(sessionName: string): Promise<void> {
    const child = this.processes.get(sessionName);
    if (!child) {
      await this.logger.warn('AgentCliController', `Agent ${sessionName} is not running`);
      return;
    }

    // Send SIGTERM for graceful shutdown
    child.kill('SIGTERM');

    // Wait up to 5 seconds for graceful shutdown
    let waited = 0;
    while (this.processes.has(sessionName) && waited < 5000) {
      await this.sleep(100);
      waited += 100;
    }

    // Force kill if still running
    if (this.processes.has(sessionName)) {
      child.kill('SIGKILL');
      this.processes.delete(sessionName);
    }

    await this.logger.info('AgentCliController', `Stopped agent: ${sessionName}`);
  }

  async isRunning(sessionName: string): Promise<boolean> {
    // Check our process map first
    if (this.processes.has(sessionName)) {
      const child = this.processes.get(sessionName)!;
      // Check if the process is still alive
      try {
        process.kill(child.pid!, 0); // Signal 0 doesn't kill, just checks existence
        return true;
      } catch {
        this.processes.delete(sessionName);
        return false;
      }
    }

    // Also check via agent-cli list command
    const agents = await this.listAgents();
    return agents.includes(sessionName);
  }

  async listAgents(): Promise<string[]> {
    try {
      const { ShellExecutor } = await import('../tmux/ShellExecutor.js');
      const shell = new ShellExecutor();
      const { stdout } = await shell.execute('agent-cli list 2>/dev/null');

      if (!stdout.trim()) {
        return [];
      }

      // Parse agent-cli list output
      // Output format: lines with agent names/IDs
      const lines = stdout.trim().split('\n');
      const agentNames: string[] = [];

      for (const line of lines) {
        // Skip header lines and empty lines
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('ID') || trimmed.startsWith('Name') || trimmed.startsWith('-')) {
          continue;
        }
        // Extract the name/id field (first column)
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 1) {
          agentNames.push(parts[0]);
        }
      }

      return agentNames;
    } catch {
      // agent-cli might not be installed or no agents running
      return [];
    }
  }

  getProcess(sessionName: string): ChildProcess | undefined {
    return this.processes.get(sessionName);
  }

  getRunningAgentNames(): string[] {
    return Array.from(this.processes.keys());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}