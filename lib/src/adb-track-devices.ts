import { logger } from "./logger.js";
import { DeviceStatus_fromString, TRACK_DEVICES_COMMAND } from "./adb-protocol.js";
import { type IDeviceInfo } from "./interfaces.js";
import { AdbSocket } from "./adb-socket.js";

function parseDeviceData(deviceData: Buffer): IDeviceInfo[] {
  const devicesStr = deviceData.toString();
  const deviceInfos: IDeviceInfo[] = [];

  for (const line of devicesStr.split('\n')) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      const parts = trimmedLine.split(/\s+/);
      logger.info(`Device line parts: ${parts}`);
      if (parts.length === 2) {
        const deviceInfo: IDeviceInfo = {
          id: parts[0]!,
          status: DeviceStatus_fromString(parts[1]!),
        };
        deviceInfos.push(deviceInfo);
      } else {
        logger.warn(`Unexpected device line format: ${line}`);
      }
    }
  }

  return deviceInfos;
}

async function readDeviceData(socket: AdbSocket): Promise<Buffer> {
  const headerBuffer = await socket.readExactBytes(4);
  const lengthStr = headerBuffer.toString();
  const dataLength = parseInt(lengthStr, 16);

  if (dataLength > 0) {
    return await socket.readExactBytes(dataLength);
  } else {
    return Buffer.alloc(0);
  }
}

export async function trackDevices(adbHost: string, adbPort: number, onDeviceChange: (devices: IDeviceInfo[]) => void): Promise<void> {
  const socket = new AdbSocket({ host: adbHost, port: adbPort });

  try {
    // Connect to ADB server
    await socket.connect();

    // Send track-devices command
    await socket.sendCommand(TRACK_DEVICES_COMMAND);
    logger.info("Successfully started device tracking");
    logger.info("Listening for device status changes...");

    // Read initial device list (if any immediately available)
    const initialDeviceData = await readDeviceData(socket);
    const initialDevices = parseDeviceData(initialDeviceData);
    onDeviceChange(initialDevices);

    // Continuously read device data
    (async () => {
      try {
        while (socket.isSocketConnected()) {
          const deviceData = await readDeviceData(socket);
          const devices = parseDeviceData(deviceData);
          onDeviceChange(devices);
        }
      } catch (error) {
        logger.error(`Error reading device data: ${error}`);
        socket.disconnect();
      }
    })();

    // Wait for connection to close
    await socket.waitForClose();

  } catch (error) {
    logger.error(`Error in trackDevices: ${error}`);
    socket.disconnect();
    throw error;
  }
}
