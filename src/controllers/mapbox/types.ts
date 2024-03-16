import { FeatureProps, SourceEvent, SourceEventHandler } from "../../types";

export type LayerFeatureProperties = { nesting: string } & FeatureProps;

export type ShapesCollection = {
  points?: SourceEvent["points"];
  lines?: SourceEvent["lines"];
  planes?: SourceEvent["planes"];
};

export type Subscription = {
  off: () => void;
  name: string;
  callback: SourceEventHandler;
  layer?: string;
};
