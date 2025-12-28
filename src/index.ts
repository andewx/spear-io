/**
 * SPEAR - Synthetic Precipitative Environmental Attenuation Radar
 * Main application entry point
 */

import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import * as storage from './services/fileStorage.js';
import * as itu from './services/ituData.js';
import { sendView } from './services/templateRenderer.js';
import apiRouter from './routes/router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT = process.env.PORT || 3000;
let server: ReturnType<typeof app.listen> | null = null;

// ============================================================================
// View Engine Configuration
// ============================================================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates', 'views'));

// ============================================================================
// Middleware
// ============================================================================

// JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files from /app/site
const staticPath = path.join(__dirname, '..', 'app', 'site');
app.use(express.static(staticPath));


// ============================================================================
// Routes
// ============================================================================

// Home page
app.get('/', async (req: Request, res: Response) => {
  try {
    const [platforms, scenarios] = await Promise.all([
      storage.listAllPlatforms(),
      storage.listAllScenarios(),
    ]);
    process.stdout.write('Rendering home page with platforms and scenarios\n');
    await sendView(res, 'home', {
      platforms: [...platforms.sams, ...platforms.fighters],
      sams: platforms.sams,
      fighters: platforms.fighters,
      scenarios,
    }, {
      title: 'Dashboard',
      page: 'home',
    });
  } catch (error) {
    process.stderr.write(`Error loading home page: ${error}\n`);
    res.status(500).send('Error loading page');
  }
});

// API routes (must be before web routes to take precedence)
app.use('/api', apiRouter);

// Web routes (handled by controllers with template rendering)
app.use('/', apiRouter);



// ============================================================================
// Error Handling
// ============================================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  process.stderr.write(`Error: ${err.message}\n${err.stack}\n`);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ============================================================================
// Command Interface
// ============================================================================

/**
 * Initialize readline interface for interactive commands
 */
function initializeCommandInterface(): readline.Interface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'SPEAR> ',
  });

  rl.on('line', async (input: string) => {
    const command = input.trim().toLowerCase();
    
    switch (command) {
      case 'quit':
      case 'exit':
      case 'stop':
        await shutdown(rl);
        break;
      
      case 'help':
        showHelp();
        rl.prompt();
        break;
      
      case 'status':
        showStatus();
        rl.prompt();
        break;
      
      case 'clear':
        console.clear();
        rl.prompt();
        break;
      
      case 'reload':
        await reloadData();
        rl.prompt();
        break;
      
      case '':
        rl.prompt();
        break;
      
      default:
        process.stdout.write(`Unknown command: ${command}. Type 'help' for available commands.\n`);
        rl.prompt();
    }
  });

  rl.on('close', () => {
    process.stdout.write('\nExiting SPEAR...\n');
    process.exit(0);
  });

  return rl;
}

/**
 * Show available commands
 */
function showHelp(): void {
  process.stdout.write('\nAvailable Commands:\n');
  process.stdout.write('==================\n');
  process.stdout.write('  help     - Show this help message\n');
  process.stdout.write('  status   - Show server status and statistics\n');
  process.stdout.write('  reload   - Reload ITU data and configurations\n');
  process.stdout.write('  clear    - Clear console screen\n');
  process.stdout.write('  quit     - Shutdown server gracefully\n');
  process.stdout.write('  exit     - (alias for quit)\n');
  process.stdout.write('  stop     - (alias for quit)\n');
  process.stdout.write('\n');
}

/**
 * Show server status
 */
function showStatus(): void {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  process.stdout.write('\nServer Status:\n');
  process.stdout.write('==============\n');
  process.stdout.write(`  URL: http://localhost:${PORT}\n`);
  process.stdout.write(`  Uptime: ${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s\n`);
  process.stdout.write(`  Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB\n`);
  process.stdout.write(`  PID: ${process.pid}\n`);
  process.stdout.write('\n');
}

/**
 * Reload data
 */
async function reloadData(): Promise<void> {
  try {
    process.stdout.write('Reloading ITU attenuation data...\n');
    await itu.loadITUData();
    process.stdout.write('Data reloaded successfully.\n');
  } catch (error) {
    process.stderr.write(`Failed to reload data: ${error}\n`);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(rl: readline.Interface): Promise<void> {
  process.stdout.write('\nShutting down server...\n');
  
  rl.close();
  
  if (server) {
    server.close(() => {
      process.stdout.write('Server closed.\n');
      process.exit(0);
    });
    
    // Force close after 5 seconds
    setTimeout(() => {
      process.stderr.write('Forced shutdown after timeout.\n');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

// ============================================================================
// Application Initialization
// ============================================================================

const main = async (): Promise<void> => {
  process.stdout.write('SPEAR - Synthetic Precipitative Environmental Attenuation Radar\n');
  process.stdout.write('================================================================\n');

  try {
    // Initialize data directories
    process.stdout.write('Initializing data directories...\n');
    await storage.initializeDataDirectories();

    // Load ITU attenuation data
    process.stdout.write('Loading ITU attenuation data...\n');
    await itu.loadITUData();

    // Start server
    server = app.listen(PORT, '0.0.0.0', () => {
      process.stdout.write(`\nServer running on http://localhost:${PORT}\n`);
      process.stdout.write(`API endpoints:\n`);
      process.stdout.write(`  - GET    /api/platforms\n`);
      process.stdout.write(`  - POST   /api/platforms\n`);
      process.stdout.write(`  - GET    /api/platforms/:type/:id\n`);
      process.stdout.write(`  - PUT    /api/platforms/:type/:id\n`);
      process.stdout.write(`  - DELETE /api/platforms/:type/:id\n`);
      process.stdout.write(`  - GET    /api/scenarios\n`);
      process.stdout.write(`  - POST   /api/scenarios\n`);
      process.stdout.write(`  - GET    /api/scenarios/:id\n`);
      process.stdout.write(`  - PUT    /api/scenarios/:id\n`);
      process.stdout.write(`  - DELETE /api/scenarios/:id\n`);
      process.stdout.write(`  - POST   /api/simulation/run\n`);
      process.stdout.write(`  - POST   /api/synthetic/precipitation\n`);
      process.stdout.write(`  - GET    /api/synthetic/precipitation/:filename\n`);
      process.stdout.write('================================================================\n');
      process.stdout.write('Type "help" for available commands\n\n');
      
      // Initialize command interface
      if (process.stdin.isTTY){
        const rl = initializeCommandInterface();
        rl.prompt();
      }

    });

    // Handle process signals for graceful shutdown
    process.on('SIGINT', async () => {
      process.stdout.write('\n\nReceived SIGINT, shutting down...\n');
      if (server) {
        server.close(() => {
          process.stdout.write('Server closed.\n');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });

    process.on('SIGTERM', async () => {
      process.stdout.write('\nReceived SIGTERM, shutting down...\n');
      if (server) {
        server.close(() => {
          process.stdout.write('Server closed.\n');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });

  } catch (error) {
    process.stderr.write(`Failed to initialize application: ${error}\n`);
    process.exit(1);
  }
};

main().catch((error) => {
  process.stderr.write(`An error occurred: ${error}\n`);
  process.exit(1);
});

