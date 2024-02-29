import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { Node, Position, SourceEvent } from "../types";

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
  }

  private _renderPlaceholderNodes() {
    const nodes = lib.createNodes(this.core.getSelectedFeatures());
    this.core.render("nodes", [...nodes, ...lib.createPlaceholderNodes(this.core.getSelectedFeatures())]);
    this.core.selectedNodes = nodes;
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
    let nextPosition: Position = Array.from(e.position);
    this.core.setFeatureState(id, { active: true });
    this.core.selected = [id];
    this.core.selectedNodes = [];
    this.core.render("nodes", lib.createNodes(this.core.getSelectedFeatures()));

    const _onMove = (ev: SourceEvent) => {
      isChanged = true;
      nextPosition = ev.position;
      const features = lib.moveFeatures(this.core.features, this.core.selected, e.position, nextPosition);
      this.core.render("features", features);
      this.core.render("nodes", lib.createNodes(features.filter((item) => this.core.selected.includes(item.id))));
    };

    const _onFinish = () => {
      this.core.removeListener("mousemove", _onMove);
      this.core.setFeatureState(id, { active: false });
      this._isDragging = false;
      if (isChanged)
        this.core.features = lib.moveFeatures(this.core.features, this.core.selected, e.position, nextPosition);
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
      document.removeEventListener("mouseup", _onMouseUp);
    };

    const _onMouseUp = () => {
      this.core.setNodeState(node, { hovered: true });
    };

    this.core.addListener("mouseleave", "point", _onLeave);
    this.core.addListener("mousemove", "point", _onMove);
    this._isDragging && document.addEventListener("mouseup", _onMouseUp, { once: true });
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
    let points = lib.openShape(lib.getShape(feature, node.indices), feature.type);
    let isChanged = false;

    const _updater = (next?: Position) =>
      lib.closeShape(
        [...points.slice(0, node.indices[pidx]), ...(next ? [next] : []), ...points.slice(node.indices[pidx] + 1)],
        feature?.type,
      );

    if (node.indices[pidx] >= points.length) {
      isChanged = true;
      this.core.setNodeState(node, { hovered: false });
      node.indices[pidx] = (node.indices[pidx] % points.length) + 1;
      points = [...points.slice(0, node.indices[pidx]), node.position, ...points.slice(node.indices[pidx])];
      feature = lib.updateShape(feature, node.indices.slice(0, pidx), lib.closeShape(points, feature.type));
    }

    const _onSiblingEnter = (ev: SourceEvent) => {
      siblingNode = ev.nodes.find(
        (n) =>
          [before, after].includes(n.indices[pidx]) &&
          lib.isArrayEqual(n.indices.slice(0, pidx), node.indices.slice(0, pidx)),
      );
      siblingNode && this.core.setNodeState(siblingNode, { hovered: true, active: true });
    };

    const _onSiblingLeave = () => {
      siblingNode && this.core.setNodeState(siblingNode, { hovered: false, active: false });
      siblingNode = undefined;
    };

    const _onMove = (ev: SourceEvent) => {
      if (!feature) return;
      isChanged = true;
      nextPosition = lib.math.normalize(
        siblingNode?.position || lib.math.add(node.position, lib.math.subtract(e.position, ev.position)),
      );
      feature = lib.updateShape(feature, node.indices.slice(0, pidx), _updater(nextPosition));
      this.core.render("features", [
        ...this.core.features.slice(0, node.fid - 1),
        feature,
        ...this.core.features.slice(node.fid),
      ]);
      this.core.render("nodes", lib.createNodes([feature]));
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
          lib.updateShape(feature, node.indices.slice(0, pidx), _updater(siblingNode ? undefined : nextPosition)),
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
    this.core.render("nodes", lib.createNodes([feature]));
    this.core.selectedNodes = [node];
    this.core.setNodeState(node, { active: true, hovered: true });
    this.core.addListener("mousemove", _onMove);
    document.addEventListener("mouseup", _onFinish, { once: true });

    if (points.length <= 2 + Number(feature.type === "Polygon")) return;
    this.core.selectedNodes = [
      ...this.core.selectedNodes,
      ...(before >= 0
        ? [{ fid: node.fid, props: feature.props, indices: [...node.indices.slice(0, pidx), before] }]
        : []),
      ...(after >= 0
        ? [{ fid: node.fid, props: feature.props, indices: [...node.indices.slice(0, pidx), after] }]
        : []),
    ];
    this.core.addListener("mousemove", "point", _onSiblingEnter);
    this.core.addListener("mouseleave", "point", _onSiblingLeave);
  }

  get config() {
    return;
  }

  public refresh() {
    this.core.selectedNodes = [];
    this.core.render("features", this.core.features);
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
