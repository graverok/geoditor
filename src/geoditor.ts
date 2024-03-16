import { Controller, AnyTool, Core } from "./core";
import { PenTool, MoveTool } from "./tools";
import * as lib from "./lib";

type Tools = {
  move: MoveTool["enable"];
  pen: PenTool["enable"];
  delete: (indices?: number[]) => void;
  off: () => void;
};

export class Geoditor {
  private _tools: AnyTool[];
  private _tool: AnyTool | undefined;
  private readonly _core: Core;
  private readonly _source: Controller;
  private _onLoad: (() => void) | undefined;
  private _onChange: (() => void) | undefined;
  private _onSelect: (() => void) | undefined;
  private _isLoaded = false;

  public onSelect(callback?: () => void) {
    this._onSelect = callback;
  }

  public onChange(callback?: () => void) {
    this._onChange = callback;
  }

  public onLoad(callback?: () => void) {
    this._onLoad = callback;
  }

  private _onInit() {
    this._isLoaded = true;
    this._core.init();
    this._tool?.enable();
    this._onLoad?.();
  }

  constructor(source: Controller, tools?: (typeof AnyTool)[]) {
    this._core = new Core({
      source,
      onSelect: () => this._onSelect?.(),
      onChange: () => {
        this._onChange?.();
        this._tool?.refresh();
      },
    });
    this._source = source;
    this._tools = [PenTool, MoveTool, ...(tools || [])].map((Tool) => new Tool(this._core));
    source.onInit(() => this._onInit());
  }

  set data(data) {
    this._core.data = data;
    this._tool?.refresh();
  }

  get data() {
    return this._core.data;
  }

  get tool() {
    return this._tool?.name;
  }

  get tools() {
    return this._tools.reduce(
      (tools, item: AnyTool) =>
        item && {
          ...tools,
          [item.name]: (...args: Parameters<typeof item.enable>) => {
            if (this._tool?.name === item.name) return;
            this._tool?.disable();
            this._tool = item;
            this._isLoaded && item.enable(...args);
          },
        },
      {
        delete: (indices?: number[]) => {
          const _deletion = indices || this._core.state.features.get("active");
          if (this._tool?.delete(_deletion)) return;
          if (!_deletion.length) return;
          this._core.features = lib.utils.deleteFeatures(this._core.features, _deletion);
        },
        off: () => {
          this._tool?.disable();
          this._tool = undefined;
          this._core.reset();
        },
      } as Tools & Record<string, (...args: any[]) => void>,
    );
  }

  get selected() {
    return this._core.state.features.get("active").map(lib.array.unarray);
  }

  public remove() {
    this._tool?.disable();
    this._tool = undefined;
    this._core.remove();
  }
}
