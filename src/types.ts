export type Position = number[];

export type Point = {
  type: "Point";
  coordinates: Position;
};

export type LineString = {
  type: "LineString";
  coordinates: Position[];
};

export type MultiLineString = {
  type: "MultiLineString";
  coordinates: Position[][];
};

export type Polygon = {
  type: "Polygon";
  coordinates: Position[][];
};

export type MultiPolygon = {
  type: "MultiPolygon";
  coordinates: Position[][][];
};

export type DrawType = "LineString" | "Polygon" | "MultiLineString";
export type LayerType = "point" | "line" | "plane";
export type Node = {
  fid: number;
  indices: number[];
  position: Position;
};

export type Feature<T = LineString | Polygon | MultiLineString | MultiPolygon> = T & {
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
