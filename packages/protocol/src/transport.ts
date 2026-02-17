export type MessageHandler = (data: number[], deltaTime: number) => void;

export interface Transport {
  open(): Promise<void>;
  send(data: number[]): void;
  onMessage(handler: MessageHandler): void;
  offMessage(): void;
  close(): void;
  readonly connected: boolean;
}

export interface MidiModule {
  listInputs(): string[];
  listOutputs(): string[];
  openPorts(inputName: string, outputName: string): void;
  sendMessage(data: number[]): void;
  setMessageHandler(handler: MessageHandler): void;
  removeMessageHandler(): void;
  closePorts(): void;
}
