import mapboxgl from "mapbox-gl";
import geojson from "geojson";
import { LayerType, Position, SourceEvent, SourceEventHandler } from "../../types";
import { AddSourcePayload } from "./config";
import * as lib from "../../lib";
import { LayerFeatureProperties, ShapesCollection } from "./types";

export const sortPointsByDistance = (
  points: geojson.Feature<geojson.Point, LayerFeatureProperties>[],
  position: Position,
) => {
  return [...points].sort((a, b) =>
    lib.math.distance(a.geometry.coordinates, position) >= lib.math.distance(b.geometry.coordinates, position) ? 1 : -1,
  );
};

export const eventMapParser = (e: mapboxgl.MapMouseEvent, collection: ShapesCollection): SourceEvent => ({
  position: e.lngLat.toArray(),
  originalEvent: e.originalEvent,
  points: [...(collection.points ?? [])],
  lines: [...(collection.lines ?? [])],
  planes: [...(collection.planes ?? [])],
});

export const eventLayerParser =
  (layer: LayerType) => (e: mapboxgl.MapLayerMouseEvent | mapboxgl.MapLayerTouchEvent, collection: ShapesCollection) =>
    ({
      position: e.lngLat.toArray(),
      originalEvent: e.originalEvent,
      layer,
      points: [...(collection.points ?? [])],
      lines: [...(collection.lines ?? [])],
      planes: [...(collection.planes ?? [])],
    }) as SourceEvent;

export function addMouseLeaveHandler(
  map: mapboxgl.Map | undefined,
  collection: ShapesCollection,
  layer: LayerType,
  mapLayer: string,
  callback: SourceEventHandler,
) {
  let featurePoint: mapboxgl.Point | undefined;

  const handleMove = (ev: mapboxgl.MapLayerTouchEvent | mapboxgl.MapMouseEvent) => {
    featurePoint = ev.point;
  };

  const handleMapMove = (ev: mapboxgl.MapMouseEvent) => {
    if (ev.point.x !== featurePoint?.x || ev.point.y !== featurePoint.y) {
      callback(eventLayerParser(layer)(ev, collection));
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
  map: mapboxgl.Map | undefined,
  collection: ShapesCollection,
  layer: LayerType,
  mapLayer: string,
  callback: SourceEventHandler,
) {
  let isDragPan: boolean;
  let isBoxZoom: boolean;

  const handler = (e: mapboxgl.MapLayerMouseEvent | mapboxgl.MapLayerTouchEvent) => {
    isDragPan = Boolean(map?.dragPan.isEnabled());
    isDragPan && map?.dragPan.disable();
    isBoxZoom = Boolean(map?.boxZoom.isEnabled());
    isBoxZoom && map?.boxZoom.disable();
    callback(eventLayerParser(layer)(e, collection));
    document.addEventListener(
      "mouseup",
      () => {
        isDragPan && map?.dragPan.enable();
        isBoxZoom && map?.boxZoom.enable();
      },
      { once: true },
    );
  };

  map?.on("mousedown", mapLayer, handler);

  return () => {
    map?.off("mousedown", mapLayer, handler);
  };
}

export function addClickHandler(
  map: mapboxgl.Map | undefined,
  collection: ShapesCollection,
  layer: LayerType | undefined,
  mapLayer: string | undefined,
  callback: SourceEventHandler,
) {
  let isDblClickEnabled: boolean | undefined;
  let point: { x: number; y: number } | undefined;
  const handleDown = (e: mapboxgl.MapMouseEvent | mapboxgl.MapLayerMouseEvent) => {
    point = {
      x: e.originalEvent.pageX,
      y: e.originalEvent.pageY,
    };
    isDblClickEnabled = map?.doubleClickZoom.isEnabled();
    isDblClickEnabled && map?.doubleClickZoom.disable();
    document.addEventListener("mousemove", handleMove);
    if (mapLayer) {
      map?.on("mouseup", mapLayer, handleUp);
    } else {
      map?.on("mouseup", handleUp);
    }
  };

  const handleMove = (ev: MouseEvent) => {
    if (!point) return;
    if (Math.abs(ev.pageX - point.x) <= 3 && Math.abs(ev.pageY - point.y) <= 3) return;
    isDblClickEnabled && map?.doubleClickZoom.enable();
    isDblClickEnabled = false;
    document.removeEventListener("mousemove", handleMove);
    if (mapLayer) {
      map?.off("mouseup", mapLayer, handleUp);
    } else {
      map?.off("mouseup", handleUp);
    }
  };

  const handleUp = (e: mapboxgl.MapMouseEvent | mapboxgl.MapLayerMouseEvent | mapboxgl.MapLayerTouchEvent) => {
    document.removeEventListener("mousemove", handleMove);
    if (mapLayer) {
      map?.off("mouseup", mapLayer, handleUp);
    } else {
      map?.off("mouseup", handleUp);
    }
    setTimeout(() => {
      isDblClickEnabled && map?.doubleClickZoom.enable();
      isDblClickEnabled = false;
    });

    if (layer) {
      callback(eventLayerParser(layer)(e as mapboxgl.MapLayerTouchEvent | mapboxgl.MapLayerMouseEvent, collection));
    } else {
      callback(eventMapParser(e as mapboxgl.MapMouseEvent, collection));
    }
  };

  if (mapLayer) {
    map?.on("mousedown", mapLayer, handleDown);
  } else {
    map?.on("mousedown", handleDown);
  }

  return () => {
    document.removeEventListener("mousemove", handleMove);
    if (mapLayer) {
      map?.off("mouseup", mapLayer, handleUp);
      map?.off("mousedown", mapLayer, handleDown);
    } else {
      map?.off("mouseup", handleUp);
      map?.off("mousedown", handleDown);
    }
    setTimeout(() => {
      isDblClickEnabled && map?.doubleClickZoom.enable();
      isDblClickEnabled = false;
    });
  };
}

export const addSource = (map: mapboxgl.Map | undefined, { id, layers, areaLayer }: AddSourcePayload) => {
  if (!map) return;
  if (map.getSource(id)) removeSource(map, { id, layers, areaLayer });
  map.addSource(id, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });

  layers.forEach(
    (layer: Omit<mapboxgl.Layer, "id">, index: number) =>
      map?.addLayer({
        ...layer,
        id: `${id}-${index + 1}`,
        source: id,
      } as mapboxgl.AnyLayer & { id: string }),
  );
  areaLayer && map.addLayer({ ...areaLayer, source: id, id } as mapboxgl.AnyLayer);
};

export const removeSource = (map: mapboxgl.Map | undefined, { id, layers, areaLayer }: AddSourcePayload) => {
  if (!map) return;
  areaLayer && map.getLayer(id) && map.removeLayer(id);
  layers.forEach(
    (layer: Omit<mapboxgl.Layer, "id">, index: number) =>
      map?.getLayer(`${id}-${index + 1}`) && map?.removeLayer(`${id}-${index + 1}`),
  );
  map.getSource(id) && map.removeSource(id);
};
