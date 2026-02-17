import { useLayoutEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import * as Clipboard from "expo-clipboard";
import { useML10X } from "@/context/ML10XContext";

export default function LogsModal() {
  const { logs, clearLogs } = useML10X();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <SymbolView name="xmark.circle.fill" tintColor="#666" size={24} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={clearLogs} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <SymbolView name="trash" tintColor="#666" size={20} />
        </Pressable>
      ),
    });
  }, [navigation, router, clearLogs]);

  const [copied, setCopied] = useState(false);

  const copyLogs = () => {
    Clipboard.setStringAsync(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No logs yet</Text>
        ) : (
          [...logs].reverse().map((line, i) => (
            <Text key={i} style={styles.logLine}>{line}</Text>
          ))
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed, copied && styles.copyButtonCopied]} onPress={copyLogs}>
          <Text style={[styles.copyButtonText, copied && styles.copyButtonTextCopied]}>
            {copied ? "Copied!" : "Copy to clipboard"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyText: {
    color: "#555",
    fontSize: 14,
    textAlign: "center",
    marginTop: 40,
  },
  logLine: {
    color: "#aaa",
    fontSize: 11,
    fontFamily: "Menlo",
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  copyButton: {
    backgroundColor: "#222",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  copyButtonPressed: {
    backgroundColor: "#333",
    borderColor: "#555",
    transform: [{ scale: 0.97 }],
  },
  copyButtonCopied: {
    backgroundColor: "#1a3a1a",
    borderColor: "#2a5a2a",
  },
  copyButtonText: {
    color: "#888",
    fontSize: 14,
  },
  copyButtonTextCopied: {
    color: "#6a6",
  },
  headerButton: {
    color: "#fff",
    fontSize: 16,
  },
});
