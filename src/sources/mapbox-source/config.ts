import { AnyLayout, AnyPaint, Layer } from "mapbox-gl";

export type AddSourcePayload = {
  id: string;
  layers: Omit<Layer, "id">[];
  areaLayer?: Omit<Layer, "id">;
};

type ConfigParams<T> = { default: { [key in keyof T]: T[key] } } & Partial<
  Record<"hovered" | "selected" | "selectedHovered" | "active" | "activeHovered", { [key in keyof T]: T[key] }>
>;

type LayerConfig = { type: Layer["type"]; paint: ConfigParams<AnyPaint>; layout?: AnyLayout };

export type Options = {
  config?: LayerConfig[];
  layerStyles?: Omit<Layer, "id">[];
  pointArea?: number;
  lineArea?: number;
};

export const areaPointLayer = {
  type: "circle",
  paint: {
    "circle-radius": 8,
    "circle-color": "#FF0000",
    "circle-opacity": 0,
  },
};

export const areaLineLayer = {
  type: "line",
  paint: {
    "line-width": 10,
    "line-color": "#0000FF",
    "line-opacity": 0,
  },
};

export const areaFillLayer = {
  type: "fill",
  paint: {
    "fill-color": "#00FF00",
    "fill-opacity": 0,
  },
};

export const defaultConfig: LayerConfig[] = [
  {
    type: "fill",
    paint: {
      default: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.08,
      },
      selected: {
        "fill-opacity": 0.15,
      },
      hovered: {
        "fill-opacity": 0.18,
      },
      active: {
        "fill-opacity": 0.2,
      },
    },
  },
  {
    type: "line",
    paint: {
      default: {
        "line-width": 1.5,
        "line-color": ["get", "color"],
        "line-opacity": 0.7,
      },
      selected: {
        "line-width": 2,
        "line-opacity": 1,
      },
      hovered: {
        "line-width": 2.2,
        "line-opacity": 1,
      },
      active: {
        "line-width": 2.2,
        "line-opacity": 1,
      },
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  },
  {
    type: "circle",
    paint: {
      default: {
        "circle-radius": 2,
        "circle-stroke-width": 0.5,
        "circle-color": ["get", "color"],
        "circle-stroke-color": ["get", "color"],
      },
      hovered: {
        "circle-radius": 2,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": ["get", "color"],
        "circle-color": "#FFFFFF",
      },
      selected: {
        "circle-stroke-color": ["get", "color"],
        "circle-color": "#FFFFFF",
        "circle-radius": 2.3,
        "circle-stroke-width": 1.5,
      },
      selectedHovered: {
        "circle-radius": 3,
      },
      active: {
        "circle-stroke-color": "#FFFFFF",
        "circle-color": ["get", "color"],
      },
    },
  },
];

export const generateLayers = (config: LayerConfig[]): Omit<Layer, "id">[] => {
  return config.map((item) => {
    const paintKeys = Object.keys(item.paint.default);

    return {
      type: item.type as any,
      paint: (paintKeys as (keyof AnyPaint)[]).reduce(
        (acc: AnyPaint | AnyLayout, key: keyof (AnyPaint | AnyLayout)): AnyPaint | AnyLayout => {
          return {
            ...acc,
            [key]: [
              "case",
              [
                "all",
                ["boolean", ["feature-state", "hovered"], false],
                ["boolean", ["feature-state", "active"], false],
              ],
              item.paint.activeHovered?.[key] ||
                item.paint.active?.[key] ||
                item.paint.selectedHovered?.[key] ||
                item.paint.hovered?.[key] ||
                item.paint.selected?.[key] ||
                item.paint.default[key],
              ["boolean", ["feature-state", "active"], false],
              item.paint.active?.[key] || item.paint.selected?.[key] || item.paint.default[key],
              [
                "all",
                ["boolean", ["feature-state", "hovered"], false],
                ["boolean", ["feature-state", "selected"], false],
              ],
              item.paint.selectedHovered?.[key] ||
                item.paint.hovered?.[key] ||
                item.paint.selected?.[key] ||
                item.paint.default[key],
              ["boolean", ["feature-state", "hovered"], false],
              item.paint.hovered?.[key] || item.paint.default[key],
              ["boolean", ["feature-state", "selected"], false],
              item.paint.selected?.[key] || item.paint.default[key],
              item.paint.default[key],
            ],
          };
        },
        {} as AnyPaint,
      ),
      ...(item.layout ? { layout: item.layout } : {}),
    } as Omit<Layer, "id">;
  });
};

export const splitLayers = (layers: Omit<Layer, "id">[]) =>
  layers.reduce(
    (acc, layer) => {
      switch (layer.type) {
        case "line":
          acc[1].push(layer);
          break;
        case "fill":
          acc[2].push(layer);
          break;
        default:
          acc[0].push(layer);
      }
      return acc;
    },
    [[], [], []] as Omit<Layer, "id">[][],
  );
