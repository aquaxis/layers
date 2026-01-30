export interface TmuxSession {
  name: string;
  attached: boolean;
  windows: number;
  created: Date;
}

export interface SessionOptions {
  windowName?: string;
  workingDir?: string;
  detached?: boolean;
}

export interface SendKeysOptions {
  enter?: boolean;
  literal?: boolean;
}

export interface CapturePaneOptions {
  startLine?: number;
  endLine?: number;
}

export interface ITmuxController {
  newSession(name: string, options?: SessionOptions): Promise<void>;
  killSession(name: string): Promise<void>;
  hasSession(name: string): Promise<boolean>;
  listSessions(): Promise<TmuxSession[]>;
  sendKeys(target: string, keys: string, options?: SendKeysOptions): Promise<void>;
  capturePane(target: string, options?: CapturePaneOptions): Promise<string>;
}

export class TmuxError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'TmuxError';
  }
}
