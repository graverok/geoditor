import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { Feature, Node, Position, SourceEvent } from "../types";

export class EditTool extends AnyTool {
  private _isDragging = false;
  private _hovered: number | undefined;
  private _resetCursor!: (() => void) | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "edit";
    this._handleFeatureHover = this._handleFeatureHover.bind(this);
    this._handleFeatureDeselect = this._handleFeatureDeselect.bind(this);
    this._handleFeaturesDrag = this._handleFeaturesDrag.bind(this);
    this._handleFillDrag = this._handleFillDrag.bind(this);
    this._handleLineDrag = this._handleLineDrag.bind(this);
    this._handlePointHover = this._handlePointHover.bind(this);
    this._handlePointDrag = this._handlePointDrag.bind(this);
    this._createPlaceholders = this._createPlaceholders.bind(this);
  }

  private _createPlaceholders(feature: Feature) {
    if (!this.core.selected.includes(feature.id)) return feature;
    type MultiPosition = Position | MultiPosition[];

    const mapper = (data: Position[] | MultiPosition[]): MultiPosition[] => {
      if (!Array.isArray(data[0][0])) {
        const placeholders = Array.from(data as Position[])
          .slice(1)
          .map((pos, index) => lib.positions.average(pos, (data as Position[])[index]));
        if (feature.type === "Polygon" || feature.type === "MultiPolygon") {
          placeholders.push(lib.positions.average((data as Position[])[0], (data as Position[])[data.length - 1]));
          placeholders.push((data as Position[])[0]);
        }

        return [...data, ...placeholders] as Position[];
      }

      return (data as Feature["coordinates"][]).map(mapper);
    };

    return {
      ...feature,
      coordinates: mapper(lib.getPoints(feature)),
    } as Feature;
  }

  private _renderPlaceholderNodes() {
    this.core.render(this.core.features, { point: false });
    this.core.render(this.core.features.map(this._createPlaceholders), {
      plane: false,
      line: false,
      point: this.core.selected,
    });
    this.core.selectedNodes = lib.createNodes(this.core.getSelectedFeatures());
  }

  private _setHovered(id?: number) {
    if (id === this._hovered) return;
    this._hovered && this.core.setFeatureState(this._hovered, { hovered: false });
    id && this.core.setFeatureState(id, { hovered: true });
    this._hovered = id;
  }

  private _handleFeatureHover() {
    if (this._isDragging) return;
    this.core.setCursor(this.core.hovered ? "pointer" : "default");
    this._setHovered(this.core.hovered?.point || this.core.hovered?.line || this.core.hovered?.plane);
  }

  private _handleFeatureDeselect() {
    if (this._hovered) return;
    this.core.selectedNodes = [];
    this.core.selected = [];
    this._renderPlaceholderNodes();
  }

  private _handleFeaturesDrag(e: SourceEvent) {
    this._isDragging = true;
    let isChanged = false;
    if (!this._hovered) return;

    const id = this._hovered;
    let delta: Position = [0, 0];
    this.core.setFeatureState(id, { active: true });
    if (!this.core.selected.includes(id)) this.core.selectedNodes = [];
    this.core.selected = [id];
    this.core.render(this.core.features, { point: this.core.selected });

    const _onMove = (ev: SourceEvent) => {
      isChanged = true;
      delta = lib.positions.subtract(e.position, ev.position);
      this.core.render(lib.moveFeatures(this.core.features, this.core.selected, delta), { point: this.core.selected });
    };

    const _onFinish = () => {
      this.core.removeListener("mousemove", _onMove);
      this.core.setFeatureState(id, { active: false });
      this._isDragging = false;
      if (isChanged) this.core.features = lib.moveFeatures(this.core.features, this.core.selected, delta);
      this._renderPlaceholderNodes();
    };

    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });
  }

  private _handleFillDrag(e: SourceEvent) {
    if (this.core.hovered?.point || this.core.hovered?.line) return;
    this._handleFeaturesDrag(e);
  }

  private _handleLineDrag(e: SourceEvent) {
    if (this.core.hovered?.point) return;
    this._handleFeaturesDrag(e);
  }

  private _handlePointHover(e: SourceEvent) {
    let node = e.nodes[0];
    !this._isDragging && this.core.setNodeState(node, { hovered: true });

    const _onMove = (ev: SourceEvent) => {
      if (this._isDragging) return;
      if (lib.isArrayEqual(ev.nodes[0].indices ?? [], node.indices)) return;
      this.core.setNodeState(node, { hovered: false });
      node = ev.nodes[0];
      this.core.setNodeState(node, { hovered: true });
    };

    const _onLeave = () => {
      !this._isDragging && this.core.setNodeState(node, { hovered: false });
      this.core.removeListener("mouseleave", "point", _onLeave);
      this.core.removeListener("mousemove", "point", _onMove);
    };

    this.core.addListener("mouseleave", "point", _onLeave);
    this.core.addListener("mousemove", "point", _onMove);
    this._isDragging &&
      document.addEventListener(
        "mouseup",
        () => {
          this.core.setNodeState(node, { hovered: true });
        },
        { once: true },
      );
  }

  private _handlePointDrag(e: SourceEvent) {
    let node = e.nodes[0];
    let feature = this.core.getFeature(node?.fid);
    if (!node || !feature) return;

    this.core.selectedNodes = [];
    let nextPosition = node.position;
    let siblingNode: Node | undefined;
    this.core.selected = [feature.id];
    this._isDragging = true;

    const pidx = node.indices.length - 1;
    let points = lib.getGeometry(node.indices.slice(0, pidx), lib.getPoints(feature));
    let isChanged = false;

    const _updater = (next?: Position) => (): Position[] => [
      ...points.slice(0, node.indices[pidx]),
      ...(next ? [next] : []),
      ...points.slice(node.indices[pidx] + 1),
    ];

    if (node.indices[pidx] >= points.length) {
      isChanged = true;
      this.core.setNodeState(node, { hovered: false });
      node.indices[pidx] = (node.indices[pidx] % points.length) + 1;
      points = [...points.slice(0, node.indices[pidx]), node.position, ...points.slice(node.indices[pidx])];
      feature = lib.updateFeature(feature, node.indices.slice(0, pidx), () => points);
    }

    const _onSiblingEnter = (ev: SourceEvent) => {
      siblingNode = ev.nodes.find((node) => [before, after].includes(node.indices[pidx]));
      siblingNode && this.core.setNodeState(siblingNode, { hovered: true, active: true });
    };

    const _onSiblingLeave = () => {
      siblingNode && this.core.setNodeState(siblingNode, { hovered: false, active: false });
      siblingNode = undefined;
    };

    const _onMove = (ev: SourceEvent) => {
      if (!feature) return;
      isChanged = true;
      nextPosition =
        siblingNode?.position || lib.positions.add(node.position, lib.positions.subtract(e.position, ev.position));
      feature = lib.updateFeature(feature, node.indices.slice(0, pidx), _updater(nextPosition));
      this.core.render([...this.core.features.slice(0, node.fid - 1), feature, ...this.core.features.slice(node.fid)], {
        point: this.core.selected,
      });
    };

    const _onFinish = () => {
      this.core.removeListener("mousemove", _onMove);
      this.core.removeListener("mousemove", "point", _onSiblingEnter);
      this.core.removeListener("mouseleave", "point", _onSiblingLeave);

      if (!feature) return;
      this.core.selectedNodes = [];

      before >= 0 &&
        this.core.setNodeState(
          { fid: node.fid, indices: [...node.indices.slice(0, pidx), before] },
          { active: false, hovered: false },
        );
      after >= 0 &&
        this.core.setNodeState(
          { fid: node.fid, indices: [...node.indices.slice(0, pidx), after] },
          { active: false, hovered: false },
        );
      this.core.setNodeState(node, { active: false });

      if (isChanged) {
        if (siblingNode && siblingNode.indices[pidx] === before) {
          this.core.setNodeState(node, { hovered: false });
          this.core.setNodeState(siblingNode, { hovered: true });
        }

        this.core.features = [
          ...this.core.features.slice(0, node.fid - 1),
          lib.updateFeature(feature, node.indices.slice(0, pidx), _updater(siblingNode ? undefined : nextPosition)),
          ...this.core.features.slice(node.fid),
        ];

        this.refresh();
      } else {
        this._renderPlaceholderNodes();
      }
      this._isDragging = false;
    };

    const before =
      node.indices[pidx] === 0 ? (feature.type === "Polygon" ? points.length - 1 : -1) : node.indices[pidx] - 1;
    const after =
      node.indices[pidx] === points.length - 1 ? (feature.type === "Polygon" ? 0 : -1) : node.indices[pidx] + 1;
    this.core.render([...this.core.features.slice(0, node.fid - 1), feature, ...this.core.features.slice(node.fid)], {
      point: this.core.selected,
    });
    this.core.selectedNodes = [node];
    this.core.setNodeState(node, { active: true, hovered: true });
    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });

    if (points.length <= 2 + Number(feature.type === "Polygon")) return;
    this.core.selectedNodes = [
      ...this.core.selectedNodes,
      ...(before >= 0 ? [{ fid: node.fid, indices: [...node.indices.slice(0, pidx), before] }] : []),
      ...(after >= 0 ? [{ fid: node.fid, indices: [...node.indices.slice(0, pidx), after] }] : []),
    ];
    this.core.addListener("mousemove", "point", _onSiblingEnter);
    this.core.addListener("mouseleave", "point", _onSiblingLeave);
  }

  get config() {
    return;
  }

  public refresh() {
    this.core.selectedNodes = [];
    this._renderPlaceholderNodes();
  }

  public enable() {
    this._resetCursor = this.core.setCursor("default");
    this.core.addListener("mouseenter", "point", this._handlePointHover);
    this.core.addListener("mousemove", this._handleFeatureHover);
    this.core.addListener("click", this._handleFeatureDeselect);
    this.core.addListener("mousedown", "point", this._handlePointDrag);
    this.core.addListener("mousedown", "line", this._handleLineDrag);
    this.core.addListener("mousedown", "plane", this._handleFillDrag);
    this._renderPlaceholderNodes();
  }

  public disable() {
    this.core.selectedNodes = [];
    this.core.removeListener("mousedown", "point", this._handlePointDrag);
    this.core.removeListener("mouseenter", "point", this._handlePointHover);
    this.core.removeListener("mousedown", "plane", this._handleFillDrag);
    this.core.removeListener("mousedown", "line", this._handleLineDrag);
    this.core.removeListener("click", this._handleFeatureDeselect);
    this.core.removeListener("mousemove", this._handleFeatureHover);
    this._resetCursor?.();
  }
}
