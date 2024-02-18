import { AnyLayer, Layer, Map, MapLayerMouseEvent, MapLayerTouchEvent, MapMouseEvent, Point } from "mapbox-gl";
import { Feature, LayerType, Node, Position, SourceEvent, SourceMouseHandler } from "../../types";
import { Feature as GeoJsonFeature, LineString, Polygon } from "geojson";
import { NodeGeoJSONProperties } from "./mapbox-source";
import { AddSourcePayload } from "./config";
import * as lib from "../../lib";

const sortNodesByDistance = (nodes: Node[], position: Position) => {
  return [...nodes].sort((a, b) =>
    lib.math.distance(a.position, position) > lib.math.distance(b.position, position) ? 1 : -1,
  );
};

export const eventMapParser = (e: MapMouseEvent): SourceEvent => ({
  position: e.lngLat.toArray(),
  originalEvent: e.originalEvent,
  features: [],
  nodes: [],
});

export const eventLayerParser =
  (layer: LayerType) =>
  (e: MapLayerMouseEvent | MapLayerTouchEvent): SourceEvent => {
    return {
      position: e.lngLat.toArray(),
      originalEvent: e.originalEvent,
      layer,
      features:
        layer !== "point"
          ? (e.features || []).map(
              (item) =>
                ({
                  id: item.id,
                  type: item.geometry.type,
                  coordinates: (item as GeoJsonFeature<LineString> | GeoJsonFeature<Polygon>).geometry.coordinates,
                  props: item.properties,
                }) as Feature,
            )
          : [],
      nodes:
        layer === "point"
          ? sortNodesByDistance(
              (e.features || []).map((item) => {
                const { position, indices, fid, ...rest } = item.properties as NodeGeoJSONProperties;
                return {
                  fid,
                  position: JSON.parse(position),
                  indices: JSON.parse(indices),
                  props: rest,
                };
              }),
              e.lngLat.toArray(),
            )
          : [],
    };
  };

export function addMouseLeaveHandler(
  map: Map | undefined,
  layer: LayerType,
  mapLayer: string,
  callback: SourceMouseHandler,
) {
  let featurePoint: Point | undefined;

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

export function addClickHandler(
  map: Map | undefined,
  layer: LayerType | undefined,
  mapLayer: string | undefined,
  callback: SourceMouseHandler,
) {
  let isDblClickEnabled: boolean | undefined;
  let point: { x: number; y: number } | undefined;
  const handleDown = (e: MapMouseEvent | MapLayerMouseEvent) => {
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

  const handleUp = (e: MapMouseEvent | MapLayerMouseEvent | MapLayerTouchEvent) => {
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
      callback(eventLayerParser(layer)(e as MapLayerTouchEvent | MapLayerMouseEvent));
    } else {
      callback(eventMapParser(e as MapMouseEvent));
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

export const addSource = (map: Map | undefined, { id, layers, areaLayer }: AddSourcePayload) => {
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
    (layer: Omit<Layer, "id">, index: number) =>
      map?.addLayer({
        ...layer,
        id: `${id}-${index + 1}`,
        source: id,
      } as AnyLayer & { id: string }),
  );
  areaLayer && map.addLayer({ ...areaLayer, source: id, id } as AnyLayer);
};

export const removeSource = (map: Map | undefined, { id, layers, areaLayer }: AddSourcePayload) => {
  if (!map) return;
  areaLayer && map.getLayer(id) && map.removeLayer(id);
  layers.forEach(
    (layer: Omit<Layer, "id">, index: number) =>
      map?.getLayer(`${id}-${index + 1}`) && map?.removeLayer(`${id}-${index + 1}`),
  );
  map.getSource(id) && map.removeSource(id);
};
