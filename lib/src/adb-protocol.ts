export enum AdbRequestResult {
  OK = 'OKAY',
  FAIL = 'FAIL',
}

export const TRACK_DEVICES_COMMAND = 'host:track-devices';

export enum DeviceStatus {
  OFFLINE = "offline",
  DEVICE = "device",
  UNAUTHORIZED = "unauthorized",
  AUTHORIZING = "authorizing",
  NO_PERMISSIONS = "no permissions",
  BOOTLOADER = "bootloader",
  RECOVERY = "recovery",
  UNKNOWN = "unknown"
}

export const DeviceStatus_fromString = (status: string): DeviceStatus => {
  const result = DeviceStatus[status.toUpperCase() as keyof typeof DeviceStatus];
  if (result) {
    return result;
  }

  return DeviceStatus.UNKNOWN;
}
