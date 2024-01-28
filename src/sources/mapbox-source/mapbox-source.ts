import {
  Map,
  MapEventType,
  MapLayerEventType,
  MapLayerMouseEvent,
  MapLayerTouchEvent,
  MapMouseEvent,
  GeoJSONSource,
  AnyLayer,
  Layer,
} from "mapbox-gl";
import { Feature } from "geojson";

import { RenderEventOptions, RenderEventHandler, Source, RenderFeature } from "../../controllers";
import { Geometry, LayerType } from "../../types";
import { geometryTools } from "../../lib";
import { addMouseDownHandler, addMouseLeaveHandler, eventLayerParser, eventMapParser } from "./lib";
import {
  areaFillLayer,
  areaLineLayer,
  areaPointLayer,
  defaultConfig,
  generateLayers,
  splitLayers,
  Options,
  AddSourcePayload,
} from "./config";

type Subscription = {
  off: () => void;
  name: string;
  callback: RenderEventHandler;
  layer?: string;
};

type ConstructorParams = [number | string, Map, Options] | [Map, Options] | [number | string, Map] | [Map];

export class MapboxSource extends Source {
  private map: Map | undefined;
  private options: Options | undefined;
  private removeSources!: () => void;
  private subscriptions: Subscription[] = [];
  private _onInit: (() => void) | undefined;

  get renderer() {
    return this.map;
  }

  constructor(...params: ConstructorParams) {
    const [id, map, options] =
      typeof params[0] === "number" || typeof params[0] === "string"
        ? ([params[0], params[1], params[2]] as [number | string, Map, Options | undefined])
        : ([undefined, params[0], params[1]] as [undefined, Map, Options | undefined]);
    super({
      node: `@@map-editor-${id ?? ""}-node`,
      point: `@@map-editor-${id ?? ""}-point`,
      line: `@@map-editor-${id ?? ""}-line`,
      fill: `@@map-editor-${id ?? ""}-fill`,
    });
    this.addListener = this.addListener.bind(this);
    this.removeListener = this.removeListener.bind(this);
    this.setCursor = this.setCursor.bind(this);
    this.setFeatureState = this.setFeatureState.bind(this);
    this.options = options;

    const init = () => {
      this.map = map;
      this.initSources(this.options);
      this._onInit?.();
    };

    map.isStyleLoaded() ? init() : map.on("load", init);
  }

  onInit(callback: () => void) {
    if (this.map) {
      callback();
    } else {
      this._onInit = callback;
    }
  }

  private initSources(options?: Options) {
    const layerStyles = options?.layerStyles ?? generateLayers(options?.paintConfig ?? defaultConfig);
    const [pointLayers, lineLayers, fillLayers] = splitLayers(layerStyles);

    const sources = [
      {
        id: this.layerNames.fill,
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
      {
        id: this.layerNames.node,
        layers: pointLayers,
        areaLayer: {
          ...areaPointLayer,
          paint: {
            ...areaPointLayer.paint,
            "circle-opacity": 0.3,
            "circle-radius": options?.pointArea || areaPointLayer.paint["circle-radius"],
          },
        },
      },
    ];

    sources.forEach((source) => this.addSource(source));
    this.removeSources = () => sources.forEach((source) => this.removeSource(source));
  }

  private addSource = ({ id, layers, areaLayer }: AddSourcePayload) => {
    if (!this.map) return;
    if (this.map.getSource(id)) this.removeSource({ id, layers, areaLayer });
    this.map.addSource(id, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    layers.forEach(
      (layer: Omit<Layer, "id">, index: number) =>
        this.map?.addLayer({
          ...layer,
          id: `${id}-${index + 1}`,
          source: id,
        } as AnyLayer),
    );
    areaLayer && this.map.addLayer({ ...areaLayer, source: id, id } as AnyLayer);
  };

  private removeSource({ id, layers, areaLayer }: AddSourcePayload) {
    if (!this.map) return;
    areaLayer && this.map.getLayer(id) && this.map.removeLayer(id);
    layers.forEach(
      (layer: Omit<Layer, "id">, index: number) =>
        this.map?.getLayer(`${id}-${index + 1}`) && this.map?.removeLayer(`${id}-${index + 1}`),
    );
    this.map.getSource(id) && this.map.removeSource(id);
  }

  setCursor(value: string) {
    if (!this.map) return;
    const prev = this.map.getCanvas().style.cursor;
    if (prev !== value) {
      this.map.getCanvas().style.cursor = value;
    }

    return () => {
      if (!this.map) return;
      const current = this.map.getCanvas().style.cursor;
      if (current !== prev) {
        this.map.getCanvas().style.cursor = prev;
      }
    };
  }

  private ignoreDblClickZoom() {
    if (!this.map) return;
    if (!this.map.doubleClickZoom.isEnabled()) return;

    this.map.doubleClickZoom.disable();
    setTimeout(() => this.map?.doubleClickZoom.enable(), 500);
  }

  private addSubscription(props: Subscription) {
    const current = this.subscriptions.findIndex(
      (item) => item.name === props.name && item.layer === props.layer && item.callback === props.callback,
    );
    if (current >= 0) {
      this.subscriptions[current].off();
      this.subscriptions[current] = props;
      return;
    }

    this.subscriptions.push(props);
  }

  private removeSubscription(props: Omit<Subscription, "off">) {
    const index = this.subscriptions.findIndex(
      (item) => item.name === props.name && item.layer === props.layer && item.callback === props.callback,
    );
    if (index >= 0) {
      this.subscriptions[index].off();
      this.subscriptions = [...this.subscriptions.slice(0, index), ...this.subscriptions.slice(index + 1)];
    }
  }

  private _addMapListener(name: keyof MapEventType, callback: RenderEventHandler, once = false) {
    const handler = (e: MapMouseEvent) => {
      callback(eventMapParser(e));
    };

    if (once) {
      this.map?.once(name, handler);
      return;
    }

    this.map?.on(name, handler);
    this.addSubscription({ callback, name, off: () => this.map?.off(name, handler) });
  }

  private _addLayerListener(name: keyof MapLayerEventType, layer: LayerType, callback: RenderEventHandler) {
    if (name === "mouseleave") {
      return this.addSubscription({
        callback,
        name,
        layer,
        off: addMouseLeaveHandler(this.map, layer, this.layerNames[layer], callback),
      });
    }

    if (name === "mousedown") {
      return this.addSubscription({
        callback,
        name,
        layer,
        off: addMouseDownHandler(this.map, layer, this.layerNames[layer], callback),
      });
    }

    const handler = (e: MapLayerMouseEvent | MapLayerTouchEvent) => {
      name === "click" && this.ignoreDblClickZoom();

      callback(eventLayerParser(layer)(e));
    };

    this.map?.on(name, this.layerNames[layer], handler);
    this.addSubscription({
      name,
      layer,
      callback,
      off: () => this.map?.off(name, this.layerNames[layer], handler),
    });
  }

  public addListener(
    ...params:
      | [keyof MapEventType, RenderEventHandler, RenderEventOptions]
      | [keyof MapLayerEventType, LayerType, RenderEventHandler]
  ) {
    if (typeof params[1] === "function") {
      const [name, callback, options] = params as [keyof MapEventType, RenderEventHandler, RenderEventOptions];
      this._addMapListener(name, callback, options?.once);
    } else {
      const [name, layer, callback] = params as [keyof MapLayerEventType, LayerType, RenderEventHandler];
      this._addLayerListener(name, layer, callback);
    }
  }

  public removeListener(
    ...params: [keyof MapEventType, RenderEventHandler] | [keyof MapLayerEventType, LayerType, RenderEventHandler]
  ) {
    if (typeof params[1] === "function") {
      const [name, callback] = params as [keyof MapEventType, RenderEventHandler];
      this.removeSubscription({ name, callback });
    } else {
      const [name, layer, callback] = params as [keyof MapLayerEventType, LayerType, RenderEventHandler];
      this.removeSubscription({ name, layer, callback });
    }
  }

  public setFeatureState(layers: LayerType[], id: number | undefined, state: Record<string, boolean>) {
    id && layers.forEach((layer) => this.map?.setFeatureState({ id, source: this.layerNames[layer] }, state));
  }

  private reducer(type: LayerType): (acc: Feature[], item: RenderFeature) => Feature[] {
    switch (type) {
      case "fill":
        return (acc: Feature[] = [], item: RenderFeature) =>
          item.geometry.type === "Polygon" ? [...acc, item as Feature] : acc;
      case "point":
        return (acc: Feature[] = [], item: RenderFeature) => [
          ...acc,
          {
            ...item,
            geometry: {
              type: "MultiPoint",
              coordinates: geometryTools.getPositions(item.geometry as Geometry),
            },
          } as Feature,
        ];
      default:
        return (acc: Feature[] = [], item: RenderFeature) => [...acc, item as Feature];
    }
  }

  render(type: LayerType, features: RenderFeature[]) {
    (this.map?.getSource(this.layerNames[type]) as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: features.reduce(this.reducer(type), []),
    });
  }

  public remove() {
    this.removeSources?.();
    this.map = undefined;
  }
}
[];
