export type Position = number[];
export type Point = {
  type: "Point";
  coordinates: Position;
};
export type LineString = {
  type: "LineString";
  coordinates: Position[];
};
export type Polygon = {
  type: "Polygon";
  coordinates: Position[][];
};
export type Tool = "modify" | "draw";
export type DrawMode = "create" | "append";
export type DrawType = "LineString" | "Polygon";
export type LayerType = "node" | "line" | "fill";

export type Node = {
  id: number;
  parentId: number;
  position: Position;
};

export type GeometryFeature<T = LineString | Polygon> = T & {
  id: number;
  props?: {
    color?: string;
  } & Record<string, any>;
};

export type SourceEvent = {
  position: Position;
  features: GeometryFeature[];
  nodes: Node[];
  layer?: LayerType;
  originalEvent?: unknown;
};

export type SourceEventOptions = { once?: boolean } | undefined;
export type SourceMouseHandler = (e: SourceEvent) => void;
