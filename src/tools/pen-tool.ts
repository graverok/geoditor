import { AnyTool, Core } from "../core";
import * as lib from "../lib";
import { DrawType, Feature, Point, Position, SourceEvent } from "../types";

interface Options {
  allowAppend?: boolean;
}

export class PenTool extends AnyTool {
  private _geometry: Position[] | undefined;
  private _feature: Feature | undefined;
  private _ignoreCanvas = false;
  private _isReversed = false;
  private _types: DrawType[] = [];
  private _resetCursor!: (() => void) | undefined;
  private _props: Record<string, any> | undefined;
  private _storedActive: (number | number[])[] = [];
  private _event: SourceEvent | undefined;
  private _options: Options = {};

  constructor(core: Core) {
    super(core);
    this._name = "pen";
    this._handleCanvasMouseMove = this._handleCanvasMouseMove.bind(this);
    this._handleCanvasClick = this._handleCanvasClick.bind(this);
    this._handlePointMouseEnter = this._handlePointMouseEnter.bind(this);
    this._handlePointClick = this._handlePointClick.bind(this);
    this._handlePointMouseDown = this._handlePointMouseDown.bind(this);
    this._activateFinishNodes = this._activateFinishNodes.bind(this);
    this._handleCanvasLeave = this._handleCanvasLeave.bind(this);
    this._handleKeyPress = this._handleKeyPress.bind(this);
  }

  private _activateFinishNodes(hover = false) {
    let _geometry = this._getShapeGeometry();
    /** Placeholder */ if (Number(this._types.includes("LineString")) + _geometry.length < 3) return;

    const _types: Feature["type"][] =
      this._feature && this._feature?.type !== "LineString" ? [this._feature.type] : this._types;
    const nest = this.core.state.features.get("active")[0] as number[];
    const endings = [
      ...((_types.includes("Polygon") || _types.includes("MultiPolygon")) && _geometry.length >= 3
        ? [this._isReversed ? _geometry.length - 1 : 0]
        : []),
      this._isReversed ? 0 : _geometry.length - 1,
    ];
    this.core.state.points.set(
      "disabled",
      _geometry.reduce((acc, _, i) => {
        if (endings.includes(i)) return acc;
        return [...acc, [...nest, i]];
      }, [] as number[][]),
    );

    if (!hover) return;
    this._ignoreCanvas = true;
    this.core.state.points.set("hover", [endings[endings.length - 1]]);
    this.core.setCursor("pointer");
  }

  private _activateStartingNodes(features: Feature[], active: (number | number[])[]) {
    let disabled: number[][] = [];
    features.forEach((feature) => {
      if (!feature) return;
      if (!active.map(lib.array.unarray).includes(lib.array.unarray(feature.nesting))) return;
      lib.traverseCoordinates(feature, (positions, indices) => {
        if (!active.map(lib.array.arrify).some((n) => lib.array.equal(n, indices, true))) return;
        if (lib.isPolygonLike(feature)) {
          disabled = [...disabled, ...positions.map((_, index) => [...indices, index])];
        } else {
          disabled = [
            ...disabled,
            ...positions.slice(1, positions.length - 1).map((_, index) => [...indices, index + 1]),
          ];
        }
      });
    });
    this.core.state.points.set("disabled", disabled);
  }

  private _getShapeGeometry(next?: Position) {
    let shape = this._feature
      ? lib.toPositions(
          lib.getCoordinates(this._feature, lib.array.arrify(this.core.state.features.get("active")[0]) ?? []),
          this._feature.type,
        )
      : [];
    return this._isReversed
      ? [...(next ? [next] : []), ...(this._geometry || []), ...shape]
      : [...shape, ...(this._geometry || []), ...(next ? [next] : [])];
  }

  private _mutateFeature(geometry: Position[], finish?: Point) {
    const renderType: Feature["type"] =
      !this._feature || this._feature.type === "LineString"
        ? (this._types.includes("LineString") || geometry.length < 3) &&
          (!finish || finish.nesting[finish.nesting.length - 1] !== (this._isReversed ? geometry.length - 1 : 0))
          ? "LineString"
          : "Polygon"
        : this._feature.type;

    return lib.mutateFeature(
      this._feature
        ? ({
            ...this._feature,
            coordinates:
              this._feature.type === "LineString" && renderType !== "LineString"
                ? [this._feature.coordinates]
                : this._feature.coordinates,
            type: renderType,
          } as Feature)
        : ({ nesting: [this.core.features.length], type: renderType, props: this._props } as Feature),
      lib.array.arrify(this.core.state.features.get("active")[0]),
      lib.toCoordinates(geometry, renderType),
    );
  }

  private _render(next?: Position) {
    if (!this._geometry) return;
    let _geometry = this._getShapeGeometry(next);

    /** Placeholder line */
    if (Number(this._types.includes("LineString")) + _geometry.length < 3) {
      const _feature = {
        nesting: [this.core.features.length],
        type: "LineString",
        coordinates: _geometry,
        props: this._feature ? this._feature.props : this._props,
      } as Feature;
      this.core.render("features", [...this.core.features, _feature]);
      this.core.state.features.add("active", [[this.core.features.length]]);

      if (next) return;
      const points = lib.createPoints([_feature]);
      this.core.state.points.add(
        "disabled",
        points.map((p) => p.nesting),
      );
      this.core.render("points", points);
      return;
    }

    const _feature = this._mutateFeature(_geometry) as Feature;
    this.core.render("features", [
      ...this.core.features.slice(0, _feature.nesting[0]),
      _feature,
      ...this.core.features.slice(_feature.nesting[0] + 1),
    ]);

    if (next) return;
    const points = lib.createPoints([_feature], this.core.state.features.get("active"));
    this.core.render("points", points);
  }

  private _handleKeyPress(ev: KeyboardEvent) {
    if (!this._geometry) {
      if (ev.altKey && this.core.state.features.get("active").length) {
        this.core.isolateFeatures(this._storedActive);
        this.core.state.features.set("active", []);
        this.core.render("points", []);
      } else if (ev.shiftKey && this._options.allowAppend) {
        if (this.core.state.features.get("active").length > 1) {
          this.core.state.features.set("active", []);
          this.core.isolateFeatures([]);
        } else {
          this.core.state.features.set("active", []);
          this.core.isolateFeatures(this._storedActive);
        }
        this.core.render("points", []);
      } else {
        this.core.state.features.set("active", this._storedActive.map(lib.array.unarray));
        this.core.render("points", lib.createPoints(this.core.features, this.core.state.features.get("active")));
        this.core.isolateFeatures(this._storedActive);
      }
    }

    this._event &&
      this._handleCanvasMouseMove({
        ...this._event,
        originalEvent: {
          ...this._event.originalEvent,
          shiftKey: ev.shiftKey,
          altKey: ev.altKey,
        },
      });
  }

  private _handleCanvasMouseMove(e: SourceEvent) {
    this._event = e;
    if (!this._geometry) {
      if (e.originalEvent.altKey) {
        const active = this._storedActive.map((n) => lib.array.unarray(n));
        const plane = e.planes.find((p) => active.includes(p.nesting[0]));
        this.core.setCursor(plane ? "crosshair" : "not-allowed");
        plane && this.core.state.features.set("hover", [plane.nesting]);
        this.core.state.points.set("hover", []);
        return;
      }

      if (e.originalEvent.shiftKey && this._options.allowAppend) {
        this.core.setCursor(this._storedActive.length ? "crosshair" : "not-allowed");
        return;
      }
    }

    this.core.state.features.set("hover", []);
    const isPoint = e.points.some((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    this.core.setCursor(isPoint ? "pointer" : "crosshair");
    this._ignoreCanvas = isPoint;
    if (isPoint) return;
    if (!this._geometry) return;
    this._render(e.position);
  }

  private _handleCanvasClick(e: SourceEvent) {
    if (this._ignoreCanvas) return;

    if (this._geometry) {
      this._geometry = this._isReversed ? [e.position, ...this._geometry] : [...this._geometry, e.position];
      this._activateFinishNodes(true);
      this._render();
      return;
    }

    if (e.originalEvent.altKey) {
      const active = this._storedActive.map((n) => lib.array.unarray(n));
      const plane = e.planes.find((p) => !active.length || active.includes(p.nesting[0]));
      if (!plane) return;
      this._feature = this.core.getFeature(plane.nesting[0]);
      if (!this._feature) return;

      this._types = ["Polygon"];
      this.core.state.features.set(
        "active",
        this._feature.type === "Polygon"
          ? [[...plane.nesting, this._feature.coordinates.length]]
          : [[...plane.nesting, this._feature.coordinates[plane.nesting[1]].length]],
      );
      this.core.isolateFeatures();
      this._geometry = [e.position];
      this._render();
      return;
    }

    if (e.originalEvent.shiftKey && this._options.allowAppend) {
      const active = this._storedActive.map((n) => lib.array.unarray(n));
      if (active.length !== 1) return;
      this._feature = this.core.getFeature(lib.array.unarray(active[0]));
      if (!this._feature) return;

      if (this._feature.type === "MultiPolygon" || this._feature.type === "Polygon") {
        this._types = ["Polygon"];
        this.core.state.features.set("active", [
          [...this._feature.nesting, this._feature.type === "Polygon" ? 1 : this._feature.coordinates.length, 0],
        ]);
      } else {
        this._types = ["LineString"];
        this.core.state.features.set("active", [
          [...this._feature.nesting, this._feature.type === "LineString" ? 1 : this._feature.coordinates.length],
        ]);
      }

      this._geometry = [e.position];
      this._render();
      return;
    }

    const count = this.core.features.length;
    this._geometry = [e.position];
    this.core.state.features.set("active", this._types.includes("LineString") ? [[count]] : [[count, 0]]);
    this._activateFinishNodes();
    this.core.isolateFeatures();
    this._render();
  }

  private _handlePointMouseEnter(e: SourceEvent) {
    let point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (!point) return;

    const _onMove = (ev: SourceEvent) => {
      if (ev.originalEvent.altKey) {
        point = undefined;
        return;
      }
      if (point && lib.array.equal(ev.points[0].nesting ?? [], point.nesting)) return;
      this.core.state.points.set("hover", [ev.points[0].nesting]);
    };

    const _onLeave = () => {
      this.core.state.points.set("hover", []);
      this.core.removeListener("mouseleave", "points", _onLeave);
      this.core.removeListener("mousemove", "points", _onMove);
    };

    this.core.addListener("mouseleave", "points", _onLeave);
    this.core.addListener("mousemove", "points", _onMove);

    if (e.originalEvent.altKey) {
      point = undefined;
      return;
    }

    this.core.state.points.set("hover", [point.nesting]);

    if (!this._geometry) return;
    this._render(point.coordinates);
  }

  private _handlePointMouseDown(e: SourceEvent) {
    const point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (!point) return;
    this.core.state.points.add("active", [point.nesting]);
    document.addEventListener("mouseup", () => this.core.state.points.remove("active", [point.nesting]), {
      once: true,
    });
  }

  private _handlePointClick(e: SourceEvent) {
    const point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (!point) return;
    if (this._geometry) {
      const feature = this._mutateFeature(this._getShapeGeometry(), point) as Feature;
      this.core.state.points.remove("hover", [point.nesting]);
      this._reset();
      this.core.features = [
        ...this.core.features.slice(0, feature.nesting[0]),
        feature,
        ...this.core.features.slice(feature.nesting[0] + 1),
      ];
    } else {
      this.core.state.points.remove("hover", [point.nesting]);
      this._geometry = [];
      this._feature = this.core.getFeature(point.nesting[0]);
      this.core.state.features.set("active", [point.nesting.slice(0, point.nesting.length - 1)]);
      this._isReversed = point.nesting[point.nesting.length - 1] === 0;
      this._render();
      this._activateFinishNodes();
    }
  }

  private _handleCanvasLeave() {
    this._event = undefined;
    if (!this._geometry) return;
    this._render();
  }

  get config() {
    return {
      types: this._types,
      isDrawing: Boolean(this._geometry),
    };
  }

  public delete(): boolean | void {
    if (this._geometry) {
      if (!this.core.getFeature(lib.array.unarray(this.core.state.features.get("active")[0])))
        this.core.state.features.set("active", this._storedActive);
      this._reset();
      this.core.features = this.core.features;
      return true;
    }
    return false;
  }

  private _reset() {
    this._storedActive = this.core.state.features.get("active");
    this._isReversed = false;
    this._geometry = undefined;
    this._feature = undefined;
  }

  public refresh() {
    if (this._geometry && !this._feature) {
      this.core.state.features.set(
        "active",
        this._types.includes("LineString") ? [[this.core.features.length]] : [[this.core.features.length, 0]],
      );
      this._render();
      this.core.isolateFeatures();
      return;
    }
    this._reset();
    this.core.state.features.set("active", this._storedActive.map(lib.array.unarray));
    this.core.isolateFeatures(this.core.state.features.get("active"));
    this._activateStartingNodes(this.core.features, this.core.state.features.get("active"));
    this.core.render("features", this.core.features);
    this.core.render("points", lib.createPoints(this.core.features, this.core.state.features.get("active")));
  }

  public enable(): void;
  public enable(type: DrawType | DrawType[]): void;
  public enable(options: Options & Record<string, any>): void;
  public enable(type: DrawType | DrawType[], options: Options & Record<string, any>): void;
  public enable(options: Options & Record<string, any>, type: DrawType | DrawType[]): void;
  public enable(...args: any[]): void {
    const options = args.find((arg) => typeof arg !== "string" && !Array.isArray(arg));
    this._types = args.reduce(
      (types, arg) => {
        if (typeof arg === "string" && ["LineString", "Polygon"].includes(arg)) {
          return [arg];
        }
        if (Array.isArray(arg)) {
          const res = arg.filter((item) => ["LineString", "Polygon"].includes(item));
          return res.length > 0 ? res : types;
        }
        return types;
      },
      ["LineString", "Polygon"],
    );
    const { allowAppend, ...props } = options || {};
    this._props = props;
    this._options = {
      allowAppend: allowAppend ?? true,
    };
    this._resetCursor = this.core.setCursor("default");
    this.refresh();

    this.core.addListener("mouseenter", "points", this._handlePointMouseEnter);
    this.core.addListener("mousedown", "points", this._handlePointMouseDown);
    this.core.addListener("click", "points", this._handlePointClick);
    this.core.addListener("mousemove", this._handleCanvasMouseMove);
    this.core.addListener("click", this._handleCanvasClick);
    this.core.addListener("mouseout", this._handleCanvasLeave);
    document.addEventListener("keydown", this._handleKeyPress);
    document.addEventListener("keyup", this._handleKeyPress);
  }

  public disable() {
    document.removeEventListener("keydown", this._handleKeyPress);
    document.removeEventListener("keyup", this._handleKeyPress);
    this.core.removeListener("mouseout", this._handleCanvasLeave);
    this.core.removeListener("mousemove", this._handleCanvasMouseMove);
    this.core.removeListener("click", this._handleCanvasClick);
    this.core.removeListener("mousedown", "points", this._handlePointMouseDown);
    this.core.removeListener("mouseenter", "points", this._handlePointMouseEnter);
    this.core.removeListener("click", "points", this._handlePointClick);
    this._resetCursor?.();
    this.core.state.features.set("active", this._storedActive);

    if (!this._geometry?.length) return;
    let _geometry = this._getShapeGeometry();
    this._geometry = undefined;
    if (Number(this._types.includes("LineString")) + _geometry.length < 3) return;
    const feature = this._mutateFeature(_geometry) as Feature;

    this.core.features = [
      ...this.core.features.slice(0, feature.nesting[0]),
      feature,
      ...this.core.features.slice(feature.nesting[0] + 1),
    ];
  }
}
