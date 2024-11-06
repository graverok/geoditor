import {
  Feature,
  LayerType,
  Point,
  SourceEventOptions,
  SourceEventHandler,
  LayerState,
  ControllerEventType,
} from "../types";

type AddListenerParams =
  | [ControllerEventType, SourceEventHandler]
  | [ControllerEventType, SourceEventHandler, SourceEventOptions]
  | [ControllerEventType, LayerType, SourceEventHandler];
type RemoveListenerParams =
  | [ControllerEventType, SourceEventHandler]
  | [ControllerEventType, LayerType, SourceEventHandler];

export abstract class Controller {
  readonly layerNames: Record<LayerType, string>;
  abstract addListener(...params: AddListenerParams): void;
  abstract removeListener(...params: RemoveListenerParams): void;
  abstract setCursor(value: string): (() => void) | undefined;
  abstract setState(layer: LayerType, nesting: number[][], key: LayerState, value: boolean): void;
  abstract remove(): void;
  abstract render(type: "features" | "points", items: Feature[] | Point[]): void;
  abstract get renderer(): unknown;
  abstract onInit(callback?: () => void): void;
  protected abstract lock(): VoidFunction;
  protected _locked: boolean = false;

  protected constructor(layerNames: Record<LayerType, string>) {
    this.layerNames = layerNames;
  }
}
