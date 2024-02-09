import { Map, MapLayerMouseEvent, MapLayerTouchEvent, MapMouseEvent } from "mapbox-gl";
import { GeometryFeature, LayerType, Node, Position, SourceEvent, SourceMouseHandler } from "../../types";
import { Feature, LineString, Polygon } from "geojson";
import { NodeGeoJSONProperties } from "./mapbox-source";
import { positionTools } from "../../lib";

export const eventMapParser = (e: MapMouseEvent): SourceEvent => ({
  position: e.lngLat.toArray(),
  originalEvent: e.originalEvent,
  features: [],
  nodes: [],
});

const sortNodesByDistance = (nodes: Node[], position: Position) => {
  return [...nodes].sort((a, b) =>
    positionTools.distance(a.position, position) > positionTools.distance(b.position, position) ? 1 : -1,
  );
};

export const eventLayerParser =
  (layer: LayerType) =>
  (e: MapLayerMouseEvent | MapLayerTouchEvent): SourceEvent => {
    return {
      position: e.lngLat.toArray(),
      originalEvent: e.originalEvent,
      layer,
      features:
        layer !== "node"
          ? (e.features || []).map(
              (item) =>
                ({
                  id: item.id,
                  type: item.geometry.type,
                  coordinates: (item as Feature<LineString> | Feature<Polygon>).geometry.coordinates,
                  props: item.properties,
                }) as GeometryFeature,
            )
          : [],
      nodes:
        layer === "node"
          ? sortNodesByDistance(
              (e.features || []).map((item) => {
                const properties = item.properties as NodeGeoJSONProperties;
                return {
                  id: properties.id,
                  parentId: properties.parentId,
                  position: JSON.parse(properties.position),
                };
              }),
              e.lngLat.toArray(),
            )
          : [],
    };
  };

export function addMouseLeaveHandler(
  map: Map | undefined,
  features: GeometryFeature[],
  layer: LayerType,
  mapLayer: string,
  callback: SourceMouseHandler,
) {
  let featurePoint: mapboxgl.Point | undefined;

  const handleMove = (ev: MapLayerTouchEvent | MapMouseEvent) => {
    featurePoint = ev.point;
  };

  const handleMapMove = (ev: MapMouseEvent) => {
    if (ev.point.x !== featurePoint?.x || ev.point.y !== featurePoint.y) {
      callback(eventLayerParser(layer)(ev));
    }
  };

  map?.on("mousemove", mapLayer, handleMove);
  map?.on("mousemove", handleMapMove);

  return () => {
    map?.off("mousemove", handleMapMove);
    map?.off("mousemove", mapLayer, handleMove);
  };
}

export function addMouseDownHandler(
  map: Map | undefined,
  features: GeometryFeature[],
  layer: LayerType,
  mapLayer: string,
  callback: SourceMouseHandler,
) {
  let isDragPan: boolean;

  const handler = (e: MapLayerMouseEvent | MapLayerTouchEvent) => {
    isDragPan = Boolean(map?.dragPan.isEnabled());
    isDragPan && map?.dragPan.disable();
    callback(eventLayerParser(layer)(e));
    document.addEventListener("mouseup", () => isDragPan && map?.dragPan.enable(), { once: true });
  };

  map?.on("mousedown", mapLayer, handler);

  return () => {
    map?.off("mousedown", mapLayer, handler);
  };
}
