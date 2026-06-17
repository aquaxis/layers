import { ShellExecutor } from '../tmux/ShellExecutor.js';
import { ITransport } from './types.js';

/**
 * Transport implementation for agent-cli IPC.
 * Uses `agent-cli send` for message delivery and `agent-cli list` for availability checks.
 */
export class AgentCliTransport implements ITransport {
  private agentCliPath: string;

  constructor(
    private shell: ShellExecutor = new ShellExecutor(),
    private configPath?: string
  ) {
    this.agentCliPath = 'agent-cli';
  }

  async send(target: string, message: string): Promise<void> {
    const escapedMessage = message.replace(/'/g, "'\\''");
    const configArg = this.configPath ? `--config "${this.configPath}"` : '';
    const cmd = `${this.agentCliPath} ${configArg} send "${target}" '${escapedMessage}'`;

    try {
      await this.shell.execute(cmd);
    } catch (error) {
      throw new Error(`Failed to send message to agent-cli peer "${target}": ${error}`);
    }
  }

  async isAvailable(target: string): Promise<boolean> {
    const configArg = this.configPath ? `--config "${this.configPath}"` : '';
    const cmd = `${this.agentCliPath} ${configArg} list`;

    try {
      const { stdout } = await this.shell.execute(cmd);
      // agent-cli list outputs a table of peers; check if target appears
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (line.includes(target)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}