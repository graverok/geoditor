import { Controller, AnyTool, Core } from "./core";
import { PenTool, MoveTool } from "./tools";
import { Feature } from "./types";
import * as lib from "./lib";
import * as geojson from "geojson";

type Tools = {
  move: (...args: Parameters<MoveTool["enable"]>) => AnyTool["subscriber"];
  pen: (...args: Parameters<PenTool["enable"]>) => AnyTool["subscriber"];
  delete: (indices?: number[]) => void;
  off: () => void;
} & Record<string, (...args: Parameters<AnyTool["enable"]>) => AnyTool["subscriber"]>;

const defaultTools = {
  move: new MoveTool(),
  pen: new PenTool(),
};

type Config = {
  controller: Controller;
  tools?: Record<string, AnyTool>;
};

export class Geoditor {
  private _tool: string | undefined;
  private _tools!: Record<string, AnyTool>;
  private readonly _core: Core;
  private readonly _controller: Controller;
  private _isLoaded = false;
  private _selected: (number | number[])[] = [];
  private _listeners: {
    load: (() => void)[];
    select: ((selected: number[]) => void)[];
    change: ((data: geojson.Feature[]) => void)[];
    render: ((data: geojson.Feature[]) => void)[];
  } = { load: [], select: [], change: [], render: [] };

  constructor(config: Config) {
    this._core = new Core({
      controller: config.controller,
      onSelect: (next: (number | number[])[]) => {
        if (lib.array.equal(this._selected, next)) return;
        this._selected = next;
        this._listeners.select.forEach((f) => f(this._selected.map(lib.array.plain)));
      },
      onChange: () => {
        this._listeners.change.forEach((f) => f(this.data));
        this._tool && this._tools[this._tool]?.refresh();
      },
      onRender: (data: geojson.Feature[]) => {
        this._listeners.render.forEach((f) => f(data));
      },
    });
    this._controller = config.controller;
    this._tools = config?.tools ?? defaultTools;
    Object.values(this._tools).forEach((t) => t.init(this._core));
    this._controller.onInit(() => this._onInit());
  }

  public on(name: "load", callback: () => void): void;
  public on(name: "select", callback: (selected: number[]) => void): void;
  public on(name: "change", callback: (data: geojson.Feature[]) => void): void;
  public on(name: "render", callback: (data: geojson.Feature[]) => void): void;
  public on(name: "load" | "select" | "change" | "render", callback: (...args: any) => void) {
    if (this._listeners[name].find((f) => f === callback)) return;
    this._listeners[name].push(callback);
    name === "load" && this._isLoaded && callback();
  }

  public off(name: "load", callback: () => void): void;
  public off(name: "select", callback: (selected: number[]) => void): void;
  public off(name: "change", callback: (data: geojson.Feature[]) => void): void;
  public off(name: "load" | "select" | "change", callback: (...args: any) => void) {
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
    this._selected = next;
    this._core.state.features.set("active", this._selected);
    this._tool && this._tools[this._tool]?.refresh();
  }

  get tool() {
    return this._tool;
  }

  get tools() {
    return Object.keys(this._tools).reduce(
      (tools, key) => ({
        ...tools,
        [key]: (...args: Parameters<Tools[typeof key]>) => {
          const current = this._tool;
          this._tool = undefined;
          current && this._tools[current]?.disable();
          this._tool = key;
          this._isLoaded && this._tools[key]?.enable(...args);
          return this._tools[key].subscriber;
        },
      }),
      {
        delete: (indices?: number[]) => {
          const _deletion = indices || this._core.state.features.get("active");
          if (!_deletion.length) return;
          if (this._tool && this._tools[this._tool]?.delete(_deletion)) return;
          this._core.features = deleteFeatures(this._core.features, _deletion);
        },
        off: () => {
          this._tool && this._tools[this._tool]?.disable();
          this._tool = undefined;
          this._core.reset();
        },
      } as Tools,
    );
  }

  public remove() {
    this._tool && this._tools[this._tool]?.disable();
    this._controller.remove();
    this._core.remove();
  }

  private _onInit() {
    this._isLoaded = true;
    this._core.init();
    this._tool && this._tools[this._tool]?.enable();
    this._listeners.load.forEach((f) => f());
  }
}

const deleteFeatures = (features: Feature[], deletion: (number | number[])[]) => {
  return features.reduce((acc, feature) => {
    if (!deletion.some((n) => lib.array.plain(n) === feature.nesting[0])) return [...acc, feature];
    if (deletion.some((n) => n === feature.nesting[0])) return acc;
    const _shapes = deletion.filter((n) => lib.array.plain(n) === feature.nesting[0]) as number[][];
    const mutated = (_shapes as number[][]).reduce<Feature | undefined>(
      (mutating, nesting) => lib.mutateFeature(mutating, nesting),
      feature,
    );
    return mutated ? [...acc, mutated] : acc;
  }, [] as Feature[]);
};
