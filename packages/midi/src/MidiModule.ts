// Node.js MIDI implementation using @julusian/midi (native CoreMIDI/ALSA bindings)
// This is the default platform resolution. Metro will resolve .ios.ts / .android.ts instead.
import midi from "@julusian/midi";
import type { MidiModule, MessageHandler } from "@ml10x-tools/protocol";

const input = new midi.Input();
const output = new midi.Output();
let handler: MessageHandler | null = null;

export const platformModule: MidiModule = {
  listInputs() {
    const names: string[] = [];
    for (let i = 0; i < input.getPortCount(); i++) {
      names.push(input.getPortName(i));
    }
    return names;
  },

  listOutputs() {
    const names: string[] = [];
    for (let i = 0; i < output.getPortCount(); i++) {
      names.push(output.getPortName(i));
    }
    return names;
  },

  openPorts(inputName: string, outputName: string) {
    const inputs = this.listInputs();
    const outputs = this.listOutputs();

    const inIdx = inputs.findIndex((n) => n.includes(inputName));
    const outIdx = outputs.findIndex((n) => n.includes(outputName));

    if (inIdx < 0 || outIdx < 0) {
      throw new Error(
        `MIDI ports not found.\n  Looking for: "${inputName}" / "${outputName}"\n  Inputs: ${inputs.join(", ")}\n  Outputs: ${outputs.join(", ")}`,
      );
    }

    // Enable SysEx, timing, and active sensing
    input.ignoreTypes(false, false, false);

    input.on("message", (deltaTime: number, message: number[]) => {
      handler?.(message, deltaTime);
    });

    input.openPort(inIdx);
    output.openPort(outIdx);
  },

  sendMessage(data: number[]) {
    output.sendMessage(data);
  },

  setMessageHandler(h: MessageHandler) {
    handler = h;
  },

  removeMessageHandler() {
    handler = null;
  },

  closePorts() {
    input.closePort();
    output.closePort();
  },
};
