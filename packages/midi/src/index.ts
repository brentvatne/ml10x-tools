import type { Transport, MessageHandler } from "@ml10x-tools/protocol";
import { platformModule } from "./MidiModule";

const ML10X_PORT_NAME = "ML10X";

export class MidiTransport implements Transport {
  private _connected = false;
  private handler: MessageHandler | null = null;
  private inputName: string;
  private outputName: string;

  constructor(inputName?: string, outputName?: string) {
    this.inputName = inputName ?? ML10X_PORT_NAME;
    this.outputName = outputName ?? ML10X_PORT_NAME;
  }

  listInputs(): string[] {
    return platformModule.listInputs();
  }

  listOutputs(): string[] {
    return platformModule.listOutputs();
  }

  async open(): Promise<void> {
    if (this.handler) {
      platformModule.setMessageHandler(this.handler);
    }
    await platformModule.openPorts(this.inputName, this.outputName);
    this._connected = true;
  }

  send(data: number[]): void {
    if (!this._connected) throw new Error("Not connected");
    platformModule.sendMessage(data);
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
    if (this._connected) {
      platformModule.setMessageHandler(handler);
    }
  }

  offMessage(): void {
    this.handler = null;
    platformModule.removeMessageHandler();
  }

  close(): void {
    if (this._connected) {
      platformModule.closePorts();
      this._connected = false;
    }
  }

  get connected(): boolean {
    return this._connected;
  }
}
