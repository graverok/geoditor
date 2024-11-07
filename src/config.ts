export type AppendSvg = Record<string, undefined | [string, string]>;

const emptyRect = `<rect x="0" y="0" width="32" height="32" opacity="0"/>`;
export const polygonShape = `<circle cx="8.5" cy="10.5" r="1"/><circle cx="8.5" cy="21.5" r="1"/><circle cx="19" cy="21.5" r="1"/><circle cx="24" cy="10.5" r="1"/><path d="M8.5 11.5V20.5"/><path d="M9.5 21.5H18"/><path d="M23.5794 11.4265L19.41 20.5991"/><path d="M23 10.5H9.5"/>`;
export const lineShapeBase = `<circle cx="8.5" cy="21.5" r="1"/><circle cx="11.5" cy="11.5" r="1"/><circle cx="23.5" cy="11.5" r="1"/><path d="M11.2208 12.4307L8.8 20.5"/>`;
export const lineShapeFill = `${lineShapeBase}<path d="M12.5 11.5H22.5"/>`;
export const lineShapeExtend = `${lineShapeBase}<path d="M12.5 11.5H22.5" stroke-dasharray="2 2"/>`;
export const disabledShape = `<circle cx="16" cy="16" r="7.5" /><path d="M10.6953 21.3047L21.3203 10.6797"/>`;
const squareShape = `<rect x="20.5" y="20.5" width="8" height="8" rx="1.5" />`;
const plusShape = `<g stroke-linecap="round" fill="none" stroke-width="1"><path d="M24.5 22V27" /><path d="M22 24.5H27" /></g>`;
const minusShape = `<g stroke-linecap="square" fill="none"><path d="M22 24.5H27" /></g>`;
const pointShape = `<circle cx="24.5" cy="24.5" r="2.5" stroke-width="1.2"/>`;
export const filterSvg = `<filter id="dropshadow" height="200%" width="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dx="0.4" dy="0.8" result="offsetblur"/><feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

const appendScale = (content: string, strokeWidth = 1, translate = "32 32") =>
  `<g transform="scale(0.5 0.5) translate(${translate})" stroke-width="${strokeWidth * 2}">${emptyRect}${content}</g>`;

export const appendSvg: AppendSvg = {
  default: undefined,
  plus: [`<g stroke="#FFF">${plusShape}</g>`, `<g stroke-width="1">${emptyRect}${squareShape}</g>`],
  minus: [`<g stroke="#FFF">${minusShape}</g>`, `<g stroke-width="1">${emptyRect}${squareShape}</g>`],
  disabled: [
    `<g fill="none" stroke="#FFF">${appendScale(disabledShape)}</g>`,
    `<g fill="#EB2F12" stroke="#EB2F12">${appendScale(disabledShape, 3)}</g>`,
  ],
  extend: [appendScale(lineShapeExtend), `<g fill="#FFF" stroke="#FFF">${appendScale(lineShapeFill, 3)}</g>`],
  line: [appendScale(lineShapeFill), `<g fill="#FFF" stroke="#FFF">${appendScale(lineShapeFill, 3)}</g>`],
  polygon: [
    appendScale(polygonShape, 1, "34 32"),
    `<g fill="#FFF" stroke="#FFF">${appendScale(polygonShape, 3, "34 32")}</g>`,
  ],
  point: [
    `<g fill="none" stroke="#FFF">${pointShape}</g>`,
    `<g fill="#000" stroke="#000">${emptyRect}${pointShape}</g>`,
  ],
};

export const transform = (content: string, translate?: string) => {
  if (!translate) return content;
  return `<g transform="translate(${translate})">${content}</g>`;
};
