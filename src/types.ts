export type Position = number[];
export type LineString = {
  type: "LineString";
  coordinates: Position[];
};
export type Polygon = {
  type: "Polygon";
  coordinates: Position[][];
};
export type Point = {
  type: "Point";
  coordinates: Position;
};
export type Geometry = LineString | Polygon;
export type Tool = "modify" | "draw";
export type DrawMode = "create" | "append";
export type DrawType = Geometry["type"];
export type LayerType = "node" | "point" | "line" | "fill";
export type NodeFeature = {
  id: number;
  type: "Feature";
  geometry: Point;
  properties: {
    before: number;
    after: number;
    featureId: number;
  };
};
export type DataItem = {
  type: "Feature";
  geometry: Geometry;
  properties?: object | null;
};
export type GeometryFeature = DataItem & { id: number };
