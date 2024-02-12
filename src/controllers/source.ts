import { Geometry, LayerType, Node, SourceMouseHandler, SourceEventOptions } from "../types";

type RenderListenerParams =
  | [string, LayerType, SourceMouseHandler]
  | [string, SourceMouseHandler, SourceEventOptions]
  | [string, SourceMouseHandler];

export abstract class Source {
  private _data: object[] = [];
  private _features: Geometry[] = [];
  private _onChange!: ((data: any[]) => void) | undefined;
  readonly layerNames: Record<LayerType, string>;
  abstract addListener(...params: RenderListenerParams): void;
  abstract removeListener(...params: RenderListenerParams): void;
  abstract setCursor(value: string): (() => void) | undefined;
  abstract setFeatureState(id: number | undefined, state: Record<string, boolean>): void;
  abstract setNodeState(node: Pick<Node, "id" | "parentId">, state: Record<string, boolean>): void;
  abstract remove(): void;
  abstract render(layer: LayerType, features: (Geometry | Node)[]): void;
  abstract get renderer(): any;
  abstract onInit(callback?: () => void): void;
  abstract toGeometry(): Geometry[];
  abstract toData(): any[];

  protected constructor(layerNames: Record<LayerType, string>) {
    this.layerNames = layerNames;
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

  set features(features: Geometry[]) {
    this._features = features;
    this._onChange?.(this.toData());
  }

  public getFeature(id?: number) {
    if (!id) return;
    return this._features.find((item) => item.id === id);
  }
}
