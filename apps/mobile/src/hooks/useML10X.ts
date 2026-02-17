import { useState, useRef, useCallback } from "react";
import { MidiTransport } from "@ml10x-tools/midi";
import { ML10XSession, hexDump, buildScrollPresetUp, buildScrollPresetDown, buildBankUp, buildBankDown, NODE_LABELS, LOOP_NAMES, type PresetData, type NodeId } from "@ml10x-tools/protocol";

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
  const [presetData, setPresetData] = useState<PresetData | null>(null);
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
    setLoading(true);
    setPresetData(null);
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

      session.on("presetData", (b, p, data) => {
        setPresetData(data);
        const engaged = data.engagedLoops.map((l) => LOOP_NAMES[l]).join(", ") || "none";
        log(`preset ${p} "${data.name}" engaged=[${engaged}]`);
        for (const [dest, src] of Object.entries(data.connections)) {
          log(`  ${NODE_LABELS[+dest as NodeId]} ← ${NODE_LABELS[+src as NodeId]}`);
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

  return { connectionState, bank, preset, presetName, presetData, loading, loadingProgress, error, logs, connect, disconnect, clearLogs, nextPreset, prevPreset, nextBank, prevBank };
}
