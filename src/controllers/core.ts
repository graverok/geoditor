import { Source } from "./source";
import { Feature, Point } from "../types";
import { StateManager } from "./state-manager";
import * as lib from "../lib";
import * as geojson from "geojson";

export class Core {
  private _source: Source;
  public addListener;
  public removeListener;
  public setCursor;
  public state: {
    features: StateManager;
    points: StateManager;
  };
  public render: (type: "features" | "points", items: Feature[] | Point[]) => void;
  private readonly _onSelect!: (() => void) | undefined;
  private readonly _onChange!: (() => void) | undefined;

  constructor(props: { source: Source; onSelect?: () => void; onChange?: () => void }) {
    this._source = props.source;
    this._onSelect = props.onSelect;
    this._onChange = props.onChange;
    this.addListener = this._source.addListener;
    this.removeListener = this._source.removeListener;
    this.setCursor = this._source.setCursor;
    this.render = this._source.render;

    this.state = {
      features: new StateManager((key, add, remove) => {
        if (remove.length) {
          this._source.setState("lines", remove, key, false);
          this._source.setState("planes", remove, key, false);
        }
        if (add.length) {
          this._source.setState("lines", add, key, true);
          this._source.setState("planes", add, key, true);
        }
        key === "active" && this._onSelect?.();
      }),
      points: new StateManager((key, add, remove) => {
        remove.length && this._source.setState("points", remove, key, false);
        add.length && this._source.setState("points", add, key, true);
      }),
    };
  }

  public getFeature(index?: number) {
    if (typeof index !== "number") return;
    return this.features[index];
  }

  public init() {
    this.render("features", this.features);
  }

  public reset() {
    this.state.features.set("active", []);
    this.render("features", this.features);
    this.render("points", []);
  }

  public isolateFeatures() {
    this.state.features.set(
      "disabled",
      this.state.features.get("active").length && !this.state.features.get("active").some((n) => typeof n === "number")
        ? this.features.reduce(
            (acc, f) => {
              if (this.state.features.get("active").map(lib.array.unarray).includes(f.nesting[0])) return acc;
              return [...acc, f.nesting[0]];
            },
            [] as (number | number[])[],
          )
        : [],
    );
  }

  get features() {
    return (this._source.data as geojson.Feature[]).map(
      (item, index) =>
        ({
          nesting: [index],
          type: item.geometry.type,
          coordinates: item.geometry.type !== "GeometryCollection" ? item.geometry.coordinates : [],
          props: item.properties,
        }) as Feature,
    );
  }

  set features(features: Feature[]) {
    this._source.data = features.map((item) =>
      this._source.data[item.nesting[0]]
        ? ({
            ...this._source.data[item.nesting[0]],
            geometry: {
              type: item.type,
              coordinates: item.coordinates,
            },
          } as geojson.Feature)
        : ({
            type: "Feature",
            geometry: {
              type: item.type,
              coordinates: item.coordinates,
            },
            properties: item.props,
          } as geojson.Feature),
    );
    this.render("features", this.features);
    this._onChange?.();
    this.state.features.refresh("active");
  }

  get renderer() {
    return this._source.renderer;
  }

  public remove() {
    this._source.remove();
  }
}
