import { Feature, Polygon, Position, Point, LineString, MultiLineString, MultiPolygon } from "./types";

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

  const _mutateLineString = (f: Feature<LineString> | Feature<MultiLineString>, c: Position[][]) => {
    switch (c.length) {
      case 0:
        return undefined;
      case 1:
        return { ...f, type: "LineString", coordinates: c[0] } as Feature<LineString>;
      default:
        return { ...f, type: "MultiLineString", coordinates: c } as Feature<MultiLineString>;
    }
  };

  const _mutatePolygon = (f: Feature<Polygon> | Feature<MultiPolygon>, c: Position[][][]) => {
    const r = c.filter((i) => i.length);
    switch (r.length) {
      case 0:
        return undefined;
      case 1:
        return { ...f, type: "Polygon", coordinates: r[0] } as Feature<Polygon>;
      default: {
        return { ...f, type: "MultiPolygon", coordinates: r } as Feature<MultiPolygon>;
      }
    }
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
                  ...parse(feature.coordinates[shapes[0]]),
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

const math = {
  subtract: (start: Position, end: Position) => {
    if (!start || !end) return start || end;
    return [end[0] - start[0], end[1] - start[1]] as Position;
  },
  add: (start: Position, end: Position) => {
    if (!start || !end) return start || end;
    return [end[0] + start[0], end[1] + start[1]] as Position;
  },
  average: (start: Position, end: Position) => {
    if (!start || !end) return start || end;
    return [(start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5];
  },

  distance: (start: Position, end: Position): number => {
    if (!start || !end) return -1;
    return Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
  },
  normalize: (position: Position): Position => {
    let [lng, lat] = position;
    if (lat > 90) lat = 180 - lat;
    if (lat < -90) lat = -180 - lat;
    return [lng, lat];
  },
  geodesic: (position: Position, from: Position, to: Position) =>
    math.normalize([
      to[0] -
        ((from[0] - position[0]) * Math.cos((position[1] / 180) * Math.PI)) /
          Math.cos(((position[1] + to[1] - from[1]) / 180) * Math.PI),
      position[1] + to[1] - from[1],
    ]),
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
  unarray: <T extends string | number | boolean>(a: T | T[]): T => {
    return Array.isArray(a) ? array.unarray(a[0]) : a;
  },
  arrify: <T extends string | number | boolean>(a: T | T[]): T[] => {
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
  math,
  array,
};
