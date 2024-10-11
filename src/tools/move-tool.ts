import { AnyTool } from "../core";
import * as lib from "../lib";
import { Feature, LayerType, Point, Position, SourceEvent } from "../types";

export class MoveTool extends AnyTool {
  private _state: { dragging: boolean } = { dragging: false };
  private _stored: { cursor?: () => void } = {};

  constructor() {
    super();
    this._handleFeatureHover = this._handleFeatureHover.bind(this);
    this._handleFeatureDeselect = this._handleFeatureDeselect.bind(this);
    this._handleGeometryMouseDown = this._handleGeometryMouseDown.bind(this);
    this._handlePointHover = this._handlePointHover.bind(this);
    this._handlePointDrag = this._handlePointDrag.bind(this);
    this._handleCanvasLeave = this._handleCanvasLeave.bind(this);
  }

  private _renderPoints() {
    const points = lib.createPoints(this.core.features, this.core.state.features.get("active")).filter(this.filter);
    if (this.core.state.features.get("active").some((n) => typeof n === "number")) {
      this.core.state.points.add(
        "disabled",
        points.map((p) => p.nesting),
      );
      this.core.render("points", points);
    } else {
      const middlePoints = createMiddlePoints(this.core.features, this.core.state.features.get("active")).filter(
        this.filter,
      );
      this.core.state.points.add(
        "disabled",
        middlePoints.map((p) => p.nesting),
      );
      this.core.state.points.remove(
        "disabled",
        points.map((p) => p.nesting),
      );
      this.core.render("points", [...points, ...middlePoints]);
    }
  }

  private _handleCanvasLeave() {
    this.core.state.features.set("hover", []);
  }

  private _handleFeatureHover(e: SourceEvent) {
    if (this._state.dragging) return;
    let shapes = [...e.points.filter(this.filter), ...e.lines.filter(this.filter), ...e.planes.filter(this.filter)].map(
      (f) => f.nesting,
    );

    if (this.core.state.features.get("active").every((n) => typeof n === "number")) {
      this.core.setCursor(shapes.length ? generateCursor("default", "pointer") : "default");
      this.core.state.features.set("hover", shapes.length ? [lib.array.plain(shapes[0])] : []);
      return;
    }

    shapes = shapes.filter((n) =>
      this.core.state.features.get("active").map(lib.array.plain).includes(lib.array.plain(n)),
    );

    if (shapes.length) {
      this.core.setCursor(generateCursor(e.points.length ? "point" : e.lines.length ? "line" : "polygon", "pointer"));
      this.core.state.features.set("hover", shapes.length ? [shapes[0]] : []);
    } else {
      this.core.setCursor("default");
      this.core.state.features.set("hover", []);
    }
  }

  private _handleFeatureDeselect(e: SourceEvent) {
    // Need testing?
    const indices = [...e.points, ...e.lines, ...e.planes].map((f) => f.nesting[0]);
    if (this.core.state.features.get("active").some((n) => typeof n === "number")) {
      if (indices.length) return;
    } else {
      if (lib.array.intersect(this.core.state.features.get("active").map(lib.array.plain), indices)) return;
    }

    this.core.state.features.set("active", []);
    this.core.isolateFeatures();
    this._renderPoints();
    this._handleFeatureHover(e);
  }

  private _handleGeometryMouseDown(e: SourceEvent) {
    if (
      e.points.filter(this.filter).length &&
      !this.core.state.features.get("active").some((n) => typeof n === "number")
    )
      return;
    if (e.layer === "planes" && e.lines.filter(this.filter).length) return;
    const geometry = e[e.layer as LayerType][0];
    if (!geometry) return;

    const state = handleSetActive(e.originalEvent.shiftKey, this.core.state.features.get("active"), geometry.nesting);
    if (!state) return;
    this.core.state.features.set("active", state.active);
    this._renderPoints();
    let features = this.core.features;
    this._state.dragging = true;
    let isChanged = false;

    const _onMove = (ev: SourceEvent) => {
      if (!isChanged) {
        if (
          Math.abs(ev.originalEvent.pageX - e.originalEvent.pageX) <= 3 &&
          Math.abs(ev.originalEvent.pageY - e.originalEvent.pageY) <= 3
        )
          return;
        isChanged = true;
      }
      features = this.core.features.map((item) => {
        const focused = this.core.state.features.get("active").filter((n) => lib.array.plain(n) === item.nesting[0]);
        if (!focused.length) return item;
        return lib.traverseCoordinates(item, (positions, indices) =>
          focused.some((n) => typeof n === "number" || lib.array.equal(n, indices.slice(0, n.length)))
            ? positions.map((pos) => lib.coordinates.geodesic(pos, e.position, ev.position))
            : positions,
        );
      });
      this.core.render("features", features);
      this.core.render(
        "points",
        lib.createPoints(features, this.core.state.features.get("active")).filter(this.filter),
      );
    };

    const _onFinish = () => {
      this.core.removeListener("mousemove", _onMove);
      this._state.dragging = false;
      if (isChanged) {
        this.core.features = features;
      } else {
        const released = state.release?.();
        if (released) {
          this.core.state.features.set("hover", released);
          this.core.state.features.set("active", released);
        }
        this.refresh();
      }
      this._handleFeatureHover(e);
    };

    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });
  }

  private _handlePointHover(e: SourceEvent) {
    if (this.core.state.features.get("active").some((n) => typeof n === "number")) return;
    let point = e.points.filter(this.filter)[0];
    if (!point) return;
    !this._state.dragging && this.core.state.points.set("hover", [point.nesting]);

    const _onMove = (ev: SourceEvent) => {
      if (this._state.dragging) return;
      if (lib.array.equal(ev.points[0].nesting ?? [], point.nesting)) return;
      point = ev.points[0];
      this.core.state.points.set("hover", [point.nesting]);
    };

    const _onLeave = () => {
      !this._state.dragging && this.core.state.points.set("hover", []);
      this.core.removeListener("mouseleave", "points", _onLeave);
      this.core.removeListener("mousemove", "points", _onMove);
    };

    this.core.addListener("mouseleave", "points", _onLeave);
    this.core.addListener("mousemove", "points", _onMove);
  }

  private _handlePointDrag(e: SourceEvent) {
    if (this.core.state.features.get("active").some((n) => typeof n === "number")) return;
    const point = e.points.filter(this.filter)[0];
    let feature = this.core.getFeatures([point?.nesting[0]])[0];
    if (!point || !feature) return;

    let sibling: Point | undefined;
    this._state.dragging = true;

    const pidx = point.nesting.length - 1;
    let positions = lib.toPositions(lib.getCoordinates(feature, point.nesting.slice(0, pidx)), feature.type);
    let isChanged = false;

    const _updater = (feature: Feature, next?: Position) =>
      lib.traverseCoordinates(feature, (coordinates, indices) =>
        lib.array.equal(point.nesting.slice(0, indices.length), indices)
          ? lib.toCoordinates(
              [
                ...positions.slice(0, point.nesting[pidx]),
                ...(next ? [next] : []),
                ...positions.slice(point.nesting[pidx] + 1),
              ],
              feature?.type,
            )
          : coordinates,
      );

    if (point.nesting[pidx] >= positions.length) {
      isChanged = true;

      point.nesting[pidx] = (point.nesting[pidx] % positions.length) + 1;

      positions = [
        ...positions.slice(0, point.nesting[pidx]),
        point.coordinates,
        ...positions.slice(point.nesting[pidx]),
      ];
      feature = lib.traverseCoordinates(feature, (coordinates, indices) =>
        lib.array.equal(point.nesting.slice(0, indices.length), indices)
          ? lib.toCoordinates(positions, feature?.type)
          : coordinates,
      );
    }

    const _onPointMove = (ev: SourceEvent) => {
      sibling = ev.points.find(
        (n) =>
          !this.core.state.points.get(n.nesting).includes("disabled") && !lib.array.equal(n.nesting, point.nesting),
      );
    };

    const _onPointLeave = () => {
      sibling = undefined;
    };

    const _onMove = (ev: SourceEvent) => {
      if (!feature) return;
      isChanged = true;
      feature = _updater(
        feature,
        lib.coordinates.normalize(
          sibling?.coordinates || lib.coordinates.move(point.coordinates, e.position, ev.position),
        ),
      );
      this.core.render("features", [
        ...this.core.features.slice(0, point.nesting[0]),
        feature,
        ...this.core.features.slice(point.nesting[0] + 1),
      ]);
      this.core.render(
        "points",
        lib.createPoints([feature], this.core.state.features.get("active")).filter(this.filter),
      );
    };

    const _onFinish = () => {
      this.core.removeListener("mousemove", _onMove);
      this.core.removeListener("mousemove", "points", _onPointMove);
      this.core.removeListener("mouseleave", "points", _onPointLeave);

      if (!feature) return;
      this.core.state.points.set("active", []);

      if (isChanged) {
        this.core.state.points.set("hover", [sibling?.nesting[pidx] === before ? sibling.nesting : point.nesting]);

        this.core.features = [
          ...this.core.features.slice(0, point.nesting[0]),
          sibling && lib.array.equal(sibling.nesting.slice(0, pidx), point.nesting.slice(0, pidx))
            ? _updater(feature)
            : feature,
          ...this.core.features.slice(point.nesting[0] + 1),
        ];
      }
      this._renderPoints();
      this._state.dragging = false;
      this._handleFeatureHover(e);
    };

    const isReducible = positions.length > 2 + Number(lib.isPolygonLike(feature));
    const before =
      isReducible && point.nesting[pidx] === 0
        ? lib.isPolygonLike(feature)
          ? positions.length - 1
          : -1
        : point.nesting[pidx] - 1;
    const after =
      isReducible && point.nesting[pidx] === positions.length - 1
        ? lib.isPolygonLike(feature)
          ? 0
          : -1
        : point.nesting[pidx] + 1;

    const points = lib.createPoints([feature], this.core.state.features.get("active"));
    this.core.state.points.add(
      "disabled",
      points.reduce((acc, p) => {
        if (before >= 0 && lib.array.equal(p.nesting, [...point.nesting.slice(0, pidx), before])) return acc;
        if (after >= 0 && lib.array.equal(p.nesting, [...point.nesting.slice(0, pidx), after])) return acc;
        return [...acc, p.nesting];
      }, [] as number[][]),
    );
    this.core.render("points", points);
    window.requestAnimationFrame(() => {
      this.core.state.points.set("hover", [point.nesting]);
      this.core.state.points.set("active", [point.nesting]);
    });

    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });

    this.core.addListener("mousemove", "points", _onPointMove);
    this.core.addListener("mouseleave", "points", _onPointLeave);
  }

  public refresh() {
    this.core.render("features", this.core.features);
    this.core.isolateFeatures();
    this._renderPoints();
  }

  public enable() {
    this._stored.cursor = this.core.setCursor("default");
    this.core.addListener("mouseout", this._handleCanvasLeave);
    this.core.addListener("mouseenter", "points", this._handlePointHover);
    this.core.addListener("mousemove", this._handleFeatureHover);
    this.core.addListener("click", this._handleFeatureDeselect);
    this.core.addListener("mousedown", "points", this._handlePointDrag);
    this.core.addListener("mousedown", "lines", this._handleGeometryMouseDown);
    this.core.addListener("mousedown", "planes", this._handleGeometryMouseDown);
    this.core.isolateFeatures();
    this._renderPoints();
  }

  public disable() {
    super.disable();
    this.core.removeListener("mousedown", "points", this._handlePointDrag);
    this.core.removeListener("mouseenter", "points", this._handlePointHover);
    this.core.removeListener("mousedown", "planes", this._handleGeometryMouseDown);
    this.core.removeListener("mousedown", "lines", this._handleGeometryMouseDown);
    this.core.removeListener("click", this._handleFeatureDeselect);
    this.core.removeListener("mousemove", this._handleFeatureHover);
    this.core.removeListener("mouseout", this._handleCanvasLeave);
    this._stored.cursor?.();
  }

  delete() {
    return;
  }
}

const createMiddlePoints = (features: Feature[], focused: (number | number[])[]): Point[] => {
  return focused.reduce((acc, nesting) => {
    const feature = features[lib.array.plain(nesting)];
    if (!feature) return acc;

    lib.traverseCoordinates(feature, (positions, indices) => {
      if (Array.isArray(nesting) && !lib.array.equal(indices.slice(0, nesting.length), nesting)) return;
      const startIndex = lib.toPositions(positions, feature.type).length;
      positions.slice(1).forEach((position, index) => {
        acc.push({
          type: "Point",
          coordinates: lib.coordinates.normalize(lib.coordinates.average(position, positions[index])),
          nesting: [...indices, startIndex + index],
          props: feature.props,
        });
      });
    });

    return acc;
  }, [] as Point[]);
};

export const handleSetActive = (
  shiftKey: boolean,
  active: (number | number[])[],
  nesting: number[],
): {
  active: (number | number[])[];
  release?: () => (number | number[])[];
} | void => {
  if (!shiftKey) {
    if (active.every((n) => typeof n === "number")) {
      /**
       * Case: current feature selected
       * Action: Release to select shape
       */
      if (active.length === 1 && active[0] === nesting[0])
        return {
          active: active,
          release: () => [nesting],
        };

      /**
       * Case: current multi-selection includes feature
       * Action: Release to feature single selection
       */
      if (active.includes(nesting[0]))
        return {
          active: active,
          release: () => [nesting[0]],
        };

      /**
       * Case: current feature is not selected
       * Action: Select current feature
       */
      return { active: [nesting[0]] };
    }

    /**
     * Case: Shape selection
     * Actions:
     *  - [1] Ignore if not current feature shape
     *  - [2] Select another shape
     *  - [3] Release to select shape from multi-selection
     *  - [4] Release to feature selection
     * */
    const _shapes = active.map(lib.array.array);
    if (!_shapes.some((n) => n[0] === nesting[0])) return; /* [1] */
    if (!_shapes.some((n) => lib.array.equal(n, nesting))) return { active: [nesting] }; /* [2] */
    if (_shapes.length > 1) return { active: active, release: () => [nesting] }; /* [3] */
    return { active: active, release: () => [nesting[0]] };
  }

  if (active.every((n) => typeof n === "number")) {
    /**
     * Case current feature is selected
     * Actions:
     *  - Unselect if multiple selection
     */
    if (active.includes(nesting[0])) {
      if (active.length === 1) return { active: active };
      return {
        active: active,
        release: () => active.filter((s) => s !== nesting[0]),
      };
    }

    /**
     * Case: current feature is not selected
     * Action: Multi-select with current feature
     */
    return { active: [...active, nesting[0]] };
  }

  /**
   * Case: Shape selection
   * Actions:
   *  - [1] Ignore if not current feature shape
   *  - [2] Add shape to multiple shape selection
   *  - [3] Release to remove shape from multiple selection
   *  - [4] Keep shape selection
   * */
  const _shapes = active.map(lib.array.array);
  if (!_shapes.some((n) => n[0] === nesting[0])) return; /* [1] */
  if (!_shapes.some((n) => lib.array.equal(n, nesting)))
    return {
      active: [...active.filter((n) => typeof n === "number" || !lib.array.equal(n, nesting, true)), nesting],
    }; /* [2] */
  if (_shapes.length > 1)
    return {
      active: active,
      release: () => active.filter((n) => !Array.isArray(n) || !lib.array.equal(n, nesting)),
    }; /* [3] */
  return { active: active }; /* [4] */
};

const generateCursor = (key: string, fallback: string) => {
  return `url(${lib.createCursor(
    {
      shape: `<path d="M10 8L13.6229 24.8856L17.3004 18.4261L24.6282 17.1796L10 8Z" fill="none" stroke="white" stroke-linejoin="round" stroke-width="1.2"/>`,
      contour: `<path fill-rule="evenodd" clip-rule="evenodd" d="M9.71322 7.59042C9.87786 7.47514 10.0955 7.46965 10.2658 7.57648L24.894 16.7561C25.0696 16.8663 25.159 17.0736 25.1186 17.277C25.0783 17.4804 24.9165 17.6378 24.7121 17.6725L17.6178 18.8793L14.0574 25.133C13.9548 25.3132 13.7516 25.4114 13.5466 25.3798C13.3417 25.3482 13.1775 25.1933 13.134 24.9905L9.51113 8.10489C9.46897 7.90837 9.54858 7.70571 9.71322 7.59042Z" fill="black" stroke="none"/>`,
      translate: { x: 2, y: -1 },
    },
    key,
  )}) 12 7, ${fallback}`;
};
