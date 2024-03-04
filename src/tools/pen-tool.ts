import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { DrawType, Feature, LineString, Point, Polygon, Position, SourceEvent } from "../types";

export class PenTool extends AnyTool {
  private _geometry: Position[] | undefined;
  private _indices: number[] = [];
  private _ignoreMapEvents = false;
  private _isReversed = false;
  private _types: DrawType[] = [];
  private _resetCursor!: (() => void) | undefined;
  private _props: Record<string, any> | undefined;
  private _storedSelected: number[] | undefined;

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
    this._handleModifyKey = this._handleModifyKey.bind(this);
  }

  private _activateFinishNodes() {
    if (!this._geometry) {
      this.core.selectedPoints = [];
      return;
    }

    let _geometry = this._geometry;
    const feature = this._getFeature();

    if (feature) {
      let shape = lib.toPoints(lib.getPositions(feature, this._indices), feature.type);
      if (this._isReversed) shape.reverse();
      _geometry = [...shape, ...this._geometry];
    }

    /** New Feature */
    if (Number(this._types.includes("LineString")) + _geometry.length < 3) {
      this.core.selectedPoints = [];
      return;
    }

    const _types: Feature["type"][] = feature && feature?.type !== "LineString" ? [feature.type] : this._types;

    this.core.selectedPoints = [
      ...((_types.includes("Polygon") || _types.includes("MultiPolygon")) && _geometry.length >= 3
        ? [{ fid: this.core.selected[0], indices: [...this._indices, 0] }]
        : []),
      { fid: this.core.selected[0], indices: [...this._indices, _geometry.length - 1] },
    ];
  }

  private _activateStartingNodes(features: Feature[]) {
    let points: Omit<Point, "coordinates">[] = [];
    features.forEach((feature) => {
      if (!feature) return;
      if (feature.type !== "LineString" && feature.type !== "MultiLineString") return;
      lib.traverseShape(feature, (positions, indices) => {
        points.push({ fid: feature.id, indices: [...indices, 0] });
        points.push({ fid: feature.id, indices: [...indices, positions.length - 1] });
      });
    });
    this.core.selectedPoints = points;
  }

  private _getFeature() {
    let feature = this.core.getFeature(this.core.selected[0]);
    if (!feature) return;
    if (feature.type === "LineString" && this._indices.length === 1)
      return { ...feature, type: "MultiLineString", coordinates: [feature.coordinates] } as Feature;
    if (feature.type === "Polygon" && this._indices.length === 2)
      return { ...feature, type: "MultiPolygon", coordinates: [feature.coordinates] } as Feature;
    return feature;
  }

  private _getShapeGeometry(geometry: Position[], asRender = true) {
    let feature = this._getFeature();
    let shape = feature ? lib.toPoints(lib.getPositions(feature, this._indices), feature.type) : [];
    if (asRender) {
      if (this._isReversed) shape.reverse();
      return [...shape, ...geometry];
    } else {
      return this._isReversed ? [...geometry.reverse(), ...shape] : [...shape, ...geometry];
    }
  }

  private _getRenderFeature(feature: Feature | undefined, geometry: Position[], point?: Point) {
    const renderType: Feature["type"] =
      !feature || feature.type === "LineString"
        ? (this._types.includes("LineString") || geometry.length < 3) &&
          (!point || point.indices[point.indices.length - 1] !== 0)
          ? "LineString"
          : "Polygon"
        : feature.type;

    const _indices = renderType !== "LineString" && this._indices.length === 0 ? [0] : this._indices;
    return lib.updateShape(
      feature
        ? {
            ...feature,
            coordinates:
              feature.type === "LineString" && renderType !== "LineString"
                ? [feature.coordinates]
                : feature.coordinates,
            type: renderType,
          }
        : { id: this.core.selected[0], type: renderType, props: this._props },
      _indices,
      lib.toCoordinates(geometry, renderType),
    );
  }

  private _render(next?: Position) {
    if (!this.core.selected[0]) return;
    if (!this._geometry) return;
    let _geometry = this._getShapeGeometry([...this._geometry, ...(next ? [next] : [])]);
    let _feature = this._getFeature();

    /** Placeholder line */
    if (Number(this._types.includes("LineString")) + _geometry.length < 3) {
      _feature = {
        id: this.core.features.length + 1,
        type: "LineString",
        coordinates: _geometry,
        props: _feature ? _feature?.props : this._props,
      };
      this.core.render("features", [...this.core.features, _feature]);
      !next && this.core.render("points", lib.createPoints([_feature]));
      return;
    }

    _feature = this._getRenderFeature(_feature, _geometry);
    this.core.render("features", [
      ...this.core.features.slice(0, this.core.selected[0] - 1),
      _feature,
      ...this.core.features.slice(this.core.selected[0]),
    ]);
    !next && this.core.render("points", lib.createPoints([_feature]));
  }

  private _handleModifyKey(e: KeyboardEvent) {
    console.log(e.shiftKey);
  }

  private _handleCanvasMouseMove(e: SourceEvent) {
    if (!this.core.hovered?.points) this._ignoreMapEvents = false;
    this.core.setCursor(this.core.hovered?.points && this._ignoreMapEvents ? "pointer" : "crosshair");
    if (this._ignoreMapEvents) return;
    if (!this._geometry) return;

    this._render(e.position);
  }

  private _handleCanvasClick(e: SourceEvent) {
    if (this._ignoreMapEvents) return;

    if (this._geometry) {
      this.core.selectedPoints = [];
      this._geometry = [...this._geometry, e.position];
      this._render();
      this._activateFinishNodes();

      /** Hover current point */
      if (this.core.selectedPoints.length) {
        const _geometry = this._getShapeGeometry(this._geometry);
        this.core.setPointState(
          { fid: this.core.selected[0], indices: [...this._indices, _geometry.length - 1] },
          { hovered: true },
        );
        this.core.setCursor("pointer");
      }
      return;
    }

    if (e.originalEvent.shiftKey || e.originalEvent.altKey) {
      if (this.core.selected.length !== 1) return;
      const feature = this._getFeature();
      if (!feature) return;

      if (e.originalEvent.shiftKey) {
        if (feature.type === "MultiPolygon" || feature.type === "Polygon") {
          this._types = ["Polygon"];
          this._indices = [feature.type === "Polygon" ? 1 : feature.coordinates.length, 0];
        } else {
          this._types = ["LineString"];
          this._indices = [feature.type === "LineString" ? 1 : feature.coordinates.length];
        }
      }

      if (e.originalEvent.altKey) {
        // TODO: Add Multipolygon support
        if (feature.type !== "Polygon") return;
        this._types = ["Polygon"];
        this._indices = [feature.coordinates.length];
      }

      this._geometry = [e.position];
      this._render();
      this.core.setFeatureState(this.core.selected[0], { hovered: true });
      return;
    }

    const id = this.core.features.length + 1;
    this._geometry = [e.position];
    this._indices = this._types.includes("LineString") ? [] : [0];
    this.core.selectedPoints = [];
    this.core.selected = [id];
    this._storedSelected = undefined;
    this._render();
    this.core.setFeatureState(id, { hovered: true });
  }

  private _handlePointMouseEnter(e: SourceEvent) {
    const point = e.points.find((n) => this.core.isPointSelected(n));
    if (!point) return;
    this._ignoreMapEvents = true;

    const handleMouseLeave = () => {
      this._ignoreMapEvents = false;
      this.core.setPointState(point, { hovered: false });
      this.core.removeListener("mouseleave", "points", handleMouseLeave);
    };

    this.core.setPointState(point, { hovered: true });
    this.core.addListener("mouseleave", "points", handleMouseLeave);

    if (!this._geometry) return;
    this._render(point.coordinates);
  }

  private _handlePointMouseDown(e: SourceEvent) {
    const point = e.points.find((n) => this.core.isPointSelected(n));
    if (!point) return;
    this._ignoreMapEvents = true;
    this.core.setPointState(point, { active: true });
    document.addEventListener("mouseup", () => this.core.setPointState(point, { active: false }), { once: true });
  }

  private _handlePointClick(e: SourceEvent) {
    const point = e.points.find((n) => this.core.isPointSelected(n));
    if (!point) return;
    if (this._geometry) {
      this._ignoreMapEvents = true;

      const feature = this._getRenderFeature(this._getFeature(), this._getShapeGeometry(this._geometry, false), point);
      this.core.setPointState(point, { hovered: false });
      this._resetDraw();
      this._activateStartingNodes([feature]);
      this.core.features = [
        ...this.core.features.slice(0, this.core.selected[0] - 1),
        feature,
        ...this.core.features.slice(this.core.selected[0]),
      ];
    } else {
      this.core.setPointState(point, { hovered: false });
      this.core.selectedPoints = [];
      this.core.selected = [point.fid];
      this._storedSelected = undefined;
      this._geometry = [];
      this._indices = point.indices.slice(0, point.indices.length - 1);
      this._isReversed = point.indices[point.indices.length - 1] === 0;
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
    this._indices = [];
    this.core.selectedPoints = [];
    this.core.render("features", this.core.features);
    this.core.render("points", lib.createPoints(this.core.getSelectedFeatures()));
  }

  public refresh() {
    this.core.selectedPoints = [];
    this.core.render("features", this.core.features);
    this.core.render("points", lib.createPoints(this.core.getSelectedFeatures()));

    if (!this.core.selected.length && this._geometry) {
      this.core.selected = [this.core.features.length + 1];
    } else {
      this._activateStartingNodes(this.core.getSelectedFeatures());
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

    if (this.core.selected.length > 1) {
      this._storedSelected = this.core.selected;
      this.core.selected = [];
    }
    this._resetDraw();
    this._activateStartingNodes(this.core.getSelectedFeatures());

    this.core.addListener("mouseenter", "points", this._handlePointMouseEnter);
    this.core.addListener("mousedown", "points", this._handlePointMouseDown);
    this.core.addListener("click", "points", this._handlePointClick);
    this.core.addListener("mousemove", this._handleCanvasMouseMove);
    this.core.addListener("click", this._handleCanvasClick);
    this.core.addListener("mouseout", this._handleCanvasLeave);
    document.addEventListener("keydown", this._handleModifyKey);
    document.addEventListener("keyup", this._handleModifyKey);
  }

  public disable() {
    document.removeEventListener("keydown", this._handleModifyKey);
    document.removeEventListener("keyup", this._handleModifyKey);
    this.core.removeListener("mouseout", this._handleCanvasLeave);
    this.core.removeListener("mousemove", this._handleCanvasMouseMove);
    this.core.removeListener("click", this._handleCanvasClick);
    this.core.removeListener("mousedown", "points", this._handlePointMouseDown);
    this.core.removeListener("mouseenter", "points", this._handlePointMouseEnter);
    this.core.removeListener("click", "points", this._handlePointClick);
    this._resetCursor?.();
    if (this._storedSelected) {
      this.core.selected = this._storedSelected;
      this._storedSelected = undefined;
    }

    if (!this._geometry?.length) return;
    let _geometry = this._getShapeGeometry(this._geometry, false);
    if (Number(this._types.includes("LineString")) + _geometry.length < 3) return this._resetDraw();

    const feature = this._getRenderFeature(this._getFeature(), _geometry);

    this.core.features = [
      ...this.core.features.slice(0, this.core.selected[0] - 1),
      feature,
      ...this.core.features.slice(this.core.selected[0]),
    ];
  }
}
