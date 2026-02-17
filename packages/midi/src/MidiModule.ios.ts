import type { MidiModule, MessageHandler } from "@ml10x-tools/protocol";
import ExpoMidiModule from "./ExpoMidiModule";

let handler: MessageHandler | null = null;
let subscription: { remove(): void } | null = null;

export const platformModule: MidiModule = {
  listInputs: () => ExpoMidiModule.listInputs(),
  listOutputs: () => ExpoMidiModule.listOutputs(),
  openPorts: (input, output) => ExpoMidiModule.openPorts(input, output),
  sendMessage: (data) => ExpoMidiModule.sendMessage(data),
  setMessageHandler: (h) => {
    handler = h;
    if (!subscription) {
      subscription = ExpoMidiModule.addListener("onMidiMessage", (event) => {
        handler?.(event.data, event.deltaTime);
      });
    }
  },
  removeMessageHandler: () => {
    handler = null;
    subscription?.remove();
    subscription = null;
  },
  closePorts: () => ExpoMidiModule.closePorts(),
};
