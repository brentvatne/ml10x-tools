import { NativeModule, requireNativeModule } from "expo";

type MidiModuleEvents = {
  onMidiMessage: (event: { data: number[]; deltaTime: number }) => void;
  onDevicesChanged: () => void;
  onDisconnect: () => void;
};

declare class ExpoMidiModuleClass extends NativeModule<MidiModuleEvents> {
  listInputs(): string[];
  listOutputs(): string[];
  openPorts(inputName: string, outputName: string): void;
  sendMessage(data: number[]): void;
  closePorts(): void;
}

export default requireNativeModule<ExpoMidiModuleClass>("Midi");
