#!/usr/bin/env node

import { program } from "commander";
import { execa } from "execa";
import { type ICliArgs } from './interfaces.js';
import { DeviceStatus } from "./adb-protocol.js";
import { detectAdbServerRunning, startAdbServer } from "./adb-start.js";
import { logger } from "./logger.js";
import { cliArgsSchema } from "./schema.js";
import { DeviceSet, DeviceTracker } from "./adb-track-devices.js";
import { detectCommandHasVar, VAR_KEY_DEVICE_ID, replaceTemplateVars } from "./cmd-var.js";

function parseCliArgs(): ICliArgs {
  program
    .option('--adb-host <string>', 'ADB server host (default: 127.0.0.1)', '127.0.0.1')
    .option('--adb-port <number>', 'ADB server port (default: 5037)', (v) => {
      const parsed = parseInt(v, 10);

      if (isNaN(parsed)) {
        throw new Error('ADB port must be a integer');
      }

      const isExceedPortRange = (num: number) => num > 65535 || num < 1;
      if (isExceedPortRange(parsed)) {
        throw new Error('ADB port must be between 1 and 65535');
      }

      return parsed;
    })
    .option('-c, --cmd <commands...>', 'Commands to execute when a device is connected')
    .option('-C, --cmd-clean <commands...>', 'Commands to execute when the program exits')
    .parse();

  const options = program.opts();

  options.commands = options.cmd || [];
  options.cleanupCommands = options.cmdClean || [];

  const result = cliArgsSchema.safeParse(options);
  if (!result.success) {
    console.error("Invalid CLI arguments:", result.error);
    process.exit(1);
  }

  return result.data;
}

async function runApp(args: ICliArgs): Promise<void> {
  const { adbHost, adbPort, commands, cleanupCommands } = args;

  logger.info("App running with args: " + JSON.stringify(args, null, 2));

  if (!await detectAdbServerRunning(adbHost, adbPort)) {
    logger.info(`ADB server is not running on ${adbHost}:${adbPort}, starting it...`);
    await startAdbServer(adbHost, adbPort);
  } else {
    logger.info(`ADB server is already running on ${adbHost}:${adbPort}. No need to start.`);
  }

  const executeAndReturnOnce = (fn: () => Promise<void>) => {
    let called = false;
    return async () => {
      if (!called) {
        called = true;
        return await fn();
      }
      return new Promise<void>(() => { /* never resolve */ });
    }
  };

  const executeCleanupCommands = executeAndReturnOnce(async () => {
    const adbCommands = cleanupCommands
      .map(cmd => cmd.trim())
      .filter(cmd => !!cmd)
      .map(cmd =>
        detectCommandHasVar(cmd, VAR_KEY_DEVICE_ID)
          ? /* should execute for each connected device if has deviceId var */
          deviceSet.getConnectedDevices().map(device => processCommandForDevice(cmd, device))
          : /* otherwise just execute once */
          cmd
      )
      .flat();

    const newCleanupCommands = [
      ...adbCommands,
    ];

    await safelyExecCommandsSequentially(newCleanupCommands, { context: 'cleanup' });
  });

  process.on('SIGINT', async () => {
    logger.info("Received SIGINT, executing cleanup commands and exiting...");
    await executeCleanupCommands();
    process.exit(0);
  });

  const processCommandForDevice = (cmd: string, device: { id: string, status: DeviceStatus }): string => {
    const processedCmd = replaceTemplateVars(cmd, {
      [VAR_KEY_DEVICE_ID]: device.id,
      // we can add more variables here in the future
    });

    return processedCmd;
  };

  const executeCommandsForDevice = async (device: { id: string, status: DeviceStatus }, cmds: string[]) => {
    const finalCommands = cmds
      .map(cmd => cmd.trim())
      .filter((cmd): cmd is string => !!cmd)
      .map(cmd => processCommandForDevice(cmd, device));

    await safelyExecCommandsSequentially(finalCommands, { context: `device:${device.id}` });
  }

  const safelyExecCommandsSequentially = async (cmds: string[], options?: { context?: string }) => {
    const formatBatchTag = () => options?.context ? `[${options.context}]` : "[cmds]";
    const formatCmdTag = (index: number) => {
      const parts = [] as string[];

      if (options?.context) {
        parts.push(options.context);
      }

      parts.push(`cmd#${index + 1}`);

      return `[${parts.join(' ')}]`;
    };

    if (cmds.length === 0) {
      logger.info(`${formatBatchTag()} No commands to execute.`);
      return;
    }

    let completedCount = 0;
    let aborted = false;

    for (const [index, cmd] of cmds.entries()) {
      const tag = formatCmdTag(index);

      try {
        logger.info(`${tag} Executing: ${cmd}`);
        const { stdout, stderr } = await execa(cmd, { shell: true });

        const trimmedStdout = stdout?.trim();
        if (trimmedStdout) {
          logger.info(`${tag} stdout: ${trimmedStdout}`);
        }

        const trimmedStderr = stderr?.trim();
        if (trimmedStderr) {
          logger.warn(`${tag} stderr: ${trimmedStderr}`);
        }

        logger.info(`${tag} Completed.`);
        completedCount += 1;
      } catch (err) {
        const error = err as Error & { stderr?: string };
        const errorMessage = error.message;

        logger.error(`${tag} Failed: ${errorMessage}`);

        const errorStderr = error.stderr?.trim();
        if (errorStderr) {
          logger.error(`${tag} stderr: ${errorStderr}`);
        }

        if (index < cmds.length - 1) {
          logger.warn(`${formatBatchTag()} Aborting remaining commands because of previous failure.`);
        }

        aborted = true;

        break;
      }
    }

    logger.info(`${formatBatchTag()} Finished ${completedCount}/${cmds.length} commands${aborted ? ' (aborted).' : '.'}`);
  }

  const tracker = new DeviceTracker(adbHost, adbPort);

  tracker.on('devicesChanged', async (devices) => {
    logger.info(`Connected devices: ${JSON.stringify(devices)}`);

    // Execute commands for each connected device
    for (const device of devices) {
      const { status } = device;

      if (status === DeviceStatus.DEVICE) {
        await executeCommandsForDevice(device, commands);
      }
    }
  });

  const deviceSet = new DeviceSet(tracker);

  deviceSet.subscribe();
  tracker.start();
}

async function main() {
  const args = parseCliArgs();

  await runApp(args);
}

main().catch((err) => {
  logger.error("Fatal error: " + (err as Error).message);
  process.exit(1);
});
