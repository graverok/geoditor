import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { DrawType, Feature, LineString, Point, Polygon, Position, SourceEvent } from "../types";

export class PenTool extends AnyTool {
  private _geometry: Position[] | undefined;
  private _feature: Feature | undefined;
  private _ignoreCanvas = false;
  private _isReversed = false;
  private _types: DrawType[] = [];
  private _resetCursor!: (() => void) | undefined;
  private _props: Record<string, any> | undefined;

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
  }

  private _activateFinishNodes(hover = false) {
    let _geometry = this._getShapeGeometry();
    /** Placeholder */
    if (Number(this._types.includes("LineString")) + _geometry.length < 3) return [];

    const _types: Feature["type"][] =
      this._feature && this._feature?.type !== "LineString" ? [this._feature.type] : this._types;
    const endings = [
      ...((_types.includes("Polygon") || _types.includes("MultiPolygon")) && _geometry.length >= 3
        ? [[...(this.core.state.features.get("active")[0] as number[]), this._isReversed ? _geometry.length - 1 : 0]]
        : []),
      [...(this.core.state.features.get("active")[0] as number[]), this._isReversed ? 0 : _geometry.length - 1],
    ];
    this.core.state.points.remove("disabled", endings);

    if (!hover) return;
    this._ignoreCanvas = true;
    this.core.state.points.set("hover", [endings[endings.length - 1]]);
    this.core.setCursor("pointer");
  }

  private _activateStartingNodes(features: Feature[], active: (number | number[])[]) {
    let points: number[][] = [];
    features.forEach((feature) => {
      if (!feature) return;
      if (lib.isPolygonLike(feature)) return;
      if (!active.map(lib.array.unarray).includes(lib.array.unarray(feature.nesting))) return;
      lib.traverseCoordinates(feature, (positions, indices) => {
        if (!active.map(lib.array.arrify).some((n) => lib.array.equal(n, indices, true))) return;
        points.push([...indices, 0]);
        points.push([...indices, positions.length - 1]);
      });
    });
    this.core.state.points.remove("disabled", points);
  }

  private _getShapeGeometry(next?: Position) {
    let shape = this._feature
      ? lib.toPositions(
          lib.getCoordinates(this._feature, this.core.state.features.get("active")[0] as number[]),
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
      this.core.state.features.get("active")[0] as number[],
      lib.toCoordinates(geometry, renderType),
    );
  }

  private _render(next?: Position) {
    let _geometry = this._getShapeGeometry(next);
    this.core.isolateFeatures();

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
    this.core.state.points.add(
      "disabled",
      points.map((p) => p.nesting),
    );
    this.core.render("points", points);
  }

  private _handleCanvasMouseMove(e: SourceEvent) {
    const isPoint = e.points.some((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    this.core.setCursor(
      isPoint
        ? "pointer"
        : !e.originalEvent.altKey ||
            e.planes.some((p) => lib.array.unarray(this.core.state.features.get("active")[0]) === p.nesting[0])
          ? "crosshair"
          : "default",
    );
    this._ignoreCanvas = isPoint;
    if (isPoint) return;
    if (!this._geometry) return;
    this._render(e.position);
  }

  private _handleCanvasClick(e: SourceEvent) {
    if (this._ignoreCanvas) return;

    if (this._geometry) {
      this._geometry = this._isReversed ? [e.position, ...this._geometry] : [...this._geometry, e.position];
      this._render();
      this._activateFinishNodes(true);
      return;
    }

    if (e.originalEvent.shiftKey || e.originalEvent.altKey) {
      if (this.core.state.features.get("active").length !== 1) return;
      this._feature = this.core.getFeature(lib.array.unarray(this.core.state.features.get("active")[0]));
      if (!this._feature) return;

      if (e.originalEvent.shiftKey) {
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
      }

      if (e.originalEvent.altKey) {
        if (!lib.isPolygonLike(this._feature)) return;
        const plane = e.planes.filter((p) => this._feature?.nesting[0] === p.nesting[0])[0];
        if (!plane) return;

        this._types = ["Polygon"];
        this.core.state.features.set(
          "active",
          this._feature.type === "Polygon"
            ? [[...plane.nesting, this._feature.coordinates.length]]
            : [[...plane.nesting, this._feature.coordinates[plane.nesting[1]].length]],
        );
      }

      this._geometry = [e.position];
      this._render();
      return;
    }

    this._feature = {
      type: this._types.includes("LineString") ? "LineString" : "Polygon",
      coordinates: [],
      props: this._props,
      nesting: [this.core.features.length],
    };
    const count = this.core.features.length;
    this._geometry = [e.position];
    this.core.state.features.set("active", this._types.includes("LineString") ? [[count]] : [[count, 0]]);
    this._render();
    this._activateFinishNodes();
  }

  private _handlePointMouseEnter(e: SourceEvent) {
    const point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (!point) return;

    this.core.state.points.set("hover", [point.nesting]);

    const _onMove = (ev: SourceEvent) => {
      if (lib.array.equal(ev.points[0].nesting ?? [], point.nesting)) return;
      this.core.state.points.set("hover", [ev.points[0].nesting]);
    };

    const _onLeave = () => {
      this.core.state.points.set("hover", []);
      this.core.removeListener("mouseleave", "points", _onLeave);
      this.core.removeListener("mousemove", "points", _onMove);
    };

    this.core.addListener("mouseleave", "points", _onLeave);
    this.core.addListener("mousemove", "points", _onMove);

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
      this._resetDraw();
      this._activateStartingNodes([feature], this.core.state.features.get("active"));
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
    if (!this._geometry) return;
    this._render();
  }

  get config() {
    return {
      types: this._types,
      isDrawing: Boolean(this._geometry),
    };
  }

  private _resetDraw() {
    this._isReversed = false;
    this._geometry = undefined;
    this.core.render("features", this.core.features);
    const points = lib.createPoints(this.core.features, this.core.state.features.get("active"));
    this.core.state.points.set(
      "disabled",
      points.map((p) => p.nesting),
    );
    this.core.render("points", points);
  }

  public refresh() {
    this.core.render("features", this.core.features);
    this.core.render("points", lib.createPoints(this.core.features, this.core.state.features.get("active")));
    if (!this.core.state.features.get("active").length && this._geometry) {
      this.core.state.features.set("active", [this.core.features.length + 1]);
    } else {
      if (this._geometry) {
        this._activateFinishNodes();
      } else {
        this._activateStartingNodes(this.core.features, this.core.state.features.get("active"));
      }
    }
    this._render();
  }

  public enable(props?: Record<string, any>): void;
  public enable(type?: DrawType | DrawType[], props?: Record<string, any>): void;
  public enable(...args: any[]): void {
    this._props = args.find((arg) => typeof arg !== "string" && !Array.isArray(arg));
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
    this._resetCursor = this.core.setCursor("default");

    this._resetDraw();
    this._activateStartingNodes(this.core.features, this.core.state.features.get("active"));

    this.core.addListener("mouseenter", "points", this._handlePointMouseEnter);
    this.core.addListener("mousedown", "points", this._handlePointMouseDown);
    this.core.addListener("click", "points", this._handlePointClick);
    this.core.addListener("mousemove", this._handleCanvasMouseMove);
    this.core.addListener("click", this._handleCanvasClick);
    this.core.addListener("mouseout", this._handleCanvasLeave);
  }

  public disable() {
    this.core.removeListener("mouseout", this._handleCanvasLeave);
    this.core.removeListener("mousemove", this._handleCanvasMouseMove);
    this.core.removeListener("click", this._handleCanvasClick);
    this.core.removeListener("mousedown", "points", this._handlePointMouseDown);
    this.core.removeListener("mouseenter", "points", this._handlePointMouseEnter);
    this.core.removeListener("click", "points", this._handlePointClick);
    this._resetCursor?.();

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
