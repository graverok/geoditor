import * as mapboxgl from "mapbox-gl";
import * as geojson from "geojson";
import { Position, SourceEvent } from "../../types";
import * as lib from "../../lib";
import { AddSourcePayload } from "./config";
import { LayerFeatureProperties } from "./types";

export const sortPointsByDistance = (
  points: geojson.Feature<geojson.Point, LayerFeatureProperties>[],
  position: Position,
) => {
  return [...points].sort((a, b) =>
    lib.point.closest(a.geometry.coordinates, position) >= lib.point.closest(b.geometry.coordinates, position) ? 1 : -1,
  );
};

export const eventParser = (
  e: mapboxgl.MapMouseEvent | mapboxgl.MapLayerMouseEvent,
): Pick<SourceEvent, "position" | "originalEvent"> => ({
  position: e.lngLat.toArray(),
  originalEvent: e.originalEvent,
});

export function addMouseLeaveHandler(
  map: mapboxgl.Map | undefined,
  mapLayer: string,
  callback: (e: mapboxgl.MapMouseEvent) => void,
) {
  let featurePoint: mapboxgl.Point | undefined;

  const handleMove = (ev: mapboxgl.MapMouseEvent) => {
    featurePoint = ev.point;
  };

  const handleMapMove = (ev: mapboxgl.MapMouseEvent) => {
    if (ev.point.x !== featurePoint?.x || ev.point.y !== featurePoint.y) {
      callback(ev);
    }
  };

  map?.on("mousemove", mapLayer, handleMove);
  map?.on("mousemove", handleMapMove);

  return () => {
    map?.off("mousemove", handleMapMove);
    map?.off("mousemove", mapLayer, handleMove);
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
    (_: Omit<mapboxgl.Layer, "id">, index: number) =>
      map?.getLayer(`${id}-${index + 1}`) && map?.removeLayer(`${id}-${index + 1}`),
  );
  map.getSource(id) && map.removeSource(id);
};
