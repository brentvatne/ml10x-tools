import { NativeModule, requireNativeModule } from 'expo';

import { MidiModuleEvents } from './Midi.types';

declare class MidiModule extends NativeModule<MidiModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MidiModule>('Midi');
