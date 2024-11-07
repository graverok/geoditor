import { Feature, GeometryType, KeyModifier, Point, Position } from "./types";
import * as geojson from "geojson";
import * as config from "./config";

export const getModifierKey = (modifier: KeyModifier): "altKey" | "shiftKey" | "metaKey" | "ctrlKey" => {
  switch (modifier) {
    case "alt":
      return "altKey";
    case "shift":
      return "shiftKey";
    case "ctrl":
      return "ctrlKey";
    case "meta":
      return "metaKey";
  }
};

const getCoordinates = (feature: Feature | undefined, nesting: number[]): Position[] => {
  if (!feature) return [];
  if (feature.nesting[0] !== nesting[0]) return [];

  switch (feature.type) {
    case "LineString":
      if (nesting.length > 1 && nesting[1] > 0) return [];
      return Array.from(feature.coordinates);
    case "MultiLineString":
    case "Polygon":
      if (nesting.length < 1) return [];
      if (nesting.length > 2 && nesting[1] > 0) return [];
      return Array.from(feature.coordinates[nesting[1]] ?? []);
    case "MultiPolygon":
      if (nesting.length < 2) return [];
      return Array.from(feature.coordinates[nesting[1]]?.[nesting[2]] ?? []);
    default:
      return [];
  }
};

const traverseCoordinates = (
  feature: Feature,
  callback: (points: Position[], indices: number[]) => Position[] | void,
): Feature => {
  switch (feature.type) {
    case "LineString":
      return {
        ...feature,
        coordinates: callback(feature.coordinates, [...feature.nesting]) || feature.coordinates,
      };

    case "Polygon":
    case "MultiLineString":
      return {
        ...feature,
        coordinates: feature.coordinates.map(
          (positions, i) => callback(positions, [...feature.nesting, i]) || positions,
        ),
      };

    case "MultiPolygon":
      return {
        ...feature,
        coordinates: feature.coordinates.map((shapes, i) =>
          shapes.map((positions, j) => callback(positions, [...feature.nesting, i, j]) || positions),
        ),
      };
    default:
      return feature;
  }
};

const mutateFeature = (
  feature: Feature | undefined,
  nesting: number[],
  positions?: Position[] | ((current: Position[] | undefined) => Position[] | undefined),
  types: GeometryType[] = ["LineString", "MultiLineString", "Polygon", "MultiPolygon"],
): Feature | undefined => {
  if (!feature) return undefined;
  if (feature.nesting[0] !== nesting[0]) return feature;
  const shapes = nesting.slice(1);

  const parse = (current?: Position[]): Position[][] => {
    if (!positions) return [];
    if (typeof positions === "function") {
      const res = positions(current || []);
      return res?.length ? [res] : [];
    }
    return positions?.length ? [positions] : [];
  };

  const _mutateLineString = (f: Feature<geojson.LineString> | Feature<geojson.MultiLineString>, c: Position[][]) => {
    if (c.length === 0) return undefined;
    if (c.length === 1 && types.includes("LineString"))
      return { ...f, type: "LineString", coordinates: c[0] } as Feature<geojson.LineString>;
    return { ...f, type: "MultiLineString", coordinates: c } as Feature<geojson.MultiLineString>;
  };

  const _mutatePolygon = (f: Feature<geojson.Polygon> | Feature<geojson.MultiPolygon>, c: Position[][][]) => {
    const r = c.filter((i) => i.length);
    if (r.length === 0) return undefined;
    if (r.length === 1 && types.includes("Polygon"))
      return { ...f, type: "Polygon", coordinates: r[0] } as Feature<geojson.Polygon>;
    return { ...f, type: "MultiPolygon", coordinates: r } as Feature<geojson.MultiPolygon>;
  };

  switch (feature.type) {
    case "LineString":
      return _mutateLineString(
        feature,
        shapes.length
          ? [...(feature.coordinates?.length ? [feature.coordinates].slice(0, shapes[0]) : []), ...parse()]
          : parse(feature.coordinates),
      );
    case "MultiLineString":
      return _mutateLineString(
        feature,
        shapes.length
          ? [
              ...(feature.coordinates || []).slice(0, shapes[0]),
              ...parse(feature.coordinates[shapes[0]]),
              ...(feature.coordinates || []).slice(shapes[0] + 1),
            ]
          : parse(),
      );

    case "Polygon":
      return _mutatePolygon(
        feature,
        shapes.length > 1
          ? [...[[...(feature.coordinates || [])]].slice(0, shapes[0]), parse()]
          : shapes.length
            ? [
                [
                  ...(feature.coordinates || []).slice(0, shapes[0]),
                  ...parse(feature.coordinates?.[shapes[0]]),
                  ...(feature.coordinates || []).slice(shapes[0] + 1),
                ],
              ]
            : [parse()],
      );

    case "MultiPolygon":
      return _mutatePolygon(
        feature,
        shapes.length > 1
          ? [
              ...(feature.coordinates ?? []).slice(0, shapes[0]),
              [
                ...(feature.coordinates?.[shapes[0]] ?? []).slice(0, shapes[1]),
                ...parse(feature.coordinates?.[shapes[0]]?.[shapes[1]]),
                ...(feature.coordinates?.[shapes[0]] ?? []).slice(shapes[1] + 1),
              ],
              ...(feature.coordinates ?? []).slice(shapes[0] + 1),
            ]
          : shapes.length
            ? [
                ...(feature.coordinates ?? []).slice(0, shapes[0]),
                parse(),
                ...(feature.coordinates ?? []).slice(shapes[0] + 1),
              ]
            : [parse()],
      );

    default:
      return feature;
  }
};

const createPoints = (features: Feature[], active?: (number | number[])[]) => {
  if (!active)
    return features.reduce((acc, feature) => {
      traverseCoordinates(feature, (positions, indices) => {
        toPositions(positions, feature.type).forEach((position, index) => {
          acc.push({
            type: "Point",
            coordinates: position,
            nesting: [...indices, index],
            props: feature.props,
          });
        });
      });

      return acc;
    }, [] as Point[]);

  return active.reduce((acc, nesting) => {
    const feature = features.find((f) => (Array.isArray(nesting) ? nesting[0] : nesting) === f.nesting[0]);
    if (!feature) return acc;

    traverseCoordinates(feature, (positions, indices) => {
      if (Array.isArray(nesting) && !array.equal(indices.slice(0, nesting.length), nesting)) return;
      toPositions(positions, feature.type).forEach((position, index) => {
        acc.push({
          type: "Point",
          coordinates: position,
          nesting: [...indices, index],
          props: feature.props,
        });
      });
    });

    return acc;
  }, [] as Point[]);
};

const toCoordinates = (positions: Position[], type?: Feature["type"]) => {
  switch (type) {
    case "Polygon":
    case "MultiPolygon":
      return [...positions, positions[0]];
    default:
      return positions;
  }
};

const toPositions = (coordinates: Position[], type?: Feature["type"]) => {
  switch (type) {
    case "Polygon":
    case "MultiPolygon":
      return coordinates.slice(0, coordinates.length - 1);
    default:
      return coordinates;
  }
};

const isPolygonLike = (feature: Feature) => {
  return feature.type === "Polygon" || feature.type === "MultiPolygon";
};

const rad = (degree: number) => (degree / 180) * Math.PI;
const degree = (rad: number) => (rad / Math.PI) * 180;

const geo = {
  rad,
  degree,
  cos: (degree: number) => Math.cos(rad(degree)),
  sin: (degree: number) => Math.sin(rad(degree)),
  delta: (start: Position, end: Position) => {
    const l =
      Math.pow(geo.sin((end[1] - start[1]) / 2), 2) +
      Math.pow(geo.sin((end[0] - start[0]) / 2), 2) * geo.cos(start[1]) * geo.cos(end[1]);
    return Math.atan2(Math.sqrt(l), Math.sqrt(1 - l)) * 2;
  },
  bearing: (start: Position, end: Position) => {
    return degree(
      Math.atan2(
        geo.sin(end[0] - start[0]) * geo.cos(end[1]),
        geo.cos(start[1]) * geo.sin(end[1]) - geo.sin(start[1]) * geo.cos(end[1]) * geo.cos(end[0] - start[0]),
      ),
    );
  },
};

const point = {
  move: (position: Position, from: Position, to: Position) => {
    return [position[0] + to[0] - from[0], position[1] + to[1] - from[1]];
  },
  middle: (start: Position, end: Position) => {
    if (!start || !end) return start || end;
    return [start[0] / 2 + end[0] / 2, start[1] / 2 + end[1] / 2];
  },
  closest: (position: Position, check: Position): number => {
    if (!position || !check) return -1;
    return geo.delta(position, check);
  },
  normalize: (position: Position): Position => {
    let [lng, lat] = position;
    if (lat > 90) lat = 180 - lat;
    if (lat < -90) lat = -180 - lat;
    return [lng, lat];
  },
};

const shape = {
  move: (positions: Position[], from: Position, to: Position) =>
    positions.map((position) =>
      point.normalize([
        to[0] -
          ((from[0] - position[0]) * Math.cos(geo.rad(position[1]))) / Math.cos(geo.rad(position[1] + to[1] - from[1])),
        position[1] + to[1] - from[1],
      ]),
    ),
};

const array = {
  equal: <T extends string | number | boolean>(a: T | (T | T[])[], b: T | (T | T[])[], partial = false): boolean => {
    if (typeof a !== "object" || typeof b !== "object") return a === b;
    if (a.length !== b.length && !partial) return false;
    return partial && a.length > b.length
      ? !b.some((x, i) => !array.equal(x, a[i], partial))
      : !a.some((x, i) => !array.equal(x, b[i], partial));
  },
  intersect: <T extends string | number | boolean>(a: T[], b: T[]): boolean => {
    return a.some((x) => b.includes(x));
  },
  plain: <T extends string | number | boolean>(a: T | T[]): T => {
    return Array.isArray(a) ? array.plain(a[0]) : a;
  },
  array: <T extends string | number | boolean>(a: T | T[]): T[] => {
    return Array.isArray(a) ? a : [a];
  },
};

export {
  isPolygonLike,
  createPoints,
  getCoordinates,
  toPositions,
  toCoordinates,
  traverseCoordinates,
  mutateFeature,
  point,
  shape,
  array,
  geo,
};

const makeSvg = (content: string, size: number, color = "currentColor") =>
  `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="${color}" stroke="${color}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

export const createCursor = (shape: string, shadow: string, key: string, color = "black", translate?: string) => {
  const append = config.appendSvg[key as keyof config.AppendSvg];
  const svg = makeSvg(
    `${
      config.filterSvg
    }<g stroke-width="1.2"><g stroke-width="1.1" style="filter:url(#dropshadow)">${shadow}</g>${shape}</g>${
      append
        ? `<g stroke-width="1">${config.transform(
            `<g stroke-width="0.9" style="filter:url(#dropshadow)">${append[1]}</g>${append[0]}`,
            translate,
          )}</g>`
        : ""
    }`,
    32,
    color,
  );

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const createIcon = (content: string, strokeWidth = 1, color?: string) => {
  if (!content) return null;

  const svg = makeSvg(`<g stroke-width="${strokeWidth}">${content}</g>`, 24, color);
  return {
    toHTML: () => svg,
    toBase64: () => `data:image/svg+xml;base64,${btoa(svg)}`,
  };
};
