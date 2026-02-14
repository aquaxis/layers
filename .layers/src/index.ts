import { AgentManager } from './agents/AgentManager.js';
import { MessageBroker } from './communication/MessageBroker.js';
import { Monitor } from './monitoring/Monitor.js';
import { LiveView } from './monitoring/LiveView.js';
import { Logger } from './monitoring/Logger.js';
import { MessageType, Priority } from './communication/types.js';

const logger = new Logger();
const agentManager = new AgentManager();
const messageBroker = new MessageBroker();
const monitor = new Monitor();

async function init(): Promise<void> {
  await logger.init();
  await messageBroker.init();
  await agentManager.loadConfig();
}

async function start(): Promise<void> {
  await init();
  console.log('\n=== Layers Multi-Agent System ===\n');
  console.log('Starting all agents...\n');
  await agentManager.startAll();
  console.log('\nAll agents started successfully!');
  console.log('\nUse the following commands:');
  console.log('  npm run status  - Check agent status');
  console.log('  npm run stop    - Stop all agents');
  console.log('  npm run send    - Send a message');
  console.log('  npm run monitor - Start monitoring');
  console.log('\nTo connect to an agent:');
  console.log('  tmux attach -t producer');
}

async function stop(): Promise<void> {
  await init();
  console.log('\n=== Stopping Layers ===\n');
  await agentManager.stopAll();
  console.log('\nAll agents stopped.');
}

async function status(): Promise<void> {
  await init();
  await monitor.displayStatus();
}

async function send(args: string[]): Promise<void> {
  await init();

  // Parse arguments
  const getArg = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : undefined;
  };

  const to = getArg('--to');
  const type = getArg('--type') as MessageType | undefined;
  const message = getArg('--message');
  const from = getArg('--from') || 'coo';
  const priority = (getArg('--priority') as Priority) || 'normal';

  if (!to || !type || !message) {
    console.log('\nUsage: npm run send -- --to <agent> --type <type> --message "<message>"\n');
    console.log('Options:');
    console.log('  --to       Target agent (required)');
    console.log('  --type     Message type: instruction, report, question, answer, status, error, complete (required)');
    console.log('  --message  Message body (required)');
    console.log('  --from     Sender name (default: coo)');
    console.log('  --priority Priority: low, normal, high, urgent (default: normal)');
    console.log('\nExample:');
    console.log('  npm run send -- --to producer --type instruction --message "プロジェクトを開始してください"');
    return;
  }

  try {
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
  } catch (error) {
    console.error(`\nFailed to send message: ${error}`);
    process.exit(1);
  }
}

async function monitorMode(): Promise<void> {
  await init();
  console.log('\n=== Layers Monitor Mode ===\n');
  console.log('Press Ctrl+C to exit\n');

  // Display initial status
  await monitor.displayStatus();

  // Start watching
  monitor.startWatching(5000);

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
  await init();

  // Parse --interval option
  const getArg = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : undefined;
  };

  const intervalStr = getArg('--interval');
  const interval = intervalStr ? parseInt(intervalStr, 10) : 3000;

  if (isNaN(interval) || interval < 1000) {
    console.error('Error: --interval must be a number >= 1000 (milliseconds)');
    process.exit(1);
  }

  const liveView = new LiveView(agentManager, monitor, { interval });
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

Live mode options:
  --interval <ms>  Update interval in milliseconds (default: 3000, min: 1000)

Examples:
  pnpm run start
  pnpm run status
  pnpm run live
  pnpm run live -- --interval 5000
  pnpm run send -- --to producer --type instruction --message "Start project"
  pnpm run stop

For more information, see README.md
`);
}

// Main
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'start':
    start().catch(console.error);
    break;
  case 'stop':
    stop().catch(console.error);
    break;
  case 'status':
    status().catch(console.error);
    break;
  case 'send':
    send(args).catch(console.error);
    break;
  case 'monitor':
    monitorMode().catch(console.error);
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
