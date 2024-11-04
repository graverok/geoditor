import { Core } from "./core";
import { Shape, FilterHandler, SubscribeType } from "../types";

type Subscriber = {
  filter: (callback: FilterHandler) => Subscriber;
};

export abstract class AnyTool {
  public core!: Core;
  public readonly config: unknown;
  public readonly subscriber: Subscriber;
  private subscriptions: {
    filter?: FilterHandler;
  };

  constructor(config?: unknown) {
    this.config = config;
    this.subscriptions = {};
    this.subscriber = {
      filter: this._subscriber("filter"),
    };
  }

  public init(core: Core) {
    this.core = core;
  }

  public abstract enable(): void;
  public abstract enable(...args: unknown[]): void;
  public abstract refresh(): void;
  public delete(indices?: (number | number[])[]): boolean | void;
  public delete(): boolean | void {
    return;
  }
  public disable(): void {
    this.subscriptions = {};
  }

  public get icon(): string {
    return "";
  }

  protected filter = (shape: Shape) => {
    return this.subscriptions.filter?.(shape) ?? true;
  };

  private _subscriber = (type: SubscribeType) => (callback: FilterHandler) => {
    this.subscriptions[type] = callback;
    return this.subscriber;
  };
}
