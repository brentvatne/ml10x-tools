import type { Transport, MessageHandler } from "@ml10x-tools/protocol";
import { NodeMidiModule } from "./MidiModule.ts";

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
    return NodeMidiModule.listInputs();
  }

  listOutputs(): string[] {
    return NodeMidiModule.listOutputs();
  }

  async open(): Promise<void> {
    if (this.handler) {
      NodeMidiModule.setMessageHandler(this.handler);
    }
    NodeMidiModule.openPorts(this.inputName, this.outputName);
    this._connected = true;
  }

  send(data: number[]): void {
    if (!this._connected) throw new Error("Not connected");
    NodeMidiModule.sendMessage(data);
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
    if (this._connected) {
      NodeMidiModule.setMessageHandler(handler);
    }
  }

  offMessage(): void {
    this.handler = null;
    NodeMidiModule.removeMessageHandler();
  }

  close(): void {
    if (this._connected) {
      NodeMidiModule.closePorts();
      this._connected = false;
    }
  }

  get connected(): boolean {
    return this._connected;
  }
}
