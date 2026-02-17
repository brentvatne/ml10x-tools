// Morningstar ML10X MIDI Protocol
// Reverse-engineered from the Morningstar Editor (editor-mkii.morningstar.io)

export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;

export const MANUFACTURER_ID = [0x00, 0x21, 0x24] as const;
export const ML10X_MODEL_ID = 0x07;

// Byte positions in SysEx messages
export enum Pos {
  SYSEX_START = 0,
  MANF_ID_1 = 1,
  MANF_ID_2 = 2,
  MANF_ID_3 = 3,
  MODEL_ID = 4,
  VERSION_ID = 5,
  FUNC_1 = 6,
  FUNC_2 = 7,
  FUNC_3 = 8,
  FUNC_4 = 9,
  FUNC_5 = 10,
  FUNC_6 = 11,
  FUNC_7 = 12,
  FUNC_8 = 13,
  LEN_MSB = 14,
  LEN_LSB = 15,
}

// SysEx function codes (from editor's Gt enum)
export enum Func {
  DUMMY = 0,
  BANK_UP = 16,
  BANK_DOWN = 17,
  SELECT_PRESET = 18,
  REQUEST_BANK_NAMES = 19,
  SCROLL_PRESET = 20,
  ENTER_EDITOR = 21,
  SELECT_BANK = 22,
  REQUEST_CONTROLLER_INFO = 24,
  WEBSOCKET_INIT = 27,
  ENGAGE_PRESET = 29,
  ENGAGE_EXP = 30,
  REQUEST_CONTROLLER_SETTINGS_ALL = 35,
  REQUEST_CONTROLLER_GENERAL_CONFIG = 36,
  REQUEST_WAVEFORM_ENGINE = 37,
  REQUEST_SEQUENCER_ENGINE = 38,
  REQUEST_SCROLL_SLOTS = 39,
  REQUEST_MIDI_CHANNEL_NAMES = 40,
  REQUEST_BANK_ARRANGEMENT = 41,
  REQUEST_OMNIPORT_DATA = 42,
  REQUEST_BANK_PRESET_NAMES = 43,
  REQUEST_CONTROLLER_FIRMWARE_VERSION = 44,
  REQUEST_EVENT_PROCESSOR = 45,
  REQUEST_CONTROLLER_UUID = 46,
  TOGGLE_LOOPER_MODE = 47,
  REQUEST_PRESET_NAMES = 64,
  REQUEST_EXPRESSION_CALIBRATION = 65,
  REQUEST_RESISTOR_LADDER_CALIBRATION = 66,
  REQUEST_MIDI_CLOCK_SLOTS = 80,
  PING = 125,
  RETRY = 126,
  ACK = 127,
}

// Response function byte 1 values
export enum ResponseType {
  STATUS = 1,
  PRESET_DATA = 6,
  DATA_DUMP = 8,
  INFO = 17,
}

// Status codes (f1=1, f2=code)
export enum StatusCode {
  CONNECTED = 0,
  GLOBAL_SETTINGS_SAVED = 1,
  PRESET_SAVED = 2,
  DISCONNECTED = 4,
  LOADING_START = 5,
  LOADING_END = 6,
  LOADING_PROGRESS = 7,
  PRESET_COPIED = 8,
  PRESET_PASTED = 9,
}

// CC numbers for ML10X
export enum CC {
  BANK_SELECT = 0,
  ENGAGE_BYPASS_ALL = 4,
  SCROLL_UP = 5,
  SCROLL_DOWN = 6,
  MUTE = 7,
  UNMUTE = 8,
  TOGGLE_MUTE = 9,
  // Loops A-E Tip/Ring engage/bypass: CC 10-19
  // Loops A-E Tip/Ring toggle: CC 20-29
}

export function checksum(data: number[]): number {
  let xor = data[0]!;
  for (let i = 1; i < data.length - 2; i++) {
    xor ^= data[i]!;
  }
  return xor & 0x7f;
}

export function buildSysex(
  f1: number,
  f2: number,
  f3 = 0,
  f4 = 0,
  f5 = 0,
  f6 = 0,
  payload: number[] = [],
): number[] {
  const msg = [
    SYSEX_START,
    ...MANUFACTURER_ID,
    ML10X_MODEL_ID,
    0, // version
    0, 0, 0, 0, 0, 0, 0, 0, // function bytes (filled below)
    0, 0, // length MSB/LSB
  ];
  msg[Pos.FUNC_1] = f1;
  msg[Pos.FUNC_2] = f2;
  msg[Pos.FUNC_3] = f3;
  msg[Pos.FUNC_4] = f4;
  msg[Pos.FUNC_5] = f5;
  msg[Pos.FUNC_6] = f6;

  const full = [...msg, ...payload, 0, SYSEX_END];
  full[full.length - 2] = checksum(full);
  return full;
}

export function buildPing(): number[] {
  return buildSysex(0, Func.PING);
}

export function buildAck(value = 0): number[] {
  return buildSysex(0, Func.ACK, value);
}

export function buildRequestFirmwareVersion(): number[] {
  return buildSysex(0, Func.REQUEST_CONTROLLER_FIRMWARE_VERSION);
}

export function buildRequestUUID(): number[] {
  return buildSysex(0, Func.REQUEST_CONTROLLER_UUID);
}

export function buildRequestPresetNames(bank: number): number[] {
  return buildSysex(0, Func.REQUEST_PRESET_NAMES, bank);
}

export function buildRequestBankPresetNames(): number[] {
  return buildSysex(0, Func.REQUEST_BANK_PRESET_NAMES);
}

export function buildRequestControllerSettings(): number[] {
  return buildSysex(0, Func.REQUEST_CONTROLLER_SETTINGS_ALL);
}

export function buildEngagePreset(presetNum: number): number[] {
  return buildSysex(0, Func.ENGAGE_PRESET, presetNum);
}

export function buildDummy(): number[] {
  return buildSysex(0, Func.DUMMY);
}

export function buildRequestControllerInfo(): number[] {
  return buildSysex(0, Func.REQUEST_CONTROLLER_INFO);
}

export function buildRequestBankNames(): number[] {
  return buildSysex(0, Func.REQUEST_BANK_NAMES);
}

export function buildEnterEditor(): number[] {
  return buildSysex(0, Func.ENTER_EDITOR);
}

export function buildSelectBank(bank: number): number[] {
  return buildSysex(0, Func.SELECT_BANK, bank);
}

export function buildSelectPreset(preset: number): number[] {
  return buildSysex(0, Func.SELECT_PRESET, preset);
}

export function buildBankUp(): number[] {
  return buildSysex(0, Func.BANK_UP);
}

export function buildBankDown(): number[] {
  return buildSysex(0, Func.BANK_DOWN);
}

export function buildScrollPresetUp(): number[] {
  return buildSysex(0, Func.SCROLL_PRESET, 127);
}

export function buildScrollPresetDown(): number[] {
  return buildSysex(0, Func.SCROLL_PRESET, 0);
}

// Standard MIDI messages (non-SysEx)
export function buildBankSelect(channel: number, bank: number): number[] {
  return [0xb0 + (channel - 1), CC.BANK_SELECT, bank & 0x03];
}

export function buildProgramChange(channel: number, preset: number): number[] {
  return [0xc0 + (channel - 1), preset & 0x7f];
}

export function isML10XSysex(data: number[] | Uint8Array): boolean {
  return (
    data.length >= 8 &&
    data[0] === SYSEX_START &&
    data[1] === MANUFACTURER_ID[0] &&
    data[2] === MANUFACTURER_ID[1] &&
    data[3] === MANUFACTURER_ID[2] &&
    data[4] === ML10X_MODEL_ID
  );
}

export function parseSysex(data: number[] | Uint8Array) {
  if (!isML10XSysex(data)) return null;
  return {
    modelId: data[Pos.MODEL_ID] as number,
    f1: data[Pos.FUNC_1] as number,
    f2: data[Pos.FUNC_2] as number,
    f3: data[Pos.FUNC_3] as number,
    f4: data[Pos.FUNC_4] as number,
    f5: data[Pos.FUNC_5] as number,
    f6: data[Pos.FUNC_6] as number,
    payload: Array.from(data.slice(16, data.length - 2)),
  };
}

export interface TLVEntry {
  tag: number;
  data: number[];
}

export function parseTLV(payload: number[]): TLVEntry[] {
  const entries: TLVEntry[] = [];
  let i = 0;
  while (i < payload.length) {
    if (payload[i] !== 0x7f) { i++; continue; }
    if (i + 2 >= payload.length) break;
    const tag = payload[i + 1]!;
    const len = payload[i + 2]!;
    if (i + 3 + len > payload.length) break;
    entries.push({ tag, data: payload.slice(i + 3, i + 3 + len) });
    i += 3 + len;
  }
  return entries;
}

export function parsePresetNames(payload: number[]): string[] {
  const entries = parseTLV(payload);
  return entries.map((e) =>
    String.fromCharCode(...e.data).replace(/\0+$/, "").trim()
  );
}

// ─── Routing Model ───────────────────────────────────────────────

export enum NodeId {
  InputTip = 0x00,
  InputRing = 0x01,
  OutputTip = 0x02,
  OutputRing = 0x03,
  LoopATip = 0x04,
  LoopBTip = 0x05,
  LoopCTip = 0x06,
  LoopDTip = 0x07,
  LoopETip = 0x08,
  LoopARing = 0x09,
  LoopBRing = 0x0a,
  LoopCRing = 0x0b,
  LoopDRing = 0x0c,
  LoopERing = 0x0d,
}

export const NODE_LABELS: Record<NodeId, string> = {
  [NodeId.InputTip]: "Input Tip",
  [NodeId.InputRing]: "Input Ring",
  [NodeId.OutputTip]: "Output Tip",
  [NodeId.OutputRing]: "Output Ring",
  [NodeId.LoopATip]: "Loop A Tip",
  [NodeId.LoopBTip]: "Loop B Tip",
  [NodeId.LoopCTip]: "Loop C Tip",
  [NodeId.LoopDTip]: "Loop D Tip",
  [NodeId.LoopETip]: "Loop E Tip",
  [NodeId.LoopARing]: "Loop A Ring",
  [NodeId.LoopBRing]: "Loop B Ring",
  [NodeId.LoopCRing]: "Loop C Ring",
  [NodeId.LoopDRing]: "Loop D Ring",
  [NodeId.LoopERing]: "Loop E Ring",
};

export enum Loop {
  A = 0,
  B = 1,
  C = 2,
  D = 3,
  E = 4,
}

export const LOOPS = [Loop.A, Loop.B, Loop.C, Loop.D, Loop.E] as const;
export const LOOP_NAMES = ["A", "B", "C", "D", "E"] as const;

export function loopTip(loop: Loop): NodeId {
  return NodeId.LoopATip + loop;
}

export function loopRing(loop: Loop): NodeId {
  return NodeId.LoopARing + loop;
}

export interface PresetData {
  name: string;
  /** Destination node → source node. Engaged loops' connectors are absent (they are sources). */
  connections: Partial<Record<NodeId, NodeId>>;
  /** Loops whose connectors are active sources in the signal chain. */
  engagedLoops: Loop[];
}

export function parsePresetData(payload: number[]): PresetData {
  const entries = parseTLV(payload);

  let name = "";
  const connections: Partial<Record<NodeId, NodeId>> = {};
  const presentTags = new Set<number>();

  for (const entry of entries) {
    if (entry.tag === 0x20) {
      name = String.fromCharCode(...entry.data).replace(/\0+$/, "").trim();
    }
    if (entry.tag >= 0x02 && entry.tag <= 0x0d && entry.data.length === 1) {
      connections[entry.tag as NodeId] = entry.data[0] as NodeId;
      presentTags.add(entry.tag);
    }
  }

  // If no connection tags at all, this is an empty/unused preset
  if (presentTags.size === 0) {
    return { name, connections, engagedLoops: [] };
  }

  // Engaged loops: both tip and ring tags are absent from the connection table
  const engagedLoops: Loop[] = [];
  for (const loop of LOOPS) {
    if (!presentTags.has(loopTip(loop)) && !presentTags.has(loopRing(loop))) {
      engagedLoops.push(loop);
    }
  }

  return { name, connections, engagedLoops };
}

// ─── Utilities ───────────────────────────────────────────────────

export function hexDump(data: number[] | Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

export function describeSysex(data: number[] | Uint8Array): string {
  const parsed = parseSysex(data);
  if (!parsed) return `Unknown: ${hexDump(data)}`;

  const { f1, f2, f3, f4 } = parsed;

  if (f1 === ResponseType.STATUS) {
    const names: Record<number, string> = {
      [StatusCode.CONNECTED]: "Device Connected",
      [StatusCode.DISCONNECTED]: "Device Disconnected",
      [StatusCode.PRESET_SAVED]: "Preset Saved",
      [StatusCode.GLOBAL_SETTINGS_SAVED]: "Global Settings Saved",
      [StatusCode.LOADING_START]: "Loading Start",
      [StatusCode.LOADING_END]: "Loading End",
      [StatusCode.LOADING_PROGRESS]: `Loading Progress: ${f3}`,
    };
    return names[f2] ?? `Status(${f2})`;
  }

  if (f1 === ResponseType.PRESET_DATA) {
    if (f2 === 0) return `Preset Data: bank=${f4} preset=${f3} advanced=${f3 > 0}`;
    if (f2 === 1) return "Controller Settings Data";
    if (f2 === 2) return `Preset Names: bank=${f4}`;
  }

  if (f1 === ResponseType.DATA_DUMP) {
    if (f2 === 1) return "Data Dump End";
    if (f2 === 2) return "Data Dump Request Next";
    return `Data Dump(${f2})`;
  }

  if (f1 === ResponseType.INFO) return "Controller Info Response";

  // Outgoing commands
  if (f1 === 0) {
    const names: Record<number, string> = {
      [Func.DUMMY]: "Dummy (Init)",
      [Func.BANK_UP]: "Bank Up",
      [Func.BANK_DOWN]: "Bank Down",
      [Func.SELECT_PRESET]: `Select Preset ${f3}`,
      [Func.REQUEST_BANK_NAMES]: "Request Bank Names",
      [Func.SCROLL_PRESET]: `Scroll Preset ${f3 === 127 ? "Up" : "Down"}`,
      [Func.ENTER_EDITOR]: "Enter Editor Mode",
      [Func.SELECT_BANK]: `Select Bank ${f3}`,
      [Func.REQUEST_CONTROLLER_INFO]: "Request Controller Info",
      [Func.ENGAGE_PRESET]: `Engage Preset ${f3}`,
      [Func.ENGAGE_EXP]: `Engage Expression ${f3}`,
      [Func.REQUEST_PRESET_NAMES]: `Request Preset Names (bank=${f3})`,
      [Func.REQUEST_BANK_PRESET_NAMES]: "Request Bank Preset Names",
      [Func.REQUEST_CONTROLLER_FIRMWARE_VERSION]: "Request Firmware Version",
      [Func.REQUEST_CONTROLLER_UUID]: "Request UUID",
      [Func.REQUEST_CONTROLLER_SETTINGS_ALL]: "Request All Settings",
      [Func.PING]: "Ping",
      [Func.ACK]: `Ack(${f3})`,
    };
    return names[f2] ?? `Command(f2=${f2}, f3=${f3}, f4=${f4})`;
  }

  return `SysEx(f1=${f1}, f2=${f2}, f3=${f3}, f4=${f4})`;
}
