import { AnyTool } from "../core";
import { GeometryType, Feature, Point, Position, SourceEvent, KeyModifier, FilterHandler } from "../types";
import * as config from "../config";
import * as lib from "../lib";

export interface PenToolConfig {
  types: GeometryType[];
  create: boolean | "alt" | "shift" | "ctrl" | "meta";
  subtract: boolean | "alt" | "shift" | "ctrl" | "meta";
  append: boolean | "alt" | "shift" | "ctrl" | "meta";
  filter: FilterHandler;
}

export class PenTool extends AnyTool {
  declare config: PenToolConfig;
  protected _state: {
    modes: Record<string, boolean>;
    reversed: boolean;
    dragging?: boolean;
    geometry?: Position[];
    feature?: Feature;
    event?: SourceEvent;
    props?: Record<string, unknown>;
    nesting?: number[];
  } = {
    modes: {},
    reversed: false,
  };
  protected _stored: {
    cursor?: () => void;
    active: (number | number[])[];
  } = {
    active: [],
  };

  constructor(config?: Partial<Omit<PenToolConfig, "types"> & { types: GeometryType | GeometryType[] }>) {
    super({
      types: config?.types
        ? Array.isArray(config.types)
          ? config.types
          : [config.types]
        : ["LineString", "Polygon", "MultiLineString", "MultiPolygon"],
      create: config?.create ?? true,
      append: config?.append ?? true,
      subtract: config?.subtract ?? true,
      filter: config?.filter ?? (() => true),
    });
    this.onCanvasMouseMove = this.onCanvasMouseMove.bind(this);
    this.onCanvasMouseDown = this.onCanvasMouseDown.bind(this);
    this.onCanvasLeave = this.onCanvasLeave.bind(this);
    this.onPointMouseEnter = this.onPointMouseEnter.bind(this);
    this.onPointMouseDown = this.onPointMouseDown.bind(this);
    this.onKeyPress = this.onKeyPress.bind(this);
  }

  get icon() {
    return `<g fill="none" transform="translate(-4 -4)">${
      hasPolygon(this.config.types) && hasLineString(this.config.types)
        ? iconShape + iconCenter
        : hasPolygon(this.config.types)
          ? config.polygonShape
          : config.lineShapeBase + config.lineShapeFill
    }</g>`;
  }

  public start(props?: Record<string, unknown>) {
    if (!this.config.types.length) {
      this.core.isolate([]);
      this._stored.cursor = this.core.setCursor(this.cursor("disabled", "not-allowed"));
      this.core.render("points", []);
      return;
    }

    super.start();
    this._state.props = props ?? this._state.props;
    this._stored.active = this.core.state.features.get("active");
    this._isolate({});
  }

  public enable() {
    if (!this.disabled) return;
    super.enable();
    this._stored.cursor = this.core.setCursor(this.cursor("default", "crosshair"));
    this._state.event && this.onCanvasMouseMove(this._state.event);
    this.core.addListener("mousemove", this.onCanvasMouseMove);
    this.core.addListener("mouseenter", "points", this.onPointMouseEnter);
    this.core.addListener("mousedown", "points", this.onPointMouseDown);
    this.core.addListener("mousedown", this.onCanvasMouseDown);
    this.core.addListener("mouseout", this.onCanvasLeave);
    document.addEventListener("keydown", this.onKeyPress);
    document.addEventListener("keyup", this.onKeyPress);
  }

  public disable() {
    if (this._state.dragging) {
      this.disabled = true;
      return;
    }
    if (this.disabled) return;
    super.disable();
    this._stored.cursor?.();
    this._render();
    document.removeEventListener("keydown", this.onKeyPress);
    document.removeEventListener("keyup", this.onKeyPress);
    this.core.removeListener("mousemove", this.onCanvasMouseMove);
    this.core.removeListener("mouseout", this.onCanvasLeave);
    this.core.removeListener("mousedown", this.onCanvasMouseDown);
    this.core.removeListener("mousedown", "points", this.onPointMouseDown);
    this.core.removeListener("mouseenter", "points", this.onPointMouseEnter);
  }

  public finish() {
    this._save();
    this._state = { modes: {}, props: this._state.props, reversed: false };
    super.finish();
  }

  public delete(indices: number[]): boolean | void {
    if (!this._state.geometry) return;

    if (indices.map(lib.array.plain).includes(this.core.features.length)) {
      if (indices.length === 1) {
        this.core.state.features.set("active", this._stored.active);
        this._reset();
        this.core.features = this.core.features;
        return true;
      }

      this._reset();
      return;
    }

    if (this._state.feature) this._reset();
    return;
  }

  public refresh() {
    if (this._state.geometry) {
      const active = this.core.state.features.get("active");
      if (active.length && !active.map(lib.array.plain).includes(lib.array.plain(this._state.nesting ?? []))) {
        this._save(active);
        this._reset();
        this._isolate({});
        return;
      }

      // if (!this._state.feature) {
      //   this.core.isolate([this.core.features.length]);
      //   if (active.length && !active.map(lib.array.plain).includes(this.core.features.length))
      //     this.core.state.features.set("active", [this.core.features.length]);
      //
      //   return this._render();
      // }
    }

    this._reset();
    this._isolate({});
  }

  protected cursor(key: string, fallback: string) {
    return `url(${lib.createCursor(
      `<g fill="none" stroke="#000">${iconCenter}${iconShape}</g>`,
      `<g fill="#FFF" stroke="#FFF">${iconShape}</g>`,
      key,
    )}) 8 8, ${fallback}`;
  }

  protected onKeyPress(e: KeyboardEvent) {
    this._isolate(e);
  }

  protected onCanvasMouseMove(e: SourceEvent) {
    this._state.event = e;

    if (this._state.geometry) {
      const point = e.points
        .filter(this.config.filter)
        .find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
      if (point) {
        this._render(undefined, point);
        this.core.setCursor(
          this.cursor(
            this._getRenderType((point.nesting[point.nesting.length - 1] === 0) === this._state.reversed) ===
              "LineString"
              ? "line"
              : "polygon",
            "pointer",
          ),
        );
      } else {
        this.core.setCursor(this.cursor("default", "crosshair"));
      }

      !point && this._render(e.position);
      return;
    }

    this.core.state.features.set("hover", []);

    if (this._state.modes.extend) {
      const point = e.points
        .filter(this.config.filter)
        .find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
      if (point) {
        return this.core.setCursor(this.cursor("extend", "crosshair"));
      }
    }

    if (this._state.modes.subtract) {
      const disabled = this.core.state.features.get("disabled").map(lib.array.plain);
      const plane = e.planes.filter(this.config.filter).find((p) => !disabled.includes(p.nesting[0]));
      this.core.state.points.set("hover", []);
      if (plane) {
        this.core.state.features.set("hover", [plane.nesting]);
        return this.core.setCursor(this.cursor("minus", "crosshair"));
      }
    }

    if (this._state.modes.create) return this.core.setCursor(this.cursor("default", "crosshair"));
    if (this._state.modes.append) return this.core.setCursor(this.cursor("plus", "crosshair"));
    return this.core.setCursor(this.cursor("disabled", "not-allowed"));
  }

  protected onCanvasMouseDown(e: SourceEvent) {
    e.preventDefault();
    this._state.dragging = true;
    let event = e;

    const _onmousemove = (ev: SourceEvent) => {
      event = ev;
    };

    const _onmouseup = () => {
      e.preventDefault();
      this._state.dragging = false;
      this.core.removeListener("mousemove", _onmousemove);
      this._state.geometry ? this._addDrawPoint(event, this._state.geometry) : this._initDraw(e);
      if (this.disabled) {
        this.disabled = false;
        this.disable();
      }
    };
    this.core.addListener("mousemove", _onmousemove);
    document.addEventListener("mouseup", _onmouseup, { once: true });
  }

  protected onPointMouseEnter(e: SourceEvent) {
    const point = e.points
      .filter(this.config.filter)
      .find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (!point) return;

    const _onmousemove = (ev: SourceEvent) => {
      if (point && lib.array.equal(ev.points[0].nesting ?? [], point.nesting)) return;
      this.core.state.points.set("hover", [ev.points[0].nesting]);
    };

    const _onmouseleave = () => {
      this.core.state.points.set("hover", []);
      this.core.removeListener("mouseleave", "points", _onmouseleave);
      this.core.removeListener("mousemove", "points", _onmousemove);
    };

    this.core.addListener("mouseleave", "points", _onmouseleave);
    this.core.addListener("mousemove", "points", _onmousemove);
    this.core.state.points.set("hover", [point.nesting]);
  }

  protected onPointMouseDown(e: SourceEvent) {
    const point = e.points
      .filter(this.config.filter)
      .find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (!point) return;
    e.preventDefault();

    const _onmouseup = () => this.core.state.points.remove("active", [point.nesting]);
    this.core.state.points.add("active", [point.nesting]);
    document.addEventListener("mouseup", _onmouseup, { once: true });
  }

  protected onCanvasLeave() {
    this._state.event = undefined;
    if (!this._state.geometry) return;
    this._render();
  }

  private _initDraw(e: SourceEvent) {
    const point = e.points
      .filter(this.config.filter)
      .find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));

    if (point) {
      if (this._state.modes.extend) {
        this.core.state.points.remove("hover", [point.nesting]);
        this._state.geometry = [];
        this._state.feature = this.core.getFeatures([point.nesting[0]])[0];
        this._state.nesting = point.nesting.slice(0, point.nesting.length - 1);
        this.core.state.features.set("active", [this._state.nesting]);
        this._state.reversed = point.nesting[point.nesting.length - 1] === 0;
        this.core.isolate();
        this._render();
      }
      return;
    }

    const active = this.core.state.features.get("active").map(lib.array.plain);
    if (this._state.modes.subtract) {
      const plane = e.planes.filter(this.config.filter).find((p) => active.includes(p.nesting[0]));
      if (plane) {
        this._state.feature = this.core.getFeatures([plane.nesting[0]])[0];
        if (!this._state.feature) return;
        this._state.nesting =
          this._state.feature.type === "Polygon"
            ? [...plane.nesting, this._state.feature.coordinates.length]
            : [...plane.nesting, this._state.feature.coordinates[plane.nesting[1]].length];
        this.core.state.features.set("active", [this._state.nesting]);
        this._state.geometry = [e.position];
        this.core.isolate();
        this._render();
        return;
      }
    }

    if (this._state.modes.create) {
      const count = this.core.features.length;
      this._state.geometry = [e.position];
      this._state.nesting = hasLineString(this.config.types) ? [count] : [count, 0];
      this.core.state.features.set("active", [this._state.nesting]);
      this.core.isolate();
      this._render();
      return;
    }

    if (this._state.modes.append) {
      this._state.feature = this.core.getFeatures(this.core.state.features.get("active"))[0];
      if (!this._state.feature) return;

      if (lib.isPolygonLike(this._state.feature) && this.config.types.includes("MultiPolygon")) {
        this._state.nesting = [
          ...this._state.feature.nesting,
          this._state.feature.type === "Polygon" ? 1 : this._state.feature.coordinates.length,
          0,
        ];
        this.core.state.features.set("active", [this._state.nesting]);
      } else if (!lib.isPolygonLike(this._state.feature) && this.config.types.includes("MultiLineString")) {
        this._state.nesting = [
          ...this._state.feature.nesting,
          this._state.feature.type === "LineString" ? 1 : this._state.feature.coordinates.length,
        ];
        this._state.modes.extend = false;
        this.core.state.features.set("active", [this._state.nesting]);
      } else return;

      this._state.geometry = [e.position];
      this._render();
    }
  }

  private _addDrawPoint(e: SourceEvent, geometry: Position[]) {
    const point = e.points
      .filter(this.config.filter)
      .find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (point) return this._endDraw(point);

    /* Add draw point */
    this._state.geometry = this._state.reversed ? [e.position, ...geometry] : [...geometry, e.position];
    this._render();
    this.core.setCursor(this.cursor(this._getRenderType() === "LineString" ? "line" : "polygon", "pointer"));
    return;
  }

  private _endDraw(point: Point) {
    const feature = this._mutateFeature(this._getShapeGeometry(), point) as Feature;
    this.core.state.points.remove("hover", [point.nesting]);
    if (!this._stored.active.some((n) => Array.isArray(n)))
      this.core.state.features.set("active", this.core.state.features.get("active").map(lib.array.plain));
    this._reset();
    this.core.features = [
      ...this.core.features.slice(0, feature.nesting[0]),
      feature,
      ...this.core.features.slice(feature.nesting[0] + 1),
    ];
  }

  private _getShapeGeometry(next?: Position) {
    const shape = this._state.feature
      ? lib.toPositions(lib.getCoordinates(this._state.feature, this._state.nesting ?? []), this._state.feature.type)
      : [];
    return this._state.reversed
      ? [...(next ? [next] : []), ...(this._state.geometry || []), ...shape]
      : [...shape, ...(this._state.geometry || []), ...(next ? [next] : [])];
  }

  private _getRenderType(end = true, placeholder = false) {
    return !this._state.feature || (this._state.feature.type === "LineString" && this._state.modes.extend)
      ? placeholder ||
        !hasPolygon(this.config.types) ||
        ((hasLineString(this.config.types) || this._state.feature?.type === "LineString") && end)
        ? "LineString"
        : "Polygon"
      : this._state.feature.type;
  }

  private _mutateFeature(geometry: Position[], point?: Point) {
    if (!this._state.nesting) return;

    const placeholder = geometry.length < 3;
    const end = !point || (point.nesting[point.nesting.length - 1] === 0) === this._state.reversed;
    const renderType = this._getRenderType(end, placeholder);

    return lib.mutateFeature(
      this._state.feature
        ? ({
            ...this._state.feature,
            type: renderType,
          } as Feature)
        : ({ nesting: this._state.nesting, type: renderType, props: this._state.props } as Feature),
      lib.array.array(this._state.nesting),
      lib.toCoordinates(geometry, renderType),
      [...this.config.types, ...(this._state.feature ? [this._state.feature.type] : [])],
    );
  }

  private _reset() {
    this._stored.active = this.core.state.features.get("active");
    this.core.render("points", []);
    this._state.reversed = false;
    this._state.geometry = undefined;
    this._state.feature = undefined;
    this._state.nesting = undefined;
  }

  private _render(next?: Position, hover?: Point) {
    if (!this._state.geometry || !this._state.nesting) return;
    const _geometry = this._getShapeGeometry();
    const _next = next ? (this._state.reversed ? [next, ..._geometry] : [..._geometry, next]) : _geometry;
    const _props = this._state.feature ? this._state.feature.props : this._state.props;

    if (Number(this._getRenderType(true, false) === "LineString") + _geometry.length < 3) {
      this.core.state.points.set("disabled", [
        [...this._state.nesting, -1],
        [...this._state.nesting, 0],
        [...this._state.nesting, _geometry.length - 1],
      ]);
    } else {
      this.core.state.points.set("disabled", [
        [...this._state.nesting, -1],
        ...(this._getRenderType(false, _geometry.length < 3) === "LineString"
          ? [[...this._state.nesting, this._state.reversed ? _geometry.length - 1 : 0]]
          : []),
      ]);
    }

    if (Number(this._getRenderType(true, false) === "LineString") + _next.length < 3) {
      /** Placeholder line */
      const _feature = {
        nesting: this._state.nesting,
        type: "LineString",
        coordinates: _next,
        props: _props,
      } as Feature;
      this.core.render("features", [...this.core.features, _feature]);
    } else {
      this.core.render("features", [
        ...this.core.features.slice(0, this._state.nesting[0]),
        this._mutateFeature(_next, hover) as Feature,
        ...this.core.features.slice(this._state.nesting[0] + 1),
      ]);
    }

    this.core.render(
      "points",
      (
        [
          ...(next ? [{ type: "Point", nesting: [...this._state.nesting, -1], coordinates: next, props: _props }] : []),
          { type: "Point", nesting: [...this._state.nesting, 0], coordinates: _geometry[0], props: _props },
          {
            type: "Point",
            nesting: [...this._state.nesting, _geometry.length - 1],
            coordinates: _geometry[_geometry.length - 1],
            props: _props,
          },
        ] as Point[]
      ).filter(this.config.filter),
    );
  }

  private _isolate(state: { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) {
    if (this._state.geometry) return;
    const _features = this.core.getFeatures(this._stored.active);
    const isolated = _features.length > 0 && this._stored.active.every((n) => Array.isArray(n));
    this._state.modes = defineModes(this.config, state, _features, isolated);

    const _indices = this.core
      .getFeatures(this._stored.active)
      .filter(
        (f) =>
          f.type === "LineString" ||
          (f.type === "MultiLineString" && hasLineString(this.config.types)) ||
          (hasPolygon(this.config.types) && lib.isPolygonLike(f)),
      )
      .map((f) => f.nesting[0]);

    this.core.state.features.set(
      "active",
      this.core.state.features.get("active").filter((n) => _indices.includes(lib.array.plain(n))),
    );
    this.core.render("points", lib.createPoints(this.core.features, _indices).filter(this.config.filter));
    this.core.render("features", this.core.features);

    const points: Point[] = [];
    const active = this.core.state.features.get("active");

    this.core.features.forEach((feature) => {
      if (!feature) return;
      if (!active.map(lib.array.plain).includes(feature.nesting[0])) return;
      lib.traverseCoordinates(feature, (p, indices) => {
        if (!this._state.modes.extend || lib.isPolygonLike(feature)) return;
        points.push({ type: "Point", nesting: [...indices, 0], props: feature.props, coordinates: p[0] });
        points.push({
          type: "Point",
          nesting: [...indices, p.length - 1],
          props: feature.props,
          coordinates: p[p.length - 1],
        });
      });
    });
    this.core.state.points.remove(
      "disabled",
      points.map((p) => p.nesting),
    );
    this.core.state.points.set("active", []);
    this.core.render("points", points.filter(this.config.filter));

    this.core.isolate(_indices.map(lib.array.array));

    this._state.event &&
      this.onCanvasMouseMove({
        ...this._state.event,
        originalEvent: {
          ...this._state.event.originalEvent,
          shiftKey: state.shiftKey ?? false,
          altKey: state.altKey ?? false,
          ctrlKey: state.ctrlKey ?? false,
          metaKey: state.metaKey ?? false,
        },
      });
    return;
  }

  private _save(selected?: (number | number[])[]) {
    if (!this._state.nesting) return this.core.state.features.set("active", selected ?? this._stored.active);

    const _geometry = this._getShapeGeometry();
    this._state.geometry = undefined;

    if (Number(this._getRenderType(true, false) === "LineString") + _geometry.length < 3) {
      this.core.render("features", this.core.features);
      return this.core.state.features.set("active", selected ?? this._stored.active);
    }

    if (!selected && !this._stored.active.some((n) => Array.isArray(n)))
      this.core.state.features.set("active", this.core.state.features.get("active").map(lib.array.plain));

    this.core.features = [
      ...this.core.features.slice(0, this._state.nesting[0]),
      this._mutateFeature(_geometry, undefined) as Feature,
      ...this.core.features.slice(this._state.nesting[0] + 1),
    ];
  }
}

const iconShape = `<circle cx="15.5" cy="15.5" r="1.5" /><path d="M11.75 20C9.5 17.5 9.5 11.5 8 8C11.5 9.5 17.5 9.5 20 11.75C21.6377 13.2239 21.8802 15.8055 21.2345 17.8649C21.1122 18.2552 21.1897 18.6897 21.4789 18.9789L23.5 21L21 23.5L18.9789 21.4789C18.6897 21.1897 18.2552 21.1122 17.8649 21.2345C15.8055 21.8802 13.2239 21.6377 11.75 20Z" stroke-linejoin="round"/>`;
const iconCenter = `<path d="M8 8L14.375 14.375" stroke-linejoin="round"/>`;

export const defineModes = (
  config: PenToolConfig,
  state: { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
  features: Feature[],
  isolated: boolean,
) => {
  const modes = ["append", "subtract", "create"] as (keyof Pick<PenToolConfig, "append" | "subtract" | "create">)[];
  const matched = modes.filter((mode) => {
    if (!config[mode]) return false;
    if (typeof config[mode] === "string") return Boolean(state[lib.getModifierKey(config[mode] as KeyModifier)]);
    return !modes.filter(
      (m) =>
        m !== mode &&
        typeof config[m] === "string" &&
        state[lib.getModifierKey(config[m] as KeyModifier) as keyof typeof state],
    ).length;
  });

  return {
    subtract: !(
      !features.length ||
      !matched.includes("subtract") ||
      !hasPolygon(config.types) ||
      !features.some((f) => lib.isPolygonLike(f))
    ),
    extend: !(
      !features.length ||
      !matched.includes("append") ||
      !features.some((f) => (hasLineString(config.types) && !lib.isPolygonLike(f)) || f.type === "LineString")
    ),
    append: !(
      features.length !== 1 ||
      !matched.includes("append") ||
      !(isolated || !matched.includes("create")) ||
      !features.some(
        (f) =>
          (lib.isPolygonLike(f) && config.types.includes("MultiPolygon")) ||
          (!lib.isPolygonLike(f) && config.types.includes("MultiLineString")),
      )
    ),
    create: !(
      !matched.includes("create") || !(!isolated || (!matched.includes("append") && !matched.includes("subtract")))
    ),
  };
};

const hasLineString = (types: GeometryType | GeometryType[]) => {
  if (!Array.isArray(types)) return types === "LineString" || types === "MultiLineString";
  return types.includes("LineString") || types.includes("MultiLineString");
};

const hasPolygon = (types: GeometryType | GeometryType[]) => {
  if (!Array.isArray(types)) return types === "Polygon" || types === "MultiPolygon";
  return types.includes("Polygon") || types.includes("MultiPolygon");
};
