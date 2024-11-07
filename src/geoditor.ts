import * as geojson from "geojson";
import { Controller, AnyTool, Core } from "./core";
import { PenTool, MoveTool, HandTool, DeleteTool } from "./tools";
import * as lib from "./lib";

const defaultTools = {
  move: new MoveTool(),
  pen: new PenTool(),
  hand: new HandTool(),
  delete: new DeleteTool(),
};

type Config<T, C> = {
  controller: C;
  tools?: T;
};

export class Geoditor<T extends Record<string, AnyTool>, C extends Controller = Controller> {
  private readonly _controller: C;
  private _loaded = false;
  private _requests: VoidFunction[] = [];
  private _selected: (number | number[])[] = [];
  private _listeners: {
    load: (() => void)[];
    select: ((selected: number[]) => void)[];
    change: ((data: geojson.Feature[]) => void)[];
    render: ((data: geojson.Feature[]) => void)[];
    tool: ((tool?: keyof T) => void)[];
  } = { load: [], select: [], change: [], render: [], tool: [] };
  private _tools: T;
  private _tool?: keyof T;
  private readonly _core: Core;

  constructor(config: Config<T, C>) {
    this._core = new Core(config.controller, {
      select: (next: (number | number[])[]) => {
        if (lib.array.equal(this._selected, next)) return;
        this._selected = next;
        this._listeners.select.forEach((f) => f(this._selected.map(lib.array.plain)));
      },
      change: () => {
        this._listeners.change.forEach((f) => f(this.data));
        this._tool && this._tools[this._tool]?.refresh();
      },
      render: (data: geojson.Feature[]) => {
        this._listeners.render.forEach((f) => f(data));
      },
    });
    this._controller = config.controller;
    this._tools = config?.tools ?? (defaultTools as unknown as T);
    Object.values(this._tools).forEach((t) => t.init(this._core));
    this._controller.ready(() => this._init());
  }

  public on(name: "load", callback: () => void): void;
  public on(name: "select", callback: (selected: number[]) => void): void;
  public on(name: "tool", callback: (tool?: keyof T) => void): void;
  public on(name: "change", callback: (data: geojson.Feature[]) => void): void;
  public on(name: "render", callback: (data: geojson.Feature[]) => void): void;
  public on(name: "load" | "select" | "change" | "render" | "tool", callback: (...args: any) => void) {
    if (this._listeners[name].find((f) => f === callback)) return;
    this._listeners[name].push(callback);
    name === "load" && this._loaded && callback();
  }

  public off(name: "load", callback: () => void): void;
  public off(name: "select", callback: (selected: number[]) => void): void;
  public off(name: "tool", callback: (tool?: keyof T) => void): void;
  public off(name: "change", callback: (data: geojson.Feature[]) => void): void;
  public off(name: "render", callback: (data: geojson.Feature[]) => void): void;
  public off(name: "load" | "select" | "change" | "render" | "tool", callback: (...args: any) => void) {
    this._listeners = {
      ...this._listeners,
      [name]: this._listeners[name].filter((f) => f !== callback),
    };
  }

  set data(data) {
    this._core.data = data;
    this._tool && this._tools[this._tool]?.refresh();
  }

  get data() {
    return this._core.data;
  }

  get selected() {
    return this._selected;
  }

  set selected(next: (number | number[])[]) {
    if (lib.array.equal(next, this._selected)) return;
    this._core.state.features.set("active", next);
    this._tool && this._tools[this._tool]?.refresh();
  }

  get tool() {
    return this._tool;
  }

  get tools() {
    return Object.keys(this._tools).reduce(
      (tools, key: keyof T) => ({
        ...tools,
        [key]: (...args: Parameters<T[typeof key]["start"]>) => {
          const current = this._tool && this._tool !== key ? this._tools[this._tool] : undefined;
          const loader = () => {
            const res = this._tools[key]?.on(current, ...args);
            if (res !== false) {
              this._tool = key;
              this._listeners.tool.filter((f) => f(key));
            }
          };

          if (this._loaded) loader();
          else this._requests.push(loader);

          return () => {
            this._tools[key].off();
          };
        },
      }),
      {
        off: () => {
          this._tool && this._tools[this._tool].off();
          this._tool = undefined;
          this._listeners.tool.filter((f) => f());
          this._core.reset();
        },
      } as { off: VoidFunction } & { [K in keyof T]: (...args: Parameters<T[K]["start"]>) => VoidFunction },
    );
  }

  public icon(key: keyof T | string, stroke?: number, color?: string) {
    return lib.createIcon(this._tools[key]?.icon, stroke, color);
  }

  public remove() {
    this._tool && this._tools[this._tool]?.finish();
    this._controller.remove();
    this._core.remove();
  }

  private _init() {
    this._loaded = true;
    this._core.init();
    this._requests.forEach((c) => c());
    this._requests = [];
    this._listeners.load.forEach((f) => f());
  }
}
