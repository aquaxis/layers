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

export interface AgentConfig {
  sessionName: string;
  role: AgentRole;
  superior: string | null;
  subordinates: string[];
  promptFile: string;
  permissionMode?: PermissionMode;
}

export interface AgentStatus {
  sessionName: string;
  role: AgentRole;
  isRunning: boolean;
  superior: string | null;
  subordinates: string[];
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
