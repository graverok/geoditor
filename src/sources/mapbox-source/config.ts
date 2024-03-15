import mapboxgl from "mapbox-gl";
import { LayerType } from "../../types";

export type AddSourcePayload = {
  id: string;
  layers: Omit<mapboxgl.Layer, "id">[];
  areaLayer?: Omit<mapboxgl.Layer, "id">;
};

type ConfigParams<T> = { default: { [key in keyof T]: T[key] } } & Partial<
  Record<"disabled" | "active" | "hover", { [key in keyof T]: T[key] }>
>;

type LayerConfig = {
  type: mapboxgl.Layer["type"];
  paint: ConfigParams<mapboxgl.AnyPaint>;
  layout?: mapboxgl.AnyLayout;
};

export type Options = {
  config?: LayerConfig[];
  layerStyles?: Omit<mapboxgl.Layer, "id">[];
  area?: {
    points?: number;
    lines?: number;
    planes?: undefined;
  };
};

export const areaLayer = {
  points: (width = 14) => ({
    type: "circle",
    paint: {
      "circle-radius": width / 2,
      "circle-opacity": 0,
    },
  }),
  lines: (width = 10) => ({
    type: "line",
    paint: {
      "line-width": width,
      "line-opacity": 0,
    },
  }),
  planes: () => ({
    type: "fill",
    paint: {
      "fill-opacity": 0,
    },
  }),
};

export const defaultConfig: LayerConfig[] = [
  {
    type: "fill",
    paint: {
      default: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.12,
      },
      disabled: {
        "fill-opacity": 0.03,
      },
      hover: {
        "fill-opacity": 0.16,
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
        "line-width": 1.6,
        "line-color": ["get", "color"],
        "line-opacity": 0.7,
      },
      disabled: {
        "line-width": 1,
        "line-opacity": 0.4,
      },
      hover: {
        "line-width": 2,
        "line-opacity": 1,
      },
      active: {
        "line-width": 2,
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
        "circle-stroke-color": ["get", "color"],
        "circle-color": "#FFFFFF",
        "circle-radius": 2,
        "circle-stroke-width": 1.5,
      },
      disabled: {
        "circle-radius": 1.5,
        "circle-stroke-width": 1,
        "circle-color": ["get", "color"],
      },
      hover: {
        "circle-radius": 2.6,
        "circle-color": "#FFFFFF",
        "circle-stroke-width": 1.7,
      },
      active: {
        "circle-stroke-color": "#FFFFFF",
        "circle-color": ["get", "color"],
      },
    },
  },
];

export const generateLayers = (config: LayerConfig[]): Omit<mapboxgl.Layer, "id">[] => {
  return config.map((item) => {
    const paintKeys = Object.keys(item.paint.default);

    return {
      type: item.type as any,
      paint: (paintKeys as (keyof mapboxgl.AnyPaint)[]).reduce(
        (
          acc: mapboxgl.AnyPaint | mapboxgl.AnyLayout,
          key: keyof (mapboxgl.AnyPaint | mapboxgl.AnyLayout),
        ): mapboxgl.AnyPaint | mapboxgl.AnyLayout => {
          return {
            ...acc,
            [key]: [
              "case",
              ["all", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "active"], false]],
              item.paint.active?.[key] || item.paint.hover?.[key] || item.paint.default[key],
              ["boolean", ["feature-state", "active"], false],
              item.paint.active?.[key] || item.paint.default[key],
              [
                "all",
                ["boolean", ["feature-state", "hover"], false],
                ["boolean", ["feature-state", "disabled"], false],
              ],
              item.paint.default[key],
              ["boolean", ["feature-state", "hover"], false],
              item.paint.hover?.[key] || item.paint.default[key],
              ["boolean", ["feature-state", "disabled"], false],
              item.paint.disabled?.[key] || item.paint.default[key],
              item.paint.default[key],
            ],
          };
        },
        {} as mapboxgl.AnyPaint,
      ),
      ...(item.layout ? { layout: item.layout } : {}),
    } as Omit<mapboxgl.Layer, "id">;
  });
};

export const splitLayers = (layers: Omit<mapboxgl.Layer, "id">[]): Record<LayerType, Omit<mapboxgl.Layer, "id">[]> =>
  layers.reduce(
    (acc, layer) => {
      switch (layer.type) {
        case "line":
          acc.lines.push(layer);
          break;
        case "fill":
          acc.planes.push(layer);
          break;
        default:
          acc.points.push(layer);
      }
      return acc;
    },
    { points: [], lines: [], planes: [] } as Record<LayerType, Omit<mapboxgl.Layer, "id">[]>,
  );
