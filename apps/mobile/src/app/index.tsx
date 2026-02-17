import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useML10X } from "@/context/ML10XContext";
import { RoutingDiagram } from "@/components/RoutingDiagram";

function DebugButton() {
  const router = useRouter();
  return (
    <Pressable style={({ pressed }) => [styles.debugButton, pressed && { opacity: 0.5 }]} onPress={() => router.push("/logs")}>
      <SymbolView name="ladybug" tintColor="#555" size={20} />
    </Pressable>
  );
}

export default function Index() {
  const { connectionState, bank, preset, presetName, presetData, loading, loadingProgress, error, connect, disconnect, nextPreset, prevPreset, nextBank, prevBank } = useML10X();
  const insets = useSafeAreaInsets();

  if (connectionState === "disconnected") {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <DebugButton />
        <View style={styles.center}>
          {error ? (
            <>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={connect}>
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            </>
          ) : (
            <>
              <SymbolView
                name="cable.connector"
                tintColor="#555"
                size={64}
                style={styles.heroIcon}
              />
              <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={connect}>
                <Text style={styles.buttonText}>Connect</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  if (connectionState === "connecting") {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <DebugButton />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#999" />
          <Text style={styles.statusText}>Connecting...</Text>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]} onPress={disconnect}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <DebugButton />

      {loading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>
            Loading{loadingProgress > 0 ? ` ${loadingProgress}%` : "..."}
          </Text>
        </View>
      )}

      <View style={[styles.center, loading && styles.disabled]} pointerEvents={loading ? "none" : "auto"}>
        <Text style={styles.label}>Bank</Text>
        <View style={styles.presetRow}>
          <Pressable
            style={({ pressed }) => [styles.arrowButton, pressed && styles.arrowButtonPressed]}
            onPress={prevBank}
          >
            <Text style={styles.arrowText}>{"\u2039"}</Text>
          </Pressable>
          <Text style={styles.bankValue}>{bank}</Text>
          <Pressable
            style={({ pressed }) => [styles.arrowButton, pressed && styles.arrowButtonPressed]}
            onPress={nextBank}
          >
            <Text style={styles.arrowText}>{"\u203A"}</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.label}>Preset</Text>
        <View style={styles.presetRow}>
          <Pressable
            style={({ pressed }) => [styles.arrowButton, pressed && styles.arrowButtonPressed]}
            onPress={prevPreset}
          >
            <Text style={styles.arrowText}>{"\u2039"}</Text>
          </Pressable>
          <Text style={styles.presetValue}>{preset}</Text>
          <Pressable
            style={({ pressed }) => [styles.arrowButton, pressed && styles.arrowButtonPressed]}
            onPress={nextPreset}
          >
            <Text style={styles.arrowText}>{"\u203A"}</Text>
          </Pressable>
        </View>
        {presetName !== "" && <Text style={styles.presetNameText}>{presetName}</Text>}

        <View style={styles.routingContainer}>
          {!loading && <RoutingDiagram data={presetData} />}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]} onPress={disconnect}>
          <Text style={styles.secondaryButtonText}>Disconnect</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    alignItems: "center",
    paddingBottom: 16,
  },
  debugButton: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  statusText: {
    color: "#999",
    fontSize: 18,
    marginTop: 16,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  heroIcon: {
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#333",
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonPressed: {
    backgroundColor: "#444",
    transform: [{ scale: 0.96 }],
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 20,
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  secondaryButtonPressed: {
    backgroundColor: "#2a2a2a",
    borderColor: "#555",
    transform: [{ scale: 0.96 }],
  },
  secondaryButtonText: {
    color: "#888",
    fontSize: 14,
  },
  label: {
    color: "#555",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  bankValue: {
    color: "#fff",
    fontSize: 64,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
    minWidth: 60,
    textAlign: "center",
    marginTop: -4,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: "#333",
    marginVertical: 20,
  },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  presetValue: {
    color: "#fff",
    fontSize: 64,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
    minWidth: 60,
    textAlign: "center",
    marginTop: -4,
  },
  arrowButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowButtonPressed: {
    backgroundColor: "#333",
    borderColor: "#555",
    transform: [{ scale: 0.92 }],
  },
  arrowText: {
    color: "#fff",
    fontSize: 32,
    marginTop: -2,
  },
  disabled: {
    opacity: 0.3,
  },
  presetNameText: {
    color: "#888",
    fontSize: 15,
    marginTop: 12,
    letterSpacing: 1,
  },
  loadingBanner: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  loadingText: {
    color: "#fff",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  routingContainer: {
    marginTop: 24,
    alignItems: "center",
    width: 220,
    height: 170,
  },
});
