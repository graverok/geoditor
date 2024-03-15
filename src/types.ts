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
export type LayerState = "disabled" | "hover" | "active";
export type FeatureProps = {
  color?: string;
} & Record<string, any>;

export type Feature<T = LineString | Polygon | MultiLineString | MultiPolygon, P = FeatureProps> = T & {
  nesting: number[];
  props?: P;
};

export type Point = {
  nesting: number[];
  coordinates: Position;
  props?: FeatureProps;
};

export type Line = {
  nesting: number[];
  coordinates: Position[];
  props?: FeatureProps;
};

export type Plane = {
  nesting: number[];
  coordinates: Position[][];
  props?: FeatureProps;
};

export interface SourceEvent<O extends MouseEvent | TouchEvent = MouseEvent> {
  position: Position;
  originalEvent: O;
  layer?: LayerType;
  points: Point[];
  lines: Line[];
  planes: Plane[];
}

export type SourceEventHandler = (e: SourceEvent) => void;
export type SourceEventOptions = { once?: boolean };
