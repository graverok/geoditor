export type AppendSvg = Record<string, undefined | [string, string]>;

const emptyRect = `<rect x="0" y="0" width="32" height="32" opacity="0"/>`;
export const polygonShape = `<circle cx="8.5" cy="10.5" r="1"/><circle cx="8.5" cy="21.5" r="1"/><circle cx="19" cy="21.5" r="1"/><circle cx="24" cy="10.5" r="1"/><path d="M8.5 11.5V20.5"/><path d="M9.5 21.5H18"/><path d="M23.5794 11.4265L19.41 20.5991"/><path d="M23 10.5H9.5"/>`;
export const lineShapeBase = `<circle cx="8.5" cy="21.5" r="1"/><circle cx="11.5" cy="11.5" r="1"/><circle cx="23.5" cy="11.5" r="1"/><path d="M11.2208 12.4307L8.8 20.5"/>`;
export const lineShapeFill = `${lineShapeBase}<path d="M12.5 11.5H22.5"/>`;
export const lineShapeExtend = `${lineShapeBase}<path d="M12.5 11.5H22.5" stroke-dasharray="2 2"/>`;
export const disabledShape = `<circle cx="16" cy="16" r="7.5" /><path d="M10.6953 21.3047L21.3203 10.6797"/>`;
export const deleteShape = `<g stroke-linecap="round"><path d="M8.5 10.5H23.5"/><path d="M10 10.5L10.929 22.5767C10.9691 23.0977 11.4035 23.5 11.926 23.5H20.074C20.5965 23.5 21.0309 23.0977 21.071 22.5767L22 10.5"/><path d="M14 10.5V9C14 8.44772 14.4477 8 15 8H17C17.5523 8 18 8.44772 18 9V10.5"/><path d="M14 20.5L13.5 14"/><path d="M18 20.5L18.5 14"/></g>`;
export const handShape = `<g stroke-linecap="round"><path d="M11.5 17L10.33 15.5375C9.86747 14.9593 9.02941 14.8529 8.43708 15.2972V15.2972C7.89745 15.7019 7.73245 16.4391 8.04806 17.0352L10.8732 22.3716C11.5664 23.681 12.9267 24.5 14.4083 24.5H16.25H18.9077C20.464 24.5 21.854 23.5264 22.3859 22.0638V22.0638C23.123 20.0369 23.5 17.8967 23.5 15.7399V13C23.5 12.1716 22.8284 11.5 22 11.5V11.5C21.1716 11.5 20.5 12.1716 20.5 13V13"/><path d="M20.5 16.5V10.5C20.5 9.67157 19.8284 9 19 9V9C18.1716 9 17.5 9.67157 17.5 10.5V12"/><path d="M11.5 18V10.5C11.5 9.67157 12.1716 9 13 9V9C13.8284 9 14.5 9.67157 14.5 10.5V15.5"/><path d="M17.5 15.5V9.5C17.5 8.67157 16.8284 8 16 8V8C15.1716 8 14.5 8.67157 14.5 9.5V10"/></g>`;
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
