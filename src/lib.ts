import { Geometry, Polygon, Position, Node } from "./types";

/**
 * Return unique points to render nodes
 */
const getPoints = (geometry?: Geometry): Position[] => {
  if (!geometry) return [];
  switch (geometry.type) {
    case "Polygon":
      return [...geometry.coordinates[0].slice(0, geometry.coordinates[0].length - 1)];
    default:
      return [...geometry.coordinates];
  }
};

/**
 * Return ids of first and last nodes of the line
 */
const getEndings = (geometry: Geometry | undefined, isReversed: boolean) => {
  const positions = getPoints(geometry);

  return {
    end: isReversed ? 1 : positions.length,
    start: !isReversed ? 1 : positions.length,
    positions,
  };
};

const getNodes = (geometries: Geometry[]) => {
  return geometries.reduce((acc, feature) => {
    return [
      ...acc,
      ...getPoints(feature).map((position, index) => ({ id: index + 1, parentId: feature.id, position }) as Node),
    ];
  }, [] as Node[]);
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
  toCoordinates: <T extends Geometry>(positions: Position[], type: T["type"]): T["coordinates"] => {
    switch (type) {
      case "Polygon":
        return [[...positions, positions[0]]];
      default:
        return positions;
    }
  },
};

const compareNodes = <T extends Omit<Node, "position">>(prev: T[], next: T[]): [T[], T[]] => {
  return [
    prev.filter((item) => !next.some((node) => node.id === item.id && node.parentId === item.parentId)),
    next.filter((item) => !prev.some((node) => node.id === item.id && node.parentId === item.parentId)),
  ];
};

export { compareNodes, getPoints, getEndings, getNodes, positions };
