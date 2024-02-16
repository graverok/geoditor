import { Source } from "./source";
import { LayerType, Feature, SourceMouseHandler, SourceEvent, Node } from "../types";
import * as lib from "../lib";

export class Core {
  private _source: Source;
  private _selected: number[] = [];
  private _selectedNodes: Omit<Node, "position">[] = [];
  private _hovered: Partial<Record<LayerType, number | undefined>> | undefined;
  public addListener;
  public removeListener;
  public setFeatureState;
  public setNodeState;
  public setCursor;
  private readonly _onSelect!: ((indices: number[]) => void) | undefined;
  private readonly _getTools!: () => Record<string, (...args: any[]) => void>;

  constructor(props: {
    source: Source;
    getTools: () => Record<string, (o?: any) => void>;
    onSelect?: (indices: number[]) => void;
  }) {
    this._source = props.source;
    this._onSelect = props.onSelect;
    this._getTools = props.getTools;
    this.addListener = this._source.addListener;
    this.removeListener = this._source.removeListener;
    this.setFeatureState = this._source.setFeatureState;
    this.setNodeState = this._source.setNodeState;
    this.setCursor = this._source.setCursor;
  }

  public getFeature(id?: number) {
    return this._source.getFeature(id);
  }

  public init() {
    this._addHandlers();
  }

  public reset() {
    this.selectedNodes = [];
    this.selected = [];
    this._hovered = undefined;
    this.render(this.features, { point: [] });
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
    this._onSelect?.(this._selected.map((id) => id - 1));
  }

  get selected() {
    return this._selected;
  }

  set selectedNodes(nodes: Omit<Node, "position">[]) {
    const [toRemove, toAdd] = lib.compareNodes(this._selectedNodes, nodes);
    toAdd.forEach((node) => this._source.setNodeState(node, { selected: true }));
    toRemove.forEach((node) => this._source.setNodeState(node, { selected: false }));
    this._selectedNodes = nodes;
  }

  get selectedNodes() {
    return this._selectedNodes;
  }

  public isNodeSelected(node: Node) {
    return this._selectedNodes.some((item) => item.fid === node.fid && lib.isArrayEqual(node.indices, item.indices));
  }

  protected _handleGeometryEnter(e: SourceEvent) {
    const layer = e.layer;
    if (!layer) return;
    let ids = layer !== "point" ? e.features.map((f) => f.id) : e.nodes.map((f) => f.fid);
    this._setHovered(
      layer,
      ids.find((id) => this._selected.includes(id)) ||
        ids.find((id) => [this._hovered?.point, this._hovered?.line, this.hovered?.plane].includes(id)) ||
        ids[0],
    );

    const handleMouseMove: SourceMouseHandler = (ev) => {
      let ids = layer !== "point" ? ev.features.map((f) => f.id) : ev.nodes.map((f) => f.fid);
      this._setHovered(
        layer,
        ids.find((id) => this._selected.includes(id)) ||
          ids.find((id) => [this._hovered?.point, this._hovered?.line, this.hovered?.plane].includes(id)) ||
          ids[0],
      );
    };

    const handleMouseLeave: SourceMouseHandler = () => {
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

  set data(data: object[]) {
    this._source.data = data;
  }

  public getSelectedFeatures() {
    return this._source.features.filter((item) => this._selected.includes(item.id));
  }

  get renderer() {
    return this._source.renderer;
  }

  public render(features: Feature[], options?: Partial<Record<LayerType, boolean | number[]>>) {
    const { line = true, plane = true, point = true } = options || {};

    const foreground = this._hovered
      ? [this._hovered.point || this._hovered.line || this._hovered.plane]
      : this._selected;

    const sorted = [
      ...features.filter((feature) => !foreground.includes(feature.id)),
      ...features.filter((feature) => foreground.includes(feature.id)),
    ] as Feature[];

    plane &&
      this._source.render("plane", Array.isArray(plane) ? sorted.filter((item) => plane.includes(item.id)) : sorted);
    line && this._source.render("line", Array.isArray(line) ? sorted.filter((item) => line.includes(item.id)) : sorted);
    point &&
      this._source.render("point", Array.isArray(point) ? sorted.filter((item) => point.includes(item.id)) : sorted);
  }

  private _addHandlers() {
    this._source.addListener("mouseenter", "point", this._handleGeometryEnter.bind(this));
    this._source.addListener("mouseenter", "line", this._handleGeometryEnter.bind(this));
    this._source.addListener("mouseenter", "plane", this._handleGeometryEnter.bind(this));
  }

  private _removeHandlers() {
    this._source.removeListener("mouseenter", "point", this._handleGeometryEnter);
    this._source.removeListener("mouseenter", "line", this._handleGeometryEnter);
    this._source.removeListener("mouseenter", "plane", this._handleGeometryEnter);
  }

  public remove() {
    this._removeHandlers();
    this._source.remove();
  }
}
