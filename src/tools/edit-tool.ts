import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { Point, Position, SourceEvent } from "../types";
import { isPolygonLike } from "../lib";

export class EditTool extends AnyTool {
  private _isDragging = false;
  private _hovered: number | undefined;
  private _resetCursor!: (() => void) | undefined;
  private _tid: number | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "edit";
    this._handleFeatureHover = this._handleFeatureHover.bind(this);
    this._handleFeatureDeselect = this._handleFeatureDeselect.bind(this);
    this._handleFeaturesDrag = this._handleFeaturesDrag.bind(this);
    this._handleFillMouseDown = this._handleFillMouseDown.bind(this);
    this._handleLineMouseDown = this._handleLineMouseDown.bind(this);
    this._handlePointHover = this._handlePointHover.bind(this);
    this._handlePointDrag = this._handlePointDrag.bind(this);
  }

  private _renderPlaceholderPoints() {
    const points = lib.createPoints(this.core.getSelectedFeatures());
    if (this.core.selected.length === 1) {
      this.core.render("points", [...points, ...lib.createMiddlePoints(this.core.getSelectedFeatures())]);
      this.core.selectedPoints = points;
    } else {
      this.core.render("points", points);
      this.core.selectedPoints = [];
    }
  }

  private _setHovered(id?: number) {
    if (id === this._hovered) return;
    const prevId = this._hovered;
    this._hovered = id;
    this._tid && clearTimeout(this._tid);
    this._tid = +setTimeout(() => {
      prevId && this.core.setFeatureState(prevId, { hovered: false });
      id && this.core.setFeatureState(id, { hovered: true });
      this.core.render("features", this.core.features);
    }, 50);
  }

  private _handleFeatureHover() {
    if (this._isDragging) return;
    this.core.setCursor(this.core.hovered ? "pointer" : "default");
    if (this.core.hovered?.points) return this._setHovered();
    this._setHovered(this.core.hovered?.lines || this.core.hovered?.planes);
  }

  private _handleFeatureDeselect() {
    if (this._hovered) return;
    this.core.selectedPoints = [];
    this.core.selected = [];
    this._renderPlaceholderPoints();
  }

  private _handleFeaturesDrag(e: SourceEvent) {
    if (!this._hovered) return;
    this._isDragging = true;
    let isChanged = false;

    const id = this._hovered;
    let nextPosition: Position = Array.from(e.position);
    this.core.setFeatureState(id, { active: true });
    const wasSelected = this.core.selected.includes(id);
    const isShiftPressed = e.originalEvent.shiftKey;
    if (!wasSelected) this.core.selected = [...(isShiftPressed ? this.core.selected : []), id];
    this.core.selectedPoints = [];
    this.core.render("points", lib.createPoints(this.core.getSelectedFeatures()));

    const _onMove = (ev: SourceEvent) => {
      isChanged = true;
      nextPosition = ev.position;
      const features = lib.moveFeatures(this.core.features, this.core.selected, e.position, nextPosition);
      this.core.render("features", features);
      this.core.render("points", lib.createPoints(features.filter((item) => this.core.selected.includes(item.id))));
    };

    const _onFinish = () => {
      this.core.removeListener("mousemove", _onMove);
      this.core.setFeatureState(id, { active: false });
      this._isDragging = false;
      if (isChanged) {
        this.core.features = lib.moveFeatures(this.core.features, this.core.selected, e.position, nextPosition);
      } else if (wasSelected) {
        this.core.selected =
          !isShiftPressed || this.core.selected.length <= 1 ? [id] : this.core.selected.filter((item) => item !== id);
      }
      this._renderPlaceholderPoints();
    };

    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });
  }

  private _handleFillMouseDown(e: SourceEvent) {
    if (!this._hovered) return;
    if (this.core.hovered?.points && this.core.selected.length === 1) return;
    if (this.core.hovered?.lines) return;
    if (!this.core.selected.includes(this._hovered)) return this._handleFeaturesDrag(e);
    if (e.originalEvent.shiftKey) return this._handleFeaturesDrag(e);
    if (this.core.selected.length > 1 && this.core.selected.includes(this._hovered)) return this._handleFeaturesDrag(e);
    console.log("geometry move");
  }

  private _handleLineMouseDown(e: SourceEvent) {
    if (!this._hovered) return;
    if (this.core.hovered?.points && this.core.selected.length === 1) return;
    if (!this.core.selected.includes(this._hovered)) return this._handleFeaturesDrag(e);
    if (e.originalEvent.shiftKey) return this._handleFeaturesDrag(e);
    if (this.core.selected.length > 1 && this.core.selected.includes(this._hovered)) return this._handleFeaturesDrag(e);
    console.log("geometry move");
  }

  private _handlePointHover(e: SourceEvent) {
    if (this.core.selected.length !== 1) return;
    let point = e.points[0];
    !this._isDragging && this.core.setPointState(point, { hovered: true });

    const _onMove = (ev: SourceEvent) => {
      if (this._isDragging) return;
      if (lib.isArrayEqual(ev.points[0].indices ?? [], point.indices)) return;
      this.core.setPointState(point, { hovered: false });
      point = ev.points[0];
      this.core.setPointState(point, { hovered: true });
    };

    const _onLeave = () => {
      !this._isDragging && this.core.setPointState(point, { hovered: false });
      this.core.removeListener("mouseleave", "points", _onLeave);
      this.core.removeListener("mousemove", "points", _onMove);
      document.removeEventListener("mouseup", _onMouseUp);
    };

    const _onMouseUp = () => {
      this.core.setPointState(point, { hovered: true });
    };

    this.core.addListener("mouseleave", "points", _onLeave);
    this.core.addListener("mousemove", "points", _onMove);
    this._isDragging && document.addEventListener("mouseup", _onMouseUp, { once: true });
  }

  private _handlePointDrag(e: SourceEvent) {
    if (this.core.selected.length !== 1) return;
    let point = e.points[0];
    let feature = this.core.getFeature(point?.fid);
    if (!point || !feature) return;

    this.core.selectedPoints = [];
    let nextPosition = point.coordinates;
    let sibling: Point | undefined;
    this.core.selected = [feature.id];
    this._isDragging = true;

    const pidx = point.indices.length - 1;
    let points = lib.toPoints(lib.getPositions(feature, point.indices), feature.type);
    let isChanged = false;

    const _updater = (next?: Position) =>
      lib.toCoordinates(
        [...points.slice(0, point.indices[pidx]), ...(next ? [next] : []), ...points.slice(point.indices[pidx] + 1)],
        feature?.type,
      );

    if (point.indices[pidx] >= points.length) {
      isChanged = true;
      this.core.setPointState(point, { hovered: false });
      point.indices[pidx] = (point.indices[pidx] % points.length) + 1;
      points = [...points.slice(0, point.indices[pidx]), point.coordinates, ...points.slice(point.indices[pidx])];
      feature = lib.updateShape(feature, point.indices.slice(0, pidx), lib.toCoordinates(points, feature.type));
    }

    const _onSiblingEnter = (ev: SourceEvent) => {
      sibling = ev.points.find(
        (n) =>
          [before, after].includes(n.indices[pidx]) &&
          lib.isArrayEqual(n.indices.slice(0, pidx), point.indices.slice(0, pidx)),
      );
      sibling && this.core.setPointState(sibling, { hovered: true, active: true });
    };

    const _onSiblingLeave = () => {
      sibling && this.core.setPointState(sibling, { hovered: false, active: false });
      sibling = undefined;
    };

    const _onMove = (ev: SourceEvent) => {
      if (!feature) return;
      isChanged = true;
      nextPosition = lib.math.normalize(
        sibling?.coordinates || lib.math.add(point.coordinates, lib.math.subtract(e.position, ev.position)),
      );
      feature = lib.updateShape(feature, point.indices.slice(0, pidx), _updater(nextPosition));
      this.core.render("features", [
        ...this.core.features.slice(0, point.fid - 1),
        feature,
        ...this.core.features.slice(point.fid),
      ]);
      this.core.render("points", lib.createPoints([feature]));
    };

    const _onFinish = () => {
      this.core.removeListener("mousemove", _onMove);
      this.core.removeListener("mousemove", "points", _onSiblingEnter);
      this.core.removeListener("mouseleave", "points", _onSiblingLeave);

      if (!feature) return;
      this.core.selectedPoints = [];

      before >= 0 &&
        this.core.setPointState(
          { fid: point.fid, indices: [...point.indices.slice(0, pidx), before] },
          { active: false, hovered: false },
        );
      after >= 0 &&
        this.core.setPointState(
          { fid: point.fid, indices: [...point.indices.slice(0, pidx), after] },
          { active: false, hovered: false },
        );
      this.core.setPointState(point, { active: false });

      if (isChanged) {
        if (sibling && sibling.indices[pidx] === before) {
          this.core.setPointState(point, { hovered: false });
          this.core.setPointState(sibling, { hovered: true });
        }

        this.core.features = [
          ...this.core.features.slice(0, point.fid - 1),
          lib.updateShape(feature, point.indices.slice(0, pidx), _updater(sibling ? undefined : nextPosition)),
          ...this.core.features.slice(point.fid),
        ];

        this.refresh();
      } else {
        this._renderPlaceholderPoints();
      }
      this._isDragging = false;
    };

    const before =
      point.indices[pidx] === 0 ? (isPolygonLike(feature) ? points.length - 1 : -1) : point.indices[pidx] - 1;
    const after =
      point.indices[pidx] === points.length - 1 ? (isPolygonLike(feature) ? 0 : -1) : point.indices[pidx] + 1;

    this.core.render("points", lib.createPoints([feature]));
    this.core.selectedPoints = [point];
    this.core.setPointState(point, { active: true, hovered: true });
    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });

    if (points.length <= 2 + Number(lib.isPolygonLike(feature))) return;
    this.core.selectedPoints = [
      ...this.core.selectedPoints,
      ...(before >= 0 ? [{ fid: point.fid, indices: [...point.indices.slice(0, pidx), before] }] : []),
      ...(after >= 0 ? [{ fid: point.fid, indices: [...point.indices.slice(0, pidx), after] }] : []),
    ];
    this.core.addListener("mousemove", "points", _onSiblingEnter);
    this.core.addListener("mouseleave", "points", _onSiblingLeave);
  }

  get config() {
    return;
  }

  public refresh() {
    this.core.selectedPoints = [];
    this.core.render("features", this.core.features);
    this._renderPlaceholderPoints();
  }

  public enable() {
    this._resetCursor = this.core.setCursor("default");
    this.core.addListener("mouseenter", "points", this._handlePointHover);
    this.core.addListener("mousemove", this._handleFeatureHover);
    this.core.addListener("click", this._handleFeatureDeselect);
    this.core.addListener("mousedown", "points", this._handlePointDrag);
    this.core.addListener("mousedown", "lines", this._handleLineMouseDown);
    this.core.addListener("mousedown", "planes", this._handleFillMouseDown);
    this._renderPlaceholderPoints();
  }

  public disable() {
    this.core.selectedPoints = [];
    this.core.removeListener("mousedown", "points", this._handlePointDrag);
    this.core.removeListener("mouseenter", "points", this._handlePointHover);
    this.core.removeListener("mousedown", "planes", this._handleFillMouseDown);
    this.core.removeListener("mousedown", "lines", this._handleLineMouseDown);
    this.core.removeListener("click", this._handleFeatureDeselect);
    this.core.removeListener("mousemove", this._handleFeatureHover);
    this._resetCursor?.();
  }
}
