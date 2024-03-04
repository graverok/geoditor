import { Source } from "./source";
import { LayerType, Feature, Point, FeatureProps, SourceEvent } from "../types";
import * as lib from "../lib";

export class Core {
  private _source: Source;
  private _selected: number[] = [];
  private _selectedPoints: Pick<Point, "indices" | "fid">[] = [];
  private _hovered: Partial<Record<LayerType, number | undefined>> | undefined;
  public addListener;
  public removeListener;
  public setFeatureState;
  public setPointState;
  public setCursor;
  private readonly _onSelect!: (() => void) | undefined;
  private readonly _getTools!: () => Record<string, (...args: any[]) => void>;

  constructor(props: { source: Source; getTools: () => Record<string, (o?: any) => void>; onSelect?: () => void }) {
    this._source = props.source;
    this._onSelect = props.onSelect;
    this._getTools = props.getTools;
    this._handleGeometryEnter = this._handleGeometryEnter.bind(this);
    this.addListener = this._source.addListener;
    this.removeListener = this._source.removeListener;
    this.setFeatureState = this._source.setFeatureState;
    this.setPointState = this._source.setPointState;
    this.setCursor = this._source.setCursor;
  }

  public getFeature(id?: number) {
    return this._source.getFeature(id);
  }

  public init() {
    this._addHandlers();
    this.render("features", this.features);
  }

  public reset() {
    this.selectedPoints = [];
    this.selected = [];
    this._hovered = undefined;
    this.render("features", this.features);
    this.render("points", []);
  }

  get hovered() {
    return this._hovered;
  }

  get tools() {
    return this._getTools();
  }

  private _setHovered(type: LayerType, id?: number) {
    this._hovered = {
      ...this._hovered,
      [type]: id,
    };

    if (!Object.values(this._hovered).some((v) => v)) {
      this._hovered = undefined;
    }
  }

  set selected(ids: number[]) {
    if (ids.length === this._selected.length && !ids.some((n) => !this._selected.includes(n))) return;

    this._selected.forEach((id) => !ids.includes(id) && this.setFeatureState(id, { selected: false }));
    ids.forEach((id) => !this._selected.includes(id) && this.setFeatureState(id, { selected: true }));

    this._selected = Array.from(ids);
    this._onSelect?.();
  }

  get selected() {
    return this._selected;
  }

  set selectedPoints(nodes: Pick<Point, "fid" | "indices">[]) {
    const [toRemove, toAdd] = lib.comparePoints(this._selectedPoints, nodes);
    toAdd.forEach((node) => this._source.setPointState(node, { selected: true }));
    toRemove.forEach((node) => this._source.setPointState(node, { selected: false }));
    this._selectedPoints = nodes;
  }

  get selectedPoints() {
    return this._selectedPoints;
  }

  public isPointSelected(node: Point) {
    return this._selectedPoints.some((item) => item.fid === node.fid && lib.isArrayEqual(node.indices, item.indices));
  }

  protected _handleGeometryEnter(e: SourceEvent) {
    const layer = e.layer;
    if (!layer) return;
    let ids = e[layer].map((i) => i.fid) ?? [];
    this._setHovered(
      layer,
      ids.find((id) => this._selected.includes(id)) ||
        ids.find((id) => [this._hovered?.points, this._hovered?.lines, this.hovered?.planes].includes(id)) ||
        ids[0],
    );

    const handleMouseMove = (ev: SourceEvent) => {
      ids = ev[layer].map((i) => i.fid) ?? [];
      this._setHovered(
        layer,
        ids.find((id) => this._selected.includes(id)) ||
          ids.find((id) => [this._hovered?.points, this._hovered?.lines, this.hovered?.planes].includes(id)) ||
          ids[0],
      );
    };

    const handleMouseLeave = () => {
      this._setHovered(layer);

      this._source.removeListener("mousemove", layer, handleMouseMove);
      this._source.removeListener("mouseleave", layer, handleMouseLeave);
    };

    this._source.addListener("mousemove", layer, handleMouseMove);
    this._source.addListener("mouseleave", layer, handleMouseLeave);
  }

  get features() {
    return this._source.features;
  }

  set features(features: Feature[]) {
    this._source.features = features;
  }

  public getSelectedFeatures() {
    return this._source.features.filter((item) => this._selected.includes(item.id));
  }

  get renderer() {
    return this._source.renderer;
  }

  public render(type: "features" | "points", items: Feature[] | Point<FeatureProps>[]) {
    switch (type) {
      case "features":
        const foreground = this._hovered
          ? [this._hovered.points || this._hovered.lines || this._hovered.planes]
          : this._selected;

        const sorted = [
          ...(items as Feature[]).filter((feature) => !foreground.includes(feature.id)),
          ...(items as Feature[]).filter((feature) => foreground.includes(feature.id)),
        ] as Feature[];

        return this._source.renderFeatures(sorted);
      case "points":
        return this._source.renderPoints(items as Point<FeatureProps>[]);
    }
  }

  private _addHandlers() {
    this._source.addListener("mouseenter", "points", this._handleGeometryEnter);
    this._source.addListener("mouseenter", "lines", this._handleGeometryEnter);
    this._source.addListener("mouseenter", "planes", this._handleGeometryEnter);
  }

  private _removeHandlers() {
    this._source.removeListener("mouseenter", "points", this._handleGeometryEnter);
    this._source.removeListener("mouseenter", "lines", this._handleGeometryEnter);
    this._source.removeListener("mouseenter", "planes", this._handleGeometryEnter);
  }

  public remove() {
    this._removeHandlers();
    this._source.remove();
  }
}
