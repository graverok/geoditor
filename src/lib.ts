import { Feature, Polygon, Position, Point, LineString, MultiLineString, MultiPolygon, FeatureProps } from "./types";

const getPositions = (feature: Feature | undefined, indices: number[]): Position[] => {
  if (!feature) return [];
  switch (feature.type) {
    case "LineString":
      return Array.from(feature.coordinates);
    case "MultiLineString":
    case "Polygon":
      if (indices.length < 1) return [];
      return Array.from(feature.coordinates[indices[0]] ?? []);
    case "MultiPolygon":
      if (indices.length < 2) return [];
      return Array.from(feature.coordinates[indices[0]]?.[indices[1]] ?? []);
    default:
      return [];
  }
};

const traverseShape = (feature: Feature | undefined, callback: (positions: Position[], indices: number[]) => void) => {
  if (!feature) return [];
  switch (feature.type) {
    case "LineString":
      return callback(feature.coordinates, []);
    case "Polygon":
    case "MultiLineString":
      return feature.coordinates.forEach((positions, i) => callback(positions, [i]));
    case "MultiPolygon":
      return feature.coordinates.forEach((shapes, i) => shapes.forEach((positions, j) => callback(positions, [i, j])));
    default:
      return;
  }
};

const updateShape = (
  feature: Omit<Feature, "coordinates"> & { coordinates?: Feature["coordinates"] },
  indices: number[],
  positions: Position[],
): Feature => {
  if (!feature) return feature;
  switch (feature.type) {
    case "LineString":
      return { ...feature, coordinates: positions } as Feature<LineString>;
    case "MultiLineString":
    case "Polygon":
      if (indices.length < 1)
        return { ...feature, coordinates: feature?.coordinates || [] } as Feature<MultiLineString> | Feature<Polygon>;
      return {
        ...feature,
        coordinates: [
          ...(feature.coordinates || []).slice(0, indices[0]),
          positions,
          ...(feature.coordinates || []).slice(indices[0] + 1),
        ],
      } as Feature<MultiLineString> | Feature<Polygon>;
    case "MultiPolygon":
      if (indices.length < 2) return { ...feature, coordinates: feature?.coordinates || [] } as Feature<MultiPolygon>;
      return {
        ...feature,
        coordinates: [
          ...(feature.coordinates ?? []).slice(0, indices[0]),
          [
            ...(feature.coordinates?.[indices[0]] ?? []).slice(0, indices[1]),
            positions,
            ...(feature.coordinates?.[indices[0]] ?? []).slice(indices[1] + 1),
          ],
          ...(feature.coordinates ?? []).slice(indices[0] + 1),
        ],
      } as Feature<MultiPolygon>;

    default:
      return { ...feature, coordinates: feature?.coordinates || [] } as Feature;
  }
};

const createMiddlePoints = (features: Feature[]): Point<FeatureProps>[] => {
  return features.reduce((acc, feature) => {
    traverseShape(feature, (positions, indices) => {
      const startIndex = toPoints(positions, feature.type).length;
      positions.slice(1).forEach((position, index) => {
        acc.push({
          fid: feature.id,
          coordinates: math.normalize(math.average(position, positions[index])),
          indices: [...indices, startIndex + index],
          props: feature.props,
        });
      });
    });

    return acc;
  }, [] as Point<FeatureProps>[]);
};

const createPoints = (features: Feature[]): Point<FeatureProps>[] => {
  return features.reduce((acc, feature) => {
    traverseShape(feature, (positions, indices) => {
      toPoints(positions, feature.type).forEach((position, index) => {
        acc.push({
          fid: feature.id,
          coordinates: position,
          indices: [...indices, index],
          props: feature.props,
        });
      });
    });

    return acc;
  }, [] as Point<FeatureProps>[]);
};

const moveFeatures = (features: Feature[], ids: number[], start: Position, end: Position) => {
  return features.map((feature) => {
    if (!ids.includes(feature.id)) return feature;

    const mapper = (
      data: Feature["coordinates"] | Position,
      start: Position,
      end: Position,
    ): Feature["coordinates"] | Position => {
      if (!Array.isArray(data[0])) {
        const [lng, lat] = data as number[];

        return math.normalize([
          end[0] -
            ((start[0] - lng) * Math.cos((lat / 180) * Math.PI)) /
              Math.cos(((lat + end[1] - start[1]) / 180) * Math.PI),
          lat + end[1] - start[1],
        ]);
      }
      return (data as Feature["coordinates"]).map((item) => mapper(item, start, end)) as Feature["coordinates"];
    };

    return { ...feature, coordinates: mapper(feature.coordinates, start, end) } as Feature;
  });
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

const toPoints = (positions: Position[], type?: Feature["type"]) => {
  switch (type) {
    case "Polygon":
    case "MultiPolygon":
      return positions.slice(0, positions.length - 1);
    default:
      return positions;
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
  equal: (start: Position, end: Position) => {
    if (!start || !end) return false;
    return start[0] === end[0] && start[1] === end[1];
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
};

const isArrayEqual = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  return !a.some((x, i) => x !== b[i]);
};

const comparePoints = <T extends Omit<Point, "coordinates">>(prev: T[], next: T[]): [T[], T[]] => {
  return [
    prev.filter((item) => !next.some((point) => point.fid === item.fid && isArrayEqual(point.indices, item.indices))),
    next.filter((item) => !prev.some((point) => point.fid === item.fid && isArrayEqual(point.indices, item.indices))),
  ];
};

export {
  isArrayEqual,
  isPolygonLike,
  comparePoints,
  createPoints,
  createMiddlePoints,
  getPositions,
  updateShape,
  toPoints,
  toCoordinates,
  traverseShape,
  moveFeatures,
  math,
};
