import { GeometryFeature, NodeFeature, Position, LayerType, DataItem } from "../types";
import { geometryTools } from "../lib";

export type RenderFeature = (NodeFeature & { layer: LayerType }) | (GeometryFeature & { layer: LayerType });
export type RenderEvent = {
  position: Position;
  features: RenderFeature[];
  originalEvent?: unknown;
  preventDefault?: () => void;
};

export type RenderEventOptions = { once?: boolean } | undefined;

export type RenderEventHandler = (e: RenderEvent) => void;
type RenderListenerParams =
  | [string, LayerType, RenderEventHandler]
  | [string, RenderEventHandler, RenderEventOptions]
  | [string, RenderEventHandler];

export interface RenderController {
  addListener: (...params: RenderListenerParams) => void;
  removeListener: (...params: RenderListenerParams) => void;
  setCursor: (value: string) => void;
  setFeatureState: (layers: LayerType[], id: number, state: Record<string, boolean>) => void;
}

export abstract class Source {
  private _data: DataItem[] = [];
  private _features: GeometryFeature[] = [];
  private _onChange!: ((data: DataItem[]) => void) | undefined;
  readonly layerNames: Record<LayerType, string>;
  abstract addListener(...params: RenderListenerParams): void;
  abstract removeListener(...params: RenderListenerParams): void;
  abstract setCursor(value: string): (() => void) | undefined;
  abstract setFeatureState(layers: LayerType[], id: number | undefined, state: Record<string, boolean>): void;
  abstract remove(): void;
  abstract render(layer: LayerType, features: RenderFeature[]): void;
  abstract get renderer(): unknown;
  abstract onInit(callback?: () => void): void;

  constructor(layerNames: Record<LayerType, string>) {
    this.layerNames = layerNames;
    this.updateData = this.updateData.bind(this);
    this.modifyFeatures = this.modifyFeatures.bind(this);
  }

  set value(data: DataItem[]) {
    this._data = Array.from(data);
    this._features = data.map((item, index) => ({
      ...item,
      id: index + 1,
    }));
  }

  get value() {
    return Array.from(this._data);
  }

  public onChange(callback?: (data: DataItem[]) => void) {
    this._onChange = callback;
  }

  get features() {
    return Array.from(this._features);
  }

  set features(features: GeometryFeature[]) {
    this._features = features;
  }

  public getFeature(id?: number) {
    if (!id) return;
    return this._features.find((item) => item.id === id);
  }

  public modifyFeatures(ids: number[], updater: (positions: Position[]) => Position[]) {
    return this._features.map((item) => {
      if (!ids.includes(item.id)) return item;

      return {
        ...item,
        geometry: geometryTools.getGeometry(updater(geometryTools.getPositions(item.geometry)), item.geometry.type),
      };
    });
  }

  public updateData() {
    this._data = [
      ...this._data.map((item, index) => ({
        ...item,
        geometry: this._features[index]?.geometry || item.geometry,
      })),
      ...(this._features.length > this._data.length ? [this._features[this._features.length - 1]] : []),
    ];

    this._onChange?.(this._data);
  }
}
