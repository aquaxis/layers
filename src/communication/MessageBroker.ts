import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { IMessageBroker, ITransport, Message } from './types.js';
import { TmuxTransport } from './TmuxTransport.js';

export class MessageBroker implements IMessageBroker {
  private logDir: string;
  private logFile: string;

  constructor(
    private transport: ITransport = new TmuxTransport(),
    logDir: string = 'logs'
  ) {
    this.logDir = logDir;
    this.logFile = join(logDir, 'messages.log');
  }

  async init(): Promise<void> {
    await mkdir(this.logDir, { recursive: true });
  }

  async send(
    partial: Omit<Message, 'message_id' | 'timestamp'>
  ): Promise<string> {
    const message: Message = {
      ...partial,
      message_id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    // Check if target is available
    const available = await this.transport.isAvailable(message.to);
    if (!available) {
      throw new Error(`Target agent not available: ${message.to}`);
    }

    const formatted = this.format(message);
    await this.transport.send(message.to, formatted);
    await this.log(message);

    return message.message_id;
  }

  format(message: Message): string {
    return `
---[MESSAGE START]---
${JSON.stringify(message, null, 2)}
---[MESSAGE END]---

上記のメッセージを受信しました。内容を確認し、適切に対応してください。
`.trim();
  }

  async log(message: Message): Promise<void> {
    const logEntry = {
      timestamp: message.timestamp,
      message_id: message.message_id,
      from: message.from,
      to: message.to,
      type: message.type,
      subject: message.content.subject,
      body_preview: message.content.body.substring(0, 100),
    };

    const line = JSON.stringify(logEntry) + '\n';

    try {
      await appendFile(this.logFile, line);
    } catch {
      // Ignore file write errors
    }
  }

  generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `msg_${timestamp}_${random}`;
  }
}
