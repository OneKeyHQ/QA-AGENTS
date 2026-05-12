import { SerialPort, ReadlineParser } from 'serialport';
import log from '../logger';

export class USBDriver {
  #path = '/dev/tty.usbserial-0001';
  #baudRate = 115200;
  #port = null;
  #parser = null;

  constructor(path, baudRate) {
    this.#path = path || this.#path;
    this.#baudRate = baudRate || this.#baudRate;
  }

  async init() {
    try {
      this.#port = new SerialPort({
        path: this.#path,
        autoOpen: false,
        baudRate: this.#baudRate,
      });
      this.#parser = this.#port.pipe(new ReadlineParser());

      this.#parser.on('data', (data) => {
        log.info(`Received data: ${data}`);
      });
      this.#parser.on('error', (error) => {
        log.error(`Parser error: ${error.message}`);
      });

      await this.#openPort();
      await this.write(1, 1);
      log.info('Serial port initialized');
    } catch (error) {
      log.error(`Failed to initialize serial port: ${error.message}`);
      throw error;
    }
  }

  async write(x, y) {
    try {
      const data = generateTouchscreenData(x, y);
      await this.#writePort(data);

      log.info(`Data written to port: ${data}`);
    } catch (error) {
      log.error(`Failed to write to port: ${error.message}`);
      throw error;
    } finally {
      await this.release();
    }
  }

  async release() {
    try {
      if (this.#port) {
        await this.#port.close();
        log.info('Serial port released');
      }
    } catch (error) {
      log.error(`Failed to release serial port: ${error.message}`);
      throw error;
    }
  }

  #openPort() {
    return new Promise((resolve, reject) => {
      this.#port.open((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  #writePort(data) {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(data.replace(/\s+/g, ''), 'hex');

      this.#port.write(buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export const generateTouchscreenData = (x, y) => {
  const fingerId = 0x0;
  const fingerStatus = 0x6;

  const xh = x >> 4;
  const xl = x & 0x0f;
  const yh = y >> 4;
  const yl = y & 0x0f;

  const pressure = 0x42;
  const reportStatus = 0x01;

  const b0 = (fingerId << 4) | fingerStatus;
  const b1 = xh;
  const b2 = yh;
  const b3 = (xl << 4) | yl;
  const b4 = pressure;
  const b5 = reportStatus;

  const data = `55 AA ${b0.toString(16).padStart(2, '0').toUpperCase()} ${b1
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()} ${b2.toString(16).padStart(2, '0').toUpperCase()} ${b3
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()} ${b4.toString(16).padStart(2, '0').toUpperCase()} ${b5
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()} AB`;
  return data;
};
