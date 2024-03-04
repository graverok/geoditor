import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { LayerType, Point, Position, SourceEvent } from "../types";

export class EditTool extends AnyTool {
  private _isDragging = false;
  private _hovered: number | undefined;
  private _resetCursor!: (() => void) | undefined;
  // private _tid: number | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "edit";
    this._handleFeatureHover = this._handleFeatureHover.bind(this);
    this._handleFeatureDeselect = this._handleFeatureDeselect.bind(this);
    this._handleGeometryMouseDown = this._handleGeometryMouseDown.bind(this);
    this._handlePointHover = this._handlePointHover.bind(this);
    this._handlePointDrag = this._handlePointDrag.bind(this);
  }

  private _renderPoints() {
    if (this.core.selected.length === 1) {
      const points = lib.createPoints(this.core.getSelectedFeatures(), this.core.shapes);
      this.core.render("points", [
        ...points,
        ...lib.createMiddlePoints(this.core.getSelectedFeatures(), this.core.shapes),
      ]);
      this.core.selectedPoints = points;
    } else {
      this.core.selectedPoints = [];
      this.core.render("points", lib.createPoints(this.core.getSelectedFeatures()));
    }
  }

  private _setHovered(id?: number) {
    if (id === this._hovered) return;
    const prevId = this._hovered;
    this._hovered = id;
    // this._tid && clearTimeout(this._tid);

    // const _hover = () => {

    this.core.setState({ hovered: false }, "planes", prevId);
    this.core.setState({ hovered: false }, "lines", prevId);
    this.core.setState({ hovered: true }, "planes", this._hovered);
    this.core.setState({ hovered: true }, "lines", this._hovered);
    this.core.render("features", this.core.features);

    // };

    // if (!this._hovered || !prevId) return _hover();
    // this._tid = +setTimeout(_hover, 50);
  }

  private _handleFeatureHover() {
    if (this._isDragging) return;
    if (this.core.shapes.length) {
      const anyHovered = this.core.hovered?.points || this.core.hovered?.lines || this.core.hovered?.planes;
      this.core.setCursor(anyHovered && this.core.selected.includes(anyHovered) ? "pointer" : "default");
      this._setHovered(anyHovered && this.core.selected.includes(anyHovered) ? anyHovered : undefined);
      return;
    }
    this.core.setCursor(this.core.hovered ? "pointer" : "default");
    this._setHovered(this.core.hovered?.points || this.core.hovered?.lines || this.core.hovered?.planes);
  }

  private _handleFeatureDeselect() {
    if (this.core.shapes.length) {
      const anyHovered = this.core.hovered?.points || this.core.hovered?.lines || this.core.hovered?.planes;
      if (anyHovered && this.core.selected.includes(anyHovered)) return;
    } else if (this.core.hovered) return;

    this.core.selectedPoints = [];
    this.core.selected = [];
    this.core.shapes = [];
    this._handleFeatureHover();
    this._renderPoints();
  }

  private _handleGeometryMouseDown(e: SourceEvent) {
    if (!this.core.hovered) return;
    if (this.core.hovered.points && this.core.selected.length === 1) return;
    if (e.layer === "planes" && this.core.hovered.lines) return;

    const layer = e.layer as LayerType;
    const geometry = e[layer].find((g) => g.fid === this.core.hovered?.[layer]);
    let _release: undefined | (() => void);
    if (geometry) {
      if (!e.originalEvent.shiftKey) {
        if (this.core.selected.includes(geometry.fid) && this.core.selected.length === 1) {
          if (lib.isArrayEqual(this.core.shapes, geometry.indices)) {
            _release = () => {
              this.core.shapes = [];
            };
          }
          this.core.shapes = geometry.indices;
        } else {
          if (this.core.shapes.length) return;
          if (this.core.selected.includes(geometry.fid)) {
            _release = () => {
              this.core.selected = [geometry.fid];
            };
          } else {
            this.core.selected = [geometry.fid];
          }
          this.core.shapes = [];
        }
      } else {
        this.core.shapes = [];
        if (this.core.selected.includes(geometry.fid)) {
          _release = () => {
            this.core.selected = this.core.selected.filter((id) => id !== geometry.fid);
          };
        } else {
          this.core.selected = [...this.core.selected, geometry.fid];
        }
      }
    }

    this._isDragging = true;
    let isChanged = false;
    let features = this.core.features;

    const points = lib.createPoints(
      features.filter((item) => this.core.selected.includes(item.id)),
      this.core.shapes,
    );
    this.core.selectedPoints = [];
    this.core.render("points", points);
    if (this.core.shapes.length) this.core.selectedPoints = points;

    this.core.selected.forEach((id) => {
      this.core.setState({ active: true }, "lines", id);
      this.core.setState({ active: true }, "planes", id);
    });

    const _onMove = (ev: SourceEvent<MouseEvent>) => {
      if (!isChanged) {
        if (
          Math.abs(ev.originalEvent.pageX - e.originalEvent.pageX) <= 3 &&
          Math.abs(ev.originalEvent.pageY - e.originalEvent.pageY) <= 3
        )
          return;
        isChanged = true;
      }
      features = this.core.features.map((item) =>
        this.core.selected.includes(item.id)
          ? lib.traverseCoordinates(item, (positions, indices) =>
              lib.isArrayEqual(this.core.shapes, indices.slice(0, this.core.shapes.length))
                ? positions.map((pos) => lib.math.geodesic(pos, e.position, ev.position))
                : positions,
            )
          : item,
      );
      this.core.render("features", features);
      this.core.render(
        "points",
        lib.createPoints(
          features.filter((item) => this.core.selected.includes(item.id)),
          this.core.shapes,
        ),
      );
    };

    const _onFinish = () => {
      this.core.removeListener("mousemove", _onMove);
      this.core.selected.forEach((id) => {
        this.core.setState({ active: false }, "lines", id);
        this.core.setState({ active: false }, "planes", id);
      });
      this._isDragging = false;
      if (isChanged) {
        this.core.features = features;
      } else {
        _release?.();
        this.refresh();
      }
    };

    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });
  }

  private _handlePointHover(e: SourceEvent) {
    if (this.core.selected.length !== 1) return;
    let point = e.points[0];
    !this._isDragging && this.core.setState({ hovered: true }, "points", point.fid, point.indices);

    const _onMove = (ev: SourceEvent) => {
      if (this._isDragging) return;
      if (lib.isArrayEqual(ev.points[0].indices ?? [], point.indices)) return;
      this.core.setState({ hovered: false }, "points", point.fid, point.indices);
      point = ev.points[0];
      this.core.setState({ hovered: true }, "points", point.fid, point.indices);
    };

    const _onLeave = () => {
      !this._isDragging && this.core.setState({ hovered: false }, "points", point.fid, point.indices);
      this.core.removeListener("mouseleave", "points", _onLeave);
      this.core.removeListener("mousemove", "points", _onMove);
      document.removeEventListener("mouseup", _onMouseUp);
    };

    const _onMouseUp = () => {
      this.core.setState({ hovered: true }, "points", point.fid, point.indices);
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
      this.core.setState({ hovered: false }, "points", point.fid, point.indices);

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
      sibling && this.core.setState({ hovered: true, active: true }, "points", sibling.fid, sibling.indices);
    };

    const _onSiblingLeave = () => {
      sibling && this.core.setState({ hovered: false, active: false }, "points", sibling.fid, sibling.indices);
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
        this.core.setState({ active: false, hovered: false }, "points", point.fid, [
          ...point.indices.slice(0, pidx),
          before,
        ]);
      after >= 0 &&
        this.core.setState({ active: false, hovered: false }, "points", point.fid, [
          ...point.indices.slice(0, pidx),
          after,
        ]);

      this.core.setState({ active: false }, "points", point.fid, point.indices);

      if (isChanged) {
        if (sibling && sibling.indices[pidx] === before) {
          this.core.setState({ hovered: false }, "points", point.fid, point.indices);
          this.core.setState({ hovered: true }, "points", sibling.fid, sibling.indices);
        }

        this.core.features = [
          ...this.core.features.slice(0, point.fid - 1),
          lib.updateShape(feature, point.indices.slice(0, pidx), _updater(sibling ? undefined : nextPosition)),
          ...this.core.features.slice(point.fid),
        ];

        this.refresh();
      } else {
        this._renderPoints();
      }
      this._isDragging = false;
    };

    const before =
      point.indices[pidx] === 0 ? (lib.isPolygonLike(feature) ? points.length - 1 : -1) : point.indices[pidx] - 1;
    const after =
      point.indices[pidx] === points.length - 1 ? (lib.isPolygonLike(feature) ? 0 : -1) : point.indices[pidx] + 1;

    this.core.render("points", lib.createPoints([feature]));
    this.core.selectedPoints = [point];
    this.core.setState({ active: true, hovered: true }, "points", point.fid, point.indices);
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
    this._renderPoints();
  }

  public enable() {
    this._resetCursor = this.core.setCursor("default");
    this.core.addListener("mouseenter", "points", this._handlePointHover);
    this.core.addListener("mousemove", this._handleFeatureHover);
    this.core.addListener("click", this._handleFeatureDeselect);
    this.core.addListener("mousedown", "points", this._handlePointDrag);
    this.core.addListener("mousedown", "lines", this._handleGeometryMouseDown);
    this.core.addListener("mousedown", "planes", this._handleGeometryMouseDown);
    this._renderPoints();
  }

  public disable() {
    this.core.selectedPoints = [];
    this.core.removeListener("mousedown", "points", this._handlePointDrag);
    this.core.removeListener("mouseenter", "points", this._handlePointHover);
    this.core.removeListener("mousedown", "planes", this._handleGeometryMouseDown);
    this.core.removeListener("mousedown", "lines", this._handleGeometryMouseDown);
    this.core.removeListener("click", this._handleFeatureDeselect);
    this.core.removeListener("mousemove", this._handleFeatureHover);
    this._resetCursor?.();
  }
}
