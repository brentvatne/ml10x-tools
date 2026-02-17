package expo.modules.midi

import android.content.Context
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiDeviceStatus
import android.media.midi.MidiInputPort
import android.media.midi.MidiOutputPort
import android.media.midi.MidiDevice
import android.media.midi.MidiManager as AndroidMidiManager
import android.media.midi.MidiReceiver
import android.os.Handler
import android.os.Looper

class MidiManager(private val context: Context) {
    private var midiManager: AndroidMidiManager? = null
    private var openDevice: MidiDevice? = null
    private var inputPort: MidiInputPort? = null   // For sending TO device
    private var outputPort: MidiOutputPort? = null  // For receiving FROM device

    var onMessage: ((ByteArray) -> Unit)? = null
    var onDevicesChanged: (() -> Unit)? = null
    var onDisconnect: (() -> Unit)? = null

    private val deviceCallback = object : AndroidMidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo) {
            onDevicesChanged?.invoke()
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo) {
            if (openDevice?.info == device) {
                close()
                onDisconnect?.invoke()
            } else {
                onDevicesChanged?.invoke()
            }
        }

        override fun onDeviceStatusChanged(status: MidiDeviceStatus) {}
    }

    fun setup() {
        midiManager = context.getSystemService(Context.MIDI_SERVICE) as? AndroidMidiManager
        midiManager?.registerDeviceCallback(deviceCallback, Handler(Looper.getMainLooper()))
    }

    fun listInputs(): List<String> {
        val manager = midiManager ?: return emptyList()
        val names = mutableListOf<String>()
        for (info in manager.devices) {
            val deviceName = info.properties.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "Unknown"
            // Input ports on the device = places we can send data TO
            for (port in info.ports) {
                if (port.type == MidiDeviceInfo.PortInfo.TYPE_INPUT) {
                    val portName = port.name
                    names.add(if (portName.isNullOrEmpty()) deviceName else "$deviceName - $portName")
                }
            }
        }
        return names
    }

    fun listOutputs(): List<String> {
        val manager = midiManager ?: return emptyList()
        val names = mutableListOf<String>()
        for (info in manager.devices) {
            val deviceName = info.properties.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "Unknown"
            // Output ports on the device = places we receive data FROM
            for (port in info.ports) {
                if (port.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT) {
                    val portName = port.name
                    names.add(if (portName.isNullOrEmpty()) deviceName else "$deviceName - $portName")
                }
            }
        }
        return names
    }

    fun openPorts(inputName: String, outputName: String, callback: (Boolean, String?) -> Unit) {
        val manager = midiManager
        if (manager == null) {
            callback(false, "MIDI service not available")
            return
        }

        // Find device that has a matching output port (for receiving) by substring match
        var targetDevice: MidiDeviceInfo? = null
        var targetInputPortIndex = -1
        var targetOutputPortIndex = -1

        for (info in manager.devices) {
            val deviceName = info.properties.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "Unknown"

            for (port in info.ports) {
                if (port.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT) {
                    val portName = port.name
                    val fullName = if (portName.isNullOrEmpty()) deviceName else "$deviceName - $portName"
                    if (fullName.contains(outputName)) {
                        targetOutputPortIndex = port.portNumber
                        targetDevice = info
                    }
                }
                if (port.type == MidiDeviceInfo.PortInfo.TYPE_INPUT) {
                    val portName = port.name
                    val fullName = if (portName.isNullOrEmpty()) deviceName else "$deviceName - $portName"
                    if (fullName.contains(inputName)) {
                        targetInputPortIndex = port.portNumber
                        targetDevice = info
                    }
                }
            }
        }

        if (targetDevice == null) {
            callback(false, "MIDI ports not found. Looking for: \"$inputName\" / \"$outputName\"")
            return
        }

        manager.openDevice(targetDevice, { device ->
            if (device == null) {
                Handler(Looper.getMainLooper()).post {
                    callback(false, "Failed to open MIDI device")
                }
                return@openDevice
            }

            openDevice = device

            // Open output port (for receiving FROM device)
            if (targetOutputPortIndex >= 0) {
                val outPort = device.openOutputPort(targetOutputPortIndex)
                outputPort = outPort
                outPort?.connect(object : MidiReceiver() {
                    override fun onSend(data: ByteArray, offset: Int, count: Int, timestamp: Long) {
                        val message = data.copyOfRange(offset, offset + count)
                        Handler(Looper.getMainLooper()).post {
                            onMessage?.invoke(message)
                        }
                    }
                })
            }

            // Open input port (for sending TO device)
            if (targetInputPortIndex >= 0) {
                inputPort = device.openInputPort(targetInputPortIndex)
            }

            Handler(Looper.getMainLooper()).post {
                callback(true, null)
            }
        }, Handler(Looper.getMainLooper()))
    }

    fun send(data: ByteArray) {
        inputPort?.send(data, 0, data.size)
    }

    fun close() {
        outputPort?.close()
        outputPort = null
        inputPort?.close()
        inputPort = null
        openDevice?.close()
        openDevice = null
    }

    fun teardown() {
        close()
        midiManager?.unregisterDeviceCallback(deviceCallback)
    }
}
