import { RenderFeature, RenderEventHandler, RenderEvent } from "../../controllers";
import { Map, MapboxGeoJSONFeature, MapLayerMouseEvent, MapLayerTouchEvent, MapMouseEvent } from "mapbox-gl";
import { LayerType } from "../../types";

export const eventMapParser = (e: MapMouseEvent): RenderEvent => ({
  position: e.lngLat.toArray(),
  originalEvent: e.originalEvent,
  preventDefault: e.preventDefault,
  features: [],
});

export const eventLayerParser =
  (layer: LayerType) =>
  (e: MapLayerMouseEvent | MapLayerTouchEvent): RenderEvent => ({
    position: e.lngLat.toArray(),
    originalEvent: e.originalEvent,
    preventDefault: e.preventDefault,
    features: (e.features ?? []).map(
      (feature: MapboxGeoJSONFeature) =>
        ({
          ...feature,
          layer,
          geometry: feature.geometry,
        }) as RenderFeature,
    ),
  });

export function addMouseLeaveHandler(
  map: Map | undefined,
  layer: LayerType,
  mapLayer: string,
  callback: RenderEventHandler,
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
  layer: LayerType,
  mapLayer: string,
  callback: RenderEventHandler,
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
