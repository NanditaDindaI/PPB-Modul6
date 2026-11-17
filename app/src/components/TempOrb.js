import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  Atlas,
  Canvas,
  FilterMode,
  Group,
  MipmapMode,
  Skia,
  rect,
  useRSXformBuffer,
  usePictureAsTexture,
} from "react-native-skia";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { tokens } from "../theme/tokens.js";

const { color } = tokens;

const DOT_COUNT = 280;
const HOLE_RADIUS = 76;
const BASE_SPEED = 0.22;
const TILT = 0.42;
const TEX = 32;

// ── Color palette: depth 0 = far (cool) → depth 1 = near (warm)
// We pre-generate one colour per dot based on a stable "home" depth
const DEPTH_COLORS = (() => {
  // Gradient stops: deep-blue → cyan → white → gold → orange
  const stops = [
    [59, 130, 246],   // blue-500
    [99, 179, 237],   // cyan-ish
    [255, 255, 255],  // white (mid)
    [251, 191, 36],   // amber
    [249, 115, 22],   // orange
  ];
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const sample = (t) => {
    const scaled = t * (stops.length - 1);
    const lo = Math.floor(scaled);
    const hi = Math.min(lo + 1, stops.length - 1);
    const f = scaled - lo;
    const r = lerp(stops[lo][0], stops[hi][0], f);
    const g = lerp(stops[lo][1], stops[hi][1], f);
    const b = lerp(stops[lo][2], stops[hi][2], f);
    return `rgb(${r},${g},${b})`;
  };
  return new Array(DOT_COUNT).fill(0).map((_, i) => {
    // stable per-dot depth from its fibonacci position
    const phi = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - (i / (DOT_COUNT - 1)) * 2;
    const theta = phi * i;
    const z = Math.sin(theta) * Math.sqrt(Math.max(0, 1 - y * y));
    const depth = (z + 1) / 2;
    return sample(depth);
  });
})();

// Fibonacci sphere: deterministic, maximally uniform dot globe.
function fibonacciSphere(n) {
  const pts = new Array(n);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    pts[i] = [Math.cos(theta) * r, y, Math.sin(theta) * r];
  }
  return pts;
}

const BASE_PTS = fibonacciSphere(DOT_COUNT);

function projectAll(angle, swell, R, cx, cy) {
  const out = new Array(DOT_COUNT);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const tilt = TILT + Math.sin(angle * 0.5) * 0.05;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const rr = R * swell;
  for (let i = 0; i < DOT_COUNT; i++) {
    const p = BASE_PTS[i];
    const x1 = p[0] * cosA + p[2] * sinA;
    const z1 = -p[0] * sinA + p[2] * cosA;
    const y1 = p[1] * cosT - z1 * sinT;
    const z2 = p[1] * sinT + z1 * cosT;
    const depth = (z2 + 1) / 2;
    const s = 2.2 / (2.2 - z2);
    const sx = cx + x1 * rr * s;
    const sy = cy + y1 * rr * s;
    const hx = sx - cx;
    const hy = sy - cy;
    const hidden = hx * hx + hy * hy < HOLE_RADIUS * HOLE_RADIUS;
    const sc = 0.24 * (0.5 + 0.9 * depth) * swell;
    out[i] = hidden
      ? [0, 0, -10000, -10000]
      : [sc, 0, sx - (TEX / 2) * sc, sy - (TEX / 2) * sc];
  }
  return out;
}

export function TempOrb({
  tint = color.primary,
  beatKey = 0,
  size = 200,
  dimmed = false,
}) {
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const angleY = useSharedValue(0.6);
  const spinBoost = useSharedValue(0);
  const intensity = useSharedValue(0);
  const dimSV = useSharedValue(dimmed ? 1 : 0);
  const firstBeat = useRef(true);

  // Pulsing ring animation values (React Native Animated, not Reanimated)
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.6);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.4);

  const R = (size * 0.8) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Build dot picture with per-depth colour tinting
  const dotPictures = useMemo(() => {
    return DEPTH_COLORS.map((depthColor) => {
      try {
        const recorder = Skia.PictureRecorder();
        const canvas = recorder.beginRecording(rect(0, 0, TEX, TEX));
        // Halo/glow
        const haloPaint = Skia.Paint();
        haloPaint.setAntiAlias(true);
        haloPaint.setColor(Skia.Color("rgba(255,255,255,0.35)"));
        canvas.drawCircle(TEX / 2, TEX / 2, TEX / 2 - 1, haloPaint);
        // Core
        const corePaint = Skia.Paint();
        corePaint.setAntiAlias(true);
        corePaint.setColor(Skia.Color(depthColor));
        canvas.drawCircle(TEX / 2, TEX / 2, (TEX / 2) * 0.56, corePaint);
        return recorder.finishRecordingAsPicture();
      } catch {
        return null;
      }
    });
  }, []);

  // Use a single shared dot picture (tinted by Atlas colors array)
  const dotPicture = useMemo(() => {
    try {
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(rect(0, 0, TEX, TEX));
      const haloPaint = Skia.Paint();
      haloPaint.setAntiAlias(true);
      haloPaint.setColor(Skia.Color("rgba(255, 255, 255, 0.45)"));
      canvas.drawCircle(TEX / 2, TEX / 2, TEX / 2 - 1, haloPaint);
      const corePaint = Skia.Paint();
      corePaint.setAntiAlias(true);
      corePaint.setColor(Skia.Color("white"));
      canvas.drawCircle(TEX / 2, TEX / 2, (TEX / 2) * 0.52, corePaint);
      return recorder.finishRecordingAsPicture();
    } catch {
      return null;
    }
  }, []);
  const dotImg = usePictureAsTexture(dotPicture, { width: TEX, height: TEX });

  const sprites = useMemo(
    () => new Array(DOT_COUNT).fill(0).map(() => rect(0, 0, TEX, TEX)),
    []
  );

  const transforms = useRSXformBuffer(DOT_COUNT, (val, i) => {
    "worklet";
    const p = BASE_PTS[i];
    const a = angleY.value;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const tilt = TILT + Math.sin(a * 0.5) * 0.05;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const swell = 1 + 0.04 * intensity.value;
    const rr = R * swell;
    const x1 = p[0] * cosA + p[2] * sinA;
    const z1 = -p[0] * sinA + p[2] * cosA;
    const y1 = p[1] * cosT - z1 * sinT;
    const z2 = p[1] * sinT + z1 * cosT;
    const depth = (z2 + 1) / 2;
    const s = 2.2 / (2.2 - z2);
    const sx = cx + x1 * rr * s;
    const sy = cy + y1 * rr * s;
    const hx = sx - cx;
    const hy = sy - cy;
    if (hx * hx + hy * hy < HOLE_RADIUS * HOLE_RADIUS) {
      val.set(0, 0, -10000, -10000);
      return;
    }
    const sc = 0.24 * (0.5 + 0.9 * depth) * swell;
    val.set(sc, 0, sx - (TEX / 2) * sc, sy - (TEX / 2) * sc);
  });

  useEffect(() => {
    try {
      const initial = projectAll(0.6, 1, R, cx, cy);
      transforms.value = transforms.value.map((slot, i) => {
        slot.set(initial[i][0], initial[i][1], initial[i][2], initial[i][3]);
        return slot;
      });
    } catch {
      // buffer write unsupported
    }
  }, [transforms, R, cx, cy]);

  useEffect(() => {
    dimSV.set(withTiming(dimmed ? 1 : 0, { duration: 400 }));
  }, [dimmed, dimSV]);

  // Pulsing ring animation
  useEffect(() => {
    if (reduceMotion || dimmed) return;
    ring1Scale.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.45, { duration: 1600, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      )
    );
    ring1Opacity.set(
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 0 }),
          withTiming(0, { duration: 1600, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      )
    );
    ring2Scale.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(1, { duration: 0 }),
          withTiming(1.45, { duration: 1600, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      )
    );
    ring2Opacity.set(
      withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800 }),
          withTiming(0.4, { duration: 0 }),
          withTiming(0, { duration: 1600, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      )
    );
  }, [reduceMotion, dimmed]);

  useEffect(() => {
    if (firstBeat.current) {
      firstBeat.current = false;
      return;
    }
    if (!beatKey || dimmed || reduceMotion) return;
    intensity.set(0);
    intensity.set(
      withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(0.35, { duration: 180 }),
        withTiming(0.7, { duration: 120 }),
        withTiming(0, { duration: 300 })
      )
    );
    spinBoost.set(2.4);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // haptics unsupported
    }
  }, [beatKey, dimmed, reduceMotion, intensity, spinBoost]);

  const frame = useFrameCallback((info) => {
    "worklet";
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    spinBoost.value *= Math.pow(0.02, dt);
    angleY.value += dt * (BASE_SPEED + spinBoost.value);
  });

  useEffect(() => {
    frame.setActive(focused && !reduceMotion && !dimmed);
  }, [focused, reduceMotion, dimmed, frame]);

  const groupOpacity = useDerivedValue(() => 0.85 * (1 - 0.55 * dimSV.value));

  // Depth-based colors: each dot gets a colour from the gradient
  const colors = useMemo(() => DEPTH_COLORS.slice(), []);

  // Animated ring styles
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const ringSize = size * 0.78;

  return (
    <View style={{ width: size, height: size }} accessible={false}>
      {/* Pulsing rings behind the globe */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            top: (size - ringSize) / 2,
            left: (size - ringSize) / 2,
            borderColor: dimmed ? color.border : tint,
          },
          ring1Style,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            top: (size - ringSize) / 2,
            left: (size - ringSize) / 2,
            borderColor: dimmed ? color.border : tint,
          },
          ring2Style,
        ]}
        pointerEvents="none"
      />
      <Canvas style={{ width: size, height: size }}>
        <Group opacity={groupOpacity}>
          <Atlas
            image={dotImg}
            sprites={sprites}
            transforms={transforms}
            colors={colors}
            colorBlendMode="modulate"
            sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
          />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
});
