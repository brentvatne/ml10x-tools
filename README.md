# ml10x-tools

Tools for the ML10X MIDI controller.

## Platform Support

| Platform    | Status |
|-------------|--------|
| CLI (Node)  | Works  |
| iOS         | Works  |
| Android     | Not yet implemented |

## Structure

- `packages/protocol` — ML10X SysEx protocol (encode/decode)
- `packages/midi` — MIDI transport (Node via `@julusian/midi`, iOS via CoreMIDI)
- `apps/cli` — Command-line interface
- `apps/mobile` — Expo app

## Setup

```bash
bun install
```

## CLI

```bash
npx ml10x
```

## Mobile

```bash
cd apps/mobile
npx expo run:ios
```
