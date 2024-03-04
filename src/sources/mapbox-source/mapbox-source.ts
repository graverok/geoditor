import "mapbox-gl";
import * as geojson from "geojson";
import * as lib from "../../lib";
import { Source } from "../../controllers";
import { Feature, FeatureProps, LayerType, Point, SourceEventOptions, SourceEventHandler } from "../../types";
import {
  addClickHandler,
  addMouseDownHandler,
  addMouseLeaveHandler,
  addSource,
  eventLayerParser,
  eventMapParser,
  removeSource,
} from "./lib";
import {
  AddSourcePayload,
  areaFillLayer,
  areaLineLayer,
  areaPointLayer,
  defaultConfig,
  generateLayers,
  Options,
  splitLayers,
} from "./config";
import mapboxgl from "mapbox-gl";

type Subscription = {
  off: () => void;
  name: string;
  callback: SourceEventHandler;
  layer?: string;
};

export type LayerFeatureProperties = { fid: string; indices: string } & Record<string, string>;

export class MapboxSource extends Source<geojson.Feature> {
  private _map: mapboxgl.Map | undefined;
  private _points: Record<string, string> = {};
  private readonly _options: Options | undefined;
  private _removeSources!: () => void;
  private _subscriptions: Subscription[] = [];
  private _onInit: (() => void) | undefined;

  constructor(id: number | string, map: mapboxgl.Map, options: Options);
  constructor(id: number | string, map: mapboxgl.Map);
  constructor(map: mapboxgl.Map, options: Options);
  constructor(map: mapboxgl.Map);
  constructor(...params: any[]) {
    const [id, map, options] =
      typeof params[0] === "number" || typeof params[0] === "string"
        ? ([params[0], params[1], params[2]] as [number | string, mapboxgl.Map, Options | undefined])
        : ([undefined, params[0], params[1]] as [undefined, mapboxgl.Map, Options | undefined]);
    super({
      points: `@@map-editor-${id ?? ""}-point`,
      lines: `@@map-editor-${id ?? ""}-line`,
      planes: `@@map-editor-${id ?? ""}-plane`,
    });
    this.addListener = this.addListener.bind(this);
    this.removeListener = this.removeListener.bind(this);
    this.setCursor = this.setCursor.bind(this);
    this.setFeatureState = this.setFeatureState.bind(this);
    this.setPointState = this.setPointState.bind(this);
    this._options = options;

    const init = () => {
      this._map = map;
      this._initSources(this._options);
      this._onInit?.();
    };

    map.isStyleLoaded() ? init() : map.on("styledataloading", init);
  }

  private _initSources(options?: Options) {
    const layerStyles = options?.layerStyles ?? generateLayers(options?.config ?? defaultConfig);
    const [pointLayers, lineLayers, fillLayers] = splitLayers(layerStyles);

    const sources: AddSourcePayload[] = [
      {
        id: this.layerNames.planes,
        layers: fillLayers,
        areaLayer: fillLayers.length ? areaFillLayer : undefined,
      },
      {
        id: this.layerNames.lines,
        layers: lineLayers,
        areaLayer: {
          ...areaLineLayer,
          paint: {
            ...areaLineLayer.paint,
            "line-width": options?.lineArea || areaLineLayer.paint["line-width"],
          },
        },
      },
      {
        id: this.layerNames.points,
        layers: pointLayers,
        areaLayer: {
          ...areaPointLayer,
          paint: {
            ...areaPointLayer.paint,
            "circle-radius": options?.pointArea || areaPointLayer.paint["circle-radius"],
          },
        },
      },
    ];

    sources.forEach((source) => addSource(this._map, source));
    this._removeSources = () => sources.forEach((source) => removeSource(this._map, source));
  }

  private _addSubscription(props: Subscription) {
    const current = this._subscriptions.findIndex(
      (item) => item.name === props.name && item.layer === props.layer && item.callback === props.callback,
    );
    if (current >= 0) {
      this._subscriptions[current].off();
      this._subscriptions[current] = props;
      return;
    }

    this._subscriptions.push(props);
  }

  private _removeSubscription(props: Omit<Subscription, "off">) {
    const index = this._subscriptions.findIndex(
      (item) => item.name === props.name && item.layer === props.layer && item.callback === props.callback,
    );
    if (index >= 0) {
      this._subscriptions[index].off();
      this._subscriptions = [...this._subscriptions.slice(0, index), ...this._subscriptions.slice(index + 1)];
    }
  }

  private _addMapListener(
    name: keyof mapboxgl.MapEventType,
    callback: SourceEventHandler,
    options: SourceEventOptions,
  ) {
    const handler = (e: mapboxgl.MapMouseEvent) => {
      callback(eventMapParser(e));
    };

    if (options?.once) {
      this._map?.once(name, handler);
      return;
    }

    if (name === "click") {
      return this._addSubscription({
        callback,
        name,
        off: addClickHandler(this._map, undefined, undefined, callback),
      });
    }

    this._map?.on(name, handler);
    this._addSubscription({ callback, name, off: () => this._map?.off(name, handler) });
  }

  private _addLayerListener(name: keyof mapboxgl.MapLayerEventType, layer: LayerType, callback: SourceEventHandler) {
    if (name === "mouseleave" || name === "mouseover") {
      return this._addSubscription({
        callback,
        name,
        layer,
        off: addMouseLeaveHandler(this._map, layer, this.layerNames[layer], callback),
      });
    }

    if (name === "mousedown") {
      return this._addSubscription({
        callback,
        name,
        layer,
        off: addMouseDownHandler(this._map, layer, this.layerNames[layer], callback),
      });
    }

    if (name === "click") {
      return this._addSubscription({
        callback,
        name,
        layer,
        off: addClickHandler(this._map, layer, this.layerNames[layer], callback),
      });
    }

    const handler = (e: mapboxgl.MapLayerMouseEvent | mapboxgl.MapLayerTouchEvent) => {
      callback(eventLayerParser(layer)(e));
    };

    this._map?.on(name, this.layerNames[layer], handler);
    this._addSubscription({
      name,
      layer,
      callback,
      off: () => this._map?.off(name, this.layerNames[layer], handler),
    });
  }

  public addListener(
    ...params:
      | [keyof mapboxgl.MapLayerEventType, LayerType, SourceEventHandler]
      | [keyof mapboxgl.MapEventType, SourceEventHandler]
      | [keyof mapboxgl.MapEventType, SourceEventHandler, SourceEventOptions]
  ) {
    if (typeof params[1] === "function") {
      const [name, callback, options] = params as [keyof mapboxgl.MapEventType, SourceEventHandler, SourceEventOptions];
      this._addMapListener(name, callback, options);
    } else {
      const [name, layer, callback] = params as [keyof mapboxgl.MapLayerEventType, LayerType, SourceEventHandler];
      this._addLayerListener(name, layer, callback);
    }
  }

  public removeListener(
    ...params:
      | [keyof mapboxgl.MapEventType, SourceEventHandler]
      | [keyof mapboxgl.MapLayerEventType, LayerType, SourceEventHandler]
  ) {
    if (typeof params[1] === "function") {
      const [name, callback] = params as [keyof mapboxgl.MapEventType, SourceEventHandler];
      this._removeSubscription({ name, callback });
    } else {
      const [name, layer, callback] = params as [keyof mapboxgl.MapLayerEventType, LayerType, SourceEventHandler];
      this._removeSubscription({ name, layer, callback });
    }
  }

  setCursor(value: string) {
    if (!this._map) return;
    const prev = this._map.getCanvas().style.cursor;
    if (prev !== value) {
      this._map.getCanvas().style.cursor = value;
    }

    return () => {
      if (!this._map) return;
      const current = this._map.getCanvas().style.cursor;
      if (current !== prev) {
        this._map.getCanvas().style.cursor = prev;
      }
    };
  }

  public setFeatureState(id: number | undefined, state: Record<string, boolean>) {
    if (!id) return;
    this._map?.setFeatureState({ id, source: this.layerNames.lines }, state);
    this._map?.setFeatureState({ id, source: this.layerNames.planes }, state);
  }

  public setPointState({ indices, fid }: Point, state: Record<string, boolean>) {
    if (!fid || !indices.length) return;
    const globalId = this._points[`${fid}.${indices.join(".")}`];
    globalId && this._map?.setFeatureState({ id: globalId, source: this.layerNames.points }, state);
  }

  public renderFeatures(features: Feature[]) {
    (this._map?.getSource(this.layerNames.planes) as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: features.reduce(
        (acc, item) => {
          switch (item.type) {
            case "Polygon":
              return [
                ...acc,
                {
                  id: item.id,
                  type: "Feature",
                  geometry: {
                    type: item.type,
                    coordinates: item.coordinates,
                  },
                  properties: {
                    ...item.props,
                    indices: "[]",
                    fid: item.id,
                  },
                } as geojson.Feature<geojson.Polygon>,
              ];
            case "MultiPolygon":
              return item.coordinates.reduce((acc2, coords, index) => {
                return [
                  ...acc2,
                  {
                    id: item.id,
                    type: "Feature",
                    geometry: {
                      type: "Polygon",
                      coordinates: coords,
                    },
                    properties: {
                      ...item.props,
                      indices: JSON.stringify([index]),
                      fid: item.id,
                    },
                  } as geojson.Feature<geojson.Polygon>,
                ];
              }, acc);
            default:
              return acc;
          }
        },

        [] as geojson.Feature<geojson.Polygon>[],
      ),
    });

    (this._map?.getSource(this.layerNames.lines) as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: features.reduce((acc, item) => {
        let res: geojson.Feature<geojson.LineString>[] = [];
        lib.traverseShape(item, (positions, indices) => {
          res.push({
            id: item.id,
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: positions,
            },
            properties: {
              ...item.props,
              fid: String(item.id),
              indices: JSON.stringify(indices),
            },
          });
        });
        return [...acc, ...res];
      }, [] as geojson.Feature<geojson.LineString>[]),
    });
  }

  public renderPoints(points: Point<FeatureProps>[]) {
    let nextNodes: Record<string, string> = {};

    const features = points.map((point, index) => {
      const globalId = String(index + 1);
      nextNodes = {
        ...nextNodes,
        [`${point.fid}.${point.indices.join(".")}`]: globalId,
      };

      return {
        id: globalId,
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: point.coordinates,
        },
        properties: {
          ...point.props,
          fid: String(point.fid),
          indices: JSON.stringify(point.indices),
        },
      } as geojson.Feature<geojson.Point, LayerFeatureProperties>;
    });

    Object.entries(this._points).forEach(([key, globalId]) => {
      if (!nextNodes[key])
        this._map?.setFeatureState(
          { id: globalId, source: this.layerNames.points },
          { hovered: false, active: false, selected: false },
        );
    });

    this._points = nextNodes;

    (this._map?.getSource(this.layerNames.points) as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features,
    });
  }

  get renderer() {
    return this._map;
  }

  onInit(callback: () => void) {
    if (this._map) {
      callback();
    } else {
      this._onInit = callback;
    }
  }

  toFeatures(): Feature[] {
    return (this.data as (geojson.Feature<geojson.LineString> | geojson.Feature<geojson.Polygon>)[]).map(
      (item, index) =>
        ({
          id: index + 1,
          type: item.geometry.type,
          coordinates: item.geometry.coordinates,
          props: item.properties,
        }) as Feature,
    );
  }

  toData() {
    const features = this.features;
    return [
      ...this.data.map(
        (item, index) =>
          ({
            ...item,
            geometry: {
              type: features[index].type,
              coordinates: features[index].coordinates,
            },
            properties: features[index].props,
          }) as geojson.Feature,
      ),
      ...(features.length > this.data.length
        ? [
            ...features.slice(this.data.length).map(
              (feature) =>
                ({
                  type: "Feature",
                  geometry: {
                    type: feature.type,
                    coordinates: feature.coordinates,
                  },
                  properties: feature.props,
                }) as geojson.Feature,
            ),
          ]
        : []),
    ];
  }

  public remove() {
    this._removeSources?.();
    this._map = undefined;
  }
}
