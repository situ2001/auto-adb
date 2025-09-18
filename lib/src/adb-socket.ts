import net from "node:net";
import { EventEmitter } from "node:events";
import { logger } from "./logger.js";
import { AdbRequestResult } from "./adb-protocol.js";

export interface AdbSocketOptions {
  host: string;
  port: number;
}

export interface AdbSocketEvents {
  connected: [];
  disconnected: [];
  error: [error: Error];
  data: [data: Buffer];
}

export class AdbSocket extends EventEmitter<AdbSocketEvents> {
  private socket: net.Socket;
  private buffer: Buffer = Buffer.alloc(0);
  private isConnected = false;
  private readonly options: AdbSocketOptions;

  constructor(options: AdbSocketOptions) {
    super();
    this.options = options;
    this.socket = new net.Socket();
    this.setupSocketEvents();
  }

  private setupSocketEvents(): void {
    this.socket.on('connect', () => {
      this.isConnected = true;
      logger.info(`Successfully connected to ADB server: ${this.options.host}:${this.options.port}`);
      this.emit('connected');
    });

    this.socket.on('data', (data: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.emit('data', data);
    });

    this.socket.on('close', () => {
      this.isConnected = false;
      logger.info("Connection closed");
      this.emit('disconnected');
    });

    this.socket.on('error', (err: Error) => {
      this.isConnected = false;
      logger.error(`Connection error: ${err.message}`);
      this.emit('error', err);
    });
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      logger.info(`Connecting to ADB server: ${this.options.host}:${this.options.port}`);

      const onConnect = () => {
        this.socket.removeListener('error', onError);
        resolve();
      };

      const onError = (err: Error) => {
        this.socket.removeListener('connect', onConnect);
        logger.error(`Connection failed: ${err.message}`);
        logger.info("Please make sure the ADB server is running (run 'adb start-server')");
        reject(err);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('error', onError);

      this.socket.connect(this.options.port, this.options.host);
    });
  }

  async readExactBytes(n: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const bytesNeeded = n;

      if (this.buffer.length >= bytesNeeded) {
        const result = this.buffer.subarray(0, bytesNeeded);
        this.buffer = this.buffer.subarray(bytesNeeded);
        resolve(result);
        return;
      }

      const onData = (_data: Buffer) => {
        // Buffer is already updated in the 'data' event handler in setupSocketEvents
        if (this.buffer.length >= bytesNeeded) {
          // We have enough data, extract exactly what we need
          const result = this.buffer.subarray(0, bytesNeeded);
          this.buffer = this.buffer.subarray(bytesNeeded);

          this.removeListener('data', onData);
          this.removeListener('error', onError);

          resolve(result);
        } else {
          // wait for more data...
        }
      };

      const onError = (err: Error) => {
        this.removeListener('data', onData);
        this.removeListener('error', onError);
        reject(err);
      };

      this.on('data', onData);
      this.on('error', onError);
    });
  }

  async sendCommand(command: string): Promise<AdbRequestResult> {
    const length = command.length.toString(16).padStart(4, '0');
    const fullCommand = `${length}${command}`;

    logger.info(`Sending command: ${command}`);

    this.socket.write(fullCommand);

    const response = (await this.readExactBytes(4)).toString() as AdbRequestResult;

    switch (response) {
      case AdbRequestResult.OK:
        logger.info(`Command successful: ${command}`);
        return response;
      case AdbRequestResult.FAIL:
        logger.error(`Command failed: ${command}`);
        throw new Error(`ADB command failed: ${command}`);
      default:
        logger.error(`Unexpected response: ${response}`);
        throw new Error(`Unexpected response: ${response}`);
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
    }
    this.isConnected = false;
  }

  waitForClose(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        resolve();
        return;
      }

      this.socket.once('close', () => {
        resolve();
      });

      this.socket.once('error', (err) => {
        reject(err);
      });
    });
  }
}
