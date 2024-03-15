import { Source, AnyTool, Core } from "./controllers";
import { PenTool, EditTool } from "./tools";
import * as lib from "./lib";
import { Feature } from "./types";

const defaultTools = {
  pen: PenTool,
  edit: EditTool,
};

export class Geoditor {
  private _tools: AnyTool[] = [];
  private _tool: AnyTool | undefined;
  private readonly _core: Core;
  private readonly _source: Source;
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

  constructor(source: Source, tools?: (typeof AnyTool | "pen" | "edit")[]) {
    this._core = new Core({
      source,
      onSelect: () => this._onSelect?.(),
      onChange: () => {
        this._onChange?.();
        this._tool?.refresh();
      },
    });
    this._source = source;
    this._tools = (tools ?? ["pen", "edit"]).reduce((res, item) => {
      const Tool = typeof item === "string" ? (item in defaultTools ? defaultTools[item] : undefined) : item;
      if (!Tool) return res;
      return [...res, new Tool(this._core)];
    }, [] as AnyTool[]);

    source.onInit(() => this._onInit());
  }

  set data(data) {
    if (data.length !== this._source.data.length) {
      this._core.state.features.set("active", []);
      this._core.isolateFeatures();
    }
    this._source.data = data;
    this._tool?.refresh();
  }

  get data() {
    return this._source.data;
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
          if (this._tool?.delete(indices)) return;

          const deletion = indices || this._core.state.features.get("active");
          if (!deletion.length) return;

          const features = this._core.features.reduce((acc, feature) => {
            const _focus = deletion.filter((n) => lib.array.unarray(n) === feature.nesting[0]);
            if (!_focus.length) return [...acc, feature];
            if (_focus.some((n) => typeof n === "number")) return acc;
            const mutated = (_focus as number[][]).reduce<Feature | undefined>(
              (mutating, nesting) => lib.mutateFeature(mutating, nesting),
              feature,
            );
            return mutated ? [...acc, mutated] : acc;
          }, [] as Feature[]);

          this._core.state.features.set("active", []);
          this._core.isolateFeatures();
          this._core.features = features;
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
    return this._core.state.features.get("active").map(lib.array.unarray);
  }

  public remove() {
    this._tool?.disable();
    this._tool = undefined;
    this._core.remove();
  }
}
