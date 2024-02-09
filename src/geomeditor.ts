import { Source, AnyTool, Core } from "./controllers";
import { CreateTool, ModifyTool } from "./tools";

const defaultTools = {
  create: CreateTool,
  modify: ModifyTool,
};

export class Geomeditor<T extends object> {
  private _tools: AnyTool[] = [];
  private _tool: AnyTool | undefined;
  private _core: Core;
  private _onLoad: (() => void) | undefined;
  private _onChange: ((data: T[]) => void) | undefined;
  private _onSelect: ((indices: number[]) => void) | undefined;
  private _isLoaded = false;

  public onSelect(callback?: (indices: number[]) => void) {
    this._onSelect = callback;
  }

  public onChange(callback?: (data: T[]) => void) {
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

  constructor(source: Source, tools?: (typeof AnyTool | "create" | "modify")[]) {
    this._core = new Core({
      source,
      onSelect: (indices: number[]) => this._onSelect?.(indices),
    });

    this._tools = (tools ?? ["create", "modify"]).map((item) => {
      const Controller = typeof item === "string" ? defaultTools[item] : item;
      return new Controller(this._core);
    });

    source.onChange((data: T[]) => this._onChange?.(data));
    source.onInit(() => this._onInit());
  }

  public setData(data: T[]) {
    this._core.value = data;
    this._core.selected = this._core.selected.length ? [Math.min(this._core.selected[0], data.length)] : [];
    this._tool?.refresh();
  }

  public setTool(name?: keyof typeof defaultTools | string, options?: unknown) {
    if (name !== this._tool?.name || options !== this._tool?.config) {
      this._tool?.disable();
      this._tool = this._tools.find((item) => item.name === name);

      if (this._tool) {
        this._isLoaded && this._tool.enable(options);
      } else {
        this._core.reset();
      }
    }
  }

  get tool() {
    if (!this._tool) return;
    return {
      name: this._tool.name,
      config: this._tool.config,
    };
  }

  get selected() {
    return this._core.selected.map((id) => id - 1);
  }

  public remove() {
    this._tool?.disable();
    this._core.remove();
  }
}
