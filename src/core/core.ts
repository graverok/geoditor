import * as geojson from "geojson";
import * as lib from "../lib";
import { Feature, Point } from "../types";
import { Controller } from "./controller";
import { StateManager } from "./state-manager";
import { array, traverseCoordinates } from "../lib";

export class Core {
  public addListener;
  public removeListener;
  public setCursor;
  public state: {
    features: StateManager;
    points: StateManager;
  };
  public render: (type: "features" | "points", items: Feature[] | Point[]) => void;
  private _data: geojson.Feature[] = [];
  private readonly _onSelect!: ((next: (number | number[])[]) => void) | undefined;
  private readonly _onChange!: (() => void) | undefined;
  private readonly _controller: Controller;

  constructor(props: {
    controller: Controller;
    onSelect?: (next: (number | number[])[]) => void;
    onChange?: () => void;
  }) {
    this._controller = props.controller;
    this._onSelect = props.onSelect;
    this._onChange = props.onChange;
    this.addListener = this._controller.addListener;
    this.removeListener = this._controller.removeListener;
    this.setCursor = this._controller.setCursor;
    this.render = this._controller.render;

    this.state = {
      features: new StateManager((key, add, remove) => {
        if (remove.length) {
          this._controller.setState("lines", remove, key, false);
          this._controller.setState("planes", remove, key, false);
        }
        if (add.length) {
          this._controller.setState("lines", add, key, true);
          this._controller.setState("planes", add, key, true);
        }
        key === "active" && this._onSelect?.(this.state.features.get("active"));
      }),
      points: new StateManager((key, add, remove) => {
        remove.length && this._controller.setState("points", remove, key, false);
        add.length && this._controller.setState("points", add, key, true);
      }),
    };
  }

  public getFeatures(indices: (number | number[])[]) {
    const flat = indices.map(lib.array.plain);
    return this.features.filter((f) => flat.includes(f.nesting[0]));
  }

  public init() {
    this.render("features", this.features);
  }

  public reset() {
    this.state.features.set("active", []);
    this.state.features.set("disabled", []);
    this.render("features", this.features);
    this.render("points", []);
  }

  public isolateFeatures(active?: (number | number[])[]) {
    const disabled =
      (active && !active.some((n) => typeof n === "number")) ||
      (this.state.features.get("active").length &&
        !this.state.features.get("active").some((n) => typeof n === "number"))
        ? this.features.reduce(
            (acc, f) => {
              if ((active || this.state.features.get("active")).map(lib.array.plain).includes(f.nesting[0])) return acc;
              return [...acc, f.nesting[0]];
            },
            [] as (number | number[])[],
          )
        : [];
    this.state.features.remove("active", disabled);
    this.state.features.set("disabled", disabled);
  }

  get features() {
    return (this._data as geojson.Feature[]).map(
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
    const next = updateSelected(features, this.state.features.get("active"));
    this.state.features.set("active", []);
    this.state.features.set("disabled", []);
    this._data = features.map((item) =>
      this._data[item.nesting[0]]
        ? ({
            ...this.data[item.nesting[0]],
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
    this.state.features.set("active", next);
    this._onChange?.();
  }

  get data() {
    return this._data;
  }

  set data(data) {
    const isEqual = this._data.length === data.length;
    this._data = data;
    this.render("features", this.features);
    if (isEqual) {
      this.state.features.refresh("active");
      return;
    }
    this.state.features.set("active", []);
    this.state.features.set("disabled", []);
  }

  get renderer() {
    return this._controller.renderer;
  }

  public remove() {
    this._controller.remove();
  }
}

const updateSelected = (features: Feature[], active: (number | number[])[]) => {
  return active.reduce((acc, n) => {
    const feature = features.find((f) => f.nesting[0] === array.plain(n));
    if (!feature) {
      /* Remove all shapes selection of this feature */
      acc = acc.filter((s) => array.plain(n) !== array.plain(s));
      /* Select nearest item if none is selected */
      if (acc.length === 0 && features.length) acc = [Math.min(array.plain(n), features.length - 1)];
      return acc;
    }
    if (typeof n === "number") return acc;

    const counts: number[] = [];
    traverseCoordinates(feature, (_, indices) => {
      indices.forEach((x, i) => {
        counts[i] = typeof counts[i] === "number" ? Math.max(counts[i], x) : x;
      });
      return;
    });
    return [
      ...acc.filter((x) => !array.equal(x, n)),
      counts.reduce((acc, x, i) => (typeof n[i] === "number" ? [...acc, Math.min(x, n[i])] : acc), [] as number[]),
    ];
  }, active);
};
