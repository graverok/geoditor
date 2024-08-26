import * as geojson from "geojson";

export type Position = number[];

export type DrawType = "LineString" | "Polygon" | "MultiLineString" | "MultiPolygon";
export type LayerType = "points" | "lines" | "planes";
export type LayerState = "disabled" | "hover" | "active";
export type FeatureProps = {
  color?: string;
} & Record<string, unknown>;

export type Feature<
  T = geojson.LineString | geojson.Polygon | geojson.MultiLineString | geojson.MultiPolygon,
  P = FeatureProps,
> = T & {
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
