// Reexport the native module. On web, it will be resolved to MidiModule.web.ts
// and on native platforms to MidiModule.ts
export { default } from './MidiModule';
export { default as MidiView } from './MidiView';
export * from  './Midi.types';
