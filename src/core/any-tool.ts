import { Core } from "./core";

export class AnyTool {
  public core!: Core;
  public readonly config: unknown;
  protected disabled: boolean = true;

  constructor(config?: unknown) {
    this.config = config;
    this.off = this.off.bind(this);
  }

  public init(core: Core) {
    this.core = core;
  }

  public on(current: AnyTool | undefined, ...args: unknown[]): boolean {
    current?.off(this);
    this.start(...args);
    return true;
  }

  public off(next?: AnyTool): void {
    if (next === this) return;
    this.finish();
  }

  public start(...args: unknown[]): void;
  public start(): void {
    this.enable();
  }
  public delete?(indices?: (number | number[])[]): boolean | void;
  public finish(): void {
    this.disable();
  }
  public refresh?(): void;

  public get icon(): string {
    return "";
  }

  public enable(): void {
    this.disabled = false;
  }

  public disable(): void {
    this.disabled = true;
  }
}
