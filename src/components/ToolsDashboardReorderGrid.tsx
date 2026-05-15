import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  LinearTransition,
  executeOnUIRuntimeSync,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";

const NUM_COLS = 2;

/** Layout reflow when tiles settle (idle grid / after drag). */
const SLOT_LAYOUT = LinearTransition.springify().damping(26).stiffness(200).mass(0.5);

const LIFT_IN_MS = 140;
const LIFT_OUT_MS = 160;

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr;
  }
  const next = [...arr];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

function slotTopLeft(index: number, tileW: number, gap: number, rowH: number) {
  const col = index % NUM_COLS;
  const row = Math.floor(index / NUM_COLS);
  return { x: col * (tileW + gap), y: row * (rowH + gap) };
}

function nearestSlotIndexWorklet(
  lx: number,
  ly: number,
  n: number,
  tileW: number,
  gap: number,
  rowH: number
): number {
  "worklet";
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const col = i % NUM_COLS;
    const row = Math.floor(i / NUM_COLS);
    const left = col * (tileW + gap);
    const top = row * (rowH + gap);
    const cx = left + tileW / 2;
    const cy = top + rowH / 2;
    const d = (lx - cx) ** 2 + (ly - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

/** Same geometry as {@link nearestSlotIndexWorklet} for use on the JS thread (drop). */
function nearestSlotIndexJS(
  lx: number,
  ly: number,
  n: number,
  tileW: number,
  gap: number,
  rowH: number
): number {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const col = i % NUM_COLS;
    const row = Math.floor(i / NUM_COLS);
    const left = col * (tileW + gap);
    const top = row * (rowH + gap);
    const cx = left + tileW / 2;
    const cy = top + rowH / 2;
    const d = (lx - cx) ** 2 + (ly - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

type GridCellProps = {
  itemId: string;
  tileWidth: number;
  tileSize: number;
  draggingId: SharedValue<string>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  corrX: SharedValue<number>;
  corrY: SharedValue<number>;
  dragLiftScale: SharedValue<number>;
  layoutTransitionEnabled: boolean;
  slotsSX: SharedValue<number>;
  slotsSY: SharedValue<number>;
  tileW: SharedValue<number>;
  colGap: SharedValue<number>;
  rowH: SharedValue<number>;
  nCount: SharedValue<number>;
  dragFromIdx: SharedValue<number>;
  originReady: SharedValue<number>;
  cardStyle: StyleProp<ViewStyle>;
  onStartDrag: (id: string) => void;
  onDragFinish: () => void;
  onHoverSlot: (draggedId: string, to: number) => void;
  onDrop: (draggedId: string, absX: number, absY: number) => void;
  children: React.ReactNode;
};

function GridCell({
  itemId,
  tileWidth,
  tileSize,
  draggingId,
  translateX,
  translateY,
  corrX,
  corrY,
  dragLiftScale,
  layoutTransitionEnabled,
  slotsSX,
  slotsSY,
  tileW,
  colGap,
  rowH,
  nCount,
  dragFromIdx,
  originReady,
  cardStyle,
  onStartDrag,
  onDragFinish,
  onHoverSlot,
  onDrop,
  children,
}: GridCellProps) {
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .maxPointers(1)
        .onStart(() => {
          "worklet";
          draggingId.value = itemId;
          corrX.value = 0;
          corrY.value = 0;
          translateX.value = 0;
          translateY.value = 0;
          dragLiftScale.value = withTiming(1.03, { duration: LIFT_IN_MS });
          runOnJS(onStartDrag)(itemId);
        })
        .onUpdate((e) => {
          "worklet";
          if (draggingId.value !== itemId) return;
          translateX.value = e.translationX + corrX.value;
          translateY.value = e.translationY + corrY.value;
          if (dragFromIdx.value < 0) return;
          if (originReady.value < 0.5) return;
          const lx = e.absoluteX - slotsSX.value;
          const ly = e.absoluteY - slotsSY.value;
          const from = dragFromIdx.value;
          const to = nearestSlotIndexWorklet(lx, ly, nCount.value, tileW.value, colGap.value, rowH.value);
          if (from >= 0 && to !== from) {
            runOnJS(onHoverSlot)(itemId, to);
          }
        })
        .onEnd((e) => {
          "worklet";
          if (draggingId.value !== itemId) return;
          const ax = e.absoluteX;
          const ay = e.absoluteY;
          corrX.value = 0;
          corrY.value = 0;
          translateX.value = 0;
          translateY.value = 0;
          dragLiftScale.value = withTiming(1, { duration: LIFT_OUT_MS });
          draggingId.value = "";
          dragFromIdx.value = -1;
          runOnJS(onDrop)(itemId, ax, ay);
          runOnJS(onDragFinish)();
        })
        .onFinalize(() => {
          "worklet";
          if (draggingId.value !== itemId) return;
          corrX.value = 0;
          corrY.value = 0;
          translateX.value = 0;
          translateY.value = 0;
          dragLiftScale.value = withTiming(1, { duration: LIFT_OUT_MS });
          draggingId.value = "";
          dragFromIdx.value = -1;
          runOnJS(onDragFinish)();
        }),
    [
      itemId,
      draggingId,
      translateX,
      translateY,
      corrX,
      corrY,
      dragLiftScale,
      slotsSX,
      slotsSY,
      tileW,
      colGap,
      rowH,
      nCount,
      dragFromIdx,
      originReady,
      onStartDrag,
      onDragFinish,
      onHoverSlot,
      onDrop,
    ]
  );

  const liftStyle = useAnimatedStyle(() => {
    const active = draggingId.value === itemId;
    return {
      transform: [
        { translateX: active ? translateX.value : 0 },
        { translateY: active ? translateY.value : 0 },
        { scale: active ? dragLiftScale.value : 1 },
      ],
      zIndex: active ? 40 : 0,
      elevation: active ? 14 : 0,
    };
  });

  return (
    <Animated.View
      layout={layoutTransitionEnabled ? SLOT_LAYOUT : undefined}
      style={{ width: tileWidth, height: tileSize }}
    >
      <Animated.View style={liftStyle}>
        <GestureDetector gesture={pan}>
          <View style={cardStyle}>{children}</View>
        </GestureDetector>
      </Animated.View>
    </Animated.View>
  );
}

export type ToolsDashboardReorderGridProps<T extends { id: string }> = {
  items: T[];
  onItemsChange: (next: T[]) => void;
  tileWidth: number;
  tileSize: number;
  containerWidth: number;
  horizontalPad: number;
  columnGap: number;
  paddingBottom: number;
  cardStyle: StyleProp<ViewStyle>;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional cell after tools (e.g. hint) when `items.length` is odd — same tile size as a tool. */
  trailingSlot?: React.ReactNode;
};

export default function ToolsDashboardReorderGrid<T extends { id: string }>({
  items,
  onItemsChange,
  tileWidth,
  tileSize,
  containerWidth,
  horizontalPad,
  columnGap,
  paddingBottom,
  cardStyle,
  renderItem,
  trailingSlot,
}: ToolsDashboardReorderGridProps<T>) {
  const slotsRef = useRef<View>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const slotsOriginRef = useRef({ x: 0, y: 0 });
  const originReadyRef = useRef(false);

  const hoverRafRef = useRef<number | null>(null);
  const hoverPendingRef = useRef<{ draggedId: string; to: number } | null>(null);

  const [layoutTransitionEnabled, setLayoutTransitionEnabled] = useState(true);

  const draggingId = useSharedValue("");
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const corrX = useSharedValue(0);
  const corrY = useSharedValue(0);
  const dragLiftScale = useSharedValue(1);

  const slotsSX = useSharedValue(0);
  const slotsSY = useSharedValue(0);
  const tileW = useSharedValue(tileWidth);
  const colGap = useSharedValue(columnGap);
  const rowH = useSharedValue(tileSize);
  const nCount = useSharedValue(items.length);
  const dragFromIdx = useSharedValue(-1);
  const originReady = useSharedValue(0);

  useEffect(() => {
    tileW.value = tileWidth;
    colGap.value = columnGap;
    rowH.value = tileSize;
    nCount.value = items.length;
  }, [tileWidth, columnGap, tileSize, items.length, tileW, colGap, rowH, nCount]);

  const bumpCorr = useMemo(
    () =>
      runOnUI((dx: number, dy: number) => {
        "worklet";
        corrX.value += dx;
        corrY.value += dy;
      }),
    []
  );

  const setDragFromIdxUI = useMemo(
    () =>
      runOnUI((i: number) => {
        "worklet";
        dragFromIdx.value = i;
      }),
    []
  );

  const syncSlotsOrigin = useCallback(() => {
    slotsRef.current?.measureInWindow((sx, sy) => {
      slotsOriginRef.current = { x: sx, y: sy };
      originReadyRef.current = true;
      runOnUI((x: number, y: number) => {
        "worklet";
        slotsSX.value = x;
        slotsSY.value = y;
        originReady.value = 1;
      })(sx, sy);
    });
  }, []);

  const startDragFromGrid = useCallback(
    (id: string) => {
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      hoverPendingRef.current = null;
      const i = itemsRef.current.findIndex((t) => t.id === id);
      if (i >= 0) {
        executeOnUIRuntimeSync((idx: number) => {
          "worklet";
          dragFromIdx.value = idx;
        })(i);
      }
      setLayoutTransitionEnabled(false);
    },
    [dragFromIdx]
  );

  const applyHoverSlot = useCallback(
    (draggedId: string, to: number) => {
      const current = itemsRef.current;
      const from = current.findIndex((t) => t.id === draggedId);
      if (from < 0 || from === to) return;
      const tw = tileWidth;
      const g = columnGap;
      const rh = tileSize;
      const oldTL = slotTopLeft(from, tw, g, rh);
      const newTL = slotTopLeft(to, tw, g, rh);
      const dx = oldTL.x - newTL.x;
      const dy = oldTL.y - newTL.y;
      bumpCorr(dx, dy);
      const next = moveItem(current, from, to);
      itemsRef.current = next;
      onItemsChange(next);
      setDragFromIdxUI(to);
    },
    [bumpCorr, columnGap, onItemsChange, setDragFromIdxUI, tileSize, tileWidth]
  );

  const scheduleHoverSlot = useCallback(
    (draggedId: string, to: number) => {
      hoverPendingRef.current = { draggedId, to };
      if (hoverRafRef.current != null) return;
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const p = hoverPendingRef.current;
        hoverPendingRef.current = null;
        if (!p) return;
        applyHoverSlot(p.draggedId, p.to);
      });
    },
    [applyHoverSlot]
  );

  const flushHoverPendingSync = useCallback(() => {
    if (hoverRafRef.current != null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    const p = hoverPendingRef.current;
    hoverPendingRef.current = null;
    if (p) applyHoverSlot(p.draggedId, p.to);
  }, [applyHoverSlot]);

  useEffect(
    () => () => {
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
    },
    []
  );

  const onDragFinish = useCallback(() => {
    setLayoutTransitionEnabled(true);
  }, []);

  const handleDrop = useCallback(
    (draggedId: string, absX: number, absY: number) => {
      flushHoverPendingSync();
      if (!originReadyRef.current) return;
      const { x: sx, y: sy } = slotsOriginRef.current;
      const current = itemsRef.current;
      const from = current.findIndex((t) => t.id === draggedId);
      if (from < 0) return;
      const lx = absX - sx;
      const ly = absY - sy;
      const to = nearestSlotIndexJS(lx, ly, current.length, tileWidth, columnGap, tileSize);
      if (to !== from) {
        const next = moveItem(current, from, to);
        itemsRef.current = next;
        onItemsChange(next);
      }
    },
    [columnGap, flushHoverPendingSync, onItemsChange, tileSize, tileWidth]
  );

  return (
    <View style={{ flex: 1, paddingHorizontal: horizontalPad, paddingTop: 8, paddingBottom }}>
      <View
        ref={slotsRef}
        collapsable={false}
        onLayout={syncSlotsOrigin}
        style={{
          width: containerWidth,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: columnGap,
          alignContent: "flex-start",
        }}
      >
        {items.map((item, index) => (
          <GridCell
            key={item.id}
            itemId={item.id}
            tileWidth={tileWidth}
            tileSize={tileSize}
            draggingId={draggingId}
            translateX={translateX}
            translateY={translateY}
            corrX={corrX}
            corrY={corrY}
            dragLiftScale={dragLiftScale}
            layoutTransitionEnabled={layoutTransitionEnabled}
            slotsSX={slotsSX}
            slotsSY={slotsSY}
            tileW={tileW}
            colGap={colGap}
            rowH={rowH}
            nCount={nCount}
            dragFromIdx={dragFromIdx}
            originReady={originReady}
            cardStyle={cardStyle}
            onStartDrag={startDragFromGrid}
            onDragFinish={onDragFinish}
            onHoverSlot={scheduleHoverSlot}
            onDrop={handleDrop}
          >
            {renderItem(item, index)}
          </GridCell>
        ))}
        {trailingSlot != null ? (
          <View style={{ width: tileWidth, height: tileSize }} pointerEvents="none">
            {trailingSlot}
          </View>
        ) : null}
      </View>
    </View>
  );
}
