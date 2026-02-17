import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useML10X } from "@/hooks/useML10X";

function LogBox({ logs }: { logs: string[] }) {
  const copyLogs = () => {
    Clipboard.setStringAsync(logs.join("\n"));
  };

  if (logs.length === 0) return null;

  return (
    <View style={styles.logBox}>
      <ScrollView style={styles.logScroll}>
        {logs.map((line, i) => (
          <Text key={i} style={styles.logLine}>{line}</Text>
        ))}
      </ScrollView>
      <Pressable style={styles.copyButton} onPress={copyLogs}>
        <Text style={styles.copyButtonText}>Copy Logs</Text>
      </Pressable>
    </View>
  );
}

export default function Index() {
  const { connectionState, bank, preset, loading, error, logs, connect, disconnect } = useML10X();

  if (connectionState === "disconnected") {
    return (
      <View style={styles.container}>
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.button} onPress={connect}>
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.button} onPress={connect}>
            <Text style={styles.buttonText}>Connect</Text>
          </Pressable>
        )}
        <LogBox logs={logs} />
      </View>
    );
  }

  if (connectionState === "connecting") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#999" />
        <Text style={styles.statusText}>Connecting to ML10X...</Text>
        <Pressable style={styles.buttonSmall} onPress={disconnect}>
          <Text style={styles.buttonSmallText}>Cancel</Text>
        </Pressable>
        <LogBox logs={logs} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
      <Text style={styles.label}>Bank</Text>
      <Text style={styles.value}>{bank}</Text>
      <View style={styles.divider} />
      <Text style={styles.label}>Preset</Text>
      <Text style={styles.value}>{preset}</Text>
      <Pressable style={styles.buttonSmall} onPress={disconnect}>
        <Text style={styles.buttonSmallText}>Disconnect</Text>
      </Pressable>
      <LogBox logs={logs} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    padding: 24,
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
  button: {
    backgroundColor: "#333",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonSmall: {
    marginTop: 20,
    backgroundColor: "#222",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonSmallText: {
    color: "#888",
    fontSize: 14,
  },
  label: {
    color: "#666",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  value: {
    color: "#fff",
    fontSize: 72,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: "#333",
    marginVertical: 24,
  },
  loadingBanner: {
    position: "absolute",
    top: 60,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  loadingText: {
    color: "#fff",
    fontSize: 14,
  },
  logBox: {
    position: "absolute",
    bottom: 30,
    left: 16,
    right: 16,
    maxHeight: 200,
  },
  logScroll: {
    maxHeight: 170,
  },
  logLine: {
    color: "#555",
    fontSize: 10,
    fontFamily: "Menlo",
    lineHeight: 14,
  },
  copyButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#222",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  copyButtonText: {
    color: "#888",
    fontSize: 11,
    fontFamily: "Menlo",
  },
});
