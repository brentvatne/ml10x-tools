import { requireNativeView } from 'expo';
import * as React from 'react';

import { MidiViewProps } from './Midi.types';

const NativeView: React.ComponentType<MidiViewProps> =
  requireNativeView('Midi');

export default function MidiView(props: MidiViewProps) {
  return <NativeView {...props} />;
}
