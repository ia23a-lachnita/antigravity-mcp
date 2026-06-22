/**
 * agy (Antigravity CLI) backend via node-pty.
 *
 * WHY PTY? agy is a TUI application that writes output directly to the Windows
 * console (conout$) through its own rendering layer — not to stdout/stderr.
 * When stdout is piped (as inside an MCP server), agy produces zero bytes on
 * stdout/stderr. A pseudo-terminal tricks agy into thinking it has a real
 * terminal so its output is capturable. ANSI escape codes are then stripped.
 *
 * REQUIREMENT: node-pty must be installed (npm install node-pty).
 * node-pty is a native module requiring MSVC build tools on Windows.
 * If it is absent, this module throws a descriptive error at call time rather
 * than at import time, so the rest of the MCP server continues to load.
 */

import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { Logger } from './logger.js';
import { CLI, ENV_VARS, ERROR_MESSAGES } from '../constants.js';
import type { ApprovalMode } from '../constants.js';

// Lazy CJS require that works from an ESM module.
// node-pty is optional and may not be installed, so we avoid static type imports.
const _require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodePty = any;

function loadNodePty(): NodePty {
  try {
    return _require('node-pty') as NodePty;
  } catch {
    throw new Error(ERROR_MESSAGES.PTY_NOT_AVAILABLE);
  }
}

// Strip ANSI/VT100 escape sequences and normalize line endings.
export function stripAnsi(raw: string): string {
  return raw
    // CSI sequences: ESC[ ... final-byte
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    // OSC sequences: ESC] ... ST (ST = BEL or ESC\)
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    // Any other lone ESC followed by a non-bracket character
    .replace(/\x1b[^[\]]/g, '')
    // Normalize Windows line endings then bare CRs
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

// Resolve the agy executable path. AGY_CLI_PATH env var overrides.
export function resolveAgyPath(): string {
  const override = process.env[ENV_VARS.AGY_CLI_PATH]?.trim();
  if (override) {
    return override.replace(/^["']|["']$/g, '');
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? '';
    if (localAppData) {
      return `${localAppData}\\agy\\bin\\agy.exe`;
    }
  }
  return CLI.COMMANDS.AGY;
}

// Probe whether the agy binary exists and responds to --help.
export function isAgyAvailable(): boolean {
  try {
    const agyPath = resolveAgyPath();
    const result = spawnSync(agyPath, ['--help'], {
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    // spawnSync returns status null on error; 0 or 1 means binary ran
    return result.status === 0 || result.status === 1;
  } catch {
    return false;
  }
}

// Check whether node-pty is loadable without actually requiring it yet.
export function isPtyAvailable(): boolean {
  try {
    _require.resolve('node-pty');
    return true;
  } catch {
    return false;
  }
}

// Strip variant suffixes that agy doesn't recognize (e.g. -preview, -exp, -latest, -001).
export function normalizeAgyModel(model: string): string {
  return model.replace(/-(preview|exp|latest|\d{3,})$/i, '');
}

// Build the agy CLI argument list from execution options.
export function buildAgyArgs(
  prompt: string,
  options: {
    model?: string;
    sandbox?: boolean;
    approvalMode?: ApprovalMode;
    printTimeout?: string;
  },
): string[] {
  const args: string[] = [];

  if (options.model) {
    const normalizedModel = normalizeAgyModel(options.model);
    if (normalizedModel !== options.model) {
      Logger.warn(`Model "${options.model}" normalized to "${normalizedModel}" for agy`);
    }
    args.push(CLI.AGY_FLAGS.MODEL, normalizedModel);
  }
  if (options.sandbox) {
    args.push(CLI.AGY_FLAGS.SANDBOX);
  }

  // Print mode is non-interactive — there is no user to approve tool use.
  // Always skip the permissions gate so tool-using responses don't stall and
  // exit with code 2. User-visible "plan" vs "auto_edit" distinctions are
  // meaningful only in interactive agy sessions, not in MCP print mode.
  args.push(CLI.AGY_FLAGS.SKIP_PERMISSIONS);

  args.push(
    CLI.AGY_FLAGS.PRINT_TIMEOUT,
    options.printTimeout ?? CLI.DEFAULTS.AGY_PRINT_TIMEOUT,
  );
  args.push(CLI.AGY_FLAGS.PROMPT, prompt);

  return args;
}

export interface AgyPtyExecutionOptions {
  model?: string;
  sandbox?: boolean;
  approvalMode?: ApprovalMode;
  onProgress?: (newOutput: string) => void;
  printTimeout?: string;
  /** PTY column width (wider = fewer line-wrap artifacts). Default: 220 */
  cols?: number;
  rows?: number;
}

export async function executeAgyViaPty(
  prompt: string,
  options: AgyPtyExecutionOptions = {},
): Promise<string> {
  const pty = loadNodePty(); // throws PTY_NOT_AVAILABLE if absent

  const agyPath = resolveAgyPath();
  const args = buildAgyArgs(prompt, {
    model: options.model,
    sandbox: options.sandbox,
    approvalMode: options.approvalMode,
    printTimeout: options.printTimeout,
  });

  Logger.debug(`agy PTY: ${agyPath} ${args.join(' ')}`);

  return new Promise<string>((resolve, reject) => {
    const ptyProc = pty.spawn(agyPath, args, {
      name: 'xterm-color',
      cols: options.cols ?? 220,
      rows: options.rows ?? 50,
      cwd: process.cwd(),
      env: { ...process.env } as Record<string, string>,
    });

    let rawOutput = '';
    let lastReportedLength = 0;

    ptyProc.onData((data: string) => {
      rawOutput += data;
      if (options.onProgress && rawOutput.length > lastReportedLength) {
        const newClean = stripAnsi(rawOutput.substring(lastReportedLength));
        lastReportedLength = rawOutput.length;
        if (newClean.trim()) {
          options.onProgress(newClean);
        }
      }
    });

    ptyProc.onExit(({ exitCode }: { exitCode: number }) => {
      const clean = stripAnsi(rawOutput).trim();

      // Detect quota/usage-limit messages in output regardless of exit code
      const isQuotaError =
        /quota exceeded|rate limit|resource_exhausted|too many requests|usage limit|daily limit/i.test(clean);
      if (isQuotaError) {
        reject(
          new Error(
            `⚠️ agy: usage/quota limit reached on your Google AI Pro account.\n` +
            `Wait for your quota to reset, or switch to a lighter model.\n\n` +
            `agy output:\n${clean}`,
          ),
        );
        return;
      }

      if (exitCode === 0) {
        if (!clean) {
          reject(
            new Error(
              'agy completed but produced no visible output. ' +
                'Ensure agy is authenticated by running: agy install',
            ),
          );
        } else {
          resolve(clean);
        }
      } else {
        const hint = exitCode === 2
          ? '\nExit code 2 usually means invalid arguments — check the model name.\n' +
            'Valid agy models: gemini-3.5-flash (default), gemini-3.1-pro, gemini-2.5-flash, gemini-2.5-pro'
          : '';
        reject(
          new Error(`agy exited with code ${exitCode}.${hint}\n${clean || '(no output)'}`),
        );
      }
    });
  });
}
