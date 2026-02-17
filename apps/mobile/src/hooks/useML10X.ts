import { useState, useEffect, useRef, useCallback } from "react";
import { MidiTransport } from "@ml10x-tools/midi";
import { ML10XSession, hexDump } from "@ml10x-tools/protocol";

export type ConnectionState = "disconnected" | "connecting" | "connected";

const MAX_LOGS = 30;

export function useML10X() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [bank, setBank] = useState(0);
  const [preset, setPreset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const sessionRef = useRef<ML10XSession | null>(null);

  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), msg]);
  }, []);

  const connect = useCallback(async () => {
    // Clean up any existing session
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

  return { connectionState, bank, preset, loading, error, logs, connect, disconnect };
}
