import { AnyTool, Core } from "../controllers";
import { geometryTools, positionTools } from "../lib";
import { Node, SourceEvent } from "../types";

export class ModifyTool extends AnyTool {
  private _isDragging = false;
  private _hovered: number | undefined;
  private _resetCursor!: (() => void) | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "modify";
    this._handleFeatureHover = this._handleFeatureHover.bind(this);
    this._handleFeatureDeselect = this._handleFeatureDeselect.bind(this);
    this._handleAddNodePlaceholder = this._handleAddNodePlaceholder.bind(this);
    this._handleFeaturesDrag = this._handleFeaturesDrag.bind(this);
    this._handleFillDrag = this._handleFillDrag.bind(this);
    this._handleLineDrag = this._handleLineDrag.bind(this);
    this._handleNodeHover = this._handleNodeHover.bind(this);
    this._handleNodeDrag = this._handleNodeDrag.bind(this);
  }

  get config() {
    return;
  }

  private _setHovered(id?: number) {
    if (id === this._hovered) return;
    this._hovered && this.core.setFeatureState(this._hovered, { hovered: false });
    id && this.core.setFeatureState(id, { hovered: true });
    this._hovered = id;
    this.core.render(this.core.features, { node: this.core.selected });
  }

  private _handleFeatureHover() {
    if (this._isDragging) return;
    this.core.setCursor(this.core.hovered ? "pointer" : "default");
    this._setHovered(this.core.hovered?.node || this.core.hovered?.line || this.core.hovered?.fill);
  }

  private _handleFeatureDeselect() {
    if (this._hovered) return;
    this.core.selected = [];
    this.core.render(this.core.features, { node: this.core.selected });
  }

  private _handleAddNodePlaceholder(e: SourceEvent) {
    let nodeBefore: number | undefined;

    const addPoint = (ev: SourceEvent) => {
      setTimeout(() => {
        if (!this._hovered) return resetNodes();
        if (!this.core.selected.includes(this._hovered)) return resetNodes();
        if (this.core.hovered?.node) return;

        const feature = this.core.getFeature(this._hovered);
        if (!feature) return;
        const { before, after, position } = geometryTools.getClosestLine(feature, ev.position);
        if (!position || nodeBefore === before) return;
        nodeBefore = before;

        this.core.render(
          this.core.modifyFeatures([feature.id], (positions) => [
            ...positions.slice(0, before),
            position,
            ...positions.slice(after - 1),
          ]),
          { fill: false, line: false, node: this.core.selected },
        );
      });
    };

    const resetNodes = () => {
      if (!nodeBefore) return;
      this.core.setNodeState(this._hovered, nodeBefore + 1, { hovered: false });
      nodeBefore = undefined;
      this.core.render(this.core.features, { fill: false, line: false, node: this.core.selected });
    };

    !this._isDragging && addPoint(e);

    const handleMouseMove = (ev: SourceEvent) => {
      if (this._isDragging) return;
      addPoint(ev);
    };

    const handleMouseDown = () => {
      if (this.core.hovered?.node) return;
      resetNodes();
    };

    const handleMouseLeave = () => {
      resetNodes();
      this.core.removeListener("mousemove", "line", handleMouseMove);
      this.core.removeListener("mousedown", "line", handleMouseDown);
      this.core.removeListener("mouseup", "line", addPoint);
      this.core.removeListener("mouseleave", "line", handleMouseLeave);
      this.core.removeListener("mousemove", "node", handleNodeMouseMove);
    };

    const handleNodeMouseMove = (ev: SourceEvent) => {
      if (this._isDragging) return;
      const node = ev.nodes[0];
      const feature = this.core.getFeature(node.parentId);
      const isPlaceholder = !geometryTools.getPoints(feature).some((pos) => positionTools.equal(pos, node.position));
      !isPlaceholder && resetNodes();
    };

    this.core.addListener("mousemove", "line", handleMouseMove);
    this.core.addListener("mousedown", "line", handleMouseDown);
    this.core.addListener("mouseup", "line", addPoint);
    this.core.addListener("mouseleave", "line", handleMouseLeave);
    this.core.addListener("mousemove", "node", handleNodeMouseMove);
  }

  private _handleFeaturesDrag(e: SourceEvent) {
    this._isDragging = true;
    let isChanged = false;
    if (!this._hovered) return;

    const id = this._hovered;
    let event = e;
    this.core.setFeatureState(id, { active: true });
    this.core.selected = [id];
    this.core.render(this.core.features, { node: this.core.selected });

    const handleMouseMove = (ev: SourceEvent) => {
      isChanged = true;
      event = ev;
      const delta = positionTools.subtract(e.position, event.position);
      this.core.render(
        this.core.modifyFeatures([id], (positions) => positions.map((item) => positionTools.add(item, delta))),
        { node: this.core.selected },
      );
    };

    const handleMouseUp = () => {
      this.core.removeListener("mousemove", handleMouseMove);
      const delta = positionTools.subtract(e.position, event.position);
      this.core.features = this.core.modifyFeatures([id], (positions) =>
        positions.map((item) => positionTools.add(item, delta)),
      );
      this.core.setFeatureState(id, { active: false });
      this.core.render(this.core.features, { node: this.core.selected });
      this._isDragging = false;
      isChanged && this.core.updateData();
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
    !this._isDragging && this.core.setNodeState(node?.parentId, node?.id, { hovered: true });

    const handleMouseMove = (ev: SourceEvent) => {
      if (this._isDragging) return;
      this.core.setNodeState(node?.parentId, node?.id, { hovered: false });
      node = ev.nodes[0];
      this.core.setNodeState(node?.parentId, node?.id, { hovered: true });
    };

    const handleMouseLeave = () => {
      !this._isDragging && this.core.setNodeState(node?.parentId, node?.id, { hovered: false });
      this.core.removeListener("mouseleave", "node", handleMouseLeave);
      this.core.removeListener("mousemove", "node", handleMouseMove);
    };

    this.core.addListener("mouseleave", "node", handleMouseLeave);
    this.core.addListener("mousemove", "node", handleMouseMove);
    this._isDragging &&
      document.addEventListener(
        "mouseup",
        () => {
          this.core.setNodeState(node?.parentId, node?.id, { hovered: true });
        },
        { once: true },
      );
  }

  private _handleNodeDrag(e: SourceEvent) {
    const node = e.nodes[0];
    const feature = this.core.getFeature(node?.parentId);
    if (!node || !feature) return;

    let nextPosition = node.position;
    let siblingNode: Node | undefined;

    this.core.selected = [feature.id];
    this.core.setNodeState(feature.id, node.id, { active: true });
    this._isDragging = true;

    const positions = geometryTools.getPoints(feature);
    const isPlaceholder = !positions.some((pos) => positionTools.equal(pos, node.position));
    let isChanged = isPlaceholder;

    const before = node.id === 1 ? (feature.type === "Polygon" ? positions.length : 0) : node.id - 1;
    const after =
      feature.type === "Polygon"
        ? node.id !== positions.length + (isPlaceholder ? 1 : 0)
          ? node.id + 1
          : 1
        : node.id !== positions.length || isPlaceholder
          ? node.id + 1
          : 0;

    const handleNodeMouseMove = (ev: SourceEvent) => {
      siblingNode = ev.nodes.find((node) => [before, after].includes(node.id));
      siblingNode && this.core.setNodeState(feature.id, siblingNode.id, { hovered: true, active: true });
    };

    const handleNodeMouseLeave = () => {
      siblingNode && this.core.setNodeState(feature.id, siblingNode.id, { hovered: false, active: false });
      siblingNode = undefined;
    };

    const handleMouseMove = (ev: SourceEvent) => {
      isChanged = true;
      nextPosition =
        siblingNode?.position || positionTools.add(node.position, positionTools.subtract(e.position, ev.position));
      this.core.features = this.core.modifyFeatures([feature.id], () => [
        ...positions.slice(0, node.id - 1),
        nextPosition,
        ...positions.slice(isPlaceholder ? node.id - 1 : node.id),
      ]);

      this.core.render(this.core.features, { node: this.core.selected });
    };

    const handleMouseUp = () => {
      this.core.removeListener("mousemove", handleMouseMove);
      this.core.removeListener("mousemove", "node", handleNodeMouseMove);
      this.core.removeListener("mouseleave", "node", handleNodeMouseLeave);

      this.core.setNodeState(feature.id, node.id, { active: false });
      siblingNode && this.core.setNodeState(feature.id, siblingNode.id, { active: false });
      this._isDragging = false;

      if (!isChanged) return;
      this.core.features = this.core.modifyFeatures([feature.id], () => [
        ...positions.slice(0, node.id - 1),
        ...(!siblingNode ? [nextPosition] : []),
        ...positions.slice(isPlaceholder ? node.id - 1 : node.id),
      ]);

      this.core.updateData();
      this.core.render(this.core.features, { node: this.core.selected });
    };

    if (positions.length > 2 + (isPlaceholder ? -1 : 0) + (feature.type === "Polygon" ? 1 : 0)) {
      this.core.addListener("mousemove", "node", handleNodeMouseMove);
      this.core.addListener("mouseleave", "node", handleNodeMouseLeave);
    }
    this.core.addListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, { once: true });
  }

  public refresh() {
    this.core.render(this.core.features, { node: this.core.selected });
  }

  public enable() {
    this._resetCursor = this.core.setCursor("default");
    this.core.render(this.core.features, { node: this.core.selected });
    this.core.addListener("mouseenter", "node", this._handleNodeHover);
    this.core.addListener("mousemove", this._handleFeatureHover);
    this.core.addListener("click", this._handleFeatureDeselect);
    this.core.addListener("mousedown", "node", this._handleNodeDrag);
    this.core.addListener("mousedown", "line", this._handleLineDrag);
    this.core.addListener("mousedown", "fill", this._handleFillDrag);
    this.core.addListener("mouseenter", "line", this._handleAddNodePlaceholder);
  }

  public disable() {
    this.core.removeListener("mouseenter", "line", this._handleAddNodePlaceholder);
    this.core.removeListener("mousedown", "node", this._handleNodeDrag);
    this.core.removeListener("mouseenter", "node", this._handleNodeHover);
    this.core.removeListener("mousedown", "fill", this._handleFillDrag);
    this.core.removeListener("mousedown", "line", this._handleLineDrag);
    this.core.removeListener("click", this._handleFeatureDeselect);
    this.core.removeListener("mousemove", this._handleFeatureHover);
    this._resetCursor?.();
  }
}
