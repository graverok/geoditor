import { Core } from "./core";

export class AnyTool {
  protected _name!: string;
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
  public enable(...args: any[]) {}
  public disable() {}
  public refresh() {}
  public delete(indices?: (number | number[])[]): boolean | void {
    return;
  }
}
