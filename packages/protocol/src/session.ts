import { EventEmitter } from "events";
import type { Transport } from "./transport.ts";
import {
  buildAck,
  buildDummy,
  buildEnterEditor,
  buildRequestBankNames,
  buildRequestControllerInfo,
  describeSysex,
  isML10XSysex,
  parsePresetData,
  parsePresetNames,
  parseSysex,
  ResponseType,
  StatusCode,
  type PresetData,
} from "./protocol.ts";

export interface ML10XSessionEvents {
  connected: [];
  disconnected: [];
  preset: [bank: number, preset: number];
  presetName: [name: string];
  loading: [active: boolean];
  loadingProgress: [progress: number];
  presetData: [bank: number, preset: number, data: PresetData];
  message: [description: string, data: number[]];
  midi: [data: number[]];
  info: [payload: number[]];
}

export class ML10XSession extends EventEmitter<ML10XSessionEvents> {
  private _bank = 0;
  private _preset = 0;
  private _loading = false;
  private _presetNames: Map<number, string[]> = new Map();
  private _loadingPresetCache: Map<number, PresetData> = new Map();

  constructor(private transport: Transport) {
    super();
  }

  get bank() {
    return this._bank;
  }
  get preset() {
    return this._preset;
  }
  get loading() {
    return this._loading;
  }

  async connect() {
    this.transport.onMessage((data, _deltaTime) => this.handleMessage(data));
    await this.transport.open();

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    this.send(buildDummy());
    await delay(100);
    this.send(buildRequestControllerInfo());
    await delay(100);
    this.send(buildRequestBankNames());
    await delay(100);
    this.send(buildEnterEditor());
  }

  send(data: number[]) {
    this.transport.send(data);
  }

  close() {
    this.transport.offMessage();
    this.transport.close();
  }

  private emitPresetName() {
    const names = this._presetNames.get(this._bank);
    const name = names?.[this._preset] ?? "";
    this.emit("presetName", name);
  }

  private handleMessage(data: number[]) {
    if (data[0] === 0xf0) {
      if (isML10XSysex(data)) {
        const parsed = parseSysex(data);
        if (!parsed) return;

        const desc = describeSysex(data);
        this.emit("message", desc, data);

        // ACK protocol: send back ack with received message's checksum
        const receivedChecksum = data[data.length - 2]!;
        this.send(buildAck(receivedChecksum));

        if (parsed.f1 === ResponseType.PRESET_DATA && parsed.f2 === 2) {
          const bank = parsed.f4;
          const names = parsePresetNames(parsed.payload);
          this._presetNames.set(bank, names);
          this.emitPresetName();
        }

        if (parsed.f1 === ResponseType.PRESET_DATA && parsed.f2 === 0) {
          const presetData = parsePresetData(parsed.payload);
          if (this._loading) {
            // During loading, cache all preset data and track bank
            this._bank = parsed.f4;
            this._loadingPresetCache.set(parsed.f3, presetData);
          } else {
            this.emit("presetData", parsed.f4, parsed.f3, presetData);
            this._preset = parsed.f3;
            this._bank = parsed.f4;
            this.emit("preset", this._bank, this._preset);
            this.emitPresetName();
          }
        }

        if (parsed.f1 === ResponseType.INFO) {
          this.emit("info", Array.from(data.slice(16, -2)));
        }

        if (parsed.f1 === ResponseType.STATUS) {
          if (parsed.f2 === StatusCode.CONNECTED) {
            this.emit("connected");
          } else if (parsed.f2 === StatusCode.DISCONNECTED) {
            this.emit("disconnected");
          } else if (parsed.f2 === StatusCode.LOADING_START) {
            this._loading = true;
            this.emit("loading", true);
          } else if (parsed.f2 === StatusCode.LOADING_PROGRESS) {
            this.emit("loadingProgress", parsed.f3);
          } else if (parsed.f2 === StatusCode.LOADING_END) {
            this._loading = false;
            this.emit("loading", false);
            const cached = this._loadingPresetCache.get(this._preset);
            if (cached) {
              this.emit("presetData", this._bank, this._preset, cached);
            }
            this._loadingPresetCache.clear();
            this.emit("preset", this._bank, this._preset);
            this.emitPresetName();
          }
        }
      }
    } else {
      this.emit("midi", data);

      const status = data[0]! & 0xf0;
      if (status === 0xc0) {
        this._preset = data[1]!;
        this.emit("preset", this._bank, this._preset);
      } else if (status === 0xb0) {
        const cc = data[1]!;
        const val = data[2]!;
        if (cc === 0) {
          this._bank = val;
          this.emit("preset", this._bank, this._preset);
        }
      }
    }
  }
}
