package expo.modules.midi

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class MidiModule : Module() {
    private val midiManager by lazy { MidiManager(appContext.reactContext!!) }
    private var isSetup = false

    private fun ensureSetup() {
        if (isSetup) return
        midiManager.setup()
        isSetup = true

        midiManager.onMessage = { data ->
            sendEvent("onMidiMessage", mapOf(
                "data" to data.map { it.toInt() and 0xFF },
                "deltaTime" to 0
            ))
        }
        midiManager.onDevicesChanged = {
            sendEvent("onDevicesChanged", emptyMap<String, Any>())
        }
        midiManager.onDisconnect = {
            sendEvent("onDisconnect", emptyMap<String, Any>())
        }
    }

    override fun definition() = ModuleDefinition {
        Name("Midi")

        Events("onMidiMessage", "onDevicesChanged", "onDisconnect")

        OnStartObserving {
            ensureSetup()
        }

        OnDestroy {
            midiManager.onMessage = null
            midiManager.onDevicesChanged = null
            midiManager.onDisconnect = null
            midiManager.teardown()
        }

        Function("listInputs") {
            ensureSetup()
            midiManager.listInputs()
        }

        Function("listOutputs") {
            ensureSetup()
            midiManager.listOutputs()
        }

        AsyncFunction("openPorts") { inputName: String, outputName: String, promise: Promise ->
            ensureSetup()
            midiManager.openPorts(inputName, outputName) { success, error ->
                if (success) {
                    promise.resolve(null)
                } else {
                    promise.reject("MIDI_ERROR", error ?: "Failed to open ports", null)
                }
            }
        }

        Function("sendMessage") { data: List<Int> ->
            midiManager.send(data.map { it.toByte() }.toByteArray())
        }

        Function("closePorts") {
            midiManager.close()
        }
    }
}
