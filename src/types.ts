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

export type DrawType = "LineString" | "Polygon";
export type LayerType = "node" | "line" | "fill";

export type Node = {
  id: number;
  parentId: number;
  position: Position;
};

export type Feature<T = LineString | Polygon> = T & {
  id: number;
  props?: {
    color?: string;
  } & Record<string, any>;
};

export type SourceEvent = {
  position: Position;
  features: Feature[];
  nodes: Node[];
  layer?: LayerType;
  originalEvent?: MouseEvent | TouchEvent;
};

export type SourceEventOptions = { once?: boolean } | undefined;
export type SourceMouseHandler = (e: SourceEvent) => void;
