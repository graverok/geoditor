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
  private readonly _source: Source<T>;
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

  constructor(source: Source<T>, tools?: (typeof AnyTool | "pen" | "edit")[]) {
    this._core = new Core({
      source,
      onSelect: () => this._onSelect?.(),
    });
    this._source = source;
    this._tools = (tools ?? ["pen", "edit"]).reduce((res, item) => {
      const Tool = typeof item === "string" ? (item in defaultTools ? defaultTools[item] : undefined) : item;
      if (!Tool) return res;
      return [...res, new Tool(this._core)];
    }, [] as AnyTool[]);

    source.onChange(() => {
      this._onChange?.();
      this._tool?.refresh();
    });
    source.onInit(() => this._onInit());
  }

  set data(data: T[]) {
    if (data.length < this._source.data.length) this._core.selected = [];
    this._source.data = data;
    this._tool?.refresh();
  }

  get data() {
    return this._source.data as T[];
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
        delete: () => {
          if (this._tool?.delete()) return;
          if (this.selected.length === 0) return;
          this.data = this._source.data.filter((_, index) => !this.selected.includes(index));
        },
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
    this._tool = undefined;
    this._core.remove();
  }
}
