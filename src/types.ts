import * as geojson from "geojson";

export type Position = number[];
export type GeometryType = "LineString" | "Polygon" | "MultiLineString" | "MultiPolygon";
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
  type: geojson.Point["type"];
  nesting: number[];
  coordinates: Position;
  props?: FeatureProps;
};

export type Line = {
  type: geojson.LineString["type"];
  nesting: number[];
  coordinates: Position[];
  props?: FeatureProps;
};

export type Plane = {
  type: geojson.Polygon["type"];
  nesting: number[];
  coordinates: Position[][];
  props?: FeatureProps;
};

export type Shape = Point | Line | Plane;

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
export type FilterHandler = (shape: Shape) => boolean | void;
export type SubscribeType = "filter";
export type ControllerEventType =
  | "click"
  | "dblclick"
  | "mousedown"
  | "mouseup"
  | "mousemove"
  | "mouseenter"
  | "mouseleave"
  | "mouseover"
  | "mouseout"
  | "contextmenu"
  | "touchstart"
  | "touchend"
  | "touchcancel";

export type KeyModifier = "alt" | "shift" | "ctrl" | "meta";
