// ------------------------------------------------------------
// text_layer_builder.js (DISABLED)
// ------------------------------------------------------------
// We disable the custom TextLayerBuilder because TextLayer.js
// handles all text extraction, charMap building, and search logic.
// PDF.js v5 no longer requires a custom builder, and keeping this
// file active breaks search and OCR fallback.

export class TextLayerBuilder {
  constructor() {
    // Intentionally empty
  }

  setTextContent() {
    // Intentionally empty
  }

  render() {
    // Intentionally empty — TextLayer.js handles rendering
  }
}
