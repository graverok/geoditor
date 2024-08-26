import { Feature, LayerType, Point, SourceEventOptions, SourceEventHandler, LayerState } from "../types";

type AddListenerParams =
  | [string, SourceEventHandler]
  | [string, SourceEventHandler, SourceEventOptions]
  | [string, LayerType, SourceEventHandler];
type RemoveListenerParams = [string, SourceEventHandler] | [string, LayerType, SourceEventHandler];

export abstract class Controller {
  readonly layerNames: Record<LayerType, string>;
  abstract addListener(...params: AddListenerParams): void;
  abstract removeListener(...params: RemoveListenerParams): void;
  abstract setCursor(value: string): (() => void) | undefined;
  abstract setState(layer: LayerType, nesting: number[][], key: LayerState, value: boolean): void;
  abstract remove(): void;
  abstract render(type: "features" | "points", items: Feature[] | Point[]): void;
  abstract get renderer(): any;
  abstract onInit(callback?: () => void): void;

  protected constructor(layerNames: Record<LayerType, string>) {
    this.layerNames = layerNames;
  }
}
