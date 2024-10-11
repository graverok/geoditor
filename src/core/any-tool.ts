import { Core } from "./core";
import { Shape, TestHandler } from "../types";

type Subscriber = {
  filter?: (callback: TestHandler) => Subscriber;
};

export abstract class AnyTool {
  public core!: Core;
  readonly config: unknown;
  public subscriber: Subscriber;
  private subscriptions: {
    filter?: TestHandler;
  };

  constructor(config?: unknown) {
    this.config = config;
    this.subscriptions = {};
    this.subscriber = {
      filter: this._filter,
    };
  }

  public init(core: Core) {
    this.core = core;
  }

  public abstract enable(): void;
  public abstract enable(...args: unknown[]): void;
  public abstract refresh(): void;
  public abstract delete(indices?: (number | number[])[]): boolean | void;
  public disable() {
    this.subscriptions = {};
  }

  private _filter = (callback: TestHandler) => {
    this.subscriptions.filter = callback;
    return this.subscriber;
  };

  protected filter = (shape: Shape) => {
    return this.subscriptions.filter?.(shape) ?? true;
  };
}
