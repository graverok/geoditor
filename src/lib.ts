import { DrawType, Geometry, Position } from "./types";

const getGeometry = (positions: Position[], type: DrawType) => {
  switch (type) {
    case "Polygon":
      return {
        type,
        coordinates: [[...positions.slice(0, positions.length - 1), positions[0]]],
      };
    default: {
      return {
        type,
        coordinates: positions,
      };
    }
  }
};

const getDistanceToLine = (point: Position, [start, end]: [Position, Position]) => {
  const a = point[0] - start[0];
  const b = point[1] - start[1];
  const c = end[0] - start[0];
  const d = end[1] - start[1];

  const dot = a * c + b * d;
  const len_sq = c * c + d * d;
  let param = -1;
  if (len_sq != 0)
    //in case of 0 length line
    param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = start[0];
    yy = start[1];
  } else if (param > 1) {
    xx = end[0];
    yy = end[1];
  } else {
    xx = start[0] + param * c;
    yy = start[1] + param * d;
  }

  const dx = point[0] - xx;
  const dy = point[1] - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

const getClosestLine = function (geometry: Geometry | undefined, point: Position) {
  const positions = getPositions(geometry);
  const { index } = positions.slice(1).reduce(
    (acc: { index: number; delta?: number }, item, index) => {
      const delta = getDistanceToLine(point, [positions[index], item]);
      return typeof acc.delta !== "number" || delta < acc.delta ? { index, delta } : acc;
    },
    { index: -1 },
  );

  return {
    before: index + 1,
    after: index + 2,
    position: positionTools.average(positions[index], positions[index + 1]),
  };
};

const getDistanceToPoint = (start: Position, end: Position): number => {
  return Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
};

const getClosestPoint = (geometry: Geometry, position: Position) => {
  const positions = getPositions(geometry);
  let distance: number | undefined;

  return positions.reduce(
    (
      acc: {
        id: number;
        before: number;
        after: number;
        position?: Position;
      },
      item,
      index,
    ) => {
      const nextDistance = getDistanceToPoint(position, item);
      if (typeof distance !== "number" || nextDistance < distance) {
        distance = nextDistance;
        return {
          id: index + 1,
          before: index > 0 ? index : geometry.type === "Polygon" ? positions.length - 1 : 0,
          after:
            geometry.type === "Polygon"
              ? index < positions.length - 2
                ? index + 2
                : 1
              : index < positions.length - 1
                ? index + 2
                : 0,
          position: item,
        };
      }
      return acc;
    },
    { id: 0, before: 0, after: 0 },
  );
};

const getPositions = (geometry?: Geometry) => {
  if (!geometry) return [];

  switch (geometry.type) {
    case "Polygon":
      return [...geometry.coordinates[0]];
    default:
      return [...geometry.coordinates];
  }
};

const getEndings = (geometry: Geometry | undefined, isReversed: boolean) => {
  const positions = getPositions(geometry);

  return {
    end: isReversed ? 1 : positions.length,
    start: !isReversed ? 1 : positions.length,
    positions,
  };
};

const createPolygon = (geometry: Geometry | undefined): Geometry => {
  const positions = getPositions(geometry);
  return {
    type: "Polygon",
    coordinates: [[...positions, positions[0]]],
  };
};

export const geometryTools = {
  getPositions,
  getEndings,
  getGeometry,
  getClosestLine,
  getClosestPoint,
  createPolygon,
};

export const positionTools = {
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
};

export const isEqual = <T = number>(next: T[], current: T[]) => {
  if (next.length !== current.length) return false;
  return !next.some((n) => !current.includes(n));
};
