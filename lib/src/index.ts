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
    .option('--cmd <commands...>', 'Commands to execute when a device is connected')
    .option('--cmd-clean <commands...>', 'Commands to execute when the program exits')
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

    await safelyExecCommandsSequentially(newCleanupCommands);
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

    await safelyExecCommandsSequentially(finalCommands);
  }

  const safelyExecCommandsSequentially = async (cmds: string[]) => {
    for (const cmd of cmds) {
      try {
        logger.info(`Executing command: ${cmd}`);
        const { stdout, stderr } = await execa(cmd, { shell: true });
        if (stdout) {
          logger.info(`Command "${cmd}" output: ${stdout}`);
        }
        if (stderr) {
          logger.warn(`Command "${cmd}" error output: ${stderr}`);
        }
        logger.info(`Command "${cmd}" executed successfully.`);
      } catch (err) {
        logger.error(`Failed to execute command "${cmd}": ${(err as Error).message}`);

        // stop loop on error
        break;
      }
    }
  }

  const tracker = new DeviceTracker(adbHost, adbPort);

  tracker.on('devicesChanged', async (devices) => {
    logger.info(`Connected devices: ${JSON.stringify(devices)}`);

    // Execute commands for each connected device
    for (const device of devices) {
      const { id, status } = device;

      switch (status) {
        case DeviceStatus.DEVICE:
          logger.info(`Device connected: ${id} (status: ${status})`);
          // Execute commands for the connected device
          await executeCommandsForDevice(device, commands);
          break;
        case DeviceStatus.OFFLINE:
          logger.warn(`Device ${id} is offline. Skipping command execution.`);
          continue;
        case DeviceStatus.UNAUTHORIZED:
          logger.warn(`Device ${id} is unauthorized. Please authorize it and try again. Skipping command execution.`);
          continue;
        case DeviceStatus.AUTHORIZING:
          logger.warn(`Device ${id} is authorizing. Please wait until it's authorized. Skipping command execution.`);
          continue;
        default:
          logger.warn(`Device ${id} has unknown status "${status}". Skipping command execution.`);
          continue;
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
