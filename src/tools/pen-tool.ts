import { AnyTool } from "../core";
import * as lib from "../lib";
import { DrawType, Feature, Point, Position, SourceEvent } from "../types";

export interface PenToolConfig {
  drawTypes: DrawType[];
  create: boolean | "altKey" | "shiftKey" | "ctrlKey" | "metaKey";
  subtract: boolean | "altKey" | "shiftKey" | "ctrlKey" | "metaKey";
  append: boolean | "altKey" | "shiftKey" | "ctrlKey" | "metaKey";
}

export class PenTool extends AnyTool {
  declare config: PenToolConfig;
  private _state: {
    modes: Record<string, boolean>;
    geometry?: Position[];
    feature?: Feature;
    reversed?: boolean;
    event?: SourceEvent;
    props?: Record<string, unknown>;
    nesting?: number[];
  } = {
    modes: {},
  };
  private _stored: {
    cursor?: () => void;
    active: (number | number[])[];
  } = {
    active: [],
  };

  constructor(config?: Partial<Omit<PenToolConfig, "drawTypes"> & { drawTypes: DrawType | DrawType[] }>) {
    super({
      drawTypes: config?.drawTypes
        ? Array.isArray(config.drawTypes)
          ? config.drawTypes
          : [config.drawTypes]
        : ["LineString", "Polygon", "MultiLineString", "MultiPolygon"],
      create: config?.create ?? true,
      append: config?.append ?? true,
      subtract: config?.subtract ?? true,
    });
    this._handleCanvasMouseMove = this._handleCanvasMouseMove.bind(this);
    this._handleCanvasClick = this._handleCanvasClick.bind(this);
    this._handlePointMouseEnter = this._handlePointMouseEnter.bind(this);
    this._handlePointMouseDown = this._handlePointMouseDown.bind(this);
    this._handleCanvasLeave = this._handleCanvasLeave.bind(this);
    this._handleKeyPress = this._handleKeyPress.bind(this);
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
    return !this._state.feature || (this._state.feature.type === "LineString" && !this._state.modes.append)
      ? placeholder || ((hasLineString(this.config.drawTypes) || this._state.feature?.type === "LineString") && end)
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
      [...this.config.drawTypes, ...(this._state.feature ? [this._state.feature.type] : [])],
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

    this.core.render("points", [
      ...(next ? [{ nesting: [...this._state.nesting, -1], coordinates: next, props: _props }] : []),
      { nesting: [...this._state.nesting, 0], coordinates: _geometry[0], props: _props },
      {
        nesting: [...this._state.nesting, _geometry.length - 1],
        coordinates: _geometry[_geometry.length - 1],
        props: _props,
      },
    ]);
  }

  private _handleKeyPress(ev: KeyboardEvent) {
    this._isolate(ev);
  }

  private _handleCanvasMouseMove(e: SourceEvent) {
    this._state.event = e;

    if (this._state.geometry) {
      const point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
      if (point) {
        this._render(undefined, point);
        this.core.setCursor(
          generateCursor(
            this._getRenderType((point.nesting[point.nesting.length - 1] === 0) === this._state.reversed) ===
              "LineString"
              ? "line"
              : "polygon",
            "pointer",
            this._state.props?.color?.toString(),
          ),
        );
      } else {
        this.core.setCursor(generateCursor("default", "crosshair", this._state.props?.color?.toString()));
      }

      !point && this._render(e.position);
      return;
    }

    this.core.state.features.set("hover", []);

    if (this._state.modes.extend) {
      const point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
      if (point) {
        return this.core.setCursor(generateCursor("extend", "crosshair", this._state.props?.color?.toString()));
      }
    }

    if (this._state.modes.subtract) {
      const disabled = this.core.state.features.get("disabled").map(lib.array.plain);
      const plane = e.planes.find((p) => !disabled.includes(p.nesting[0]));
      this.core.state.points.set("hover", []);
      if (plane) {
        this.core.state.features.set("hover", [plane.nesting]);
        return this.core.setCursor(generateCursor("minus", "crosshair", this._state.props?.color?.toString()));
      }
    }

    if (this._state.modes.create)
      return this.core.setCursor(generateCursor("default", "crosshair", this._state.props?.color?.toString()));
    if (this._state.modes.append)
      return this.core.setCursor(generateCursor("plus", "crosshair", this._state.props?.color?.toString()));
    return this.core.setCursor(generateCursor("disabled", "not-allowed", this._state.props?.color?.toString()));
  }

  private _handleCanvasClick(e: SourceEvent) {
    const point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));

    if (point) {
      if (this._state.geometry) {
        const feature = this._mutateFeature(this._getShapeGeometry(), point) as Feature;
        this.core.state.points.remove("hover", [point.nesting]);
        if (!this._stored.active.some((n) => Array.isArray(n))) {
          this.core.state.features.set("active", this.core.state.features.get("active").map(lib.array.plain));
        }
        this._reset();
        this.core.features = [
          ...this.core.features.slice(0, feature.nesting[0]),
          feature,
          ...this.core.features.slice(feature.nesting[0] + 1),
        ];

        return;
      }

      if (this._state.modes.extend) {
        this.core.state.points.remove("hover", [point.nesting]);
        this._state.geometry = [];
        this._state.feature = this.core.getFeatures([point.nesting[0]])[0];
        this._state.nesting = point.nesting.slice(0, point.nesting.length - 1);
        this.core.state.features.set("active", [this._state.nesting]);
        this._state.reversed = point.nesting[point.nesting.length - 1] === 0;
        this.core.isolateFeatures();
        this._render();
      }
      return;
    }

    if (this._state.geometry) {
      this._state.geometry = this._state.reversed
        ? [e.position, ...this._state.geometry]
        : [...this._state.geometry, e.position];
      this._render();
      this.core.setCursor(
        generateCursor(
          this._getRenderType() === "LineString" ? "line" : "polygon",
          "pointer",
          this._state.props?.color?.toString(),
        ),
      );
      return;
    }

    const active = this.core.state.features.get("active").map(lib.array.plain);
    if (this._state.modes.subtract) {
      const plane = e.planes.find((p) => active.includes(p.nesting[0]));
      if (plane) {
        this._state.feature = this.core.getFeatures([plane.nesting[0]])[0];
        if (!this._state.feature) return;

        this._state.nesting =
          this._state.feature.type === "Polygon"
            ? [...plane.nesting, this._state.feature.coordinates.length]
            : [...plane.nesting, this._state.feature.coordinates[plane.nesting[1]].length];
        this.core.state.features.set("active", [this._state.nesting]);
        this._state.geometry = [e.position];
        this.core.isolateFeatures();
        this._render();
        return;
      }
    }

    if (this._state.modes.create) {
      const count = this.core.features.length;
      this._state.geometry = [e.position];
      this._state.nesting = hasLineString(this.config.drawTypes) ? [count] : [count, 0];
      this.core.state.features.set("active", [this._state.nesting]);
      this.core.isolateFeatures();
      this._render();
      return;
    }

    if (this._state.modes.append) {
      this._state.feature = this.core.getFeatures(this.core.state.features.get("active"))[0];
      if (!this._state.feature) return;

      if (lib.isPolygonLike(this._state.feature) && this.config.drawTypes.includes("MultiPolygon")) {
        this._state.nesting = [
          ...this._state.feature.nesting,
          this._state.feature.type === "Polygon" ? 1 : this._state.feature.coordinates.length,
          0,
        ];
        this.core.state.features.set("active", [this._state.nesting]);
      } else if (!lib.isPolygonLike(this._state.feature) && this.config.drawTypes.includes("MultiLineString")) {
        this._state.nesting = [
          ...this._state.feature.nesting,
          this._state.feature.type === "LineString" ? 1 : this._state.feature.coordinates.length,
        ];
        this.core.state.features.set("active", [this._state.nesting]);
      } else return;

      this._state.geometry = [e.position];
      this._render();
    }
  }

  private _handlePointMouseEnter(e: SourceEvent) {
    const point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (!point) return;

    const _onMove = (ev: SourceEvent) => {
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
    this.core.state.points.set("hover", [point.nesting]);
  }

  private _handlePointMouseDown(e: SourceEvent) {
    const point = e.points.find((p) => !this.core.state.points.get(p.nesting).includes("disabled"));
    if (!point) return;
    this.core.state.points.add("active", [point.nesting]);
    document.addEventListener("mouseup", () => this.core.state.points.remove("active", [point.nesting]), {
      once: true,
    });
  }

  private _handleCanvasLeave() {
    this._state.event = undefined;
    if (!this._state.geometry) return;
    this._render();
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
          (f.type === "MultiLineString" && hasLineString(this.config.drawTypes)) ||
          (hasPolygon(this.config.drawTypes) && lib.isPolygonLike(f)),
      )
      .map((f) => f.nesting[0]);

    this.core.state.features.set(
      "active",
      this.core.state.features.get("active").filter((n) => _indices.includes(lib.array.plain(n))),
    );
    this.core.render("points", lib.createPoints(this.core.features, _indices));
    this.core.render("features", this.core.features);

    const points: Point[] = [];
    const active = this.core.state.features.get("active");

    this.core.features.forEach((feature) => {
      if (!feature) return;
      if (!active.map(lib.array.plain).includes(feature.nesting[0])) return;
      lib.traverseCoordinates(feature, (p, indices) => {
        if (!this._state.modes.extend || lib.isPolygonLike(feature)) return;
        points.push({ nesting: [...indices, 0], props: feature.props, coordinates: p[0] });
        points.push({ nesting: [...indices, p.length - 1], props: feature.props, coordinates: p[p.length - 1] });
      });
    });
    this.core.state.points.remove(
      "disabled",
      points.map((p) => p.nesting),
    );
    this.core.state.points.set("active", []);
    this.core.render("points", points);

    this.core.isolateFeatures(_indices.map(lib.array.array));

    this._state.event &&
      this._handleCanvasMouseMove({
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

  private _finish(selected?: (number | number[])[]) {
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

  public refresh() {
    if (this._state.geometry) {
      const active = this.core.state.features.get("active");
      if (active.length && !active.map(lib.array.plain).includes(lib.array.plain(this._state.nesting ?? []))) {
        this._finish(active);
        this._reset();
        this._isolate({});
        return;
      }

      if (!this._state.feature) {
        this.core.state.features.set("active", [this.core.features.length]);
        this.core.isolateFeatures([this.core.features.length]);

        return this._render();
      }
    }

    this._reset();
    this._isolate({});
  }

  public enable(props?: Record<string, unknown>) {
    if (!this.config.drawTypes.length) {
      this.core.isolateFeatures([]);
      this._stored.cursor = this.core.setCursor(
        generateCursor("disabled", "not-allowed", this._state.props?.color?.toString()),
      );
      this.core.render("points", []);
      return;
    }

    this._state.props = props;
    this._stored.cursor = this.core.setCursor(
      generateCursor("default", "crosshair", this._state.props?.color?.toString()),
    );
    this.refresh();

    this.core.addListener("mouseenter", "points", this._handlePointMouseEnter);
    this.core.addListener("mousedown", "points", this._handlePointMouseDown);
    this.core.addListener("mousemove", this._handleCanvasMouseMove);
    this.core.addListener("click", this._handleCanvasClick);
    this.core.addListener("mouseout", this._handleCanvasLeave);
    document.addEventListener("keydown", this._handleKeyPress);
    document.addEventListener("keyup", this._handleKeyPress);
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

  public disable() {
    document.removeEventListener("keydown", this._handleKeyPress);
    document.removeEventListener("keyup", this._handleKeyPress);
    this.core.removeListener("mouseout", this._handleCanvasLeave);
    this.core.removeListener("mousemove", this._handleCanvasMouseMove);
    this.core.removeListener("click", this._handleCanvasClick);
    this.core.removeListener("mousedown", "points", this._handlePointMouseDown);
    this.core.removeListener("mouseenter", "points", this._handlePointMouseEnter);
    this._stored.cursor?.();
    this._finish();
  }
}

export const defineModes = (
  config: PenToolConfig,
  state: { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
  features: Feature[],
  isolated: boolean,
) => {
  const modes = ["append", "subtract", "create"] as (keyof Pick<PenToolConfig, "append" | "subtract" | "create">)[];
  const matched = modes.filter((mode) => {
    if (!config[mode]) return false;
    if (typeof config[mode] === "string") return Boolean(state[config[mode] as keyof typeof state]);
    return !modes.filter((m) => m !== mode && typeof config[m] === "string" && state[config[m] as keyof typeof state])
      .length;
  });
  return {
    subtract: !(
      !features.length ||
      !matched.includes("subtract") ||
      !hasPolygon(config.drawTypes) ||
      !features.some((f) => lib.isPolygonLike(f))
    ),
    extend: !(
      !features.length ||
      !matched.includes("append") ||
      !features.some((f) => (hasLineString(config.drawTypes) && !lib.isPolygonLike(f)) || f.type === "LineString")
    ),
    append: !(
      features.length !== 1 ||
      !matched.includes("append") ||
      !(isolated || !matched.includes("create")) ||
      !features.some(
        (f) =>
          (lib.isPolygonLike(f) && config.drawTypes.includes("MultiPolygon")) ||
          (!lib.isPolygonLike(f) && config.drawTypes.includes("MultiLineString")),
      )
    ),
    create: !(
      !matched.includes("create") || !(!isolated || (!matched.includes("append") && !matched.includes("subtract")))
    ),
  };
};

const generateCursor = (key: string, fallback: string, color = "black") => {
  return `url(${lib.createCursor(
    {
      shape: `<path d="M8 8C9.5 11.5 9.5 17.5 11.75 20C13.2239 21.6377 15.8055 21.8802 17.8649 21.2345C18.2552 21.1122 18.6897 21.1897 18.9789 21.4789L21 23.5L23.5 21L21.4789 18.9789C21.1897 18.6897 21.1122 18.2552 21.2345 17.8649C21.8802 15.8055 21.6377 13.2239 20 11.75C17.5 9.5 11.5 9.5 8 8ZM8 8L14.375 14.375M14.375 14.375C14.1776 14.629 14 15.1534 14 15.5C14 16.3284 14.6716 17 15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C15.1534 14 14.629 14.1776 14.375 14.375Z" fill="none" stroke-linejoin="round" stroke="black"/>`,
      contour: `<path fill-rule="evenodd" clip-rule="evenodd" d="M7.64645 7.64645C7.79102 7.50188 8.00904 7.45989 8.19696 7.54043C9.55773 8.12362 11.3115 8.47165 13.1418 8.83487C13.5839 8.92261 14.0304 9.01122 14.477 9.10426C15.6066 9.3396 16.7269 9.60277 17.728 9.95397C18.7262 10.3041 19.6397 10.7531 20.3345 11.3783C22.1712 13.0314 22.3906 15.8488 21.7116 18.0145C21.6363 18.2546 21.694 18.4869 21.8325 18.6254L23.8536 20.6464C24.0488 20.8417 24.0488 21.1583 23.8536 21.3536L21.3536 23.8536C21.1583 24.0488 20.8417 24.0488 20.6464 23.8536L18.6254 21.8325C18.4869 21.694 18.2546 21.6363 18.0145 21.7116C15.8488 22.3906 13.0314 22.1712 11.3783 20.3345C10.7531 19.6397 10.3041 18.7262 9.95397 17.728C9.60277 16.7269 9.3396 15.6066 9.10426 14.477C9.01122 14.0304 8.92261 13.5839 8.83487 13.1418C8.47165 11.3115 8.12362 9.55773 7.54043 8.19696C7.45989 8.00904 7.50188 7.79102 7.64645 7.64645ZM14.7341 14.7341C14.6883 14.8085 14.6341 14.9225 14.5876 15.0616C14.5287 15.2373 14.5 15.3989 14.5 15.5C14.5 16.0523 14.9477 16.5 15.5 16.5C16.0523 16.5 16.5 16.0523 16.5 15.5C16.5 14.9477 16.0523 14.5 15.5 14.5C15.3989 14.5 15.2373 14.5287 15.0616 14.5876C14.9225 14.6341 14.8085 14.6883 14.7341 14.7341Z" />`,
    },
    key,
    color,
  )}) 8 8, ${fallback}`;
};

const hasLineString = (drawTypes: DrawType | DrawType[]) => {
  if (!Array.isArray(drawTypes)) return drawTypes === "LineString" || drawTypes === "MultiLineString";
  return drawTypes.includes("LineString") || drawTypes.includes("MultiLineString");
};

const hasPolygon = (drawTypes: DrawType | DrawType[]) => {
  if (!Array.isArray(drawTypes)) return drawTypes === "Polygon" || drawTypes === "MultiPolygon";
  return drawTypes.includes("Polygon") || drawTypes.includes("MultiPolygon");
};
