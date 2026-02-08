// Minimal TextLayerBuilder for PDF.js v5
export class TextLayerBuilder {
  constructor({ textLayerDiv, pageIndex, viewport, enhanceTextSelection }) {
    this.textLayerDiv = textLayerDiv;
    this.pageIndex = pageIndex;
    this.viewport = viewport;
    this.enhanceTextSelection = enhanceTextSelection;
    this.textContent = null;
  }

  setTextContent(textContent) {
    this.textContent = textContent;
  }

  render() {
    if (!this.textContent) return;

    const fragment = document.createDocumentFragment();

    for (const item of this.textContent.items) {
      const span = document.createElement("span");
      span.textContent = item.str;

      const transform = pdfjsLib.Util.transform(
        this.viewport.transform,
        item.transform
      );

      const fontHeight = Math.hypot(transform[2], transform[3]);
      span.style.fontSize = `${fontHeight}px`;
      span.style.transform = `matrix(${transform.join(",")})`;
      span.style.position = "absolute";
      span.style.whiteSpace = "pre";

      fragment.appendChild(span);
    }

    this.textLayerDiv.appendChild(fragment);
  }
}
