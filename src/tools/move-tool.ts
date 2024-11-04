import { AnyTool } from "../core";
import * as lib from "../lib";
import { Feature, KeyModifier, LayerType, Point, Position, SourceEvent } from "../types";
import { array, getModifierKey } from "../lib";

export interface MoveToolConfig {
  modify: boolean | "dblclick" | "alt" | "meta" | "ctrl";
}

export class MoveTool extends AnyTool {
  declare config: MoveToolConfig;
  private _state: { dragging: boolean; modifiers: ("alt" | "meta" | "ctrl")[] } = { dragging: false, modifiers: [] };
  private _stored: { cursor?: () => void } = {};
  private _event: SourceEvent | null = null;

  constructor(config?: MoveToolConfig) {
    super({
      modify: config?.modify ?? true,
    });
    this.onCanvasClick = this.onCanvasClick.bind(this);
    this.onCanvasLeave = this.onCanvasLeave.bind(this);
    this.onFeatureHover = this.onFeatureHover.bind(this);
    this.onGeometryMouseDown = this.onGeometryMouseDown.bind(this);
    this.onGeometryDblClick = this.onGeometryDblClick.bind(this);
    this.onPointHover = this.onPointHover.bind(this);
    this.onPointDrag = this.onPointDrag.bind(this);
    this.onKeyPress = this.onKeyPress.bind(this);
  }

  get icon() {
    return `<g fill="none" transform="translate(-4 -4)">${iconShape}</g>`;
  }

  public refresh() {
    this.core.render("features", this.core.features);
    this.core.isolate();
    this._renderPoints();
  }

  public enable() {
    this._stored.cursor = this.core.setCursor("default");
    this.core.addListener("mouseout", this.onCanvasLeave);
    this.core.addListener("mouseenter", "points", this.onPointHover);
    this.core.addListener("mousemove", this.onFeatureHover);
    this.core.addListener("click", this.onCanvasClick);
    this.core.addListener("mousedown", "points", this.onPointDrag);
    this.core.addListener("mousedown", "lines", this.onGeometryMouseDown);
    this.core.addListener("mousedown", "planes", this.onGeometryMouseDown);
    this.core.addListener("dblclick", "lines", this.onGeometryDblClick);
    this.core.addListener("dblclick", "planes", this.onGeometryDblClick);
    document.addEventListener("keydown", this.onKeyPress);
    document.addEventListener("keyup", this.onKeyPress);
    this.core.isolate();
    this._renderPoints();
  }

  public disable() {
    super.disable();
    document.removeEventListener("keydown", this.onKeyPress);
    document.removeEventListener("keyup", this.onKeyPress);
    this.core.removeListener("mousedown", "points", this.onPointDrag);
    this.core.removeListener("mouseenter", "points", this.onPointHover);
    this.core.removeListener("mousedown", "planes", this.onGeometryMouseDown);
    this.core.removeListener("mousedown", "lines", this.onGeometryMouseDown);
    this.core.removeListener("dblclick", "planes", this.onGeometryDblClick);
    this.core.removeListener("dblclick", "lines", this.onGeometryDblClick);
    this.core.removeListener("click", this.onCanvasClick);
    this.core.removeListener("mousemove", this.onFeatureHover);
    this.core.removeListener("mouseout", this.onCanvasLeave);
    this._stored.cursor?.();
  }

  delete() {
    return;
  }

  protected cursor = (key: string, fallback: string) => {
    return `url(${lib.createCursor(
      `<g fill="none" stroke="#FFF">${iconShape}</g>`,
      `<g fill="#000" stroke="#000">${iconShape}</g>`,
      key,
      "#000",
      "-2.5 0",
    )}) 10 8, ${fallback}`;
  };

  protected onCanvasLeave() {
    this.core.state.features.set("hover", []);
  }

  protected onFeatureHover(e: SourceEvent) {
    if (this._state.dragging) return;
    this._event = e;
    const points = e.points.filter(this.filter);
    const lines = e.lines.filter(this.filter);
    const planes = e.planes.filter(this.filter);
    let shapes = [...points, ...lines, ...planes].map((f) => f.nesting);

    if (this.core.state.features.get("active").every((n) => typeof n === "number")) {
      this.core.setCursor(shapes.length ? this.cursor("default", "pointer") : "default");
      this.core.state.features.set("hover", shapes.length ? [lib.array.plain(shapes[0])] : []);
      return;
    }

    shapes = shapes.filter((n) =>
      this.core.state.features.get("active").map(lib.array.plain).includes(lib.array.plain(n)),
    );

    if (shapes.length) {
      this.core.setCursor(this.cursor(points.length ? "point" : lines.length ? "line" : "polygon", "pointer"));
      this.core.state.features.set("hover", shapes.length ? [shapes[0]] : []);
    } else {
      this.core.setCursor("default");
      this.core.state.features.set("hover", []);
    }
  }

  protected onCanvasClick(e: SourceEvent) {
    const indices = [...e.points, ...e.lines, ...e.planes].map((f) => f.nesting[0]);
    if (
      typeof this.config.modify === "string" &&
      ["meta", "alt", "ctrl"].includes(this.config.modify) &&
      e.originalEvent[getModifierKey(this.config.modify as KeyModifier)]
    )
      return;

    if (this.core.state.features.get("active").some((n) => typeof n === "number")) {
      if (indices.length) return;
    } else {
      if (lib.array.intersect(this.core.state.features.get("active").map(lib.array.plain), indices)) return;
    }

    this.core.state.features.set("active", []);
    this.core.isolate();
    this._renderPoints();
    this.onFeatureHover(e);
  }

  protected onGeometryMouseDown(e: SourceEvent) {
    if (
      e.points.filter(this.filter).length &&
      !this.core.state.features.get("active").some((n) => typeof n === "number")
    )
      return;
    if (e.layer === "planes" && e.lines.filter(this.filter).length) return;
    const geometry = e[e.layer as LayerType][0];
    if (!geometry) return;

    const current = {
      active: this.core.state.features.get("active"),
      hover: this.core.state.features.get("hover"),
    };

    const state = handleSetActive(
      e.originalEvent.shiftKey,
      this.core.state.features.get("active"),
      geometry.nesting,
      this.config.modify === true,
    );
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
            ? lib.shape.move(positions, e.position, ev.position)
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
        if (current.active.map(array.plain).includes(geometry.nesting[0]))
          this.core.state.features.set("active", current.active);
        this.core.state.features.set("hover", current.hover);
        this.core.features = features;
      } else {
        const released = state.release?.();
        if (released) {
          this.core.state.features.set("hover", released);
          this.core.state.features.set("active", released);
        }
        this.refresh();
      }
      this.onFeatureHover(e);
    };

    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });
  }

  protected onGeometryDblClick(e: SourceEvent) {
    if (this.config.modify !== "dblclick") return;

    if (
      e.points.filter(this.filter).length &&
      !this.core.state.features.get("active").some((n) => typeof n === "number")
    )
      return;
    if (e.layer === "planes" && e.lines.filter(this.filter).length) return;
    const geometry = e[e.layer as LayerType][0];
    if (!geometry) return;
    this.core.state.features.set("active", [[geometry.nesting[0]]]);
    this.refresh();
  }

  protected onKeyPress(e: Pick<KeyboardEvent, "metaKey" | "altKey" | "ctrlKey" | "shiftKey">) {
    if (typeof this.config.modify !== "string" || !["meta", "alt", "ctrl"].includes(this.config.modify)) return;

    if (!e[getModifierKey(this.config.modify as KeyModifier)]) {
      if (!this._state.dragging) {
        this.core.state.features.set("active", this.core.state.features.get("active").map(lib.array.plain));
        this.core.state.points.set("active", []);
        this.core.state.points.set("hover", []);
        this.refresh();
        this._event && this.onFeatureHover(this._event);

        return;
      }

      return;
    }

    this.core.state.features.set("active", this.core.state.features.get("active").map(lib.array.array));
    this.refresh();
    this._event && this.onFeatureHover(this._event);
  }

  protected onPointHover(e: SourceEvent) {
    if (this.core.state.features.get("active").some((n) => typeof n === "number")) return;
    let point = e.points.filter(this.filter)[0];
    if (!point) return;
    !this._state.dragging && this.core.state.points.set("hover", [point.nesting]);

    const _onMove = (ev: SourceEvent) => {
      if (this._state.dragging) return;
      if (lib.array.equal(ev.points[0].nesting ?? [], point.nesting)) return;
      point = ev.points.filter(this.filter)[0];
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

  protected onPointDrag(e: SourceEvent) {
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
        lib.point.normalize(sibling?.coordinates || lib.point.move(point.coordinates, e.position, ev.position)),
      );
      this.core.render("features", [
        ...this.core.features.slice(0, point.nesting[0]),
        feature,
        ...this.core.features.slice(point.nesting[0] + 1),
      ]);
      this.core.render("points", lib.createPoints([feature], this.core.state.features.get("active")));
    };

    const _onFinish = (ev: MouseEvent) => {
      this.core.removeListener("mousemove", _onMove);
      this.core.removeListener("mousemove", "points", _onPointMove);
      this.core.removeListener("mouseleave", "points", _onPointLeave);

      if (!feature) return;
      this.core.state.points.set("active", []);

      if (isChanged) {
        if (sibling && this.filter(sibling)) {
          this.core.state.points.set("hover", [sibling?.nesting[pidx] === before ? sibling.nesting : point.nesting]);
        }

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
      this.onKeyPress(ev);
      this.onFeatureHover(e);
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
    const [disabled, enabled] = points.reduce(
      (acc, p) => {
        if (
          (before >= 0 && lib.array.equal(p.nesting, [...point.nesting.slice(0, pidx), before])) ||
          (after >= 0 && lib.array.equal(p.nesting, [...point.nesting.slice(0, pidx), after]))
        )
          acc[1].push(p.nesting);
        else acc[0].push(p.nesting);

        return acc;
      },
      [[], []] as number[][][],
    );
    this.core.state.points.add("disabled", disabled);
    this.core.state.points.remove("disabled", enabled);
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

  private _renderPoints() {
    const points = lib.createPoints(this.core.features, this.core.state.features.get("active"));
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
        [...middlePoints, ...points].map((p) => p.nesting),
      );
      this.core.state.points.remove(
        "disabled",
        points.filter(this.filter).map((p) => p.nesting),
      );
      this.core.render("points", [...points, ...middlePoints]);
    }
  }
}

const iconShape = `<path d="M10 8L13.6229 24.8856L17.3004 18.4261L24.6282 17.1796L10 8Z" stroke-linejoin="round"/>`;

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
          coordinates: lib.point.normalize(lib.point.middle(position, positions[index])),
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
  allowIsolate = true,
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
      if (allowIsolate && active.length === 1 && active[0] === nesting[0])
        return {
          active: active,
          release: () => [nesting],
        };

      /**
       * Case: current multi-selection includes feature
       * Action: Release to feature single selection
       */
      if (active.includes(nesting[0])) {
        return {
          active: active,
          release: () => [nesting[0]],
        };
      }

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
    if (!_shapes.some((n) => lib.array.equal(n, nesting))) {
      return { active: [nesting] };
    } /* [2] */
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
