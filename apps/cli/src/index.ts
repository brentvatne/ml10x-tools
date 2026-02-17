#!/usr/bin/env node
// ML10X Monitor & Controller

import * as readline from "node:readline";
import { MidiTransport } from "@ml10x-tools/midi";
import {
  ML10XSession,
  buildBankDown,
  buildBankUp,
  buildEngagePreset,
  buildPing,
  buildRequestControllerInfo,
  buildRequestControllerSettings,
  buildRequestFirmwareVersion,
  buildRequestPresetNames,
  buildSelectBank,
  buildSelectPreset,
  hexDump,
  describeSysex,
} from "@ml10x-tools/protocol";

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
}

const transport = new MidiTransport();
const session = new ML10XSession(transport);

// Log all session events
session.on("message", (desc, data) => {
  log(`<< SysEx: ${desc}`);
});

session.on("preset", (bank, preset) => {
  log(`   >> Active: Bank ${bank} / Preset ${preset}`);
});

session.on("connected", () => {
  log("   >> Device entered editor mode");
});

session.on("disconnected", () => {
  log("   >> Device left editor mode");
});

session.on("loading", (active) => {
  if (active) log("   >> Loading...");
});

session.on("info", (payload) => {
  log(`   >> Info payload: ${hexDump(payload)}`);
});

session.on("midi", (data) => {
  const status = data[0]! & 0xf0;
  const channel = (data[0]! & 0x0f) + 1;

  if (status === 0xc0) {
    log(`<< PC: ch=${channel} preset=${data[1]}`);
  } else if (status === 0xb0) {
    log(`<< CC: ch=${channel} cc=${data[1]} val=${data[2]}`);
  } else {
    log(`<< MIDI: ${hexDump(data)}`);
  }
});

function sendAndLog(label: string, data: number[]) {
  log(`>> ${label}: ${hexDump(data)}`);
  session.send(data);
}

function printHelp() {
  console.log(`
Commands:
  status          Current bank/preset
  bank <0-3>      Switch bank (SysEx)
  preset <0-127>  Switch preset (SysEx)
  goto <b> <p>    Switch to bank b, preset p
  up              Bank up
  down            Bank down
  engage <0-127>  Engage preset via SysEx
  info            Request controller info
  ping            Ping device
  fw              Request firmware version
  settings        Request controller settings
  names [bank]    Request preset names
  raw <hex...>    Send raw MIDI bytes
  help            This help
  quit            Exit
`);
}

async function handleCommand(line: string) {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  switch (cmd) {
    case "status":
    case "s":
      console.log(`Bank ${session.bank} / Preset ${session.preset}`);
      break;

    case "bank":
    case "b": {
      const bank = parseInt(parts[1]!);
      if (isNaN(bank) || bank < 0 || bank > 3) {
        console.log("Usage: bank <0-3>");
        break;
      }
      sendAndLog(`Select Bank ${bank}`, buildSelectBank(bank));
      break;
    }

    case "preset":
    case "p": {
      const preset = parseInt(parts[1]!);
      if (isNaN(preset) || preset < 0 || preset > 127) {
        console.log("Usage: preset <0-127>");
        break;
      }
      sendAndLog(`Select Preset ${preset}`, buildSelectPreset(preset));
      break;
    }

    case "goto":
    case "g": {
      const bank = parseInt(parts[1]!);
      const preset = parseInt(parts[2]!);
      if (isNaN(bank) || bank < 0 || bank > 3 || isNaN(preset) || preset < 0 || preset > 127) {
        console.log("Usage: goto <bank 0-3> <preset 0-127>");
        break;
      }
      sendAndLog(`Select Bank ${bank}`, buildSelectBank(bank));
      await new Promise((r) => setTimeout(r, 100));
      sendAndLog(`Select Preset ${preset}`, buildSelectPreset(preset));
      break;
    }

    case "engage":
    case "e": {
      const preset = parseInt(parts[1]!);
      if (isNaN(preset) || preset < 0 || preset > 127) {
        console.log("Usage: engage <0-127>");
        break;
      }
      sendAndLog(`Engage Preset ${preset}`, buildEngagePreset(preset));
      break;
    }

    case "up":
    case "u":
      sendAndLog("Bank Up", buildBankUp());
      break;

    case "down":
    case "d":
      sendAndLog("Bank Down", buildBankDown());
      break;

    case "info":
    case "i":
      sendAndLog("Request Controller Info", buildRequestControllerInfo());
      break;

    case "ping":
      sendAndLog("Ping", buildPing());
      break;

    case "fw":
    case "firmware":
      sendAndLog("Request FW Version", buildRequestFirmwareVersion());
      break;

    case "settings":
      sendAndLog("Request Settings", buildRequestControllerSettings());
      break;

    case "names":
    case "n": {
      const bank = parts[1] ? parseInt(parts[1]) : session.bank;
      sendAndLog(`Request Preset Names (bank ${bank})`, buildRequestPresetNames(bank));
      break;
    }

    case "raw": {
      const bytes = parts.slice(1).map((s) => parseInt(s, 16));
      if (bytes.some(isNaN)) {
        console.log("Usage: raw <hex bytes...>");
        break;
      }
      sendAndLog("Raw", bytes);
      break;
    }

    case "help":
    case "h":
    case "?":
      printHelp();
      break;

    case "quit":
    case "q":
    case "exit":
      log("Closing...");
      session.close();
      process.exit(0);

    case "":
    case undefined:
      break;

    default:
      console.log(`Unknown: ${cmd}. Type 'help' for commands.`);
  }
}

async function main() {
  console.log("ML10X Monitor & Controller\n");

  const inputs = transport.listInputs();
  const outputs = transport.listOutputs();
  console.log("MIDI Inputs:");
  inputs.forEach((name, i) => console.log(`  [${i}] ${name}`));
  console.log("MIDI Outputs:");
  outputs.forEach((name, i) => console.log(`  [${i}] ${name}`));
  console.log();

  try {
    await session.connect();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  console.log("\nHandshake sent. Waiting for device response...\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "ml10x> ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    await handleCommand(line);
    rl.prompt();
  });

  rl.on("close", () => {
    log("Closing...");
    session.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
