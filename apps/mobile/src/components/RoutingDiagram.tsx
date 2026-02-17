import { Canvas, Circle, RoundedRect, Line, Text, matchFont, vec } from "@shopify/react-native-skia";
import { Platform } from "react-native";
import { type PresetData, LOOP_NAMES, type Loop } from "@ml10x-tools/protocol";

const WIDTH = 220;
const HEIGHT = 170;

const SRC_X = 36;
const SRC_Y = HEIGHT / 2;
const SRC_R = 26;

const DEST_X = 130;
const DEST_W = 48;
const DEST_H = 22;
const DEST_R = 6;
const DEST_CX = DEST_X + DEST_W / 2;

const INPUT_COLOR = "#4a9eed";
const INPUT_BG = "#1e3a5f";
const OUTPUT_COLOR = "#22c55e";
const OUTPUT_BG = "#1a4d2e";
const LOOP_COLOR = "#8b5cf6";
const LOOP_BG = "#2d1b69";
const DEST_COLOR = "#4a6a8a";
const DEST_BG = "#121a28";
const LINE_COLOR = "#2a4a6a";

const font = matchFont({
  fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  fontSize: 11,
  fontWeight: "bold",
});

interface Props {
  data: PresetData | null;
}

export function RoutingDiagram({ data }: Props) {
  if (!data || Object.keys(data.connections).length === 0) return null;

  const isInput = data.engagedLoops.length === 0;
  const sourceLabel = isInput ? "IN" : LOOP_NAMES[data.engagedLoops[0]!];
  const sourceColor = isInput ? INPUT_COLOR : LOOP_COLOR;
  const sourceBg = isInput ? INPUT_BG : LOOP_BG;

  // Build destination list: all loops not engaged + Output
  const destinations: { label: string; isOutput: boolean }[] = [];
  const engaged = new Set(data.engagedLoops as number[]);
  for (let i = 0; i < 5; i++) {
    if (!engaged.has(i)) {
      destinations.push({ label: LOOP_NAMES[i as Loop]!, isOutput: false });
    }
  }
  destinations.push({ label: "OUT", isOutput: true });

  const destCount = destinations.length;
  const totalHeight = destCount * (DEST_H + 4) - 4;
  const startY = (HEIGHT - totalHeight) / 2;

  return (
    <Canvas style={{ width: WIDTH, height: HEIGHT }}>
      {/* Source node fill */}
      {isInput ? (
        <Circle cx={SRC_X} cy={SRC_Y} r={SRC_R} color={sourceBg} />
      ) : (
        <RoundedRect
          x={SRC_X - SRC_R}
          y={SRC_Y - SRC_R}
          width={SRC_R * 2}
          height={SRC_R * 2}
          r={8}
          color={sourceBg}
        />
      )}
      {/* Source node border */}
      {isInput ? (
        <Circle cx={SRC_X} cy={SRC_Y} r={SRC_R} color={sourceColor} style="stroke" strokeWidth={2} />
      ) : (
        <RoundedRect
          x={SRC_X - SRC_R}
          y={SRC_Y - SRC_R}
          width={SRC_R * 2}
          height={SRC_R * 2}
          r={8}
          color={sourceColor}
          style="stroke"
          strokeWidth={2}
        />
      )}
      {/* Source label */}
      <Text
        x={SRC_X - font.measureText(sourceLabel).width / 2}
        y={SRC_Y + 4}
        text={sourceLabel}
        font={font}
        color="#e5e5e5"
      />

      {/* Fan-out lines and destination nodes — all in same column */}
      {destinations.map((dest, i) => {
        const destY = startY + i * (DEST_H + 4) + DEST_H / 2;
        const color = dest.isOutput ? OUTPUT_COLOR : DEST_COLOR;
        const bg = dest.isOutput ? OUTPUT_BG : DEST_BG;
        const textColor = dest.isOutput ? "#e5e5e5" : "#8aa0b8";
        const strokeW = dest.isOutput ? 1.5 : 1;

        return (
          <G key={dest.label}>
            {/* Line from source to destination */}
            <Line
              p1={vec(SRC_X + SRC_R, SRC_Y)}
              p2={vec(DEST_X, destY)}
              color={LINE_COLOR}
              strokeWidth={1.5}
              style="stroke"
            />
            {/* Destination node — all rendered as rounded rects in the same column */}
            <RoundedRect
              x={DEST_X}
              y={destY - DEST_H / 2}
              width={DEST_W}
              height={DEST_H}
              r={dest.isOutput ? DEST_H / 2 : DEST_R}
              color={bg}
            />
            <RoundedRect
              x={DEST_X}
              y={destY - DEST_H / 2}
              width={DEST_W}
              height={DEST_H}
              r={dest.isOutput ? DEST_H / 2 : DEST_R}
              color={color}
              style="stroke"
              strokeWidth={strokeW}
            />
            <Text
              x={DEST_CX - font.measureText(dest.label).width / 2}
              y={destY + 4}
              text={dest.label}
              font={font}
              color={textColor}
            />
          </G>
        );
      })}
    </Canvas>
  );
}

function G({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
