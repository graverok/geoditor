import * as mapboxgl from "mapbox-gl";
import * as geojson from "geojson";
import * as lib from "lib";
import { Controller } from "../../core";
import {
  Feature,
  LayerState,
  LayerType,
  Line,
  Plane,
  Point,
  SourceEventHandler,
  SourceEventOptions,
} from "../../types";
import {
  addClickHandler,
  addMouseDownHandler,
  addMouseLeaveHandler,
  addSource,
  eventLayerParser,
  eventMapParser,
  removeSource,
  sortPointsByDistance,
} from "./lib";
import { AddSourcePayload, areaLayer, defaultConfig, generateLayers, Options, splitLayers } from "./config";
import type { ShapesCollection, LayerFeatureProperties, Subscription } from "./types";

const featureTypes = {
  points: "Point",
  lines: "LineString",
  planes: "Polygon",
};

export class MapboxController extends Controller {
  private _map: mapboxgl.Map | undefined;
  private _features: Partial<Record<LayerType, geojson.Feature[]>> = {};
  private _requested: Partial<Record<LayerType, boolean>> = {};
  private _states: Partial<Record<LayerType, Partial<Record<LayerState, string[]>>>> = {};
  private readonly _options: Options | undefined;
  private _removeSources!: () => void;
  private _subscriptions: Subscription[] = [];
  private _onInit: (() => void) | undefined;
  private _hovered: ShapesCollection = {};

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
      points: `@@map-editor-${id ?? ""}-points`,
      lines: `@@map-editor-${id ?? ""}-lines`,
      planes: `@@map-editor-${id ?? ""}-planes`,
    });
    this._handleFillMouseMove = this._handleFillMouseMove.bind(this);
    this._handleFillMouseLeave = this._handleFillMouseLeave.bind(this);
    this._handleLineMouseMove = this._handleLineMouseMove.bind(this);
    this._handleLineMouseLeave = this._handleLineMouseLeave.bind(this);
    this._handlePointMouseMove = this._handlePointMouseMove.bind(this);
    this._handlePointMouseLeave = this._handlePointMouseLeave.bind(this);
    this._handleRender = this._handleRender.bind(this);
    this.addListener = this.addListener.bind(this);
    this.removeListener = this.removeListener.bind(this);
    this.setCursor = this.setCursor.bind(this);
    this.setState = this.setState.bind(this);
    this._options = options;
    this.render = this.render.bind(this);

    const init = () => {
      this._map = map;
      this._initSources(this._options);
      this._map.on("mousemove", this.layerNames.planes, this._handleFillMouseMove);
      this._map.on("mousedown", this.layerNames.planes, this._handleFillMouseMove);
      this._map.on("mouseleave", this.layerNames.planes, this._handleFillMouseLeave);
      this._map.on("mousemove", this.layerNames.lines, this._handleLineMouseMove);
      this._map.on("mousedown", this.layerNames.lines, this._handleLineMouseMove);
      this._map.on("mouseleave", this.layerNames.lines, this._handleLineMouseLeave);
      this._map.on("mousemove", this.layerNames.points, this._handlePointMouseMove);
      this._map.on("mousedown", this.layerNames.points, this._handlePointMouseMove);
      this._map.on("mouseleave", this.layerNames.points, this._handlePointMouseLeave);
      this._handleRender();
      this._onInit?.();
    };

    map.isStyleLoaded() ? init() : map.on("styledataloading", init);
  }

  private _handleRender() {
    (["points", "lines", "planes"] as LayerType[]).forEach((type) => {
      if (!this._requested[type]) return;
      const parse = (item: geojson.Feature) => ({
        ...item,
        id: (item.id as string).split(".").join("0"),
      });
      const collection = (this._features[type] ?? []).reduce(
        (acc, item) => {
          if (this._states[type]?.active?.includes(item.id as string))
            return { ...acc, active: [...acc.active, parse(item)] };
          if (this._states[type]?.hover?.includes(item.id as string))
            return { ...acc, hover: [...acc.hover, parse(item)] };
          if (this._states[type]?.disabled?.includes(item.id as string))
            return { ...acc, disabled: [...acc.disabled, parse(item)] };
          return { ...acc, default: [...acc.default, parse(item)] };
        },
        {
          disabled: [],
          default: [],
          hover: [],
          active: [],
        } as Record<LayerState | "default", geojson.Feature[]>,
      );
      (this._map?.getSource(this.layerNames[type]) as mapboxgl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: [...collection.disabled, ...collection.default, ...collection.hover, ...collection.active],
      });

      this._requested[type] = false;
    });

    this._map && window.requestAnimationFrame(this._handleRender);
  }

  private _handleFillMouseMove(e: mapboxgl.MapLayerTouchEvent | mapboxgl.MapLayerMouseEvent) {
    this._hovered.planes = (e.features || []).map((f) => {
      const { nesting, ...rest } = f.properties as LayerFeatureProperties;
      return {
        coordinates: (f.geometry as geojson.Polygon).coordinates,
        nesting: JSON.parse(nesting),
        props: rest,
      };
    });
  }

  private _handleFillMouseLeave() {
    this._hovered.planes = [];
  }

  private _handleLineMouseMove(e: mapboxgl.MapLayerTouchEvent | mapboxgl.MapLayerMouseEvent) {
    this._hovered.lines = (e.features || []).map((f) => {
      const { nesting, ...rest } = f.properties as LayerFeatureProperties;
      return {
        coordinates: (f.geometry as geojson.LineString).coordinates,
        nesting: JSON.parse(nesting),
        props: rest,
      };
    });
  }

  private _handleLineMouseLeave() {
    this._hovered.lines = [];
  }

  private _handlePointMouseMove(e: mapboxgl.MapLayerTouchEvent | mapboxgl.MapLayerMouseEvent) {
    this._hovered.points = sortPointsByDistance(e.features ?? ([] as any), e.lngLat.toArray()).map((f) => {
      const { nesting, ...rest } = f.properties as LayerFeatureProperties;
      return {
        coordinates: (f.geometry as geojson.Point).coordinates,
        nesting: JSON.parse(nesting),
        props: rest,
      };
    });
  }

  private _handlePointMouseLeave() {
    this._hovered.points = [];
  }

  private _initSources(options?: Options) {
    const layerStyles = options?.layerStyles ?? generateLayers(options?.config ?? defaultConfig);
    const layers = splitLayers(layerStyles);

    const sources: AddSourcePayload[] = [
      ...(Object.keys(this.layerNames) as LayerType[]).reduce((acc, type) => {
        return [
          ...acc,
          {
            id: this.layerNames[type],
            layers: layers[type],
            areaLayer: layers[type].length ? areaLayer[type](options?.area?.[type]) : undefined,
          },
        ];
      }, [] as AddSourcePayload[]),
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
      callback(eventMapParser(e, this._hovered));
    };

    if (options?.once) {
      this._map?.once(name, handler);
      return;
    }

    if (name === "click") {
      return this._addSubscription({
        callback,
        name,
        off: addClickHandler(this._map, this._hovered, undefined, undefined, callback),
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
        off: addMouseLeaveHandler(this._map, this._hovered, layer, this.layerNames[layer], callback),
      });
    }

    if (name === "mousedown") {
      return this._addSubscription({
        callback,
        name,
        layer,
        off: addMouseDownHandler(this._map, this._hovered, layer, this.layerNames[layer], callback),
      });
    }

    if (name === "click") {
      return this._addSubscription({
        callback,
        name,
        layer,
        off: addClickHandler(this._map, this._hovered, layer, this.layerNames[layer], callback),
      });
    }

    const handler = (e: mapboxgl.MapLayerMouseEvent | mapboxgl.MapLayerTouchEvent) => {
      callback(eventLayerParser(layer)(e, this._hovered));
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

  private _handleSetState(layer: LayerType, ids: (string | undefined)[], key: LayerState, value: boolean) {
    let _changed = false;

    ids.forEach((id) => {
      if (!id) return;
      if (value !== this._states[layer]?.[key]?.includes(id)) {
        this._states[layer] = {
          ...this._states[layer],
          [key]: value
            ? [...(this._states[layer]?.[key] ?? []), id]
            : (this._states[layer]?.[key] ?? []).filter((x) => x !== id),
        };
        _changed = true;
      }
      this._map?.setFeatureState(
        { id: (id as string).split(".").join("0"), source: this.layerNames[layer] },
        { [key]: value },
      );
    });

    if (!_changed) return;
    this._requested[layer] = true;
  }

  public setState(layer: LayerType, nesting: number[][], key: LayerState, value: boolean) {
    if (layer === "points")
      return this._handleSetState(
        layer,
        nesting.map((n) => `${n.map((x) => x + 1).join(".")}.`),
        key,
        value,
      );

    this._handleSetState(
      layer,
      nesting.reduce((acc, n) => {
        const search = `${n.map((x) => x + 1).join(".")}.`;

        return [
          ...acc,
          search,
          ...(this._features[layer] ?? []).reduce((ids, f) => {
            if (f.id?.toString().indexOf(search) !== 0) return ids;
            return [...ids, f.id.toString()];
          }, [] as string[]),
        ];
      }, [] as string[]),
      key,
      value,
    );
  }

  private _toFeatures(type: LayerType, items: (Line | Plane | Point)[]) {
    this._features[type] = items.map(
      (item) =>
        ({
          id: `${item.nesting.map((x) => x + 1).join(".")}.`,
          type: "Feature",
          geometry: {
            type: featureTypes[type],
            coordinates: item.coordinates,
          },
          properties: {
            ...item.props,
            nesting: JSON.stringify(item.nesting),
          },
        }) as geojson.Feature,
    );
    this._requested[type] = true;
  }

  render(key: "features" | "points", items: Feature[] | Point[]) {
    if (key === "points") return this._toFeatures("points", items as Point[]);
    this._toFeatures(
      "planes",
      (items as Feature[]).reduce((acc, item) => {
        switch (item.type) {
          case "Polygon":
            return [...acc, item];
          case "MultiPolygon":
            return [
              ...acc,
              ...item.coordinates.map((coords, index) => ({
                ...item,
                coordinates: coords,
                nesting: [...item.nesting, index],
              })),
            ];
          default:
            return acc;
        }
      }, [] as Plane[]),
    );

    this._toFeatures(
      "lines",
      (items as Feature[]).reduce((acc, item) => {
        let res: Line[] = [];
        lib.traverseCoordinates(item, (positions, indices) => {
          res.push({
            coordinates: positions,
            nesting: [...indices],
            props: item.props,
          });
        });
        return [...acc, ...res];
      }, [] as Line[]),
    );
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

  public remove() {
    this._map?.off("mousemove", this.layerNames.planes, this._handleFillMouseMove);
    this._map?.off("mousedown", this.layerNames.planes, this._handleFillMouseMove);
    this._map?.off("mouseleave", this.layerNames.planes, this._handleFillMouseLeave);
    this._map?.off("mousemove", this.layerNames.lines, this._handleLineMouseMove);
    this._map?.off("mousedown", this.layerNames.lines, this._handleLineMouseMove);
    this._map?.off("mouseleave", this.layerNames.lines, this._handleLineMouseLeave);
    this._map?.off("mousemove", this.layerNames.points, this._handlePointMouseMove);
    this._map?.off("mousedown", this.layerNames.points, this._handlePointMouseMove);
    this._map?.off("mouseleave", this.layerNames.points, this._handlePointMouseLeave);
    this._removeSources?.();
    this._map = undefined;
  }
}
