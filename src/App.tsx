import React, { useMemo, useRef, useState } from "react";
import "./App.css";
import { objectLibrary } from "./objectLibrary";

type Cell = {
  col: number;
  row: number;
};

type Point = {
  x: number;
  y: number;
};

type LineStyle = "solid" | "dashed";

type ObstacleType = "square" | "wide" | "custom" | "player";

type Obstacle = {
  id: string;
  type: ObstacleType;
  label: string;
  col: number;
  row: number;
  w: number;
  h: number;
  image?: string;
  rotate: number;
};

export type PaletteItem = {
  id: string;
  type: ObstacleType;
  label: string;
  w: number;
  h: number;
  image?: string;
  rotate: number;
  locked?: boolean;
};

type RouteTarget = {
  kind: "obstacle";
  id: string;
  label: string;
  col: number;
  row: number;
  w: number;
  h: number;
};

type ImportedRouteTarget = {
  kind?: "player" | "obstacle";
  id?: string;
  label?: string;
  col: number;
  row: number;
  w?: number;
  h?: number;
};

type RouteSection = {
  id: string;
  axis: "x" | "y";
  lane: number;
};

type RouteLine = {
  id: string;
  name: string;
  targets: RouteTarget[];
  sections: RouteSection[];
  color: string;
  width: number;
  style: LineStyle;
};

type DragLaneState = {
  routeId: string;
  sectionId: string;
  axis: "x" | "y";
  startClientX: number;
  startClientY: number;
  originalLane: number;
} | null;

type MenuKey = "board" | "objects" | "edit" | "file" | "freeLine" | "route";

type FreeLine = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  style: LineStyle;
};

type ExportObstacleGroupFile = {
  fileType: "obstacle-group";
  version: 1;
  exportedAt: string;
  obstacles: Obstacle[];
};

type ExportFullFieldFile = {
  fileType: "full-field";
  version: 1;
  exportedAt: string;
  grid: {
    cols: number;
    rows: number;
    cellSize: number;
  };
  obstacles: Obstacle[];
  routes: RouteLine[];
  freeLines: FreeLine[];

  // Giữ để vẫn nhập được file cũ nếu trước đây có player riêng
  player?: Cell;
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultObjects = (): PaletteItem[] =>
  objectLibrary.map((item) => ({
    ...item,
    id: makeId(),
  }));

function snapToGrid(value: number, cellSize: number) {
  return Math.round(value / cellSize) * cellSize;
}

function removeDuplicatePoints(points: Point[]) {
  const cleaned: Point[] = [];

  for (const p of points) {
    const last = cleaned[cleaned.length - 1];

    if (!last || last.x !== p.x || last.y !== p.y) {
      cleaned.push({ ...p });
    }
  }

  return cleaned;
}

function getTargetCenter(target: RouteTarget, cellSize: number): Point {
  return {
    x: (target.col + target.w / 2) * cellSize,
    y: (target.row + target.h / 2) * cellSize,
  };
}

function getTargetBounds(target: RouteTarget, cellSize: number) {
  const padding = 10;

  return {
    left: target.col * cellSize + padding,
    top: target.row * cellSize + padding,
    right: (target.col + target.w) * cellSize - padding,
    bottom: (target.row + target.h) * cellSize - padding,
  };
}

function getExitPoint(
  target: RouteTarget,
  toward: Point,
  cellSize: number,
): Point {
  const center = getTargetCenter(target, cellSize);
  const bounds = getTargetBounds(target, cellSize);

  const dx = toward.x - center.x;
  const dy = toward.y - center.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? bounds.right : bounds.left,
      y: center.y,
    };
  }

  return {
    x: center.x,
    y: dy >= 0 ? bounds.bottom : bounds.top,
  };
}

function getEntryPoint(
  target: RouteTarget,
  from: Point,
  cellSize: number,
): Point {
  const center = getTargetCenter(target, cellSize);
  const bounds = getTargetBounds(target, cellSize);

  const dx = center.x - from.x;
  const dy = center.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? bounds.left : bounds.right,
      y: center.y,
    };
  }

  return {
    x: center.x,
    y: dy >= 0 ? bounds.top : bounds.bottom,
  };
}

function normalizeOrthogonal(points: Point[]) {
  if (points.length <= 1) return points.map((p) => ({ ...p }));

  const result: Point[] = [{ ...points[0] }];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];

    if (prev.x === curr.x || prev.y === curr.y) {
      result.push({ ...curr });
    } else {
      result.push({ x: curr.x, y: prev.y });
      result.push({ ...curr });
    }
  }

  return removeDuplicatePoints(result);
}

function refreshRouteTargets(
  routeTargets: RouteTarget[],
  obstacles: Obstacle[],
): RouteTarget[] {
  return routeTargets
    .map((target) => {
      const obstacle = obstacles.find((o) => o.id === target.id);
      if (!obstacle) return null;

      return {
        kind: "obstacle" as const,
        id: obstacle.id,
        label: obstacle.label,
        col: obstacle.col,
        row: obstacle.row,
        w: obstacle.w,
        h: obstacle.h,
      };
    })
    .filter(Boolean) as RouteTarget[];
}

function buildDefaultSections(
  targets: RouteTarget[],
  cellSize: number,
): RouteSection[] {
  const sections: RouteSection[] = [];

  for (let i = 0; i < targets.length - 1; i++) {
    const current = targets[i];
    const next = targets[i + 1];

    const currentCenter = getTargetCenter(current, cellSize);
    const nextCenter = getTargetCenter(next, cellSize);

    const dx = Math.abs(nextCenter.x - currentCenter.x);
    const dy = Math.abs(nextCenter.y - currentCenter.y);

    if (dx >= dy) {
      sections.push({
        id: makeId(),
        axis: "y",
        lane: currentCenter.y,
      });
    } else {
      sections.push({
        id: makeId(),
        axis: "x",
        lane: currentCenter.x,
      });
    }
  }

  return sections;
}

function buildSectionPoints(
  fromTarget: RouteTarget,
  toTarget: RouteTarget,
  section: RouteSection,
  cellSize: number,
): Point[] {
  const fromCenter = getTargetCenter(fromTarget, cellSize);
  const toCenter = getTargetCenter(toTarget, cellSize);

  const start = getExitPoint(fromTarget, toCenter, cellSize);
  const end = getEntryPoint(toTarget, fromCenter, cellSize);

  if (section.axis === "x") {
    return normalizeOrthogonal([
      start,
      { x: section.lane, y: start.y },
      { x: section.lane, y: end.y },
      end,
    ]);
  }

  return normalizeOrthogonal([
    start,
    { x: start.x, y: section.lane },
    { x: end.x, y: section.lane },
    end,
  ]);
}

function buildRoutePoints(
  targets: RouteTarget[],
  sections: RouteSection[],
  cellSize: number,
): Point[] {
  if (targets.length < 2) return [];

  const all: Point[] = [];

  for (let i = 0; i < targets.length - 1; i++) {
    const pairPoints = buildSectionPoints(
      targets[i],
      targets[i + 1],
      sections[i],
      cellSize,
    );

    if (all.length === 0) {
      all.push(...pairPoints);
    } else {
      const prev = all[all.length - 1];
      const first = pairPoints[0];

      if (prev.x === first.x && prev.y === first.y) {
        all.push(...pairPoints.slice(1));
      } else {
        all.push(...pairPoints);
      }
    }
  }

  return normalizeOrthogonal(all);
}

function pointsToSvg(points: Point[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function getLineDash(style: LineStyle) {
  return style === "dashed" ? "10 8" : undefined;
}

function clampLane(
  axis: "x" | "y",
  lane: number,
  gridCols: number,
  gridRows: number,
  cellSize: number,
) {
  if (axis === "x") {
    return Math.max(0, Math.min(lane, gridCols * cellSize));
  }

  return Math.max(0, Math.min(lane, gridRows * cellSize));
}

type MenuSectionProps = {
  id: MenuKey;
  title: string;
  badge?: string;
  isOpen: boolean;
  onToggle: (key: MenuKey) => void;
  children: React.ReactNode;
};

function MenuSection({
  id,
  title,
  badge,
  isOpen,
  onToggle,
  children,
}: MenuSectionProps) {
  return (
    <div className={`panel accordion-panel ${isOpen ? "accordion-open" : ""}`}>
      <button
        type="button"
        className="accordion-header"
        onClick={() => onToggle(id)}
      >
        <span className="accordion-title">{title}</span>

        <span className="accordion-right">
          {badge && <span className="accordion-badge">{badge}</span>}
          <span className="accordion-arrow">{isOpen ? "▲" : "▼"}</span>
        </span>
      </button>

      {isOpen && <div className="accordion-content">{children}</div>}
    </div>
  );
}

export default function App() {
  const boardRef = useRef<HTMLDivElement | null>(null);

  const [gridCols, setGridCols] = useState(12);
  const [gridRows, setGridRows] = useState(8);
  const [cellSize, setCellSize] = useState(60);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [customLabel, setCustomLabel] = useState("Vật cản mới");
  const [customWidth, setCustomWidth] = useState(1);
  const [customHeight, setCustomHeight] = useState(1);
  const [customImage, setCustomImage] = useState("");
  const [customRotate, setCustomRotate] = useState(0);

  const [routeMode, setRouteMode] = useState(false);
  const [draftRoute, setDraftRoute] = useState<RouteTarget[]>([]);
  const [routeName, setRouteName] = useState("Tuyến di chuyển");
  const [routes, setRoutes] = useState<RouteLine[]>([]);
  const [routeColor, setRouteColor] = useState("#0f172a");
  const [routeWidth, setRouteWidth] = useState(3);
  const [routeStyle, setRouteStyle] = useState<LineStyle>("dashed");

  const [freeDrawMode, setFreeDrawMode] = useState(false);
  const [freeLines, setFreeLines] = useState<FreeLine[]>([]);
  const [draftFreeLine, setDraftFreeLine] = useState<Point[]>([]);
  const [isDrawingFreeLine, setIsDrawingFreeLine] = useState(false);
  const [freeLineColor, setFreeLineColor] = useState("#f97316");
  const [freeLineWidth, setFreeLineWidth] = useState(2);
  const [freeLineStyle, setFreeLineStyle] = useState<LineStyle>("solid");

  const [dragLane, setDragLane] = useState<DragLaneState>(null);
  const [isBoardDragging, setIsBoardDragging] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  const [openMenus, setOpenMenus] = useState<Record<MenuKey, boolean>>({
    board: true,
    objects: true,
    edit: false,
    file: false,
    freeLine: false,
    route: false,
  });

  const [availableObjects, setAvailableObjects] =
    useState<PaletteItem[]>(createDefaultObjects);
  const [objectSearchKeyword, setObjectSearchKeyword] = useState("");
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  const selectedObstacle = obstacles.find((o) => o.id === selectedId) || null;

  const placedObjectLegends = useMemo(() => {
    const legendMap = new Map<string, Obstacle>();

    obstacles.forEach((item) => {
      const key = item.label.trim().toLowerCase() || item.id;

      if (!legendMap.has(key)) {
        legendMap.set(key, item);
      }
    });

    return Array.from(legendMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "vi"),
    );
  }, [obstacles]);

  const filteredAvailableObjects = useMemo(() => {
    const keyword = objectSearchKeyword.trim().toLowerCase();

    if (!keyword) {
      return availableObjects;
    }

    return availableObjects.filter((item) =>
      item.label.toLowerCase().includes(keyword),
    );
  }, [availableObjects, objectSearchKeyword]);

  const toggleMenu = (key: MenuKey) => {
    setOpenMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  React.useEffect(() => {
    if (!selectedId) return;

    setOpenMenus((prev) => ({
      ...prev,
      edit: true,
    }));
  }, [selectedId]);

  const normalizeRotate = (value: number) => {
    const next = Number(value) || 0;
    return Math.max(0, Math.min(next, 360));
  };

  const readImageFile = (
    file: File | undefined,
    callback: (image: string) => void,
  ) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        callback(reader.result);
      }
    };

    reader.readAsDataURL(file);
  };

  const addCustomObjectToLibrary = () => {
    const next: PaletteItem = {
      id: makeId(),
      type: "custom",
      label: customLabel.trim() || "Vật cản mới",
      w: Math.min(Math.max(customWidth, 1), 4),
      h: Math.min(Math.max(customHeight, 1), 4),
      image: customImage || "",
      rotate: normalizeRotate(customRotate),
    };

    setAvailableObjects((prev) => [...prev, next]);

    setCustomLabel("Vật cản mới");
    setCustomWidth(1);
    setCustomHeight(1);
    setCustomImage("");
    setCustomRotate(0);

    setOpenMenus((prev) => ({
      ...prev,
      objects: true,
    }));
  };

  const removeObjectFromLibrary = (id: string) => {
    setAvailableObjects((prev) => {
      const item = prev.find((object) => object.id === id);

      if (item?.locked) {
        return prev;
      }

      return prev.filter((object) => object.id !== id);
    });
  };

  const updateSelectedObstacle = (patch: Partial<Obstacle>) => {
    if (!selectedId) return;

    setObstacles((prev) =>
      prev.map((o) => (o.id === selectedId ? { ...o, ...patch } : o)),
    );

    if (patch.label !== undefined) {
      setRoutes((prev) =>
        prev.map((route) => ({
          ...route,
          targets: route.targets.map((target) =>
            target.id === selectedId
              ? {
                  ...target,
                  label: patch.label || "Vật cản",
                }
              : target,
          ),
        })),
      );

      setDraftRoute((prev) =>
        prev.map((target) =>
          target.id === selectedId
            ? {
                ...target,
                label: patch.label || "Vật cản",
              }
            : target,
        ),
      );
    }
  };

  const rotateObstacleByClick = (id: string) => {
    setObstacles((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              rotate: ((item.rotate || 0) + 15) % 360,
            }
          : item,
      ),
    );
  };

  const isInsideBoard = (col: number, row: number, w = 1, h = 1) => {
    return col >= 0 && row >= 0 && col + w <= gridCols && row + h <= gridRows;
  };

  const renderedRoutes = useMemo(() => {
    return routes
      .map((route) => {
        const refreshedTargets = refreshRouteTargets(route.targets, obstacles);
        if (refreshedTargets.length < 2) return null;

        const sections =
          route.sections.length === refreshedTargets.length - 1
            ? route.sections
            : buildDefaultSections(refreshedTargets, cellSize);

        const points = buildRoutePoints(refreshedTargets, sections, cellSize);

        return {
          ...route,
          targets: refreshedTargets,
          sections,
          points,
        };
      })
      .filter(Boolean) as Array<RouteLine & { points: Point[] }>;
  }, [routes, obstacles, cellSize]);

  const canPlaceObstacle = (next: Obstacle, ignoreId?: string) => {
    if (!isInsideBoard(next.col, next.row, next.w, next.h)) return false;

    return !obstacles.some((o) => {
      if (o.id === ignoreId) return false;

      const overlapX = next.col < o.col + o.w && next.col + next.w > o.col;
      const overlapY = next.row < o.row + o.h && next.row + next.h > o.row;

      return overlapX && overlapY;
    });
  };

  const getDropCell = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (!isInsideBoard(col, row)) return null;

    return { col, row };
  };

  const getBoardPointFromClient = (
    clientX: number,
    clientY: number,
  ): Point | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const x = Math.max(0, Math.min(clientX - rect.left, gridCols * cellSize));
    const y = Math.max(0, Math.min(clientY - rect.top, gridRows * cellSize));

    return { x, y };
  };

  const shouldIgnoreFreeDrawTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;

    return Boolean(target.closest(".route-drag-handle, .route-drag-hit"));
  };

  const startFreeDraw = (
    clientX: number,
    clientY: number,
    target: EventTarget | null,
  ) => {
    if (!freeDrawMode || routeMode) return;
    if (shouldIgnoreFreeDrawTarget(target)) return;

    const point = getBoardPointFromClient(clientX, clientY);
    if (!point) return;

    setIsDrawingFreeLine(true);
    setDraftFreeLine([point]);
  };

  const moveFreeDraw = (clientX: number, clientY: number) => {
    if (!freeDrawMode || !isDrawingFreeLine) return;

    const point = getBoardPointFromClient(clientX, clientY);
    if (!point) return;

    setDraftFreeLine((prev) => {
      const last = prev[prev.length - 1];

      if (
        last &&
        Math.abs(last.x - point.x) < 2 &&
        Math.abs(last.y - point.y) < 2
      ) {
        return prev;
      }

      return [...prev, point];
    });
  };

  const finishFreeDraw = () => {
    if (!isDrawingFreeLine) return;

    setIsDrawingFreeLine(false);

    setDraftFreeLine((prev) => {
      if (prev.length >= 2) {
        setFreeLines((lines) => [
          ...lines,
          {
            id: makeId(),
            points: prev,
            color: freeLineColor,
            width: freeLineWidth,
            style: freeLineStyle,
          },
        ]);
      }

      return [];
    });
  };

  const clearSelectedWhenClickBoard = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;

    const clickedOnObject = target.closest(
      ".obstacle, .route-drag-handle, .route-drag-hit",
    );

    if (clickedOnObject) return;

    setSelectedId(null);

    setOpenMenus((prev) => ({
      ...prev,
      edit: false,
    }));
  };

  const handleFreeDrawMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    clearSelectedWhenClickBoard(e.target);
    startFreeDraw(e.clientX, e.clientY, e.target);
  };

  const handleFreeDrawMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    moveFreeDraw(e.clientX, e.clientY);
  };

  const handleFreeDrawTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!freeDrawMode || routeMode) return;

    const touch = e.touches[0];
    if (!touch) return;

    e.preventDefault();
    startFreeDraw(touch.clientX, touch.clientY, e.target);
  };

  const handleFreeDrawTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!freeDrawMode || !isDrawingFreeLine) return;

    const touch = e.touches[0];
    if (!touch) return;

    e.preventDefault();
    moveFreeDraw(touch.clientX, touch.clientY);
  };

  const undoFreeLine = () => {
    setFreeLines((prev) => prev.slice(0, -1));
  };

  const clearFreeLines = () => {
    setFreeLines([]);
    setDraftFreeLine([]);
    setIsDrawingFreeLine(false);
  };

  const downloadJsonFile = (fileName: string, data: unknown) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const normalizeImportedObstacle = (
    item: Partial<Obstacle>,
    keepId = false,
  ): Obstacle | null => {
    if (
      typeof item.label !== "string" ||
      typeof item.col !== "number" ||
      typeof item.row !== "number" ||
      typeof item.w !== "number" ||
      typeof item.h !== "number"
    ) {
      return null;
    }

    const type: ObstacleType =
      item.type === "square" ||
      item.type === "wide" ||
      item.type === "custom" ||
      item.type === "player"
        ? item.type
        : "custom";

    return {
      id: keepId && item.id ? item.id : makeId(),
      type,
      label: item.label || (type === "player" ? "Người chơi" : "Vật thể"),
      col: item.col,
      row: item.row,
      w: item.w,
      h: item.h,
      image: typeof item.image === "string" ? item.image : "",
      rotate: normalizeRotate(item.rotate || 0),
    };
  };

  const exportObstacleGroup = () => {
    const data: ExportObstacleGroupFile & {
      imageMode: "base64-in-json";
      imageCount: number;
    } = {
      fileType: "obstacle-group",
      version: 1,
      exportedAt: new Date().toISOString(),
      imageMode: "base64-in-json",
      imageCount: obstacles.filter((item) => Boolean(item.image)).length,
      obstacles: obstacles.map((item) => ({
        ...item,
        image: item.image || "",
      })),
    };

    downloadJsonFile(
      `cum-vat-the-co-anh-${new Date().toISOString().slice(0, 10)}.json`,
      data,
    );
  };

  const exportFullField = () => {
    const data: ExportFullFieldFile & {
      imageMode: "base64-in-json";
      imageCount: number;
    } = {
      fileType: "full-field",
      version: 1,
      exportedAt: new Date().toISOString(),
      imageMode: "base64-in-json",
      imageCount: obstacles.filter((item) => Boolean(item.image)).length,
      grid: {
        cols: gridCols,
        rows: gridRows,
        cellSize,
      },
      obstacles: obstacles.map((item) => ({
        ...item,
        image: item.image || "",
      })),
      routes,
      freeLines,
    };

    downloadJsonFile(
      `toan-bo-san-co-anh-${new Date().toISOString().slice(0, 10)}.json`,
      data,
    );
  };

  const importObstacleGroup = (file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        if (typeof reader.result !== "string") return;

        const parsed = JSON.parse(
          reader.result,
        ) as Partial<ExportObstacleGroupFile>;

        if (
          parsed.fileType !== "obstacle-group" ||
          !Array.isArray(parsed.obstacles)
        ) {
          alert("File này không phải file cụm vật thể.");
          return;
        }

        const importedObstacles = parsed.obstacles
          .map((item) => normalizeImportedObstacle(item, false))
          .filter(Boolean) as Obstacle[];

        const validObstacles = importedObstacles.filter((item) =>
          isInsideBoard(item.col, item.row, item.w, item.h),
        );

        setObstacles((prev) => [...prev, ...validObstacles]);
        setSelectedId(null);

        setOpenMenus((prev) => ({
          ...prev,
          edit: false,
        }));
      } catch (error) {
        alert(
          "Không thể nhập cụm vật thể. Vui lòng chọn đúng file JSON đã xuất.",
        );
      }
    };

    reader.readAsText(file);
  };

  const normalizeImportedRoutes = (
    importedRoutes: unknown,
    playerIdFromOldFile?: string,
  ): RouteLine[] => {
    if (!Array.isArray(importedRoutes)) return [];

    return importedRoutes
      .map((route) => {
        const item = route as Partial<RouteLine>;

        if (!item.id || !item.name || !Array.isArray(item.targets)) return null;

        const targets = item.targets
          .map((target) => {
            const rawTarget = target as ImportedRouteTarget;

            if (rawTarget.kind === "player" && playerIdFromOldFile) {
              return {
                kind: "obstacle" as const,
                id: playerIdFromOldFile,
                label: rawTarget.label || "Người chơi",
                col: rawTarget.col,
                row: rawTarget.row,
                w: rawTarget.w || 1,
                h: rawTarget.h || 1,
              };
            }

            if (!rawTarget.id) return null;

            return {
              kind: "obstacle" as const,
              id: rawTarget.id,
              label: rawTarget.label || "Vật thể",
              col: rawTarget.col,
              row: rawTarget.row,
              w: rawTarget.w || 1,
              h: rawTarget.h || 1,
            };
          })
          .filter(Boolean) as RouteTarget[];

        return {
          id: item.id,
          name: item.name,
          targets,
          sections: Array.isArray(item.sections) ? item.sections : [],
          color: typeof item.color === "string" ? item.color : "#0f172a",
          width: typeof item.width === "number" ? item.width : 3,
          style:
            item.style === "solid" || item.style === "dashed"
              ? item.style
              : "dashed",
        };
      })
      .filter(Boolean) as RouteLine[];
  };

  const importFullField = (file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        if (typeof reader.result !== "string") return;

        const parsed = JSON.parse(
          reader.result,
        ) as Partial<ExportFullFieldFile>;

        if (
          parsed.fileType !== "full-field" ||
          !parsed.grid ||
          !Array.isArray(parsed.obstacles)
        ) {
          alert("File này không phải file toàn bộ sân.");
          return;
        }

        const nextCols = Math.min(Math.max(parsed.grid.cols || 12, 4), 20);
        const nextRows = Math.min(Math.max(parsed.grid.rows || 8, 4), 14);
        const nextCellSize = Math.min(
          Math.max(parsed.grid.cellSize || 60, 40),
          90,
        );

        const importedObstacles = parsed.obstacles
          .map((item) => normalizeImportedObstacle(item, true))
          .filter(Boolean) as Obstacle[];

        let playerIdFromOldFile: string | undefined;

        if (
          parsed.player &&
          typeof parsed.player.col === "number" &&
          typeof parsed.player.row === "number"
        ) {
          const oldPlayerObstacle: Obstacle = {
            id: makeId(),
            type: "player",
            label: "Người chơi 1",
            col: Math.max(0, Math.min(parsed.player.col || 0, nextCols - 1)),
            row: Math.max(0, Math.min(parsed.player.row || 0, nextRows - 1)),
            w: 1,
            h: 1,
            image: "",
            rotate: 0,
          };

          playerIdFromOldFile = oldPlayerObstacle.id;

          const hasPlayerAtOldPosition = importedObstacles.some(
            (item) =>
              item.type === "player" &&
              item.col === oldPlayerObstacle.col &&
              item.row === oldPlayerObstacle.row,
          );

          if (!hasPlayerAtOldPosition) {
            importedObstacles.unshift(oldPlayerObstacle);
          }
        }

        const validObstacles = importedObstacles.filter(
          (item) =>
            item.col >= 0 &&
            item.row >= 0 &&
            item.col + item.w <= nextCols &&
            item.row + item.h <= nextRows,
        );

        setGridCols(nextCols);
        setGridRows(nextRows);
        setCellSize(nextCellSize);
        setObstacles(validObstacles);

        setRoutes(normalizeImportedRoutes(parsed.routes, playerIdFromOldFile));

        setFreeLines(
          Array.isArray(parsed.freeLines)
            ? parsed.freeLines.map((line) => ({
                ...line,
                color: line.color || "#f97316",
                width: line.width || 2,
                style:
                  line.style === "solid" || line.style === "dashed"
                    ? line.style
                    : "solid",
              }))
            : [],
        );

        setSelectedId(null);
        setDraftRoute([]);
        setDraftFreeLine([]);
        setRouteMode(false);
        setFreeDrawMode(false);
        setIsDrawingFreeLine(false);
        setDragLane(null);

        setOpenMenus((prev) => ({
          ...prev,
          edit: false,
        }));
      } catch (error) {
        alert(
          "Không thể nhập toàn bộ sân. Vui lòng chọn đúng file JSON đã xuất.",
        );
      }
    };

    reader.readAsText(file);
  };

  const sanitizeBoard = (nextCols: number, nextRows: number) => {
    setObstacles((prev) =>
      prev.filter((o) => o.col + o.w <= nextCols && o.row + o.h <= nextRows),
    );

    setDraftRoute((prev) =>
      prev.filter((t) => t.col + t.w <= nextCols && t.row + t.h <= nextRows),
    );
  };

  const handleColsChange = (value: number) => {
    const next = Math.min(Math.max(value || 1, 4), 20);
    setGridCols(next);
    sanitizeBoard(next, gridRows);
  };

  const handleRowsChange = (value: number) => {
    const next = Math.min(Math.max(value || 1, 4), 14);
    setGridRows(next);
    sanitizeBoard(gridCols, next);
  };

  const handleCellSizeChange = (value: number) => {
    const next = Math.min(Math.max(value || 1, 40), 90);

    setRoutes((prev) =>
      prev.map((route) => ({
        ...route,
        sections: route.sections.map((section) => ({
          ...section,
          lane: snapToGrid(section.lane, next),
        })),
      })),
    );

    setCellSize(next);
  };

  const handleBoardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsBoardDragging(true);
  };

  const handleBoardDragLeave = (e: React.DragEvent) => {
    const currentTarget = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node | null;

    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setIsBoardDragging(false);
    }
  };

  const handleBoardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsBoardDragging(false);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;

    const cell = getDropCell(e.clientX, e.clientY);
    if (!cell) return;

    const data = JSON.parse(raw);

    if (data.kind === "palette-obstacle") {
      const next: Obstacle = {
        id: makeId(),
        type: data.type,
        label:
          data.type === "player"
            ? `Người chơi ${obstacles.filter((item) => item.type === "player").length + 1}`
            : data.label,
        col: cell.col,
        row: cell.row,
        w: data.w,
        h: data.h,
        image: data.image || "",
        rotate: normalizeRotate(data.rotate || 0),
      };

      if (canPlaceObstacle(next)) {
        setObstacles((prev) => [...prev, next]);
      }

      return;
    }

    if (data.kind === "move-obstacle") {
      const current = obstacles.find((o) => o.id === data.id);
      if (!current) return;

      const next = { ...current, col: cell.col, row: cell.row };

      if (canPlaceObstacle(next, current.id)) {
        setObstacles((prev) =>
          prev.map((o) => (o.id === current.id ? next : o)),
        );
      }
    }
  };

  const handleAddRouteTarget = (target: RouteTarget) => {
    if (!routeMode) return;

    setDraftRoute((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.id === target.id) return prev;

      return [...prev, target];
    });
  };

  const handleAddObstacleToRoute = (o: Obstacle) => {
    handleAddRouteTarget({
      kind: "obstacle",
      id: o.id,
      label: o.label,
      col: o.col,
      row: o.row,
      w: o.w,
      h: o.h,
    });
  };

  const saveRoute = () => {
    if (draftRoute.length < 2) return;

    setRoutes((prev) => [
      ...prev,
      {
        id: makeId(),
        name: routeName.trim() || `Tuyến ${prev.length + 1}`,
        targets: draftRoute,
        sections: buildDefaultSections(draftRoute, cellSize),
        color: routeColor,
        width: routeWidth,
        style: routeStyle,
      },
    ]);

    setDraftRoute([]);
    setRouteMode(false);
  };

  const startLaneDrag = (
    e: React.MouseEvent,
    routeId: string,
    sectionId: string,
    axis: "x" | "y",
    lane: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragLane({
      routeId,
      sectionId,
      axis,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originalLane: lane,
    });
  };

  React.useEffect(() => {
    if (!dragLane) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta =
        dragLane.axis === "x"
          ? e.clientX - dragLane.startClientX
          : e.clientY - dragLane.startClientY;

      const snapped = snapToGrid(delta, cellSize);
      const nextLane = clampLane(
        dragLane.axis,
        dragLane.originalLane + snapped,
        gridCols,
        gridRows,
        cellSize,
      );

      setRoutes((prev) =>
        prev.map((route) => {
          if (route.id !== dragLane.routeId) return route;

          return {
            ...route,
            sections: route.sections.map((section) =>
              section.id === dragLane.sectionId
                ? { ...section, lane: nextLane }
                : section,
            ),
          };
        }),
      );
    };

    const handleMouseUp = () => {
      setDragLane(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragLane, cellSize, gridCols, gridRows]);

  const resetBoard = () => {
    setGridCols(12);
    setGridRows(8);
    setCellSize(60);
    setSelectedId(null);
    setRouteMode(false);
    setDraftRoute([]);
    setRouteName("Tuyến di chuyển");
    setRoutes([]);
    setDragLane(null);
    setCustomImage("");
    setCustomRotate(0);
    setAvailableObjects(createDefaultObjects());
    setObjectSearchKeyword("");

    setFreeDrawMode(false);
    setFreeLines([]);
    setDraftFreeLine([]);
    setIsDrawingFreeLine(false);
    setFreeLineColor("#f97316");
    setFreeLineWidth(2);
    setFreeLineStyle("solid");
    setRouteColor("#0f172a");
    setRouteWidth(3);
    setRouteStyle("dashed");

    setOpenMenus((prev) => ({
      ...prev,
      edit: false,
      freeLine: false,
      objects: true,
    }));

    setObstacles([]);
  };

  const draftSections =
    draftRoute.length >= 2 ? buildDefaultSections(draftRoute, cellSize) : [];

  const draftPoints =
    draftRoute.length >= 2
      ? buildRoutePoints(draftRoute, draftSections, cellSize)
      : [];

  const draftPolyline = pointsToSvg(draftPoints);

  return (
    <div className="field-page">
      <div
        className={`field-layout ${leftPanelCollapsed ? "left-collapsed" : ""} ${
          rightPanelCollapsed ? "right-collapsed" : ""
        }`}
      >
        <div
          className={`sidebar side-panel left-sidebar ${leftPanelCollapsed ? "side-collapsed" : ""}`}
        >
          <button
            type="button"
            className="side-collapse-btn left-collapse-btn"
            onClick={() => setLeftPanelCollapsed((prev) => !prev)}
            title={leftPanelCollapsed ? "Mở menu trái" : "Thu nhỏ menu trái"}
          >
            {leftPanelCollapsed ? "›" : "‹"}
          </button>
          <MenuSection
            id="board"
            title="Chỉnh ô sân"
            badge={`${gridCols}x${gridRows}`}
            isOpen={openMenus.board}
            onToggle={toggleMenu}
          >
            <div className="input-row input-row-3">
              <div>
                <label className="input-label">Cột</label>
                <input
                  className="form-input"
                  type="number"
                  min={4}
                  max={20}
                  value={gridCols}
                  onChange={(e) => handleColsChange(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="input-label">Hàng</label>
                <input
                  className="form-input"
                  type="number"
                  min={4}
                  max={14}
                  value={gridRows}
                  onChange={(e) => handleRowsChange(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="input-label">Ô</label>
                <input
                  className="form-input"
                  type="number"
                  min={40}
                  max={90}
                  value={cellSize}
                  onChange={(e) => handleCellSizeChange(Number(e.target.value))}
                />
              </div>
            </div>
          </MenuSection>

          <MenuSection
            id="objects"
            title="Vật thể"
            badge={`${availableObjects.length}`}
            isOpen={openMenus.objects}
            onToggle={toggleMenu}
          >
<div className="object-library">
  <div className="route-list-title">Danh sách vật thể</div>

  <div className="object-search-box">
    <input
      className="form-input object-search-input"
      value={objectSearchKeyword}
      onChange={(e) => setObjectSearchKeyword(e.target.value)}
      placeholder="Tìm vật thể..."
    />

    {objectSearchKeyword && (
      <button
        type="button"
        className="object-search-clear"
        onClick={() => setObjectSearchKeyword("")}
      >
        ×
      </button>
    )}
  </div>

  <div className="card-list">
    {filteredAvailableObjects.map((item) => (
                  <div
                    key={item.id}
                    className={`drag-card object-card ${
                      item.type === "player" ? "player-card" : ""
                    }`}
                    draggable={!freeDrawMode}
                    onDragEnd={() => setIsBoardDragging(false)}
                    onDragStart={(e) => {
                      const target = e.target as HTMLElement;

                      if (target.closest(".object-delete-btn")) {
                        e.preventDefault();
                        return;
                      }

                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({
                          kind: "palette-obstacle",
                          type: item.type,
                          label: item.label,
                          w: item.w,
                          h: item.h,
                          image: item.image || "",
                          rotate: item.rotate || 0,
                        }),
                      );
                    }}
                  >
                    {item.image ? (
                      <img
                        className="object-thumb"
                        src={item.image}
                        alt={item.label}
                      />
                    ) : item.type === "player" ? (
                      <div className="drag-icon">👤</div>
                    ) : (
                      <div className="drag-icon">
                        {item.w === 1 ? "⬜" : "▭"}
                      </div>
                    )}

                    <div className="object-info">
                      <div className="drag-title">{item.label}</div>
                      <div className="drag-subtitle">
                        {item.type === "player"
                          ? "Kéo vào sân nhiều lần để thêm nhiều người"
                          : `${item.w} x ${item.h} ô · xoay ${item.rotate || 0}°`}
                      </div>
                    </div>

                    {!item.locked && (
                      <button
                        type="button"
                        className="object-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeObjectFromLibrary(item.id);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onDragStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                ))}{filteredAvailableObjects.length === 0 && (
  <div className="object-empty-search">
    Không tìm thấy vật thể phù hợp.
  </div>
)}
              </div>
            </div>

            <div className="object-create-box">
              <div className="route-list-title">Thêm vật thể mới</div>

              <input
                className="form-input"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Tên vật cản"
              />

              <div className="input-row">
                <div>
                  <label className="input-label">Rộng</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={4}
                    value={customWidth}
                    onChange={(e) =>
                      setCustomWidth(Number(e.target.value) || 1)
                    }
                  />
                </div>

                <div>
                  <label className="input-label">Cao</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={4}
                    value={customHeight}
                    onChange={(e) =>
                      setCustomHeight(Number(e.target.value) || 1)
                    }
                  />
                </div>
              </div>

              <div className="compact-field">
                <label className="input-label">Ảnh</label>
                <input
                  className="form-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    readImageFile(e.target.files?.[0], setCustomImage);
                  }}
                />
              </div>

              {customImage && (
                <div className="image-preview compact-preview">
                  <img src={customImage} alt="Preview vật cản" />
                  <button
                    type="button"
                    className="btn btn-gray compact-btn"
                    onClick={() => setCustomImage("")}
                  >
                    Xóa
                  </button>
                </div>
              )}

              <div className="rotate-control compact-rotate">
                <label className="input-label">Xoay: {customRotate}°</label>

                <div className="rotate-inline">
                  <input
                    className="rotate-slider"
                    type="range"
                    min={0}
                    max={360}
                    value={customRotate}
                    onChange={(e) =>
                      setCustomRotate(normalizeRotate(Number(e.target.value)))
                    }
                  />

                  <input
                    className="form-input rotate-number"
                    type="number"
                    min={0}
                    max={360}
                    value={customRotate}
                    onChange={(e) =>
                      setCustomRotate(normalizeRotate(Number(e.target.value)))
                    }
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-green add-object-btn"
                onClick={addCustomObjectToLibrary}
              >
                Thêm vào vật thể
              </button>
            </div>
          </MenuSection>
        </div>

        <div
          className="board-wrapper"
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;

            if (
              target.closest(
                ".obstacle, .football-board, .route-drag-handle, .route-drag-hit",
              )
            ) {
              return;
            }

            setSelectedId(null);

            setOpenMenus((prev) => ({
              ...prev,
              edit: false,
            }));
          }}
        >
          <div className="board-header">
            <div>
              <h2 className="board-title">Sân mô phỏng</h2>
              <p className="board-subtitle">
                Lưới {gridCols} x {gridRows} ô
              </p>
            </div>

            {selectedObstacle && (
              <div className="selected-box">
                Đang chọn: <strong>{selectedObstacle.label}</strong> (
                {selectedObstacle.w}x{selectedObstacle.h})
              </div>
            )}
          </div>

          <div
            ref={boardRef}
            className={`football-board ${isBoardDragging ? "football-board-show-grid" : ""} ${
              freeDrawMode ? "football-board-free-draw" : ""
            }`}
            onDragOver={handleBoardDragOver}
            onDragLeave={handleBoardDragLeave}
            onDrop={handleBoardDrop}
            onMouseDown={handleFreeDrawMouseDown}
            onMouseMove={handleFreeDrawMouseMove}
            onMouseUp={finishFreeDraw}
            onMouseLeave={() => {
              finishFreeDraw();
            }}
            onTouchStart={handleFreeDrawTouchStart}
            onTouchMove={handleFreeDrawTouchMove}
            onTouchEnd={finishFreeDraw}
            style={{
              width: gridCols * cellSize,
              height: gridRows * cellSize,
              backgroundSize: isBoardDragging
                ? `${cellSize}px ${cellSize}px, ${cellSize}px ${cellSize}px, auto`
                : "auto",
              backgroundRepeat: isBoardDragging
                ? "repeat, repeat, no-repeat"
                : "no-repeat",
            }}
          >
            {Array.from({ length: gridRows * gridCols }).map((_, i) => {
              const col = i % gridCols;
              const row = Math.floor(i / gridCols);

              return (
                <div
                  key={`${col}-${row}`}
                  className="grid-cell"
                  style={{
                    left: col * cellSize,
                    top: row * cellSize,
                    width: cellSize,
                    height: cellSize,
                  }}
                />
              );
            })}

            <svg
              className="route-svg"
              width={gridCols * cellSize}
              height={gridRows * cellSize}
              viewBox={`0 0 ${gridCols * cellSize} ${gridRows * cellSize}`}
            >
              <defs>
                <marker
                  id="route-arrow-dark"
                  markerWidth="5"
                  markerHeight="5"
                  refX="11"
                  refY="7"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L10,5 L0,10 Z" fill="#0f172a" />
                </marker>

                <marker
                  id="route-arrow-blue"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L10,5 L0,10 Z" fill="#2563eb" />
                </marker>
                <marker
                  id="free-line-arrow"
                  markerWidth="22"
                  markerHeight="22"
                  refX="8"
                  refY="5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
                </marker>
              </defs>

              {freeLines.map((line) => (
                <polyline
                  key={line.id}
                  className="free-line"
                  points={pointsToSvg(line.points)}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={line.width}
                  strokeDasharray={getLineDash(line.style || "solid")}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  markerEnd="url(#free-line-arrow)"
                />
              ))}

              {draftFreeLine.length >= 2 && (
                <polyline
                  className="free-line free-line-draft"
                  points={pointsToSvg(draftFreeLine)}
                  fill="none"
                  stroke={freeLineColor}
                  strokeWidth={freeLineWidth}
                  strokeDasharray={getLineDash(freeLineStyle)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {renderedRoutes.map((route) => {
                const start = route.points[0];

                return (
                  <g key={route.id}>
                    <polyline
                      points={pointsToSvg(route.points)}
                      fill="none"
                      stroke={route.color || "#0f172a"}
                      strokeWidth={route.width || 4}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={getLineDash(route.style || "dashed")}
                      markerEnd="url(#route-arrow-dark)"
                    />

                    {start && (
                      <circle
                        cx={start.x}
                        cy={start.y}
                        r="6"
                        fill={route.color || "#0f172a"}
                      />
                    )}

                    {route.sections.map((section, index) => {
                      const fromTarget = route.targets[index];
                      const toTarget = route.targets[index + 1];

                      if (!fromTarget || !toTarget) return null;

                      const pairPoints = buildSectionPoints(
                        fromTarget,
                        toTarget,
                        section,
                        cellSize,
                      );
                      const p1 = pairPoints[1];
                      const p2 = pairPoints[2];

                      if (!p1 || !p2) return null;

                      if (section.axis === "x") {
                        const midX = p1.x;
                        const midY = (p1.y + p2.y) / 2;

                        return (
                          <g key={section.id}>
                            <line
                              x1={p1.x}
                              y1={p1.y}
                              x2={p2.x}
                              y2={p2.y}
                              className="route-drag-hit"
                              onMouseDown={(e) =>
                                startLaneDrag(
                                  e,
                                  route.id,
                                  section.id,
                                  "x",
                                  section.lane,
                                )
                              }
                            />

                            <rect
                              x={midX - 8}
                              y={midY - 8}
                              width="16"
                              height="16"
                              rx="4"
                              className="route-drag-handle"
                              onMouseDown={(e) =>
                                startLaneDrag(
                                  e,
                                  route.id,
                                  section.id,
                                  "x",
                                  section.lane,
                                )
                              }
                            />
                          </g>
                        );
                      }

                      const midX = (p1.x + p2.x) / 2;
                      const midY = p1.y;

                      return (
                        <g key={section.id}>
                          <line
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            className="route-drag-hit"
                            onMouseDown={(e) =>
                              startLaneDrag(
                                e,
                                route.id,
                                section.id,
                                "y",
                                section.lane,
                              )
                            }
                          />

                          <rect
                            x={midX - 8}
                            y={midY - 8}
                            width="16"
                            height="16"
                            rx="4"
                            className="route-drag-handle"
                            onMouseDown={(e) =>
                              startLaneDrag(
                                e,
                                route.id,
                                section.id,
                                "y",
                                section.lane,
                              )
                            }
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {draftPoints.length >= 2 && (
                <g>
                  <polyline
                    points={draftPolyline}
                    fill="none"
                    stroke={routeColor}
                    strokeWidth={routeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={getLineDash(routeStyle)}
                    markerEnd="url(#route-arrow-blue)"
                  />

                  <circle
                    cx={draftPoints[0].x}
                    cy={draftPoints[0].y}
                    r="6"
                    fill={routeColor}
                  />
                </g>
              )}
            </svg>

            {obstacles.map((o) => (
              <div
                key={o.id}
               className={`obstacle ${selectedId === o.id ? "obstacle-selected" : ""} ${
  o.type === "custom" ? "obstacle-custom" : ""
} ${o.type === "player" ? "player-piece" : ""} ${
  routeMode ? "route-pickable" : ""
} ${freeDrawMode ? "free-draw-ignore-object" : ""}`}
                style={{
                  left: o.col * cellSize + 4,
                  top: o.row * cellSize + 4,
                  width: o.w * cellSize - 8,
                  height: o.h * cellSize - 8,
                  transform: `rotate(${o.rotate || 0}deg)`,
                }}
                draggable={!routeMode && !freeDrawMode}
                onDragEnd={() => setIsBoardDragging(false)}
                onClick={(e) => {
                  e.stopPropagation();

                  if (routeMode) {
                    handleAddObstacleToRoute(o);
                    return;
                  }

                  if (freeDrawMode) return;

                  setSelectedId(o.id);
                  setLeftPanelCollapsed(true);
                  setRightPanelCollapsed(false);

                  setOpenMenus((prev) => ({
                    ...prev,
                    edit: true,
                  }));

                  if (o.type !== "player") {
                    rotateObstacleByClick(o.id);
                  }
                }}
                onDragStart={(e) => {
                  e.stopPropagation();

                  if (routeMode || freeDrawMode) return;

                  setSelectedId(o.id);

                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({
                      kind: "move-obstacle",
                      id: o.id,
                    }),
                  );
                }}
              >
                {o.image ? (
                  <img className="obstacle-image" src={o.image} alt={o.label} />
                ) : o.type === "player" ? (
                  <span className="obstacle-label">👤</span>
                ) : (
                  <span className="obstacle-label">{o.label}</span>
                )}
              </div>
            ))}
          </div>

          {placedObjectLegends.length > 0 && (
            <div
              className="field-object-legend"
              style={{
                width: gridCols * cellSize,
                maxWidth: "100%",
                marginTop: 14,
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                background: "#ffffff",
                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div
                className="field-object-legend-title"
                style={{
                  marginBottom: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Ghi chú vật thể
              </div>

              <div
                className="field-object-legend-list"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {placedObjectLegends.map((item) => (
                  <div
                    key={`${item.type}-${item.label}`}
                    className="field-object-legend-item"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      minHeight: 36,
                      padding: "6px 10px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 999,
                      background: "#f8fafc",
                      color: "#1f2937",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.label}
                        style={{
                          width: 26,
                          height: 26,
                          objectFit: "contain",
                          flex: "0 0 auto",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 8,
                          background: item.type === "player" ? "#2563eb" : "#e5e7eb",
                          color: item.type === "player" ? "#ffffff" : "#111827",
                          fontSize: 16,
                        }}
                      >
                        {item.type === "player" ? "👤" : "⬜"}
                      </span>
                    )}

                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className={`sidebar side-panel right-sidebar ${rightPanelCollapsed ? "side-collapsed" : ""}`}
        >
          <button
            type="button"
            className="side-collapse-btn right-collapse-btn"
            onClick={() => setRightPanelCollapsed((prev) => !prev)}
            title={rightPanelCollapsed ? "Mở menu phải" : "Thu nhỏ menu phải"}
          >
            {rightPanelCollapsed ? "‹" : "›"}
          </button>
          {selectedObstacle && (
            <MenuSection
              id="edit"
              title="Chỉnh vật đang chọn"
              badge={selectedObstacle.label}
              isOpen={openMenus.edit}
              onToggle={toggleMenu}
            >
              <div className="selected-edit-name">
                {selectedObstacle.label} ({selectedObstacle.w}x
                {selectedObstacle.h})
              </div>

              <div className="compact-field">
                <label className="input-label">Tên</label>
                <input
                  className="form-input"
                  value={selectedObstacle.label}
                  onChange={(e) => {
                    updateSelectedObstacle({
                      label: e.target.value,
                    });
                  }}
                  placeholder="Nhập tên vật cản"
                />
              </div>

              <div className="compact-field">
                <label className="input-label">Ảnh</label>
                <input
                  className="form-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    readImageFile(e.target.files?.[0], (image) => {
                      updateSelectedObstacle({ image });
                    });
                  }}
                />
              </div>

              {selectedObstacle.image && (
                <div className="image-preview compact-preview">
                  <img
                    src={selectedObstacle.image}
                    alt={selectedObstacle.label}
                  />
                  <button
                    type="button"
                    className="btn btn-gray compact-btn"
                    onClick={() => updateSelectedObstacle({ image: "" })}
                  >
                    Xóa
                  </button>
                </div>
              )}

              <div className="rotate-control compact-rotate">
                <label className="input-label">
                  Xoay: {selectedObstacle.rotate || 0}°
                </label>

                <div className="rotate-inline">
                  <input
                    className="rotate-slider"
                    type="range"
                    min={0}
                    max={360}
                    value={selectedObstacle.rotate || 0}
                    onChange={(e) =>
                      updateSelectedObstacle({
                        rotate: normalizeRotate(Number(e.target.value)),
                      })
                    }
                  />

                  <input
                    className="form-input rotate-number"
                    type="number"
                    min={0}
                    max={360}
                    value={selectedObstacle.rotate || 0}
                    onChange={(e) =>
                      updateSelectedObstacle({
                        rotate: normalizeRotate(Number(e.target.value)),
                      })
                    }
                  />
                </div>
              </div>
            </MenuSection>
          )}

<div style={{ display: "none" }}>
  <MenuSection
    id="file"
    title="Xuất / Nhập file"
    badge={`${obstacles.length}`}
    isOpen={openMenus.file}
    onToggle={toggleMenu}
  >
    <div className="file-tool-box">
      <div className="route-list-title">1. Cụm vật thể</div>

      <div className="button-row">
        <button
          className="btn btn-green"
          onClick={exportObstacleGroup}
          disabled={obstacles.length === 0}
        >
          Xuất cụm
        </button>

        <label className="btn btn-blue import-file-btn">
          Nhập cụm
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              importObstacleGroup(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="route-empty import-note">
        Nhập cụm sẽ thêm vật thể vào sân hiện tại, không xóa vật thể đang có.
      </div>
    </div>

    <div className="file-tool-box">
      <div className="route-list-title">2. Toàn bộ sân</div>

      <div className="button-row">
        <button className="btn btn-green" onClick={exportFullField}>
          Xuất sân
        </button>

        <label className="btn btn-blue import-file-btn">
          Nhập sân
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              importFullField(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="route-empty import-note">
        Nhập sân sẽ khôi phục nguyên sân cũ, gồm vật thể, ảnh, line theo ô và
        line tự do.
      </div>
    </div>
  </MenuSection>
</div>

          <MenuSection
            id="freeLine"
            title="Vẽ line tự do"
            badge={`${freeLines.length}`}
            isOpen={openMenus.freeLine}
            onToggle={toggleMenu}
          >
            <div className="button-row">
              <button
                className={`btn ${freeDrawMode ? "btn-blue" : "btn-dark"}`}
                onClick={() => {
                  setFreeDrawMode((prev) => !prev);
                  setRouteMode(false);
                  setDraftFreeLine([]);
                  setIsDrawingFreeLine(false);
                }}
              >
                {freeDrawMode ? "Đang vẽ" : "Bật vẽ"}
              </button>

              <button
                className="btn btn-gray"
                onClick={undoFreeLine}
                disabled={freeLines.length === 0}
              >
                Hoàn tác
              </button>
            </div>

            <div className="button-row route-button-row">
              <button
                className="btn btn-red"
                onClick={clearFreeLines}
                disabled={freeLines.length === 0 && draftFreeLine.length === 0}
              >
                Xóa line
              </button>
            </div>

            <div className="input-row free-line-control">
              <div>
                <label className="input-label">Màu</label>
                <input
                  className="form-input color-input"
                  type="color"
                  value={freeLineColor}
                  onChange={(e) => setFreeLineColor(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Độ dày</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={20}
                  value={freeLineWidth}
                  onChange={(e) =>
                    setFreeLineWidth(
                      Math.min(Math.max(Number(e.target.value) || 1, 1), 20),
                    )
                  }
                />
              </div>
            </div>

            <div className="compact-field">
              <label className="input-label">Kiểu nét</label>
              <select
                className="form-input"
                value={freeLineStyle}
                onChange={(e) => setFreeLineStyle(e.target.value as LineStyle)}
              >
                <option value="solid">Liền mạch</option>
                <option value="dashed">Nét đứt</option>
              </select>
            </div>

            <div className="route-empty">
              Bật vẽ rồi kéo chuột hoặc vuốt trên sân để vẽ.
            </div>
          </MenuSection>

          <MenuSection
            id="route"
            title="Vẽ line theo ô"
            badge={`${routes.length}`}
            isOpen={openMenus.route}
            onToggle={toggleMenu}
          >
            <input
              className="form-input"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Tên tuyến"
            />

            <div className="input-row free-line-control">
              <div>
                <label className="input-label">Màu</label>
                <input
                  className="form-input color-input"
                  type="color"
                  value={routeColor}
                  onChange={(e) => setRouteColor(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Độ dày</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={20}
                  value={routeWidth}
                  onChange={(e) =>
                    setRouteWidth(
                      Math.min(Math.max(Number(e.target.value) || 1, 1), 20),
                    )
                  }
                />
              </div>
            </div>

            <div className="compact-field">
              <label className="input-label">Kiểu nét</label>
              <select
                className="form-input"
                value={routeStyle}
                onChange={(e) => setRouteStyle(e.target.value as LineStyle)}
              >
                <option value="solid">Liền mạch</option>
                <option value="dashed">Nét đứt</option>
              </select>
            </div>

            <div className="button-row">
              <button
                className={`btn ${routeMode ? "btn-blue" : "btn-dark"}`}
                onClick={() => {
                  setRouteMode((prev) => !prev);
                  setFreeDrawMode(false);
                  setDraftFreeLine([]);
                  setIsDrawingFreeLine(false);
                  setDraftRoute([]);
                }}
              >
                {routeMode ? "Đang chọn" : "Bật vẽ"}
              </button>

              <button
                className="btn btn-gray"
                onClick={() => setDraftRoute([])}
                disabled={draftRoute.length === 0}
              >
                Xóa nháp
              </button>
            </div>

            <div className="button-row route-button-row">
              <button
                className="btn btn-green"
                onClick={saveRoute}
                disabled={draftRoute.length < 2}
              >
                Lưu
              </button>

              <button
                className="btn btn-red"
                onClick={() => setRoutes([])}
                disabled={routes.length === 0}
              >
                Xóa line
              </button>
            </div>

            <div className="route-list">
              <div className="route-list-title">Điểm đang chọn</div>

              {draftRoute.length === 0 ? (
                <div className="route-empty">Chưa có điểm</div>
              ) : (
                draftRoute.map((item, index) => (
                  <div
                    key={`${item.kind}-${item.id}-${index}`}
                    className="route-chip"
                  >
                    {index + 1}. {item.label}
                  </div>
                ))
              )}
            </div>

            <div className="route-list">
              <div className="route-list-title">Tuyến đã lưu</div>

              {routes.length === 0 ? (
                <div className="route-empty">Chưa có tuyến</div>
              ) : (
                routes.map((route) => (
                  <div key={route.id} className="saved-route-item">
                    <div className="saved-route-name">{route.name}</div>
                    <div className="saved-route-path">
                      {route.targets.map((t) => t.label).join(" -> ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </MenuSection>

          <div className="button-row sidebar-actions">
            <button className="btn btn-dark" onClick={resetBoard}>
              Reset
            </button>

            <button
              className="btn btn-red"
              disabled={!selectedId}
              onClick={() => {
                if (!selectedId) return;

                setObstacles((prev) => prev.filter((o) => o.id !== selectedId));
                setRoutes((prev) =>
                  prev
                    .map((route) => ({
                      ...route,
                      targets: route.targets.filter(
                        (target) => target.id !== selectedId,
                      ),
                    }))
                    .filter((route) => route.targets.length >= 2),
                );
                setDraftRoute((prev) =>
                  prev.filter((target) => target.id !== selectedId),
                );
                setSelectedId(null);

                setOpenMenus((prev) => ({
                  ...prev,
                  edit: false,
                }));
              }}
            >
              Xóa chọn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
