import { Core } from "./core";

export class AnyTool {
  protected _name: string | undefined;
  public core: Core;

  constructor(core: Core) {
    this.core = core;
  }

  get name() {
    return this._name;
  }

  get config(): unknown {
    return;
  }
  public enable(options?: unknown) {
    return options;
  }

  public disable() {}

  public refresh() {}
}
