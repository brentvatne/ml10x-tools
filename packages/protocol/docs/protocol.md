# Morningstar ML10X SysEx Protocol

Reverse-engineered from the Morningstar Editor web app (`editor-mkii.morningstar.io/ml10x`), live MIDI captures, and the [morningstarmidi](https://github.com/guyburton/morningstarmidi) Python tool.

## Device Identity

| Field | Value |
|-------|-------|
| Manufacturer ID | `0x00 0x21 0x24` (3-byte extended) |
| Model ID | `0x07` |
| USB MIDI port name | `Morningstar ML10X revb` |

## Hardware

- 4 banks (0-3), 128 presets per bank
- 5 stereo loops (A-E), each with independent tip and ring connectors
- Input tip/ring, output tip/ring (14 internal routing nodes total)
- RevA and RevB hardware variants (detected via controller info response)

## Message Format

Every SysEx message follows this structure:

```
F0 00 21 24 07 00 F1 F2 F3 F4 F5 F6 00 00 LL LL [payload...] CHK F7
```

| Bytes | Name | Description |
|-------|------|-------------|
| 0 | `F0` | SysEx start |
| 1-3 | `00 21 24` | Manufacturer ID |
| 4 | `07` | ML10X model ID |
| 5 | `00` | Protocol version |
| 6-13 | Function bytes | Command/response ID and parameters (F1-F8) |
| 14-15 | Length | MSB/LSB of payload length |
| 16+ | Payload | Optional TLV-encoded data |
| N-2 | Checksum | XOR of all preceding bytes, masked `& 0x7F` |
| N-1 | `F7` | SysEx end |

### Function Bytes

The first two function bytes (F1, F2) identify the message type. F3-F6 carry parameters.

- **Outgoing commands** (host → device): F1 = `0`, F2 = command code
- **Responses** (device → host): F1 = response type, F2 = subtype

### Checksum

XOR all bytes from index 0 through N-3 (everything except the checksum byte and `F7`), then AND with `0x7F`:

```
checksum = (byte[0] ^ byte[1] ^ ... ^ byte[N-3]) & 0x7F
```

## Connection Handshake

The editor performs this exact sequence to connect:

```
OUT: DUMMY           (0, 0)     → f0 00 21 24 07 00 00 00 00 00 00 00 00 00 00 00 72 f7
     wait 100ms
OUT: CONTROLLER INFO (0, 24)    → f0 00 21 24 07 00 00 18 00 00 00 00 00 00 00 00 6a f7
     wait 100ms
OUT: BANK NAMES      (0, 19)    → f0 00 21 24 07 00 00 13 00 00 00 00 00 00 00 00 61 f7
     wait 100ms
OUT: ENTER EDITOR    (0, 21)    → f0 00 21 24 07 00 00 15 00 00 00 00 00 00 00 00 67 f7
```

The device then responds with a data flood:

```
IN:  Status: Connected          (f1=1, f2=0)
IN:  Controller Settings        (f1=6, f2=1)       ~291 bytes
IN:  Preset Data                (f1=6, f2=0)       ~173 bytes — the active preset
IN:  Status: Loading Start      (f1=1, f2=5)
IN:  Bank arrangement           128 messages
IN:  Preset Names               (f1=6, f2=2)       ~1938 bytes
IN:  Status: Loading End        (f1=1, f2=6)
```

### ACK Protocol

After receiving each SysEx message from the device, the host must send an ACK containing the received message's checksum byte:

```
OUT: ACK  (0, 127, received_checksum)
```

The checksum value in the ACK is the byte at position `data[data.length - 2]` of the received message. Without ACKs, the device may stop sending data.

## Commands (F1 = 0)

Commands are sent TO the device. F1 is always 0, F2 is the command code.

| F2 | Hex | Name | Parameters |
|----|-----|------|------------|
| 0 | 0x00 | DUMMY | Handshake init, no params |
| 16 | 0x10 | BANK_UP | Move to next bank. Triggers loading sequence. |
| 17 | 0x11 | BANK_DOWN | Move to previous bank. Triggers loading sequence. |
| 18 | 0x12 | SELECT_PRESET | F3 = preset index (0-127) |
| 19 | 0x13 | REQUEST_BANK_NAMES | Request all bank names |
| 20 | 0x14 | SCROLL_PRESET | F3: 0 = down, 127 = up. Wraps around 0↔127. |
| 21 | 0x15 | ENTER_EDITOR | Put device in editor mode |
| 22 | 0x16 | SELECT_BANK | F3 = bank index (0-3). Triggers loading sequence. |
| 24 | 0x18 | REQUEST_CONTROLLER_INFO | Request firmware/UUID info |
| 27 | 0x1B | WEBSOCKET_INIT | WebSocket initialization (editor internal) |
| 29 | 0x1D | ENGAGE_PRESET | F3 = preset index |
| 30 | 0x1E | ENGAGE_EXP | F3 = expression index |
| 35 | 0x23 | REQUEST_CONTROLLER_SETTINGS_ALL | Request all settings |
| 36 | 0x24 | REQUEST_CONTROLLER_GENERAL_CONFIG | Request general config |
| 37 | 0x25 | REQUEST_WAVEFORM_ENGINE | Request waveform engine data |
| 38 | 0x26 | REQUEST_SEQUENCER_ENGINE | Request sequencer engine data |
| 39 | 0x27 | REQUEST_SCROLL_SLOTS | Request scroll slot config |
| 40 | 0x28 | REQUEST_MIDI_CHANNEL_NAMES | Request MIDI channel names |
| 41 | 0x29 | REQUEST_BANK_ARRANGEMENT | Request bank arrangement |
| 42 | 0x2A | REQUEST_OMNIPORT_DATA | Request omniport configuration |
| 43 | 0x2B | REQUEST_BANK_PRESET_NAMES | Request preset names for all banks |
| 44 | 0x2C | REQUEST_FIRMWARE_VERSION | Request firmware version string |
| 45 | 0x2D | REQUEST_EVENT_PROCESSOR | Request event processor data |
| 46 | 0x2E | REQUEST_CONTROLLER_UUID | Request device UUID |
| 47 | 0x2F | TOGGLE_LOOPER_MODE | Toggle looper mode |
| 64 | 0x40 | REQUEST_PRESET_NAMES | F3 = bank (0-3) |
| 65 | 0x41 | REQUEST_EXPRESSION_CALIBRATION | Request expression pedal calibration |
| 66 | 0x42 | REQUEST_RESISTOR_LADDER_CALIBRATION | Request resistor ladder calibration |
| 80 | 0x50 | REQUEST_MIDI_CLOCK_SLOTS | Request MIDI clock slot config |
| 125 | 0x7D | PING | Heartbeat |
| 126 | 0x7E | RETRY / NACK | Request retransmission |
| 127 | 0x7F | ACK | F3 = checksum of received message |

## Responses (from device)

### Status Messages (F1 = 1)

| F2 | Meaning |
|----|---------|
| 0 | Connected (editor mode entered) |
| 1 | Global settings saved |
| 2 | Preset saved |
| 4 | Disconnected |
| 5 | Loading start |
| 6 | Loading end |
| 7 | Loading progress (F3 = progress 0-100) |
| 8 | Preset copied |
| 9 | Preset pasted |

### Data Messages (F1 = 6)

| F2 | Meaning | Parameters |
|----|---------|------------|
| 0 | Preset data | F3 = preset number, F4 = bank number |
| 1 | Controller settings | Full device configuration |
| 2 | All preset names | F4 = bank number |

### Data Dump Control (F1 = 8)

| F2 | Meaning |
|----|---------|
| 1 | Data dump end |
| 2 | Data dump request next |

### Controller Info (F1 = 17)

Firmware version, hardware revision, UUID. Payload is TLV-encoded.

## Bank/Preset Switching

### Via SysEx (what the editor uses)

```
Select Bank:    (0, 0x16, bank_index)     bank_index = 0-3
Select Preset:  (0, 0x12, preset_index)   preset_index = 0-127
Bank Up:        (0, 0x10)
Bank Down:      (0, 0x11)
Scroll Preset:  (0, 0x14, direction)      0 = down, 127 = up
Engage Preset:  (0, 0x1D, preset_index)   makes preset active on device
```

### Loading Sequence

Bank changes (BANK_UP, BANK_DOWN, SELECT_BANK) trigger a loading sequence:

```
IN:  Status: Loading Start    (f1=1, f2=5)
IN:  Preset Data × N          (f1=6, f2=0)  — all presets in new bank
IN:  Preset Names             (f1=6, f2=2)  — names for new bank
IN:  Status: Loading Progress (f1=1, f2=7, f3=progress)  — may repeat
IN:  Status: Loading End      (f1=1, f2=6)
```

During loading, preset data messages arrive with F3=preset number, F4=bank number. The last preset data message received before LOADING_END reflects the active preset after the bank change. Preset scroll (SCROLL_PRESET) does NOT trigger loading — it sends a single preset data message immediately.

### Via Standard MIDI (also supported)

The device also responds to standard MIDI messages:

| Message | Effect |
|---------|--------|
| CC#0 (value 0-3) | Select bank |
| PC 0-127 | Select preset in current bank |
| CC#4 | Engage/bypass all loops |
| CC#5 | Scroll up |
| CC#6 | Scroll down |
| CC#7 | Mute |
| CC#8 | Unmute |
| CC#9 | Toggle mute |
| CC#10-19 | Loops A-E tip/ring engage/bypass |
| CC#20-29 | Loops A-E tip/ring toggle |

The device sends standard MIDI messages to confirm changes:
- **CC#0**: Bank select confirmation (value = bank number)
- **Program Change**: Preset change confirmation (value = preset number)

## Payload Format (TLV)

Data payloads use a tag-length-value encoding:

```
0x7F [tag_id] [length] [data bytes...]
```

The `0x7F` byte acts as a separator before each TLV entry. Multiple entries are concatenated within the payload region (bytes 16 through N-3). Bytes before the first `0x7F` separator are skipped.

## Preset Data (F1=6, F2=0)

~173 bytes. Sent for the active preset on connection, on every preset change, and for all presets during bank loading. F3 = preset number, F4 = bank number. The TLV payload contains the full routing configuration.

### Node IDs

The ML10X has 14 internal routing nodes. Each node has a fixed ID used throughout the TLV payload:

| ID | Connector | | ID | Connector |
|----|-----------|--|----|-----------|
| `0x00` | Input Tip | | `0x01` | Input Ring |
| `0x02` | Output Tip | | `0x03` | Output Ring |
| `0x04` | Loop A Tip | | `0x09` | Loop A Ring |
| `0x05` | Loop B Tip | | `0x0a` | Loop B Ring |
| `0x06` | Loop C Tip | | `0x0b` | Loop C Ring |
| `0x07` | Loop D Tip | | `0x0c` | Loop D Ring |
| `0x08` | Loop E Tip | | `0x0d` | Loop E Ring |

**Formula:** Tip = `0x04 + loop_index`, Ring = `0x09 + loop_index` (A=0, B=1, C=2, D=3, E=4).

Input Tip/Ring (`0x00`/`0x01`) are always the ultimate signal sources when no loops are engaged. They never appear as TLV tag IDs — only as values (sources) in the connection table.

### Preset Data TLV Tags

| Tag | Length | Description |
|-----|--------|-------------|
| `0x02`–`0x0D` | 1 | **Node connection table.** Tag = destination node ID, value = source node ID. Each entry says "this node receives signal from [value]." See detailed section below. |
| `0x14` | 1 | **Configuration bitmask.** Observed as `0x7F` in all tested presets. Exact meaning TBD. |
| `0x20` | 12 | **Preset name.** 12-char ASCII string, null/space-padded. |
| `0x30`–`0x3F` | 3 | **Routing source bitmask.** Redundant bitmask representation of routing. See detailed section below. |

### Node Connection Table (Tags 0x02–0x0D)

This is the primary way to read the routing. For a given preset:

1. Parse the TLV entries with tags `0x02`–`0x0D`
2. Each tag present = a destination node, its 1-byte value = the source node ID
3. Tags that are **absent** = the engaged loop's connectors (they are active sources in the signal chain)
4. The absent tags' node IDs appear as **values** in all other entries (they are what everything else receives from)
5. **Empty/unused presets** have zero connection tags — no loops are engaged

#### Routing Topology

The ML10X uses a **fan-out** topology: a single source broadcasts to all other nodes simultaneously. There is no serial chain.

- **All loops bypassed:** Input is the source. All loop connectors and Output receive from Input.
- **One loop engaged:** That loop replaces Input as the source. Input is disconnected. All other loop connectors and Output receive from the engaged loop.
- The engaged loop's own tip/ring tags are absent from the table (they ARE the source, not a destination).

#### Examples

**All bypassed (preset 0) — Input fans out to everything:**
```
tag=0x02 val=0x00  →  Output Tip    ← Input Tip
tag=0x03 val=0x01  →  Output Ring   ← Input Ring
tag=0x04 val=0x00  →  Loop A Tip    ← Input Tip
tag=0x05 val=0x00  →  Loop B Tip    ← Input Tip
tag=0x06 val=0x00  →  Loop C Tip    ← Input Tip
tag=0x07 val=0x00  →  Loop D Tip    ← Input Tip
tag=0x08 val=0x00  →  Loop E Tip    ← Input Tip
tag=0x09 val=0x01  →  Loop A Ring   ← Input Ring
tag=0x0a val=0x01  →  Loop B Ring   ← Input Ring
tag=0x0b val=0x01  →  Loop C Ring   ← Input Ring
tag=0x0c val=0x01  →  Loop D Ring   ← Input Ring
tag=0x0d val=0x01  →  Loop E Ring   ← Input Ring
(all 12 tags present — no loops engaged, Input is the source)
```

**Loop A engaged — A fans out, Input disconnected:**
```
tag=0x02 val=0x04  →  Output Tip    ← Loop A Tip
tag=0x03 val=0x09  →  Output Ring   ← Loop A Ring
tag=0x05 val=0x04  →  Loop B Tip    ← Loop A Tip
tag=0x06 val=0x04  →  Loop C Tip    ← Loop A Tip
tag=0x07 val=0x04  →  Loop D Tip    ← Loop A Tip
tag=0x08 val=0x04  →  Loop E Tip    ← Loop A Tip
tag=0x0a val=0x09  →  Loop B Ring   ← Loop A Ring
tag=0x0b val=0x09  →  Loop C Ring   ← Loop A Ring
tag=0x0c val=0x09  →  Loop D Ring   ← Loop A Ring
tag=0x0d val=0x09  →  Loop E Ring   ← Loop A Ring
(tags 0x04 and 0x09 absent — Loop A Tip/Ring are the active sources)
```

**Loop D engaged — D fans out, Input disconnected:**
```
tag=0x02 val=0x07  →  Output Tip    ← Loop D Tip
tag=0x03 val=0x0c  →  Output Ring   ← Loop D Ring
tag=0x04 val=0x07  →  Loop A Tip    ← Loop D Tip
tag=0x05 val=0x07  →  Loop B Tip    ← Loop D Tip
tag=0x06 val=0x07  →  Loop C Tip    ← Loop D Tip
tag=0x08 val=0x07  →  Loop E Tip    ← Loop D Tip
tag=0x09 val=0x0c  →  Loop A Ring   ← Loop D Ring
tag=0x0a val=0x0c  →  Loop B Ring   ← Loop D Ring
tag=0x0b val=0x0c  →  Loop C Ring   ← Loop D Ring
tag=0x0d val=0x0c  →  Loop E Ring   ← Loop D Ring
(tags 0x07 and 0x0c absent — Loop D Tip/Ring are the active sources)
```

#### Detecting Engaged Loops

A loop is engaged when **both** its tip tag (`0x04 + loop_index`) and ring tag (`0x09 + loop_index`) are absent from the connection table. If both are absent, that loop is an active source.

### Routing Source Bitmask (Tags 0x30–0x3F)

Each of the 16 tags represents a routing destination. The 3-byte value encodes which source node(s) feed it, using one bit per source. This is redundant with the node connection table for simple presets but may encode additional information for multi-source and advanced routing configurations.

**Destination tag mapping:**

| Tag | Destination | | Tag | Destination |
|-----|-------------|--|-----|-------------|
| `0x31` | Output Tip | | `0x3f` | Output Ring |
| `0x3c` | Loop A Tip | | `0x38` | Loop A Ring |
| `0x3d` | Loop B Tip | | `0x3b` | Loop B Ring |
| `0x3e` | Loop C Tip | | `0x37` | Loop C Ring |
| `0x33` | Loop D Tip | | `0x32` | Loop D Ring |
| `0x34` | Loop E Tip | | `0x35` | Loop E Ring |

Tags `0x30`, `0x36`, `0x39`, `0x3a` are always zero (reserved).

**Source bit positions:**

| Byte | Bit | Source | Byte | Bit | Source |
|------|-----|--------|------|-----|--------|
| 0 | 0 | Loop A Tip | 1 | 2 | Loop E Ring |
| 0 | 1 | Loop A Ring | 1 | 3 | Loop E Tip |
| 0 | 2 | Input Ring | 1 | 4 | Loop C Ring |
| 0 | 3 | Input Tip | 1 | 5 | Loop D Tip |
| 0 | 4 | Loop B Tip | 1 | 6 | Loop D Ring |
| 0 | 6 | Loop C Tip | 2 | 1 | Loop B Ring |

## Preset Names (F1=6, F2=2)

~1938 bytes. F4 = bank number. Payload contains 128 TLV entries (one per preset in the bank), each with a 12-byte ASCII name. Parse with the standard TLV format, then decode each entry's data as a string, trimming trailing nulls and whitespace.

## Implementation Notes

### Session State Machine

The session tracks `bank`, `preset`, and `loading` state internally:

- **Preset changes** (SCROLL_PRESET, Program Change): Device sends a single Preset Data message (f1=6, f2=0). Session updates bank/preset and emits `preset` + `presetData` events.
- **Bank changes** (BANK_UP, BANK_DOWN, SELECT_BANK): Device sends LOADING_START, then preset data for all presets in the bank, then LOADING_END. During loading, the session tracks bank/preset from incoming preset data but suppresses `preset` events to avoid UI flicker. When LOADING_END fires, the session emits `preset` with the final bank/preset values.
- **Standard MIDI**: CC#0 updates bank, Program Change updates preset. Both emit `preset` immediately.

### iOS CoreMIDI Notes

When receiving SysEx via CoreMIDI with `._1_0` (UMP) protocol:
- UMP type `0x3` (SysEx) packets strip `F0`/`F7` delimiters. Must prepend `F0` and append `F7` when reassembling.
- CoreMIDI `._1_0` never delivers UMP "End" status packets — only Start and Continue arrive. Workaround: emit the buffer when a new Start packet arrives with data already in the buffer ("implicit end").
- Must use `unsafeSequence()` for `MIDIEventList` iteration — copying `eventList.pointee` causes `EXC_BAD_ACCESS`.
- `MIDIObjectGetStringProperty` follows the "Get Rule" — use `takeUnretainedValue()`, not `takeRetainedValue()`.
- `MIDIEventList` must be heap-allocated for SysEx sends — stack allocation is too small.
