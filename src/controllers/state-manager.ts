import { LayerState } from "../types";
import * as lib from "../lib";

export class StateManager {
  private _state: Record<LayerState, (number | number[])[]> = {
    active: [],
    disabled: [],
    hover: [],
  };
  private _callback: (key: LayerState, add: number[][], remove: number[][]) => void;

  constructor(callback: (key: LayerState, add: number[][], remove: number[][]) => void) {
    this._callback = callback;
  }

  public set(key: LayerState, next: (number | number[])[]) {
    this._callback(
      key,
      next.reduce(
        (acc, n) => (this._state[key].some((x) => lib.array.equal(n, x)) ? acc : [...acc, lib.array.arrify(n)]),
        [] as number[][],
      ),
      this._state[key].reduce(
        (acc, n) => (next.some((x) => lib.array.equal(n, x)) ? acc : [...acc, lib.array.arrify(n)]),
        [] as number[][],
      ),
    );
    this._state[key] = next;
  }

  public get(key: LayerState): (number | number[])[];
  public get(nesting: number | number[]): LayerState[];
  public get(payload: LayerState | number | number[]) {
    if (typeof payload === "string") return this._state[payload];
    return (["active", "hover", "disabled"] as LayerState[]).filter((key) =>
      this._state[key].find((n) => lib.array.equal(n, payload)),
    );
  }

  public add(key: LayerState, add: (number | number[])[]) {
    const added = add.filter((n) => !this._state[key].some((x) => lib.array.equal(n, x)));
    this._callback(
      key,
      added.map((n) => lib.array.arrify(n)),
      [],
    );
    this._state[key] = [...this._state[key], ...added];
  }

  public remove(key: LayerState, remove: (number | number[])[]) {
    const removed = remove.filter((n) => this._state[key].some((x) => lib.array.equal(n, x)));
    this._callback(
      key,
      [],
      removed.map((n) => lib.array.arrify(n)),
    );
    this._state[key] = this._state[key].filter((n) => !removed.some((r) => lib.array.equal(n, r)));
  }

  public refresh(key: LayerState) {
    this._callback(
      key,
      this._state[key].map((n) => lib.array.arrify(n)),
      [],
    );
  }
}
