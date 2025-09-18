import type { DeviceStatus } from "./adb-protocol.js";

export interface ICliArgs {
  /**
   * If not specified, the default host 127.0.0.1 will be used.
   */
  adbHost: string;

  /**
   * If not specified, the default port 5037 will be used.
   */
  adbPort: number;

  /**
   * Commands that will be executed when a device is connected.
   */
  commands: string[];

  /**
   * Commands that will be executed when this program exits (e.g. to clean up).
   */
  cleanupCommands: string[];
}

export interface IDeviceInfo {
  id: string;
  status: DeviceStatus;
}

export interface IDeviceChangePayload {
  device: IDeviceInfo;
  oldStatus: DeviceStatus;
  newStatus: DeviceStatus;
}

export interface IDeviceChangeset {
  added: IDeviceInfo[];
  removed: IDeviceInfo[];
  changed: IDeviceChangePayload[];
}
