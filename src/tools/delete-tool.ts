import { AnyTool } from "../core";
import * as lib from "../lib";
import { Feature } from "../types";

export class DeleteTool extends AnyTool {
  get icon() {
    return `<g fill="none" transform="translate(-4 -4)">${iconShape}</g>`;
  }

  public on(current: AnyTool | undefined, indices?: number[]): boolean {
    const _deletion = indices || this.core.state.features.get("active");
    if (!_deletion.length) return false;
    if (current?.delete(_deletion)) return false;

    let unselect = false;
    this.core.features = this.core.features.reduce((acc, feature) => {
      if (!_deletion.some((n) => lib.array.plain(n) === feature.nesting[0])) return [...acc, feature];
      if (_deletion.some((n) => n === feature.nesting[0])) {
        unselect = true;
        return acc;
      }
      const _shapes = _deletion.filter((n) => lib.array.plain(n) === feature.nesting[0]) as number[][];
      const mutated = (_shapes as number[][]).reduce<Feature | undefined>(
        (mutating, nesting) => lib.mutateFeature(mutating, nesting),
        feature,
      );
      if (mutated) return [...acc, mutated];
      unselect = true;
      return acc;
    }, [] as Feature[]);

    if (unselect) {
      this.core.state.features.set("active", []);
      this.core.render("points", []);
    }
    return false;
  }
}

const iconShape = `<g stroke-linecap="round"><path d="M8.5 10.5H23.5"/><path d="M10 10.5L10.929 22.5767C10.9691 23.0977 11.4035 23.5 11.926 23.5H20.074C20.5965 23.5 21.0309 23.0977 21.071 22.5767L22 10.5"/><path d="M14 10.5V9C14 8.44772 14.4477 8 15 8H17C17.5523 8 18 8.44772 18 9V10.5"/><path d="M14 20.5L13.5 14"/><path d="M18 20.5L18.5 14"/></g>`;
