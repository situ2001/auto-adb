import { logger } from "./logger.js";
import { DeviceStatus, DeviceStatus_fromString, TRACK_DEVICES_COMMAND } from "./adb-protocol.js";
import { type IDeviceInfo } from "./interfaces.js";
import { AdbSocket } from "./adb-socket.js";
import EventEmitter from "node:events";

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

export interface DeviceTrackerEvents {
  devicesChanged: [devices: IDeviceInfo[]];
  error: [error: any];
  close: [];
}

export class DeviceTracker extends EventEmitter<DeviceTrackerEvents> {
  private socket: AdbSocket;
  private tracking = false;

  constructor(private adbHost: string, private adbPort: number) {
    super();
    this.socket = new AdbSocket({ host: this.adbHost, port: this.adbPort });
  }

  public async start(): Promise<void> {
    if (this.tracking) {
      logger.warn("Device tracking is already in progress.");
      return;
    }
    this.tracking = true;

    try {
      // Connect to ADB server
      await this.socket.connect();

      // Send track-devices command
      await this.socket.sendCommand(TRACK_DEVICES_COMMAND);
      logger.info("Successfully started device tracking");
      logger.info("Listening for device status changes...");

      // Read initial device list (if any immediately available)
      const initialDeviceData = await readDeviceData(this.socket);
      const initialDevices = parseDeviceData(initialDeviceData);
      this.emit('devicesChanged', initialDevices);

      this.readLoop();

      this.socket.waitForClose().then(() => {
        this.tracking = false;
        this.emit('close');
        logger.info("Device tracking stopped.");
      });

    } catch (error) {
      logger.error(`Error in DeviceTracker.start: ${error}`);
      this.stop();
      this.emit('error', error);
      throw error;
    }
  }

  public stop(): void {
    if (this.tracking) {
      this.tracking = false;
      this.socket.disconnect();
    }
  }

  private async readLoop(): Promise<void> {
    try {
      while (this.socket.isSocketConnected() && this.tracking) {
        const deviceData = await readDeviceData(this.socket);
        const devices = parseDeviceData(deviceData);
        this.emit('devicesChanged', devices);
      }
    } catch (error) {
      logger.error(`Error reading device data: ${error}`);
      this.emit('error', error);
      this.stop();
    }
  }
}

export class DeviceSet {
  private devices: IDeviceInfo[] = [];

  constructor(private tracker: DeviceTracker) { }

  private handleDeviceChange = (devices: IDeviceInfo[]) => {
    const changeset: {
      added: IDeviceInfo[];
      removed: IDeviceInfo[];
      changed: { device: IDeviceInfo; oldStatus: DeviceStatus; newStatus: DeviceStatus }[];
    } = {
      added: [],
      removed: [],
      changed: [],
    };

    const oldDeviceMap = new Map(this.devices.map(d => [d.id, d]));
    const newDeviceMap = new Map(devices.map(d => [d.id, d]));

    for (const [id, newDevice] of newDeviceMap.entries()) {
      if (!oldDeviceMap.get(id)) {
        changeset.added.push(newDevice);
      }
    }

    for (const [id, newDevice] of newDeviceMap.entries()) {
      const oldDevice = oldDeviceMap.get(id);
      if (oldDevice && oldDevice.status !== newDevice.status) {
        changeset.changed.push({ device: newDevice, oldStatus: oldDevice.status, newStatus: newDevice.status });
      }
    }

    for (const [id, oldDevice] of oldDeviceMap.entries()) {
      if (!newDeviceMap.has(id)) {
        changeset.removed.push(oldDevice);
      }
    }

    logger.info(`Device changes detected: ${JSON.stringify(changeset, null, 2)}`);

    // apply changes
    this.devices = [
      ...this.devices.filter(d => !changeset.removed.find(r => r.id === d.id) && !changeset.changed.find(c => c.device.id === d.id)),
      ...changeset.added,
      ...changeset.changed.map(c => c.device)
    ];

    logger.info(`Updated device set: ${JSON.stringify(this.devices, null, 2)}`);
  }

  public subscribe(): void {
    this.tracker.on('devicesChanged', this.handleDeviceChange);
  }

  public unsubscribe(): void {
    this.tracker.off('devicesChanged', this.handleDeviceChange);
  }

  public getDevices(): IDeviceInfo[] {
    return this.devices;
  }

  public getConnectedDevices(): IDeviceInfo[] {
    return this.devices.filter(d => d.status === DeviceStatus.DEVICE);
  }
}
