import { Feature, Polygon, Position, Node } from "./types";
type MultiPosition = Position | MultiPosition[];

const getPoints = (feature: Feature | undefined): MultiPosition[] => {
  if (!feature) return [];

  switch (feature.type) {
    case "MultiPolygon":
      return feature.coordinates.map((g) => g.map((c) => c.slice(0, c.length - 1)));
    case "Polygon":
      return feature.coordinates.map((c) => c.slice(0, c.length - 1));
    default:
      return feature.coordinates;
  }
};

const getGeometry = (indices: number[], points: MultiPosition[]) => {
  let _indices = Array.from(indices);
  let _points: MultiPosition[] = Array.from(points);
  while (_indices.length > 0 && Array.isArray(_points[0])) {
    _points = _points[_indices[0]] as MultiPosition[];
    _indices = [..._indices.slice(1)];
  }
  return _points as Position[];
};

const updateFeature = (
  feature: Feature,
  indices: number[],
  updater: (positions: Position[]) => Position[],
): Feature => {
  const mapper = (data: Position[] | MultiPosition[], _indices: number[]): MultiPosition[] => {
    if (_indices.length === 0) return positions.toCoords(updater(data as Position[]), feature.type);
    return [
      ...data.slice(0, _indices[0]),
      mapper(data[_indices[0]] as MultiPosition[], _indices.slice(1)),
      ...data.slice(_indices[0] + 1),
    ];
  };

  return {
    ...feature,
    coordinates: mapper(getPoints(feature), indices),
  } as Feature;
};

const createNodes = (features: Feature[]): Node[] => {
  const reducer =
    (feature: Feature, indices: number[]) =>
    (acc: Node[], item: Position | MultiPosition[], index: number): Node[] => [
      ...acc,
      ...(Array.isArray(item[0])
        ? (item as MultiPosition[]).reduce(reducer(feature, [index]), acc)
        : [
            {
              fid: feature.id,
              position: item as Position,
              indices: [...indices, index],
            },
          ]),
    ];

  return features.reduce(
    (acc, feature) => [...acc, ...getPoints(feature).reduce(reducer(feature, []), acc)],
    [] as Node[],
  );
};

const moveFeatures = (features: Feature[], ids: number[], delta: Position) => {
  return features.map((item) => {
    if (!ids.includes(item.id)) return item;

    const mapper = (data: MultiPosition, delta: Position): MultiPosition[] | MultiPosition => {
      if (!Array.isArray(data[0])) return positions.add(data as Position, delta);
      return data.map((item) => mapper(item as MultiPosition, delta));
    };

    return { ...item, coordinates: mapper(item.coordinates, delta) } as Feature;
  });
};

const positions = {
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
  toCoordinates: <T extends Feature>(positions: Position[], type: T["type"]): T["coordinates"] => {
    switch (type) {
      case "Polygon":
        return [[...positions, positions[0]]];
      default:
        return positions;
    }
  },
  toCoords: (points: Position[], type: Feature["type"]) => {
    switch (type) {
      case "Polygon":
      case "MultiPolygon":
        return [...points, points[0]];
      default:
        return points;
    }
  },
};

const isArrayEqual = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  return !a.some((x, i) => x !== b[i]);
};

const compareNodes = <T extends Omit<Node, "position">>(prev: T[], next: T[]): [T[], T[]] => {
  return [
    prev.filter((item) => !next.some((node) => node.fid === item.fid && isArrayEqual(node.indices, item.indices))),
    next.filter((item) => !prev.some((node) => node.fid === item.fid && isArrayEqual(node.indices, item.indices))),
  ];
};

export { isArrayEqual, compareNodes, getPoints, createNodes, getGeometry, moveFeatures, updateFeature, positions };
