import { Core } from "./core";

export class AnyTool {
  public core!: Core;
  readonly config: any;

  constructor(config?: any) {
    this.config = config;
  }
  public init(core: Core) {
    this.core = core;
  }
  public enable(...args: any[]) {}
  public disable() {}
  public refresh() {}
  public delete(indices?: (number | number[])[]): boolean | void {
    return;
  }
}
