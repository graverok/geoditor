import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { Geometry, Node, Position, SourceEvent } from "../types";

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
    this._handleNodeHover = this._handleNodeHover.bind(this);
    this._handleNodeDrag = this._handleNodeDrag.bind(this);
    this._createPlaceholders = this._createPlaceholders.bind(this);
  }

  private _createPlaceholders(feature: Geometry) {
    if (!this.core.selected.includes(feature.id)) return feature;
    let points = lib.getPoints(feature);
    const placeholders = points.slice(1).map((pos, index) => lib.positions.average(pos, points[index]));
    if (feature.type === "Polygon") placeholders.push(lib.positions.average(points[0], points[points.length - 1]));

    return {
      ...feature,
      coordinates: lib.positions.toCoordinates([...points, ...placeholders], feature.type),
    } as Geometry;
  }

  private _renderPlaceholderNodes() {
    this.core.render(this.core.features, { node: false });
    this.core.render(this.core.features.map(this._createPlaceholders), {
      fill: false,
      line: false,
      node: this.core.selected,
    });
    this.core.selectedNodes = lib.getNodes(this.core.getSelectedFeatures());
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
    this._setHovered(this.core.hovered?.node || this.core.hovered?.line || this.core.hovered?.fill);
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
    this.core.render(this.core.features, { node: this.core.selected });

    const handleMouseMove = (ev: SourceEvent) => {
      isChanged = true;
      delta = lib.positions.subtract(e.position, ev.position);
      this.core.render(
        this.core.modifyFeatures([id], (positions) => positions.map((item) => lib.positions.add(item, delta))),
        { node: this.core.selected },
      );
    };

    const handleMouseUp = () => {
      this.core.removeListener("mousemove", handleMouseMove);
      this.core.setFeatureState(id, { active: false });
      this._isDragging = false;
      if (isChanged) {
        this.core.features = this.core.modifyFeatures([id], (positions) =>
          positions.map((item) => lib.positions.add(item, delta)),
        );
      }

      this._renderPlaceholderNodes();
    };

    this.core.addListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, { once: true });
  }

  private _handleFillDrag(e: SourceEvent) {
    if (this.core.hovered?.node || this.core.hovered?.line) return;
    this._handleFeaturesDrag(e);
  }

  private _handleLineDrag(e: SourceEvent) {
    if (this.core.hovered?.node) return;
    this._handleFeaturesDrag(e);
  }

  private _handleNodeHover(e: SourceEvent) {
    let node = e.nodes[0];
    !this._isDragging && this.core.setNodeState(node, { hovered: true });

    const handleMouseMove = (ev: SourceEvent) => {
      if (this._isDragging) return;
      if (ev.nodes[0]?.id === node.id) return;
      this.core.setNodeState(node, { hovered: false });
      node = ev.nodes[0];
      this.core.setNodeState(node, { hovered: true });
    };

    const handleMouseLeave = () => {
      !this._isDragging && this.core.setNodeState(node, { hovered: false });
      this.core.removeListener("mouseleave", "node", handleMouseLeave);
      this.core.removeListener("mousemove", "node", handleMouseMove);
    };

    this.core.addListener("mouseleave", "node", handleMouseLeave);
    this.core.addListener("mousemove", "node", handleMouseMove);
    this._isDragging &&
      document.addEventListener(
        "mouseup",
        () => {
          this.core.setNodeState(node, { hovered: true });
        },
        { once: true },
      );
  }

  private _handleNodeDrag(e: SourceEvent) {
    let node = e.nodes[0];
    let feature = this.core.getFeature(node?.parentId);
    if (!node || !feature) return;

    const updater = (next?: Position) => (): Position[] => [
      ...positions.slice(0, node.id - 1),
      ...(next ? [next] : []),
      ...positions.slice(node.id),
    ];

    this.core.selectedNodes = [];
    let nextPosition = node.position;
    let siblingNode: Node | undefined;
    this.core.selected = [feature.id];
    this._isDragging = true;

    let positions = lib.getPoints(feature);
    let isChanged = false;

    if (node.id > positions.length) {
      isChanged = true;
      this.core.setNodeState(node, { hovered: false });
      node.id = ((node.id - 1) % positions.length) + 2;
      positions = [...positions.slice(0, node.id - 1), node.position, ...positions.slice(node.id - 1)];
      feature = {
        ...feature,
        coordinates: lib.positions.toCoordinates(positions, feature.type),
      } as Geometry;
    }

    const handleNodeMouseMove = (ev: SourceEvent) => {
      siblingNode = ev.nodes.find((node) => [before, after].includes(node.id));
      siblingNode && this.core.setNodeState(siblingNode, { hovered: true, active: true });
    };

    const handleNodeMouseLeave = () => {
      siblingNode && this.core.setNodeState(siblingNode, { hovered: false, active: false });
      siblingNode = undefined;
    };

    const handleMouseMove = (ev: SourceEvent) => {
      isChanged = true;
      nextPosition =
        siblingNode?.position || lib.positions.add(node.position, lib.positions.subtract(e.position, ev.position));

      feature &&
        this.core.render(this.core.modifyFeatures([feature.id], updater(nextPosition)), { node: this.core.selected });
    };

    const handleMouseUp = () => {
      this.core.removeListener("mousemove", handleMouseMove);
      this.core.removeListener("mousemove", "node", handleNodeMouseMove);
      this.core.removeListener("mouseleave", "node", handleNodeMouseLeave);

      this.core.selectedNodes = [];

      before && this.core.setNodeState({ parentId: node.parentId, id: before }, { active: false, hovered: false });
      after && this.core.setNodeState({ parentId: node.parentId, id: after }, { active: false, hovered: false });
      this.core.setNodeState(node, { active: false });

      if (isChanged) {
        if (siblingNode && siblingNode.id === before) {
          this.core.setNodeState(node, { hovered: false });
          this.core.setNodeState(siblingNode, { hovered: true });
        }

        this.core.features = this.core.modifyFeatures([node.parentId], updater(siblingNode ? undefined : nextPosition));
        this.refresh();
      } else {
        this._renderPlaceholderNodes();
      }
      this._isDragging = false;
    };

    const before = node.id === 1 ? (feature.type === "Polygon" ? positions.length : 0) : node.id - 1;
    const after = node.id === positions.length ? (feature.type === "Polygon" ? 1 : 0) : node.id + 1;
    this.core.render(this.core.modifyFeatures([feature.id], updater(node.position)), { node: this.core.selected });
    this.core.selectedNodes = [node];
    this.core.setNodeState(node, { active: true, hovered: true });
    this.core.addListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, { once: true });

    if (positions.length <= 2 + Number(feature.type === "Polygon")) return;
    this.core.selectedNodes = [
      ...this.core.selectedNodes,
      ...(before ? [{ parentId: node.parentId, id: before }] : []),
      ...(after ? [{ parentId: node.parentId, id: after }] : []),
    ];
    this.core.addListener("mousemove", "node", handleNodeMouseMove);
    this.core.addListener("mouseleave", "node", handleNodeMouseLeave);
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
    this.core.addListener("mouseenter", "node", this._handleNodeHover);
    this.core.addListener("mousemove", this._handleFeatureHover);
    this.core.addListener("click", this._handleFeatureDeselect);
    this.core.addListener("mousedown", "node", this._handleNodeDrag);
    this.core.addListener("mousedown", "line", this._handleLineDrag);
    this.core.addListener("mousedown", "fill", this._handleFillDrag);
    this._renderPlaceholderNodes();
  }

  public disable() {
    this.core.selectedNodes = [];
    this.core.removeListener("mousedown", "node", this._handleNodeDrag);
    this.core.removeListener("mouseenter", "node", this._handleNodeHover);
    this.core.removeListener("mousedown", "fill", this._handleFillDrag);
    this.core.removeListener("mousedown", "line", this._handleLineDrag);
    this.core.removeListener("click", this._handleFeatureDeselect);
    this.core.removeListener("mousemove", this._handleFeatureHover);
    this._resetCursor?.();
  }
}
