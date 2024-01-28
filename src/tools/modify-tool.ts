import { AnyTool, Core, RenderEvent } from "../controllers";
import { geometryTools, positionTools } from "../lib";
import { Geometry, NodeFeature, Position } from "../types";

export class ModifyTool extends AnyTool {
  private isDragging = false;
  private _hovered: number | undefined;
  private resetCursor!: (() => void) | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "modify";
    this.handleFeatureHover = this.handleFeatureHover.bind(this);
    this.handleFeatureDeselect = this.handleFeatureDeselect.bind(this);
    this.handleNodeLineAdd = this.handleNodeLineAdd.bind(this);
    this.handleNodePointAdd = this.handleNodePointAdd.bind(this);
    this.handleFeaturesDrag = this.handleFeaturesDrag.bind(this);
    this.handleFillDrag = this.handleFillDrag.bind(this);
    this.handleLineDrag = this.handleLineDrag.bind(this);
    this.handleNodeHover = this.handleNodeHover.bind(this);
    this.handleNodeDrag = this.handleNodeDrag.bind(this);
  }

  get config() {
    return;
  }

  private setHovered(id?: number) {
    if (id === this._hovered) return;
    this._hovered && this.core.setFeatureState(["line", "fill"], this._hovered, { hovered: false });
    id && this.core.setFeatureState(["line", "fill"], id, { hovered: true });
    this._hovered = id;
    this.core.render(this.core.features);
  }

  private handleFeatureHover() {
    if (this.isDragging) return;
    this.core.setCursor(this.core.hovered ? "pointer" : "default");
    this.setHovered(this.core.hovered?.point || this.core.hovered?.line || this.core.hovered?.fill);
  }

  private handleFeatureDeselect() {
    if (this._hovered) return;
    this.core.selected = [];
  }

  private handleNodeLineAdd(e: RenderEvent) {
    if (this.isDragging) return;
    let feature = e.features[0];
    if (!feature) return;
    const { id, layer } = feature;
    if (!id || !layer) return;

    let nodeId: number | undefined;
    let timerId: number | undefined;

    const unmount = () => {
      timerId && window.clearTimeout(timerId);
      this.core.removeNode(nodeId);
      this.core.removeListener("mousemove", layer, handleMouseMove);
      this.core.removeListener("mouseleave", layer, handleMouseLeave);
      this.core.removeListener("mousedown", layer, handleMouseDown);
    };

    const addNode = (point: Position) => {
      timerId && window.clearTimeout(timerId);
      const { position, ...rest } = geometryTools.getClosestLine(this.core.getFeature(id)?.geometry as Geometry, point);
      nodeId = geometryTools.getPositions(this.core.getFeature(id)?.geometry).length + 1;
      this.core.addNode(nodeId, position, { featureId: +feature.id, ...rest });
    };

    const handleMouseMove = (ev: RenderEvent) => {
      if (this.isDragging) return;
      if (this.core.hovered?.point) {
        if (nodeId) {
          this.core.removeNode(nodeId);
          nodeId = undefined;
        }
        return;
      }
      if (this.core.hovered?.node) return;
      if (!this.core.selected.includes(id)) return;
      feature = ev.features.find((f) => f.id === feature.id) ? feature : ev.features[0];
      addNode(ev.position);
    };

    const handleMouseLeave = () => !this.isDragging && unmount();

    const handleMouseDown = () => {
      if (!this.core.hovered?.node) {
        this.core.removeNode(nodeId);
        nodeId = undefined;
      }

      this.core.addListener(
        "mouseup",
        (ev: RenderEvent) => {
          if (!this.core.hovered?.line) return unmount();
          if (!this.core.hovered?.node) timerId = window.setTimeout(() => addNode(ev.position), 30);
        },
        { once: true },
      );
    };

    this.core.addListener("mousemove", layer, handleMouseMove);
    this.core.addListener("mouseleave", layer, handleMouseLeave);
    this.core.addListener("mousedown", layer, handleMouseDown);
  }

  private handleNodePointAdd() {
    if (!this._hovered) return;
    let nodeId: number | undefined;

    const cleanUp = () => {
      nodeId && this.core.removeNode(nodeId);
      this.core.removeListener("mouseleave", "point", handleMouseLeave);
      this.core.removeListener("mousemove", "point", handleMouseMove);
    };

    const handleMouseMove = (ev: RenderEvent) => {
      if (this.isDragging) return;
      if (!this._hovered) return;
      const editFeature = this.core.getFeature(this._hovered);
      if (!editFeature) return;
      const { id, position, ...rest } = geometryTools.getClosestPoint(editFeature.geometry, ev.position);

      if (nodeId && nodeId !== id) this.core.removeNode(nodeId);
      nodeId = id;
      this.core.addNode(nodeId, position, { ...rest, featureId: editFeature.id });
    };

    const handleMouseLeave = () => {
      this.isDragging
        ? document.addEventListener("mouseup", () => !this.core.hovered?.node && cleanUp(), { once: true })
        : cleanUp();
    };

    this.core.addListener("mouseleave", "point", handleMouseLeave);
    this.core.addListener("mousemove", "point", handleMouseMove);
  }

  private handleFeaturesDrag(e: RenderEvent) {
    this.isDragging = true;
    let isChanged = false;
    const feature = e.features.find((f) => this._hovered === f.id);
    if (!feature) return;
    let updatedFeatures = this.core.features;
    this.core.setFeatureState(["line", "fill", "point"], feature.id, {
      active: true,
    });
    this.core.render(this.core.features, { point: [] });

    const handleMouseMove = (ev: RenderEvent) => {
      isChanged = true;
      const delta = positionTools.subtract(e.position, ev.position);
      updatedFeatures = this.core.modifyFeatures([feature.id], (positions) =>
        positions.map((item) => positionTools.add(item, delta)),
      );
      this.core.render(updatedFeatures, { point: [] });
    };

    const handleMouseUp = () => {
      this.core.removeListener("mousemove", handleMouseMove);
      this.core.features = updatedFeatures;
      this.core.setFeatureState(["line", "fill", "point"], feature.id, { active: false });
      this.core.selected = [feature.id];
      this.core.render(this.core.features);
      this.isDragging = false;
      isChanged && this.core.updateData();
    };

    this.core.addListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, { once: true });
  }

  private handleFillDrag(e: RenderEvent) {
    if (this.core.hovered?.node) return;
    if (this.core.hovered?.line) return;
    this.handleFeaturesDrag(e);
  }

  private handleLineDrag(e: RenderEvent) {
    if (this.core.hovered?.node) return;
    this.handleFeaturesDrag(e);
  }

  private handleNodeHover() {
    const id = this.core.hovered?.node;
    if (!id) return;

    this.core.setFeatureState(["node"], id, { hovered: true });

    const handleMouseLeave = () => {
      this.core.setFeatureState(["node"], id, { hovered: false });
      this.core.removeListener("mouseleave", "node", handleMouseLeave);
    };

    this.core.addListener("mouseleave", "node", handleMouseLeave);
  }

  private handleNodeDrag(e: RenderEvent) {
    const nodeFeature = e.features[0] as NodeFeature;
    const editFeature = this.core.getFeature(nodeFeature?.properties.featureId);
    if (!nodeFeature || !editFeature) return;

    this.core.selected = [editFeature.id];
    let isChanged = false;
    this.isDragging = true;
    const position = nodeFeature.geometry.coordinates;
    let nextPosition = position;
    let nodeId = nodeFeature.id;
    const { before, featureId } = nodeFeature.properties;
    let after = nodeFeature.properties.after;

    if (nodeFeature.id > geometryTools.getPositions(editFeature.geometry).length) {
      isChanged = true;
      nodeId = after;
      this.core.features = this.core.modifyFeatures([editFeature.id], (position) => [
        ...position.slice(0, before),
        nodeFeature.geometry.coordinates,
        ...position.slice(before),
      ]);

      after += 1;
    }

    if (nodeFeature.id !== nodeId) {
      this.core.removeNode(nodeFeature.id);
      this.core.addNode(nodeId, position, { before, after, featureId });
    }
    this.core.setFeatureState(["node"], nodeId, { hovered: true, active: true });

    const positions = geometryTools.getPositions(this.core.getFeature(featureId)?.geometry);
    this.core.addNode(before, positions[before - 1], { featureId });
    this.core.addNode(after, positions[after - 1], { featureId });
    this.core.setFeatureState(["node"], before, { hovered: false, selected: false, active: false });
    this.core.setFeatureState(["node"], after, { hovered: false, selected: false, active: false });

    let hoveredSibling: NodeFeature | undefined;

    const handleNodeMouseMove = (ev: RenderEvent) => {
      hoveredSibling = ev.features.find((f) => f.id !== nodeId) as unknown as NodeFeature;
    };

    const handleNodeMouseLeave = () => {
      hoveredSibling = undefined;
    };

    const handleMouseMove = (ev: RenderEvent) => {
      isChanged = true;

      nextPosition =
        hoveredSibling?.geometry?.coordinates ||
        positionTools.add(position, positionTools.subtract(e.position, ev.position));

      this.core.features = this.core.modifyFeatures([featureId], (positions) => [
        ...positions.slice(0, nodeId - 1),
        nextPosition,
        ...positions.slice(nodeId),
      ]);

      this.core.render(this.core.features);
      this.core.addNode(nodeId, nextPosition, nodeFeature.properties);
    };

    const handleMouseUp = () => {
      this.core.removeListener("mousemove", handleMouseMove);
      this.core.removeListener("mousemove", "node", handleNodeMouseMove);
      this.core.removeListener("mouseleave", "node", handleNodeMouseLeave);

      this.core.setFeatureState(["node"], nodeId, { active: false });
      this.isDragging = false;

      hoveredSibling?.id === before ? this.core.removeNode(nodeId) : this.core.removeNode(before);
      this.core.removeNode(after);

      if (!isChanged) return;
      this.core.features = this.core.modifyFeatures([featureId], (positions) => [
        ...positions.slice(0, nodeId - 1),
        ...(!hoveredSibling ? [nextPosition] : []),
        ...positions.slice(nodeId),
      ]);
      this.core.updateData();
      this.core.render(this.core.features);
    };

    this.core.addListener("mousemove", "node", handleNodeMouseMove);
    this.core.addListener("mouseleave", "node", handleNodeMouseLeave);
    this.core.addListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, { once: true });
  }

  public enable() {
    this.resetCursor = this.core.setCursor("default");
    this.core.addListener("mousemove", this.handleFeatureHover);
    this.core.addListener("click", this.handleFeatureDeselect);
    this.core.addListener("mousedown", "line", this.handleLineDrag);
    this.core.addListener("mousedown", "fill", this.handleFillDrag);
    this.core.addListener("mouseenter", "node", this.handleNodeHover);
    this.core.addListener("mousedown", "node", this.handleNodeDrag);
    this.core.addListener("mouseenter", "point", this.handleNodePointAdd);
    this.core.addListener("mouseenter", "line", this.handleNodeLineAdd);
  }

  public disable() {
    this.core.removeListener("mouseenter", "line", this.handleNodeLineAdd);
    this.core.removeListener("mouseenter", "point", this.handleNodePointAdd);
    this.core.removeListener("mousedown", "node", this.handleNodeDrag);
    this.core.removeListener("mouseenter", "node", this.handleNodeHover);
    this.core.removeListener("mousedown", "fill", this.handleFillDrag);
    this.core.removeListener("mousedown", "line", this.handleLineDrag);
    this.core.removeListener("click", this.handleFeatureDeselect);
    this.core.removeListener("mousemove", this.handleFeatureHover);
    this.resetCursor?.();
  }
}
