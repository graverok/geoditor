export type Position = number[];

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

export type DrawType = "LineString" | "Polygon";
export type LayerType = "points" | "lines" | "planes";
export type FeatureProps = {
  color?: string;
} & Record<string, any>;

export type Feature<T = LineString | Polygon | MultiLineString | MultiPolygon, P = FeatureProps> = T & {
  id: number;
  props?: P;
};

export type Point<P = undefined> = {
  fid: number;
  indices: number[];
  coordinates: Position;
  props?: P;
};

export type Line = {
  fid: number;
  indices: number[];
  coordinates: Position[];
};

export type Plane = {
  fid: number;
  indices: number[];
  coordinates: Position[][];
};

export interface SourceEvent {
  position: Position;
  originalEvent: MouseEvent | TouchEvent;
  layer?: LayerType;
  points: Point[];
  lines: Line[];
  planes: Plane[];
}

export type SourceEventHandler = (e: SourceEvent) => void;
export type SourceEventOptions = { once?: boolean };
