import { IShellExecutor, ShellExecutor } from './ShellExecutor.js';
import {
  ITmuxController,
  TmuxSession,
  SessionOptions,
  SendKeysOptions,
  CapturePaneOptions,
  TmuxError,
} from './types.js';

export class TmuxController implements ITmuxController {
  constructor(private shell: IShellExecutor = new ShellExecutor()) {}

  async newSession(name: string, options: SessionOptions = {}): Promise<void> {
    const {
      windowName = 'main',
      workingDir = process.cwd(),
      detached = true,
    } = options;

    const cmd = [
      'tmux new-session',
      detached ? '-d' : '',
      `-s "${name}"`,
      `-n "${windowName}"`,
      `-c "${workingDir}"`,
    ]
      .filter(Boolean)
      .join(' ');

    try {
      await this.shell.execute(cmd);
    } catch (error) {
      throw new TmuxError(`Failed to create session: ${name}`, error);
    }
  }

  async killSession(name: string): Promise<void> {
    try {
      await this.shell.execute(`tmux kill-session -t "${name}"`);
    } catch (error) {
      throw new TmuxError(`Failed to kill session: ${name}`, error);
    }
  }

  async hasSession(name: string): Promise<boolean> {
    try {
      await this.shell.execute(`tmux has-session -t "${name}"`);
      return true;
    } catch {
      return false;
    }
  }

  async listSessions(): Promise<TmuxSession[]> {
    try {
      const { stdout } = await this.shell.execute(
        'tmux list-sessions -F "#{session_name}|#{session_attached}|#{session_windows}|#{session_created}"'
      );

      if (!stdout.trim()) {
        return [];
      }

      return stdout
        .trim()
        .split('\n')
        .map((line) => {
          const [name, attached, windows, created] = line.split('|');
          return {
            name,
            attached: attached === '1',
            windows: parseInt(windows, 10),
            created: new Date(parseInt(created, 10) * 1000),
          };
        });
    } catch {
      return [];
    }
  }

  async sendKeys(
    target: string,
    keys: string,
    options: SendKeysOptions = {}
  ): Promise<void> {
    const { enter = false } = options;

    try {
      const escapedKeys = this.escapeForTmux(keys);
      await this.shell.execute(`tmux send-keys -t "${target}" "${escapedKeys}"`);

      if (enter) {
        await this.shell.execute(`tmux send-keys -t "${target}" Enter`);
      }
    } catch (error) {
      throw new TmuxError(`Failed to send keys to: ${target}`, error);
    }
  }

  async capturePane(
    target: string,
    options: CapturePaneOptions = {}
  ): Promise<string> {
    const { startLine, endLine } = options;

    let cmd = `tmux capture-pane -t "${target}" -p`;
    if (startLine !== undefined) cmd += ` -S ${startLine}`;
    if (endLine !== undefined) cmd += ` -E ${endLine}`;

    try {
      const { stdout } = await this.shell.execute(cmd);
      return stdout;
    } catch (error) {
      throw new TmuxError(`Failed to capture pane: ${target}`, error);
    }
  }

  private escapeForTmux(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
  }
}
