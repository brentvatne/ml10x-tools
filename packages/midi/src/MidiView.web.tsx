import * as React from 'react';

import { MidiViewProps } from './Midi.types';

export default function MidiView(props: MidiViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
