import {
  GeoJSONSource,
  Map,
  MapEventType,
  MapLayerEventType,
  MapLayerMouseEvent,
  MapLayerTouchEvent,
  MapMouseEvent,
} from "mapbox-gl";
import { Feature as GeoJsonFeature, LineString, Point, Polygon } from "geojson";

import { Source } from "../../controllers";
import { Feature, LayerType, Node, SourceEventOptions, SourceMouseHandler } from "../../types";
import * as lib from "../../lib";
import {
  addMouseDownHandler,
  addMouseLeaveHandler,
  addSource,
  eventLayerParser,
  eventMapParser,
  removeSource,
} from "./lib";
import {
  areaFillLayer,
  areaLineLayer,
  areaPointLayer,
  defaultConfig,
  generateLayers,
  Options,
  splitLayers,
} from "./config";

type Subscription = {
  off: () => void;
  name: string;
  callback: SourceMouseHandler;
  layer?: string;
};

export type NodeGeoJSONProperties = Omit<Node, "position" | "indices"> & { position: string; indices: string } & Record<
    string,
    any
  >;

type ConstructorParams = [number | string, Map, Options] | [Map, Options] | [number | string, Map] | [Map];

export class MapboxSource extends Source {
  private _map: Map | undefined;
  private _nodes: Record<number, Record<string, string>> = {};
  private readonly _options: Options | undefined;
  private _removeSources!: () => void;
  private _subscriptions: Subscription[] = [];
  private _onInit: (() => void) | undefined;

  constructor(...params: ConstructorParams) {
    const [id, map, options] =
      typeof params[0] === "number" || typeof params[0] === "string"
        ? ([params[0], params[1], params[2]] as [number | string, Map, Options | undefined])
        : ([undefined, params[0], params[1]] as [undefined, Map, Options | undefined]);
    super({
      point: `@@map-editor-${id ?? ""}-point`,
      line: `@@map-editor-${id ?? ""}-line`,
      plane: `@@map-editor-${id ?? ""}-plane`,
    });
    this.addListener = this.addListener.bind(this);
    this.removeListener = this.removeListener.bind(this);
    this.setCursor = this.setCursor.bind(this);
    this.setFeatureState = this.setFeatureState.bind(this);
    this.setNodeState = this.setNodeState.bind(this);
    this._options = options;

    const init = () => {
      this._map = map;
      this._initSources(this._options);
      this._onInit?.();
    };

    map.isStyleLoaded() ? init() : map.on("load", init);
  }

  private _initSources(options?: Options) {
    const layerStyles = options?.layerStyles ?? generateLayers(options?.paintConfig ?? defaultConfig);
    const [pointLayers, lineLayers, fillLayers] = splitLayers(layerStyles);

    const sources = [
      {
        id: this.layerNames.plane,
        layers: fillLayers,
        areaLayer: fillLayers.length ? areaFillLayer : undefined,
      },
      {
        id: this.layerNames.line,
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
        id: this.layerNames.point,
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

  private _ignoreDblClickZoom() {
    if (!this._map) return;
    if (!this._map.doubleClickZoom.isEnabled()) return;

    this._map.doubleClickZoom.disable();
    setTimeout(() => this._map?.doubleClickZoom.enable(), 500);
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

  private _addMapListener(name: keyof MapEventType, callback: SourceMouseHandler, once = false) {
    const handler = (e: MapMouseEvent) => {
      callback(eventMapParser(e));
    };

    if (once) {
      this._map?.once(name, handler);
      return;
    }

    this._map?.on(name, handler);
    this._addSubscription({ callback, name, off: () => this._map?.off(name, handler) });
  }

  private _addLayerListener(name: keyof MapLayerEventType, layer: LayerType, callback: SourceMouseHandler) {
    if (name === "mouseleave" || name === "mouseover") {
      return this._addSubscription({
        callback,
        name,
        layer,
        off: addMouseLeaveHandler(this._map, this.features, layer, this.layerNames[layer], callback),
      });
    }

    if (name === "mousedown") {
      return this._addSubscription({
        callback,
        name,
        layer,
        off: addMouseDownHandler(this._map, this.features, layer, this.layerNames[layer], callback),
      });
    }

    const handler = (e: MapLayerMouseEvent | MapLayerTouchEvent) => {
      name === "click" && this._ignoreDblClickZoom();

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

  private _pushNode(globalId: string, node: Node) {
    this._nodes = { ...this._nodes, [node.fid]: { ...this._nodes?.[node.fid], [node.indices.join(".")]: globalId } };
  }

  private _reducer(type: LayerType): (acc: GeoJsonFeature[], item: Feature) => GeoJsonFeature[] {
    switch (type) {
      case "plane":
        return (acc: GeoJsonFeature[] = [], item) =>
          item.type === "Polygon"
            ? [
                ...acc,
                {
                  id: item.id,
                  type: "Feature",
                  geometry: {
                    type: item.type,
                    coordinates: [...item.coordinates.slice(0, item.coordinates.length - 1), item.coordinates[0]],
                  },
                  properties: item.props,
                } as GeoJsonFeature,
              ]
            : acc;
      case "point":
        this._nodes = [];
        return (acc: GeoJsonFeature[] = [], item: Feature) => {
          const nodes = lib.createNodes([item]);
          return [
            ...acc,
            ...nodes.map((node, index) => {
              this._pushNode(String(acc.length + index + 1), node);

              return {
                id: String(acc.length + index + 1),
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: node.position,
                },
                properties: {
                  ...item.props,
                  fid: node.fid,
                  indices: JSON.stringify(node.indices),
                  position: JSON.stringify(node.position),
                },
              } as GeoJsonFeature<Point, NodeGeoJSONProperties>;
            }),
          ];
        };

      default:
        return (acc: GeoJsonFeature[] = [], item: Feature) => [
          ...acc,
          {
            id: item.id,
            type: "Feature",
            geometry: {
              type: item.type,
              coordinates: item.coordinates,
            },
            properties: item.props,
          } as GeoJsonFeature,
        ];
    }
  }

  public addListener(
    ...params:
      | [keyof MapEventType, SourceMouseHandler, SourceEventOptions]
      | [keyof MapLayerEventType, LayerType, SourceMouseHandler]
  ) {
    if (typeof params[1] === "function") {
      const [name, callback, options] = params as [keyof MapEventType, SourceMouseHandler, SourceEventOptions];
      this._addMapListener(name, callback, options?.once);
    } else {
      const [name, layer, callback] = params as [keyof MapLayerEventType, LayerType, SourceMouseHandler];
      this._addLayerListener(name, layer, callback);
    }
  }

  public removeListener(
    ...params: [keyof MapEventType, SourceMouseHandler] | [keyof MapLayerEventType, LayerType, SourceMouseHandler]
  ) {
    if (typeof params[1] === "function") {
      const [name, callback] = params as [keyof MapEventType, SourceMouseHandler];
      this._removeSubscription({ name, callback });
    } else {
      const [name, layer, callback] = params as [keyof MapLayerEventType, LayerType, SourceMouseHandler];
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
    this._map?.setFeatureState({ id, source: this.layerNames.line }, state);
    this._map?.setFeatureState({ id, source: this.layerNames.plane }, state);
  }

  public setNodeState({ indices, fid }: Node, state: Record<string, boolean>) {
    if (!fid || !indices.length) return;
    const globalId = this._nodes[fid]?.[indices.join(".")];

    globalId && this._map?.setFeatureState({ id: globalId, source: this.layerNames.point }, state);
  }

  public render(type: LayerType, features: Feature[]) {
    (this._map?.getSource(this.layerNames[type]) as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: features.reduce(this._reducer(type), []),
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

  toGeometry(): Feature[] {
    return (this.data as (GeoJsonFeature<LineString> | GeoJsonFeature<Polygon>)[]).map(
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
          }) as GeoJsonFeature<LineString> | GeoJsonFeature<Polygon>,
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
                }) as GeoJsonFeature<LineString> | GeoJsonFeature<Polygon>,
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
