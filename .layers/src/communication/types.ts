export type MessageType =
  | 'instruction'
  | 'report'
  | 'question'
  | 'answer'
  | 'status'
  | 'error'
  | 'complete'
  | 'ack';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface Attachment {
  type: 'file' | 'code' | 'reference';
  path?: string;
  content?: string;
}

export interface MessageContent {
  subject?: string;
  body: string;
  task_id?: string;
  attachments?: Attachment[];
}

export interface Message {
  message_id: string;
  type: MessageType;
  from: string;
  to: string;
  timestamp: string;
  priority: Priority;
  content: MessageContent;
  requires_response?: boolean;
}

export interface ITransport {
  send(target: string, message: string): Promise<void>;
  isAvailable(target: string): Promise<boolean>;
}

export interface IMessageBroker {
  send(message: Omit<Message, 'message_id' | 'timestamp'>): Promise<string>;
  format(message: Message): string;
  log(message: Message): Promise<void>;
  generateId(): string;
}
