import { AgentManager } from './agents/AgentManager.js';
import { AgentCliController } from './agents/AgentCliController.js';
import { join } from 'path';
import { MessageBroker } from './communication/MessageBroker.js';
import { Monitor } from './monitoring/Monitor.js';
import { LiveView } from './monitoring/LiveView.js';
import { Logger } from './monitoring/Logger.js';
import { MessageType, Priority } from './communication/types.js';
import { BackendType } from './agents/types.js';

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result[key] = args[i + 1];
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

async function init(backend: BackendType): Promise<void> {
  const logger = new Logger();
  await logger.init();

  const agentCli = new AgentCliController(join(process.cwd(), '.layers', 'agent-cli.toml'));
  const monitor = new Monitor(undefined, undefined, agentCli);
  const agentManager = new AgentManager(undefined, undefined, agentCli, undefined, backend);

  await agentManager.loadConfig();

  return { agentManager, agentCli, monitor, logger, backend } as any;
}

// Global instances
const logger = new Logger();
const agentCliController = new AgentCliController(join(process.cwd(), '.layers', 'agent-cli.toml'));
const agentManager = new AgentManager(undefined, undefined, agentCliController);
const messageBroker = new MessageBroker();
const monitor = new Monitor(undefined, undefined, agentCliController);

async function start(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const backend: BackendType =
    (parsed['backend'] as BackendType) || 'claude';

  agentManager.setBackend(backend);
  await agentManager.loadConfig();
  await logger.init();

  console.log('\n=== Layers Multi-Agent System ===\n');
  console.log(`Backend: ${backend}\n`);

  if (backend === 'agent-cli') {
    console.log('Starting all agents (agent-cli mode)...\n');
  } else {
    console.log('Starting all agents (claude/tmux mode)...\n');
  }

  await agentManager.startAll();

  if (backend === 'agent-cli') {
    console.log('\nAll agents started successfully (agent-cli mode)!');
    console.log('\nAgent-cli processes are running. Use the following commands:');
    console.log('  agent-cli list          - List running agents');
    console.log('  ./layers status         - Check agent status');
    console.log('  ./layers stop           - Stop all agents');
    console.log('  ./layers send           - Send a message');
  } else {
    console.log('\nAll agents started successfully!');
    console.log('\nUse the following commands:');
    console.log('  pnpm run status  - Check agent status');
    console.log('  pnpm run stop    - Stop all agents');
    console.log('  pnpm run send    - Send a message');
    console.log('  pnpm run monitor - Start monitoring');
    console.log('\nTo connect to an agent:');
    console.log('  tmux attach -t producer');
  }
}

async function stop(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const backend: BackendType =
    (parsed['backend'] as BackendType) || 'claude';

  agentManager.setBackend(backend);
  await agentManager.loadConfig();
  await logger.init();

  console.log('\n=== Stopping Layers ===\n');

  await agentManager.stopAll();

  console.log('\nAll agents stopped.');
}

async function status(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const backend: BackendType =
    (parsed['backend'] as BackendType) || 'claude';

  agentManager.setBackend(backend);
  await agentManager.loadConfig();
  await logger.init();

  await monitor.displayStatus(backend);
}

async function send(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const backend: BackendType =
    (parsed['backend'] as BackendType) || 'claude';

  agentManager.setBackend(backend);
  await agentManager.loadConfig();
  await logger.init();
  await messageBroker.init();

  const to = parsed['to'] as string;
  const type = parsed['type'] as MessageType;
  const message = parsed['message'] as string;
  const from = (parsed['from'] as string) || 'coo';
  const priority = (parsed['priority'] as Priority) || 'normal';

  if (!to || !type || !message) {
    console.log('\nUsage: pnpm run send -- --to <agent> --type <type> --message "<message>"');
    console.log('\nOptions:');
    console.log('  --to       Target agent (required)');
    console.log('  --type     Message type: instruction, report, question, answer, status, error, complete (required)');
    console.log('  --message  Message body (required)');
    console.log('  --from     Sender name (default: coo)');
    console.log('  --priority Priority: low, normal, high, urgent (default: normal)');
    console.log('  --backend  Backend: claude, agent-cli (default: claude)');
    console.log('\nExample:');
    console.log('  pnpm run send -- --to producer --type instruction --message "Start project"');
    console.log('  pnpm run send -- --to producer --type instruction --message "Start project" --backend agent-cli');
    return;
  }

  try {
    if (backend === 'agent-cli') {
      // For agent-cli mode, use agent-cli send command
      const { exec } = await import('child_process');
      const execAsync = (cmd: string) =>
        new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          exec(cmd, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve({ stdout, stderr });
          });
        });

      const formattedMessage = [
        '---[MESSAGE START]---',
        JSON.stringify({
          type,
          from,
          to,
          priority,
          content: { body: message },
        }, null, 2),
        '---[MESSAGE END]---',
      ].join('\n');

      await execAsync(`agent-cli send "${to}" "${formattedMessage}"`);
      console.log(`\nMessage sent successfully!`);
      console.log(`From: ${from} -> To: ${to}`);
      console.log(`Type: ${type}`);
      console.log(`Backend: agent-cli`);
    } else {
      const messageId = await messageBroker.send({
        type,
        from,
        to,
        priority,
        content: {
          body: message,
        },
      });
      console.log(`\nMessage sent successfully!`);
      console.log(`Message ID: ${messageId}`);
      console.log(`From: ${from} -> To: ${to}`);
      console.log(`Type: ${type}`);
    }
  } catch (error) {
    console.error(`\nFailed to send message: ${error}`);
    process.exit(1);
  }
}

async function monitorMode(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const backend: BackendType =
    (parsed['backend'] as BackendType) || 'claude';

  agentManager.setBackend(backend);
  await agentManager.loadConfig();
  await logger.init();

  console.log('\n=== Layers Monitor Mode ===\n');
  console.log(`Backend: ${backend}\n`);
  console.log('Press Ctrl+C to exit\n');

  // Display initial status
  await monitor.displayStatus(backend);

  // Start watching
  monitor.startWatching(5000, backend);

  // Handle exit
  process.on('SIGINT', () => {
    console.log('\n\nStopping monitor...');
    monitor.stopWatching();
    process.exit(0);
  });

  // Keep running
  await new Promise(() => {});
}

async function liveMode(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const backend: BackendType =
    (parsed['backend'] as BackendType) || 'claude';

  agentManager.setBackend(backend);
  await agentManager.loadConfig();
  await logger.init();

  const intervalStr = parsed['interval'] as string;
  const interval = intervalStr ? parseInt(intervalStr, 10) : 3000;

  if (isNaN(interval) || interval < 1000) {
    console.error('Error: --interval must be a number >= 1000 (milliseconds)');
    process.exit(1);
  }

  const liveView = new LiveView(agentManager, monitor, { interval }, agentCliController, backend);
  liveView.start();

  // Keep running
  await new Promise(() => {});
}

async function showHelp(): Promise<void> {
  console.log(`
=== Layers - Hierarchical Multi-Agent System ===

Usage: pnpm run <command> [options]

Commands:
  start     Start all agents
  stop      Stop all agents
  status    Show agent status
  send      Send a message to an agent
  monitor   Start monitoring mode
  live      Start live status view (real-time auto-refresh)

Options:
  --backend <type>   Backend to use: claude (default) or agent-cli
  --provider <type>  AI provider for agent-cli: claude, codex, ollama, opencode, llama.cpp
  --model <model>    Override the model name (agent-cli mode only)
  --auto-approve     Auto-approve tools in agent-cli mode (default: true)

Live mode options:
  --interval <ms>  Update interval in milliseconds (default: 3000, min: 1000)

Examples:
  pnpm run start                           # Start with claude (tmux) backend
  pnpm run start -- --backend agent-cli    # Start with agent-cli backend
  pnpm run start -- --backend agent-cli --provider ollama --model glm-5.1:cloud
  pnpm run status
  pnpm run status -- --backend agent-cli
  pnpm run live
  pnpm run live -- --interval 5000
  pnpm run send -- --to producer --type instruction --message "Start project"
  pnpm run send -- --to producer --type instruction --message "Start project" --backend agent-cli
  pnpm run stop
  pnpm run stop -- --backend agent-cli

For more information, see README.md
`);
}

// Main
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'start':
    start(args).catch(console.error);
    break;
  case 'stop':
    stop(args).catch(console.error);
    break;
  case 'status':
    status(args).catch(console.error);
    break;
  case 'send':
    send(args).catch(console.error);
    break;
  case 'monitor':
    monitorMode(args).catch(console.error);
    break;
  case 'live':
    liveMode(args).catch(console.error);
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    showHelp();
    break;
}