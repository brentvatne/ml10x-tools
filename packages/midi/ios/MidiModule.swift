import ExpoModulesCore

public class MidiModule: Module {
    private lazy var midiManager = MidiManager()
    private var isSetup = false

    private func ensureSetup() {
        guard !isSetup else { return }
        do {
            try midiManager.setup()
            isSetup = true

            midiManager.onMessage = { [weak self] data in
                let hex = data.prefix(10).map { String(format: "%02x", $0) }.joined(separator: " ")
                print("[MidiModule] sendEvent onMidiMessage: \(data.count)B, \(hex)")
                self?.sendEvent("onMidiMessage", [
                    "data": data.map { Int($0) },
                    "deltaTime": 0
                ])
            }
            midiManager.onDevicesChanged = { [weak self] in
                self?.sendEvent("onDevicesChanged", [:])
            }
            midiManager.onDisconnect = { [weak self] in
                self?.sendEvent("onDisconnect", [:])
            }
        } catch {
            print("MIDI setup failed: \(error)")
        }
    }

    public func definition() -> ModuleDefinition {
        Name("Midi")

        Events("onMidiMessage", "onDevicesChanged", "onDisconnect")

        // OnStartObserving intentionally empty — ensureSetup() is called by
        // each Function handler. This avoids a race condition where
        // OnStartObserving runs async on a background queue while openPorts
        // runs ensureSetup() synchronously, potentially double-creating MIDI ports.
        OnStartObserving {}

        OnDestroy {
            self.midiManager.onMessage = nil
            self.midiManager.onDevicesChanged = nil
            self.midiManager.onDisconnect = nil
            self.midiManager.disconnect()
        }

        Function("listInputs") { () -> [String] in
            self.ensureSetup()
            return self.midiManager.listSources()
        }

        Function("listOutputs") { () -> [String] in
            self.ensureSetup()
            return self.midiManager.listDestinations()
        }

        Function("openPorts") { (inputName: String, outputName: String) in
            self.ensureSetup()
            try self.midiManager.connect(sourceName: inputName, destName: outputName)
        }

        Function("sendMessage") { (data: [Int]) in
            let bytes = data.map { UInt8(clamping: $0) }
            self.midiManager.send(data: bytes)
        }

        Function("closePorts") {
            self.midiManager.disconnect()
        }
    }
}
