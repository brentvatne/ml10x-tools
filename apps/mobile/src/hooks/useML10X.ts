import { useState, useRef, useCallback } from "react";
import { MidiTransport } from "@ml10x-tools/midi";
import { ML10XSession, hexDump, buildScrollPresetUp, buildScrollPresetDown, buildBankUp, buildBankDown, type TLVEntry } from "@ml10x-tools/protocol";

export type ConnectionState = "disconnected" | "connecting" | "connected";

const MAX_LOGS = 100;

export function useML10X() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [bank, setBank] = useState(0);
  const [preset, setPreset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [presetName, setPresetName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const sessionRef = useRef<ML10XSession | null>(null);

  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), msg]);
  }, []);

  const connect = useCallback(async () => {
    sessionRef.current?.close();
    sessionRef.current = null;

    setError(null);
    setLogs([]);
    setConnectionState("connecting");

    try {
      const transport = new MidiTransport();
      const inputs = transport.listInputs();
      const outputs = transport.listOutputs();
      log(`inputs: [${inputs.join(", ")}]`);
      log(`outputs: [${outputs.join(", ")}]`);

      const session = new ML10XSession(transport);
      sessionRef.current = session;

      session.on("message", (desc, data) => {
        log(`<< ${desc}`);
        log(`   ${hexDump(data.slice(0, 20))}${data.length > 20 ? "..." : ""} (${data.length}B)`);
      });

      session.on("midi", (data) => {
        log(`<< midi: ${hexDump(data)}`);
      });

      session.on("connected", () => {
        log("connected!");
        setConnectionState("connected");
      });

      session.on("disconnected", () => {
        log("disconnected");
        setConnectionState("disconnected");
      });

      session.on("preset", (b, p) => {
        setBank(b);
        setPreset(p);
      });

      session.on("loading", (active) => {
        setLoading(active);
        if (active) setLoadingProgress(0);
      });

      session.on("loadingProgress", (progress) => {
        setLoadingProgress(progress);
      });

      session.on("presetName", (name) => {
        setPresetName(name);
      });

      session.on("presetData", (b, p, tlv) => {
        log(`presetData: bank=${b} preset=${p} entries=${tlv.length}`);
        for (const entry of tlv) {
          const ascii = entry.data.every((b) => b >= 0x20 && b < 0x7f)
            ? ` "${String.fromCharCode(...entry.data)}"`
            : "";
          log(`  tag=0x${entry.tag.toString(16).padStart(2, "0")} len=${entry.data.length} data=[${hexDump(entry.data)}]${ascii}`);
        }
      });

      log("calling session.connect()...");
      await session.connect();
      log("handshake sent, waiting for response...");
    } catch (err: any) {
      log(`error: ${err.message}`);
      setError(err.message ?? "Connection failed");
      setConnectionState("disconnected");
      sessionRef.current = null;
    }
  }, [log]);

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setConnectionState("disconnected");
    log("disconnected by user");
  }, [log]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const nextPreset = useCallback(() => {
    sessionRef.current?.send(buildScrollPresetUp());
  }, []);

  const prevPreset = useCallback(() => {
    sessionRef.current?.send(buildScrollPresetDown());
  }, []);

  const nextBank = useCallback(() => {
    sessionRef.current?.send(buildBankUp());
  }, []);

  const prevBank = useCallback(() => {
    sessionRef.current?.send(buildBankDown());
  }, []);

  return { connectionState, bank, preset, presetName, loading, loadingProgress, error, logs, connect, disconnect, clearLogs, nextPreset, prevPreset, nextBank, prevBank };
}
