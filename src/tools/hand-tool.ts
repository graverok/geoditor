import { AnyTool } from "../core";

export class HandTool extends AnyTool {
  private _current?: AnyTool;

  get icon() {
    return `<g fill="none" transform="translate(-4 -4)">${iconShape}</g>`;
  }

  public on(current: AnyTool | undefined, args?: { preserve: boolean }): boolean {
    this._current = current;
    this.start(args);
    return !args?.preserve;
  }

  public off(next?: AnyTool): void {
    this.finish();
    if (!next || next === this) {
      this._current?.enable();
    } else {
      this._current?.off(next);
    }
  }

  public start(args?: { preserve: boolean }): void {
    if (args?.preserve) {
      this._current?.disable();
    } else {
      this._current?.off(this);
      this.core.state.features.set("disabled", []);
      this.core.render("points", []);
    }
  }
}

const iconShape = `<g stroke-linecap="round"><path d="M11.5 17L10.33 15.5375C9.86747 14.9593 9.02941 14.8529 8.43708 15.2972V15.2972C7.89745 15.7019 7.73245 16.4391 8.04806 17.0352L10.8732 22.3716C11.5664 23.681 12.9267 24.5 14.4083 24.5H16.25H18.9077C20.464 24.5 21.854 23.5264 22.3859 22.0638V22.0638C23.123 20.0369 23.5 17.8967 23.5 15.7399V13C23.5 12.1716 22.8284 11.5 22 11.5V11.5C21.1716 11.5 20.5 12.1716 20.5 13V13"/><path d="M20.5 16.5V10.5C20.5 9.67157 19.8284 9 19 9V9C18.1716 9 17.5 9.67157 17.5 10.5V12"/><path d="M11.5 18V10.5C11.5 9.67157 12.1716 9 13 9V9C13.8284 9 14.5 9.67157 14.5 10.5V15.5"/><path d="M17.5 15.5V9.5C17.5 8.67157 16.8284 8 16 8V8C15.1716 8 14.5 8.67157 14.5 9.5V10"/></g>`;
