import { execa } from "execa";

export const detectAdbServerRunning = async (adbHost: string, adbPort: number): Promise<boolean> => {
  try {
    const result = await execa('adb', ['get-state', '--host', adbHost, '--port', adbPort.toString()]);

    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export const startAdbServer = async (adbHost: string, adbPort: number): Promise<void> => {
  const result = await execa('adb', ['start-server', '--host', adbHost, '--port', adbPort.toString()]);

  if (result.exitCode === 0) {
    console.log(`ADB server started on ${adbHost}:${adbPort}`);
  } else {
    throw new Error(`Failed to start ADB server: ${result.stderr}`);
  }
}
