export type AgentRole =
  | 'producer'
  | 'director'
  | 'lead_design'
  | 'lead_prog'
  | 'lead_qa'
  | 'designer'
  | 'programmer'
  | 'tester';

export type PermissionMode = 'default' | 'acceptEdits' | 'dangerouslySkip';

export type BackendType = 'claude' | 'agent-cli';

export interface AgentConfig {
  sessionName: string;
  role: AgentRole;
  superior: string | null;
  subordinates: string[];
  promptFile: string;
  permissionMode?: PermissionMode;
  backend?: BackendType; // default: 'claude'
  personaFile?: string; // path to agent-cli persona file (for agent-cli backend)
  provider?: string; // AI provider for agent-cli (e.g., 'claude', 'ollama')
  model?: string; // model override for agent-cli
  autoApproveTools?: boolean; // auto-approve tools for agent-cli (default: true for consistency)
}

export interface AgentStatus {
  sessionName: string;
  role: AgentRole;
  isRunning: boolean;
  superior: string | null;
  subordinates: string[];
  backend?: BackendType;
}

export interface HealthCheckResult {
  healthy: boolean;
  agents: {
    sessionName: string;
    isRunning: boolean;
    lastActivity?: Date;
  }[];
  unhealthyCount: number;
}

export interface AgentsConfig {
  agents: AgentConfig[];
}