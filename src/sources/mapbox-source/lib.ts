import * as geojson from "geojson";
import "mapbox-gl";
import { LayerType, Point, Position, SourceEvent, SourceEventHandler } from "../../types";
import { LayerFeatureProperties } from "./mapbox-source";
import { AddSourcePayload } from "./config";
import * as lib from "../../lib";
import mapboxgl from "mapbox-gl";

const sortPointsByDistance = (points: Point[], position: Position) => {
  return [...points].sort((a, b) =>
    lib.math.distance(a.coordinates, position) > lib.math.distance(b.coordinates, position) ? 1 : -1,
  );
};

export const eventMapParser = (e: mapboxgl.MapMouseEvent): SourceEvent => ({
  position: e.lngLat.toArray(),
  originalEvent: e.originalEvent,
  points: [],
  lines: [],
  planes: [],
});

const renderElements = (
  layer: LayerType,
  features: mapboxgl.MapboxGeoJSONFeature[] | undefined,
  position: Position,
) => {
  const elements = (features || []).map((item) => {
    const { indices, fid } = item.properties as LayerFeatureProperties;
    return {
      fid: +fid,
      indices: JSON.parse(indices),
      coordinates: (item.geometry as geojson.Point | geojson.LineString | geojson.Polygon).coordinates,
    };
  });

  switch (layer) {
    case "points":
      return {
        points: sortPointsByDistance(elements as Point[], position) as Point[],
        lines: [],
        planes: [],
      };
    default: {
      return {
        points: [],
        lines: [],
        planes: [],
        [layer]: elements,
      };
    }
  }
};

export const eventLayerParser = (layer: LayerType) => (e: mapboxgl.MapLayerMouseEvent | mapboxgl.MapLayerTouchEvent) =>
  ({
    position: e.lngLat.toArray(),
    originalEvent: e.originalEvent,
    layer,
    ...renderElements(layer, e.features, e.lngLat.toArray()),
  }) as SourceEvent;

export function addMouseLeaveHandler(
  map: mapboxgl.Map | undefined,
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
  map: mapboxgl.Map | undefined,
  layer: LayerType,
  mapLayer: string,
  callback: SourceEventHandler,
) {
  let isDragPan: boolean;

  const handler = (e: mapboxgl.MapLayerMouseEvent | mapboxgl.MapLayerTouchEvent) => {
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

export function addClickHandler(
  map: mapboxgl.Map | undefined,
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
      callback(eventLayerParser(layer)(e as mapboxgl.MapLayerTouchEvent | mapboxgl.MapLayerMouseEvent));
    } else {
      callback(eventMapParser(e as mapboxgl.MapMouseEvent));
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
