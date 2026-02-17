import { registerWebModule, NativeModule } from 'expo';

import { MidiModuleEvents } from './Midi.types';

class MidiModule extends NativeModule<MidiModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(MidiModule, 'MidiModule');
