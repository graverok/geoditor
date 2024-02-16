import { Source, AnyTool, Core } from "./controllers";
import { PenTool, EditTool } from "./tools";

const defaultTools = {
  pen: PenTool,
  edit: EditTool,
};

export class Geomeditor<T extends object> {
  private _tools: AnyTool[] = [];
  private _tool: AnyTool | undefined;
  private readonly _core: Core;
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

  constructor(source: Source, tools?: (typeof AnyTool | "pen" | "edit")[]) {
    this._core = new Core({
      source,
      onSelect: (indices: number[]) => this._onSelect?.(indices),
      getTools: () => this.tools,
    });

    this._tools = (tools ?? ["pen", "edit"]).reduce((res, item) => {
      const Tool = typeof item === "string" ? (item in defaultTools ? defaultTools[item] : undefined) : item;
      if (!Tool) return res;
      return [...res, new Tool(this._core)];
    }, [] as AnyTool[]);

    source.onChange((data: T[]) => this._onChange?.(data));
    source.onInit(() => this._onInit());
  }

  set data(data: T[]) {
    this._core.data = data;
    this._core.selected = this._core.selected.length ? [Math.min(this._core.selected[0], data.length)] : [];
    this._tool?.refresh();
  }

  get tool() {
    if (!this._tool) return undefined;
    return {
      name: this._tool.name,
      config: this._tool.config,
    };
  }

  get tools() {
    return this._tools.reduce(
      (tools, item: AnyTool) =>
        item && {
          ...tools,
          [item.name]: (...args: Parameters<typeof item.enable>) => {
            this._tool?.disable();
            this._tool = item;
            this._isLoaded && item.enable(...args);
          },
        },
      {
        off: () => {
          this._tool?.disable();
          this._tool = undefined;
          this._core.reset();
        },
      } as Record<string, (...args: any[]) => void>,
    );
  }

  get selected() {
    return this._core.selected.map((id) => id - 1);
  }

  public remove() {
    this._tool?.disable();
    this._core.remove();
  }
}
