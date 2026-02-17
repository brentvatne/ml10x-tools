# Morningstar ML10X SysEx Protocol

Reverse-engineered from the Morningstar Editor web app (`editor-mkii.morningstar.io/ml10x`), live MIDI captures, and the [morningstarmidi](https://github.com/guyburton/morningstarmidi) Python tool.

## Device Identity

| Field | Value |
|-------|-------|
| Manufacturer ID | `0x00 0x21 0x24` (3-byte extended) |
| Model ID | `0x07` |
| USB MIDI port name | `Morningstar ML10X revb` |

## Message Format

Every SysEx message follows this structure:

```
F0 00 21 24 07 00 F1 F2 F3 F4 F5 F6 00 00 00 00 [payload...] CHK F7
```

Broken down:

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

- **Outgoing commands** (to device): F1 = `0`, F2 = command code
- **Responses** (from device): F1 = response type, F2 = subtype

### Checksum

XOR all bytes from index 0 through N-3 (everything except the checksum byte and `F7`), then AND with `0x7F`:

```
checksum = (byte[0] ^ byte[1] ^ ... ^ byte[N-3]) & 0x7F
```

From the editor source:
```js
let o = i[0];
for (let h = 1; h < i.length - 2; h++) o ^= i[h];
o &= 127;
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

After receiving each SysEx message from the device, the editor sends an ACK containing the received message's checksum:

```
OUT: ACK  (0, 127, received_checksum)
```

Without ACKs, the device may stop sending data.

## Commands (F1 = 0)

Commands are sent TO the device. F1 is always 0, F2 is the command code.

| F2 | Hex | Name | Parameters |
|----|-----|------|------------|
| 0 | 0x00 | DUMMY | Handshake init, no params |
| 16 | 0x10 | BANK_UP | Move to next bank |
| 17 | 0x11 | BANK_DOWN | Move to previous bank |
| 18 | 0x12 | SELECT_PRESET | F3 = preset index (0-127) |
| 19 | 0x13 | REQUEST_BANK_NAMES | Request all bank names |
| 20 | 0x14 | SCROLL_PRESET | F3: 0 = down, 127 = up |
| 21 | 0x15 | ENTER_EDITOR | Put device in editor mode |
| 22 | 0x16 | SELECT_BANK | F3 = bank index (0-3) |
| 24 | 0x18 | REQUEST_CONTROLLER_INFO | Request firmware/UUID info |
| 29 | 0x1D | ENGAGE_PRESET | F3 = preset index |
| 30 | 0x1E | ENGAGE_EXP | F3 = expression index |
| 35 | 0x23 | REQUEST_CONTROLLER_SETTINGS_ALL | Request all settings |
| 43 | 0x2B | REQUEST_BANK_PRESET_NAMES | Request preset names for all banks |
| 44 | 0x2C | REQUEST_FIRMWARE_VERSION | Request firmware version string |
| 46 | 0x2E | REQUEST_CONTROLLER_UUID | Request device UUID |
| 64 | 0x40 | REQUEST_PRESET_NAMES | F3 = bank (0-3) |
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
| 7 | Loading progress (F3 = progress value) |
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
Engage Preset:  (0, 0x1D, preset_index)   makes preset active on device
```

### Via Standard MIDI (also supported)

- CC#0 value 0-3: select bank
- PC 0-127: select preset in current bank
- CC#10-19: loop A-E tip/ring engage/bypass
- CC#20-29: loop A-E tip/ring toggle

## Hardware

- 4 banks, 128 presets per bank
- 5 stereo loops (A-E), each with independent tip and ring
- Input tip/ring, output tip/ring
- RevA and RevB hardware variants (detected via controller info response)

## Payload Format (TLV)

Data payloads use a tag-length-value encoding:

```
0x7F [tag_id] [length] [data bytes...]
```

The `0x7F` byte acts as a separator before each TLV entry. Multiple entries are concatenated within the payload region (bytes 16 through N-3).

Parsing TLV payloads is needed for extracting preset routing, connector names, and device configuration — but is not required for basic monitoring and switching.
