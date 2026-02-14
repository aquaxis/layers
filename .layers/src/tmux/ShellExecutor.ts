import { exec } from 'child_process';
import { promisify } from 'util';

export interface IShellExecutor {
  execute(command: string): Promise<{ stdout: string; stderr: string }>;
}

export class ShellExecutor implements IShellExecutor {
  private execAsync = promisify(exec);

  async execute(command: string): Promise<{ stdout: string; stderr: string }> {
    return this.execAsync(command);
  }
}
