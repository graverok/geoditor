import { GeometryFeature, LayerType, Node, Position, SourceMouseHandler, SourceEventOptions } from "../types";
import { geometryTools } from "../lib";

type RenderListenerParams =
  | [string, LayerType, SourceMouseHandler]
  | [string, SourceMouseHandler, SourceEventOptions]
  | [string, SourceMouseHandler];

export abstract class Source {
  private _data: object[] = [];
  private _features: GeometryFeature[] = [];
  private _onChange!: ((data: any[]) => void) | undefined;
  readonly layerNames: Record<LayerType, string>;
  abstract addListener(...params: RenderListenerParams): void;
  abstract removeListener(...params: RenderListenerParams): void;
  abstract setCursor(value: string): (() => void) | undefined;
  abstract setFeatureState(id: number | undefined, state: Record<string, boolean>): void;
  abstract setNodeState(id: number | undefined, nodeId: number | undefined, state: Record<string, boolean>): void;
  abstract remove(): void;
  abstract render(layer: LayerType, features: (GeometryFeature | Node)[]): void;
  abstract get renderer(): any;
  abstract onInit(callback?: () => void): void;
  abstract toGeometry(): GeometryFeature[];
  abstract toData(): any[];

  constructor(layerNames: Record<LayerType, string>) {
    this.layerNames = layerNames;
    this.updateData = this.updateData.bind(this);
    this.modifyFeatures = this.modifyFeatures.bind(this);
  }

  set value(data) {
    this._data = Array.from(data);
    this._features = this.toGeometry();
  }

  get value() {
    return Array.from(this._data);
  }

  public onChange(callback?: (data: any[]) => void) {
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
        coordinates: geometryTools.getCoordinates(updater(geometryTools.getPoints(item)), item.type),
      } as GeometryFeature;
    });
  }

  public updateData() {
    this._onChange?.(this.toData());
  }
}
