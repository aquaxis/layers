import { TmuxController } from '../tmux/TmuxController.js';
import { ITransport } from './types.js';

export class TmuxTransport implements ITransport {
  constructor(private tmux: TmuxController = new TmuxController()) {}

  async send(target: string, message: string): Promise<void> {
    await this.tmux.sendKeys(target, message, { enter: true });
  }

  async isAvailable(target: string): Promise<boolean> {
    return this.tmux.hasSession(target);
  }
}
