import CoreMIDI
import Foundation

enum MidiError: LocalizedError {
    case clientCreationFailed(OSStatus)
    case portCreationFailed(OSStatus)
    case connectionFailed(OSStatus)
    case sourceNotFound(String)
    case destinationNotFound(String)

    var errorDescription: String? {
        switch self {
        case .clientCreationFailed(let status):
            return "MIDI client creation failed (OSStatus \(status))"
        case .portCreationFailed(let status):
            return "MIDI port creation failed (OSStatus \(status))"
        case .connectionFailed(let status):
            return "MIDI connection failed (OSStatus \(status))"
        case .sourceNotFound(let name):
            return "MIDI input \"\(name)\" not found"
        case .destinationNotFound(let name):
            return "MIDI output \"\(name)\" not found"
        }
    }
}

class MidiManager {
    private var midiClient: MIDIClientRef = 0
    private var inputPort: MIDIPortRef = 0
    private var outputPort: MIDIPortRef = 0
    private var connectedSource: MIDIEndpointRef = 0
    private var connectedDestination: MIDIEndpointRef = 0

    // Serial queue for thread-safe access to sysexBuffer and callbackCount.
    // CoreMIDI callbacks fire on a background thread; this protects mutable state.
    private let midiQueue = DispatchQueue(label: "com.ml10x.midi", qos: .userInteractive)

    // SysEx reassembly buffer for raw bytes (F0..F7). Accessed only on midiQueue.
    private var sysexBuffer: [UInt8] = []
    private var callbackCount = 0

    // Callbacks
    var onMessage: (([UInt8]) -> Void)?
    var onDevicesChanged: (() -> Void)?
    var onDisconnect: (() -> Void)?

    func setup() throws {
        var status = MIDIClientCreateWithBlock("ML10X" as CFString, &midiClient) { [weak self] notification in
            self?.handleMidiNotification(notification)
        }
        guard status == noErr else {
            throw MidiError.clientCreationFailed(status)
        }

        // Use MIDIInputPortCreateWithBlock for raw MIDIPacketList delivery.
        // MIDIInputPortCreateWithProtocol(._1_0) translates to UMP format which
        // drops SysEx Continue/End packets for some USB MIDI devices, truncating
        // every message to 8 bytes. Raw MIDIPacketList bypasses this entirely.
        status = MIDIInputPortCreateWithBlock(
            midiClient,
            "Input" as CFString,
            &inputPort
        ) { [weak self] packetList, _ in
            self?.handleMidiPacketList(packetList)
        }
        guard status == noErr else {
            throw MidiError.portCreationFailed(status)
        }

        status = MIDIOutputPortCreate(midiClient, "Output" as CFString, &outputPort)
        guard status == noErr else {
            throw MidiError.portCreationFailed(status)
        }
    }

    func listSources() -> [String] {
        var names: [String] = []
        let count = MIDIGetNumberOfSources()
        for i in 0..<count {
            let endpoint = MIDIGetSource(i)
            if let name = endpointName(endpoint) {
                names.append(name)
            }
        }
        return names
    }

    func listDestinations() -> [String] {
        var names: [String] = []
        let count = MIDIGetNumberOfDestinations()
        for i in 0..<count {
            let endpoint = MIDIGetDestination(i)
            if let name = endpointName(endpoint) {
                names.append(name)
            }
        }
        return names
    }

    func connect(sourceName: String, destName: String) throws {
        // Disconnect any existing connection
        disconnect()

        // Find source by substring match
        let sourceCount = MIDIGetNumberOfSources()
        var foundSource: MIDIEndpointRef = 0
        for i in 0..<sourceCount {
            let endpoint = MIDIGetSource(i)
            if let name = endpointName(endpoint), name.contains(sourceName) {
                foundSource = endpoint
                break
            }
        }
        guard foundSource != 0 else {
            throw MidiError.sourceNotFound(sourceName)
        }

        // Find destination by substring match
        let destCount = MIDIGetNumberOfDestinations()
        var foundDest: MIDIEndpointRef = 0
        for i in 0..<destCount {
            let endpoint = MIDIGetDestination(i)
            if let name = endpointName(endpoint), name.contains(destName) {
                foundDest = endpoint
                break
            }
        }
        guard foundDest != 0 else {
            throw MidiError.destinationNotFound(destName)
        }

        let status = MIDIPortConnectSource(inputPort, foundSource, nil)
        guard status == noErr else {
            throw MidiError.connectionFailed(status)
        }

        connectedSource = foundSource
        connectedDestination = foundDest
    }

    /// Send raw MIDI bytes via MIDIPacketList.
    func send(data: [UInt8]) {
        guard connectedDestination != 0 else {
            print("[MidiManager] send: SKIPPED (no destination)")
            return
        }

        let hex = data.prefix(10).map { String(format: "%02x", $0) }.joined(separator: " ")
        print("[MidiManager] send: \(data.count)B, \(hex)\(data.count > 10 ? "..." : "")")

        let bufferSize = 1024 + data.count
        let buffer = UnsafeMutableRawPointer.allocate(
            byteCount: bufferSize,
            alignment: MemoryLayout<MIDIPacketList>.alignment
        )
        defer { buffer.deallocate() }

        let packetListPtr = buffer.assumingMemoryBound(to: MIDIPacketList.self)
        var packet = MIDIPacketListInit(packetListPtr)
        packet = MIDIPacketListAdd(packetListPtr, bufferSize, packet, 0, data.count, data)

        let status = MIDISend(outputPort, connectedDestination, packetListPtr)
        if status != noErr {
            print("[MidiManager] send: MIDISend FAILED (OSStatus \(status))")
        }
    }

    func disconnect() {
        if connectedSource != 0 {
            MIDIPortDisconnectSource(inputPort, connectedSource)
            connectedSource = 0
        }
        connectedDestination = 0
        midiQueue.sync {
            sysexBuffer.removeAll()
        }
    }

    // MARK: - Raw MIDI Packet Handling

    private func handleMidiPacketList(_ packetListPtr: UnsafePointer<MIDIPacketList>) {
        midiQueue.sync {
            callbackCount += 1
            let cbNum = callbackCount
            var messages: [[UInt8]] = []

            let numPackets = Int(packetListPtr.pointee.numPackets)

            // Walk packets via pointer arithmetic to avoid copying MIDIPacket structs
            // (whose data tuple is only 256 bytes but actual data can be larger).
            // MIDIPacketList layout: [numPackets: UInt32] [packet0] [packet1] ...
            let packetListRaw = UnsafeRawPointer(packetListPtr)
            var packetPtr = UnsafeMutablePointer<MIDIPacket>(
                mutating: packetListRaw.advanced(by: 4)
                    .bindMemory(to: MIDIPacket.self, capacity: 1)
            )

            for _ in 0..<numPackets {
                let length = Int(packetPtr.pointee.length)
                if length > 0 {
                    // MIDIPacket layout: [timeStamp: UInt64(8)] [length: UInt16(2)] [data...]
                    let dataPtr = UnsafeRawPointer(packetPtr)
                        .advanced(by: 10)
                        .bindMemory(to: UInt8.self, capacity: length)
                    let bytes = Array(UnsafeBufferPointer(start: dataPtr, count: length))

                    processRawMidiBytes(bytes, into: &messages)
                }
                packetPtr = MIDIPacketNext(packetPtr)
            }

            print("[MidiManager] callback #\(cbNum), \(numPackets) pkts, \(messages.count) msgs")

            if !messages.isEmpty {
                let callback = self.onMessage
                DispatchQueue.main.async {
                    for msg in messages {
                        callback?(msg)
                    }
                }
            }
        }
    }

    /// Process raw MIDI bytes from a MIDIPacket.
    /// Handles SysEx reassembly (F0..F7) and passes through short messages.
    /// NOTE: Must be called on midiQueue.
    private func processRawMidiBytes(_ bytes: [UInt8], into messages: inout [[UInt8]]) {
        guard !bytes.isEmpty else { return }

        if bytes.first == 0xF0 {
            // New SysEx starting
            if !sysexBuffer.isEmpty {
                // Previous SysEx was incomplete — discard
                print("[MidiManager] SysEx: incomplete buffer \(sysexBuffer.count)B, discarding")
                sysexBuffer.removeAll()
            }

            if bytes.contains(0xF7) {
                // Complete SysEx in this packet — find F7 and extract
                if let f7Index = bytes.firstIndex(of: 0xF7) {
                    messages.append(Array(bytes[...f7Index]))
                }
            } else {
                // SysEx continues in next packet(s)
                sysexBuffer = Array(bytes)
            }
        } else if !sysexBuffer.isEmpty {
            // Continuation of SysEx
            if let f7Index = bytes.firstIndex(of: 0xF7) {
                // SysEx complete
                sysexBuffer.append(contentsOf: bytes[...f7Index])
                messages.append(sysexBuffer)
                sysexBuffer.removeAll()
            } else {
                sysexBuffer.append(contentsOf: bytes)
            }
        } else {
            // Non-SysEx message (CC, PC, etc.)
            messages.append(Array(bytes))
        }
    }

    // MARK: - Notifications

    private func handleMidiNotification(_ notification: UnsafePointer<MIDINotification>) {
        switch notification.pointee.messageID {
        case .msgObjectRemoved:
            notification.withMemoryRebound(to: MIDIObjectAddRemoveNotification.self, capacity: 1) { removeNotification in
                let removedChild = removeNotification.pointee.child
                if removedChild == connectedSource {
                    connectedSource = 0
                    DispatchQueue.main.async { [weak self] in
                        self?.onDisconnect?()
                    }
                }
                if removedChild == connectedDestination {
                    connectedDestination = 0
                }
            }
        case .msgSetupChanged, .msgObjectAdded:
            DispatchQueue.main.async { [weak self] in
                self?.onDevicesChanged?()
            }
        default:
            break
        }
    }

    // MARK: - Helpers

    private func endpointName(_ endpoint: MIDIEndpointRef) -> String? {
        var name: Unmanaged<CFString>?
        let status = MIDIObjectGetStringProperty(endpoint, kMIDIPropertyDisplayName, &name)
        guard status == noErr else { return nil }
        // MIDIObjectGetStringProperty follows the "Get Rule" — caller does NOT own the reference.
        // Using takeRetainedValue() here would over-release and corrupt memory.
        return name?.takeUnretainedValue() as String?
    }

    deinit {
        disconnect()
        if inputPort != 0 { MIDIPortDispose(inputPort) }
        if outputPort != 0 { MIDIPortDispose(outputPort) }
        if midiClient != 0 { MIDIClientDispose(midiClient) }
    }
}
