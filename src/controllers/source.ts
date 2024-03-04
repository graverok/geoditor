import { Feature, LayerType, Point, SourceEventOptions, FeatureProps, SourceEventHandler } from "../types";

type AddListenerParams =
  | [string, SourceEventHandler]
  | [string, SourceEventHandler, SourceEventOptions | undefined]
  | [string, LayerType, SourceEventHandler];
type RemoveListenerParams = [string, SourceEventHandler] | [string, LayerType, SourceEventHandler];

export abstract class Source<T = object> {
  private _data: T[] = [];
  private _features: Feature[] = [];
  private _onChange!: (() => void) | undefined;
  readonly layerNames: Record<LayerType, string>;
  abstract addListener(...params: AddListenerParams): void;
  abstract removeListener(...params: RemoveListenerParams): void;
  abstract setCursor(value: string): (() => void) | undefined;
  abstract setFeatureState(id: number | undefined, state: Record<string, boolean>): void;
  abstract setPointState(node: Pick<Point, "indices" | "fid">, state: Record<string, boolean>): void;
  abstract remove(): void;
  abstract renderFeatures(features: Feature[]): void;
  abstract renderPoints(nodes: Point<FeatureProps>[]): void;
  abstract get renderer(): any;
  abstract onInit(callback?: () => void): void;
  abstract toFeatures(): Feature[];
  abstract toData(): T[];

  protected constructor(layerNames: Record<LayerType, string>) {
    this.layerNames = layerNames;
  }

  set data(data) {
    this._data = Array.from(data);
    this._features = this.toFeatures();
  }

  get data() {
    return Array.from(this._data);
  }

  public onChange(callback?: () => void) {
    this._onChange = callback;
  }

  get features() {
    return Array.from(this._features);
  }

  set features(features: Feature[]) {
    this._features = features;
    this._data = this.toData();
    this._onChange?.();
  }

  public getFeature(id?: number) {
    if (!id) return;
    return this._features.find((item) => item.id === id);
  }
}
