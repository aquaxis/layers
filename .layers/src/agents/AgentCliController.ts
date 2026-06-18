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

    // Resolve config path: explicit configPath > project-local .layers/agent-cli.toml
    const resolvedConfigPath = this.configPath || join(projectRoot, '.layers', 'agent-cli.toml');

    const args: string[] = ['run', '--config', resolvedConfigPath];

    // Only pass --provider when explicitly set per-agent (overrides config file)
    if (config.provider) {
      args.push('--provider', config.provider);
    }

    if (config.model) {
      args.push('--model', config.model);
    }

    args.push('--name', config.sessionName);
    args.push('--persona', personaPath);
    args.push('--auto-approve-tools');

    const agentCliCmd = `agent-cli ${args.join(' ')}`;
    await this.logger.info('AgentCliController', `Starting agent-cli (PTY): ${agentCliCmd}`);

    // Use the `script` command to allocate a pseudo-terminal (PTY) for agent-cli.
    // agent-cli's REPL checks isatty(stdin) and exits immediately when stdin is
    // not a TTY. Wrapping with `script -qec "<cmd>" /dev/null` provides a proper
    // PTY so the REPL stays alive in interactive mode.
    //
    // We use detached: true so the child is the leader of its own process group.
    // This allows us to kill the entire process group (script + agent-cli) on
    // shutdown, preventing orphaned agent-cli processes.
    const child = spawn('script', ['-qec', agentCliCmd, '/dev/null'], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
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

    // Kill the entire process group (negative PID) to ensure both `script`
    // and its child `agent-cli` process are terminated.
    // With detached: true, child.pid is the process group leader PID.
    try {
      process.kill(-child.pid!, 'SIGTERM');
    } catch {
      // Process group kill might fail if the process already exited
      try { child.kill('SIGTERM'); } catch { /* already dead */ }
    }

    // Wait up to 5 seconds for graceful shutdown
    let waited = 0;
    while (this.processes.has(sessionName) && waited < 5000) {
      await this.sleep(100);
      waited += 100;
    }

    // Force kill the process group if still running
    if (this.processes.has(sessionName)) {
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
      }
      this.processes.delete(sessionName);
    }

    await this.logger.info('AgentCliController', `Stopped agent: ${sessionName}`);
  }

  async isRunning(sessionName: string): Promise<boolean> {
    if (this.processes.has(sessionName)) {
      const child = this.processes.get(sessionName)!;
      try {
        process.kill(child.pid!, 0);
        return true;
      } catch {
        this.processes.delete(sessionName);
        return false;
      }
    }

    const agents = await this.listAgents();
    return agents.includes(sessionName);
  }

  async listAgents(): Promise<string[]> {
    try {
      const { ShellExecutor } = await import('../tmux/ShellExecutor.js');
      const shell = new ShellExecutor();

      // Pass --config so agent-cli reads the correct registry directory
      const configFlag = this.configPath ? `--config "${this.configPath}"` : '';
      const { stdout } = await shell.execute(`agent-cli ${configFlag} list 2>/dev/null`);

      if (!stdout.trim() || stdout.includes('no agents running')) {
        return [];
      }

      // Parse agent-cli list output
      // Output format:
      //   ID  NAME  PROVIDER  MODEL  ROLE  SKILLS
      //   agent-XXXX  producer  ollama  glm-5.1:cloud  Producer — ...  ...
      const lines = stdout.trim().split('\n');
      const agentNames: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        // Skip header lines and separator lines
        if (!trimmed || trimmed.startsWith('ID') || trimmed.startsWith('Name') || trimmed.startsWith('-')) {
          continue;
        }
        // Split by whitespace — columns: ID, NAME, PROVIDER, MODEL, ROLE, SKILLS
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          // NAME is the second column (index 1)
          const name = parts[1];
          if (name && name !== '-') {
            agentNames.push(name);
          }
        }
      }

      return agentNames;
    } catch {
      return [];
    }
  }

  getProcess(sessionName: string): ChildProcess | undefined {
    return this.processes.get(sessionName);
  }

  setConfigPath(configPath: string): void {
    this.configPath = configPath;
  }

  getRunningAgentNames(): string[] {
    return Array.from(this.processes.keys());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}