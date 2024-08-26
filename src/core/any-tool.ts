import { Core } from "./core";

export abstract class AnyTool {
  public core!: Core;
  readonly config: unknown;

  constructor(config?: unknown) {
    this.config = config;
  }
  public init(core: Core) {
    this.core = core;
  }
  public abstract enable(...args: unknown[]): void;
  public abstract disable(): void;
  public abstract refresh(): void;
  public abstract delete(indices?: (number | number[])[]): boolean | void;
}
