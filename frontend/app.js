const apiBase = "http://127.0.0.1:8000";

const pdfInput = document.getElementById("pdfInput");
const detectBtn = document.getElementById("detectBtn");
const previewBtn = document.getElementById("previewBtn");

const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageIndicator = document.getElementById("pageIndicator");

const companyName = document.getElementById("companyName");
const companyId = document.getElementById("companyId");

const pdfCanvas = document.getElementById("pdfCanvas");
const pdfCtx = pdfCanvas.getContext("2d");

const detectionKeywordsEl = document.getElementById("detectionKeywords");
const zonesList = document.getElementById("zonesList");
const rulesList = document.getElementById("rulesList");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");
const addRuleBtn = document.getElementById("addRuleBtn");

const noZoneSelectedEl = document.getElementById("noZoneSelected");
const zoneEditorEl = document.getElementById("zoneEditor");
const zoneLabelInput = document.getElementById("zoneLabelInput");
const zoneStyleSelect = document.getElementById("zoneStyleSelect");
const deleteZoneBtn = document.getElementById("deleteZoneBtn");
const duplicateZoneBtn = document.getElementById("duplicateZoneBtn");
const zoneCoordsEl = document.getElementById("zoneCoords");

const snapToGridCheckbox = document.getElementById("snapToGridCheckbox");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

const copyPageZonesToAllBtn = document.getElementById("copyPageZonesToAllBtn");
const validateTemplateBtn = document.getElementById("validateTemplateBtn");

const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomLabel = document.getElementById("zoomLabel");

let currentFile = null;
let currentTemplate = null;

let pdfDoc = null;
let currentPage = 1;
let totalPages = 1;

let zones = []; // all zones across all pages
let rules = [];

// Konva
let stage = null;
let layer = null;
let transformer = null;
let selectedZone = null;
let zoneShapes = []; // { zone, rect }

let baseViewportWidth = 0;
let baseViewportHeight = 0;
let currentZoom = 1.0;

// Undo/redo
let historyStack = [];
let historyIndex = -1;

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


// ---------------------------------------------------------
// Utility: deep clone state for history
// ---------------------------------------------------------
function cloneState() {
    return {
        zones: JSON.parse(JSON.stringify(zones)),
        rules: JSON.parse(JSON.stringify(rules)),
        currentPage,
        zoom: currentZoom
    };
}

function pushHistory() {
    const state = cloneState();
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(state);
    historyIndex = historyStack.length - 1;
    updateUndoRedoButtons();
}

function restoreState(state) {
    zones = JSON.parse(JSON.stringify(state.zones));
    rules = JSON.parse(JSON.stringify(state.rules));
    currentPage = state.currentPage;
    currentZoom = state.zoom;
}

function updateUndoRedoButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= historyStack.length - 1;
}


// ---------------------------------------------------------
// Style-based coloring
// ---------------------------------------------------------
function styleToColors(style) {
    switch (style) {
        case "white":
            return { stroke: "#1565c0", fill: "rgba(33, 150, 243, 0.15)" };
        case "blur":
            return { stroke: "#8e24aa", fill: "rgba(142, 36, 170, 0.15)" };
        case "black":
        default:
            return { stroke: "#c62828", fill: "rgba(244, 67, 54, 0.15)" };
    }
}


// ---------------------------------------------------------
// Snap-to-grid
// ---------------------------------------------------------
function snap(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}

function maybeSnap(value) {
    if (!snapToGridCheckbox.checked) return value;
    return snap(value, 10);
}


// ---------------------------------------------------------
// Detect Company
// ---------------------------------------------------------
detectBtn.onclick = async () => {
    if (!pdfInput.files.length) {
        alert("Upload a PDF first");
        return;
    }

    const form = new FormData();
    form.append("file", pdfInput.files[0]);

    const res = await fetch(apiBase + "/detect-company", {
        method: "POST",
        body: form
    });

    const data = await res.json();

    companyName.textContent = data.display_name || "Unknown";
    companyId.textContent = data.company_id || "None";

    if (!data.company_id) {
        alert("No matching template found");
        return;
    }

    await loadTemplate(data.company_id);
    pushHistory();
};


// ---------------------------------------------------------
// Load Template
// ---------------------------------------------------------
async function loadTemplate(id) {
    const res = await fetch(apiBase + "/templates/get/" + id);
    if (!res.ok) {
        alert("Failed to load template");
        return;
    }

    const template = await res.json();
    currentTemplate = template;

    detectionKeywordsEl.value =
        (template.detection?.text_contains || []).join(", ");

    zones = [];
    zonesList.innerHTML = "";

    const pagePatterns = template.page_patterns || [];
    pagePatterns.forEach(pattern => {
        (pattern.zones || []).forEach(z => zones.push(z));
    });

    rules = template.rules || [];
    rulesList.innerHTML = "";
    rules.forEach(r => addRuleToUI(r));

    refreshZonesList();
    clearSelectedZone();
}


// ---------------------------------------------------------
// PDF Preview
// ---------------------------------------------------------
previewBtn.onclick = async () => {
    if (!pdfInput.files.length) {
        alert("Upload a PDF first");
        return;
    }

    currentFile = pdfInput.files[0];
    const url = URL.createObjectURL(currentFile);

    pdfDoc = await pdfjsLib.getDocument(url).promise;
    totalPages = pdfDoc.numPages;
    currentPage = 1;
    currentZoom = 1.0;

    updatePageIndicator();
    await renderPage(currentPage);
    pushHistory();
};

async function renderPage(pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    baseViewportWidth = viewport.width;
    baseViewportHeight = viewport.height;

    const scaledWidth = baseViewportWidth * currentZoom;
    const scaledHeight = baseViewportHeight * currentZoom;

    pdfCanvas.width = scaledWidth;
    pdfCanvas.height = scaledHeight;

    const konvaContainer = document.getElementById("konvaContainer");
    konvaContainer.style.width = scaledWidth + "px";
    konvaContainer.style.height = scaledHeight + "px";

    await page.render({
        canvasContext: pdfCtx,
        viewport: page.getViewport({ scale: 1.5 * currentZoom })
    }).promise;

    if (!stage) {
        stage = new Konva.Stage({
            container: "konvaContainer",
            width: scaledWidth,
            height: scaledHeight,
            draggable: true
        });
        layer = new Konva.Layer();
        stage.add(layer);

        transformer = new Konva.Transformer({
            rotateEnabled: false,
            ignoreStroke: true,
            enabledAnchors: [
                "top-left", "top-center", "top-right",
                "middle-left", "middle-right",
                "bottom-left", "bottom-center", "bottom-right"
            ]
        });
        layer.add(transformer);

        stage.on("mousedown", (e) => {
            if (e.target === stage) {
                clearSelectedZone();
            }
        });

        stage.on("wheel", (e) => {
            e.evt.preventDefault();
            const oldScale = currentZoom;
            const pointer = stage.getPointerPosition();
            const scaleBy = 1.05;
            const direction = e.evt.deltaY > 0 ? -1 : 1;
            const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
            setZoom(newScale, pointer);
        });
    } else {
        stage.size({ width: scaledWidth, height: scaledHeight });
        layer.destroyChildren();
        layer.add(transformer);
    }

    zoneShapes = [];
    drawZonesForCurrentPage();
    layer.draw();
    updateZoomLabel();
}

function setZoom(newZoom, center) {
    newZoom = Math.max(0.5, Math.min(3.0, newZoom));
    const oldZoom = currentZoom;
    currentZoom = newZoom;

    const scale = currentZoom;
    const mousePointTo = {
        x: (center.x - stage.x()) / oldZoom,
        y: (center.y - stage.y()) / oldZoom
    };

    stage.scale({ x: scale, y: scale });

    const newPos = {
        x: center.x - mousePointTo.x * scale,
        y: center.y - mousePointTo.y * scale
    };
    stage.position(newPos);
    stage.batchDraw();
    updateZoomLabel();
}

function updateZoomLabel() {
    zoomLabel.textContent = Math.round(currentZoom * 100) + "%";
}


// ---------------------------------------------------------
// Page Navigation
// ---------------------------------------------------------
prevPageBtn.onclick = async () => {
    if (currentPage > 1) {
        currentPage--;
        updatePageIndicator();
        await renderPage(currentPage);
        refreshZonesList();
        clearSelectedZone();
        pushHistory();
    }
};

nextPageBtn.onclick = async () => {
    if (currentPage < totalPages) {
        currentPage++;
        updatePageIndicator();
        await renderPage(currentPage);
        refreshZonesList();
        clearSelectedZone();
        pushHistory();
    }
};

function updatePageIndicator() {
    pageIndicator.textContent = `Page ${currentPage} / ${totalPages}`;
}


// ---------------------------------------------------------
// Draw zones for current page (Konva)
// ---------------------------------------------------------
function drawZonesForCurrentPage() {
    if (!layer) return;

    zones
        .filter(z => z.page_index === currentPage - 1)
        .forEach(z => createKonvaRectForZone(z));

    layer.draw();
}

function createKonvaRectForZone(zone) {
    const colors = styleToColors(zone.style || "black");

    const rect = new Konva.Rect({
        x: zone.x1,
        y: zone.y1,
        width: zone.x2 - zone.x1,
        height: zone.y2 - zone.y1,
        stroke: colors.stroke,
        strokeWidth: 2,
        fill: colors.fill,
        draggable: true
    });

    rect._zone = zone;

    rect.on("click", (e) => {
        e.cancelBubble = true;
        selectZone(zone, rect);
    });

    rect.on("dragmove", () => {
        let x = rect.x();
        let y = rect.y();
        x = maybeSnap(x);
        y = maybeSnap(y);
        rect.position({ x, y });
        updateZoneFromRect(zone, rect);
        updateSelectedZoneUI();
        refreshZonesListHighlight();
    });

    rect.on("transformend", () => {
        const scaleX = rect.scaleX();
        const scaleY = rect.scaleY();

        let newWidth = rect.width() * scaleX;
        let newHeight = rect.height() * scaleY;
        let newX = rect.x();
        let newY = rect.y();

        newX = maybeSnap(newX);
        newY = maybeSnap(newY);
        newWidth = maybeSnap(newWidth);
        newHeight = maybeSnap(newHeight);

        rect.width(newWidth);
        rect.height(newHeight);
        rect.position({ x: newX, y: newY });
        rect.scaleX(1);
        rect.scaleY(1);

        updateZoneFromRect(zone, rect);
        updateSelectedZoneUI();
        refreshZonesListHighlight();
    });

    layer.add(rect);
    zoneShapes.push({ zone, rect });
}

function updateZoneFromRect(zone, rect) {
    zone.x1 = rect.x();
    zone.y1 = rect.y();
    zone.x2 = rect.x() + rect.width();
    zone.y2 = rect.y() + rect.height();
}


// ---------------------------------------------------------
// Selection handling
// ---------------------------------------------------------
function selectZone(zone, rect) {
    selectedZone = zone;
    transformer.nodes([rect]);
    updateSelectedZoneUI();
    refreshZonesListHighlight();
    layer.draw();
}

function clearSelectedZone() {
    selectedZone = null;
    if (transformer) transformer.nodes([]);
    noZoneSelectedEl.style.display = "block";
    zoneEditorEl.style.display = "none";
    refreshZonesListHighlight();
    if (layer) layer.draw();
}

function getRectForZone(zone) {
    const entry = zoneShapes.find(zs => zs.zone === zone);
    return entry ? entry.rect : null;
}

function updateSelectedZoneUI() {
    if (!selectedZone) return;

    noZoneSelectedEl.style.display = "none";
    zoneEditorEl.style.display = "block";

    zoneLabelInput.value = selectedZone.label || "";
    zoneStyleSelect.value = selectedZone.style || "black";

    const coordsText = `x1: ${selectedZone.x1.toFixed(1)}, y1: ${selectedZone.y1.toFixed(1)}\n` +
                       `x2: ${selectedZone.x2.toFixed(1)}, y2: ${selectedZone.y2.toFixed(1)}`;
    zoneCoordsEl.textContent = coordsText;
}

function refreshZonesListHighlight() {
    const items = zonesList.querySelectorAll(".zone-item");
    items.forEach((item) => {
        const label = item.getAttribute("data-label");
        if (selectedZone && selectedZone.label === label) {
            item.classList.add("selected");
        } else {
            item.classList.remove("selected");
        }
    });
}


// ---------------------------------------------------------
// Zones UI
// ---------------------------------------------------------
function refreshZonesList() {
    zonesList.innerHTML = "";

    zones
        .filter(z => z.page_index === currentPage - 1)
        .forEach(z => addZoneToUI(z));

    refreshZonesListHighlight();
}

function addZoneToUI(zone) {
    const div = document.createElement("div");
    div.className = "zone-item";
    div.setAttribute("data-label", zone.label || "");
    div.innerHTML = `
        <p><strong>${zone.label}</strong></p>
        <p>Page: ${zone.page_index + 1}</p>
        <p>x1: ${zone.x1.toFixed(1)}, y1: ${zone.y1.toFixed(1)}</p>
        <p>x2: ${zone.x2.toFixed(1)}, y2: ${zone.y2.toFixed(1)}</p>
        <p>Style: ${zone.style}</p>
    `;
    div.onclick = () => {
        const rect = getRectForZone(zone);
        if (rect) {
            selectZone(zone, rect);
        }
    };
    zonesList.appendChild(div);
}


// ---------------------------------------------------------
// Sidebar zone editor events
// ---------------------------------------------------------
zoneLabelInput.addEventListener("input", () => {
    if (!selectedZone) return;
    selectedZone.label = zoneLabelInput.value || "";
    refreshZonesList();
    pushHistory();
});

zoneStyleSelect.addEventListener("change", () => {
    if (!selectedZone) return;
    selectedZone.style = zoneStyleSelect.value;

    const rect = getRectForZone(selectedZone);
    if (rect) {
        const colors = styleToColors(selectedZone.style);
        rect.stroke(colors.stroke);
        rect.fill(colors.fill);
        layer.draw();
    }
    refreshZonesList();
    pushHistory();
});

deleteZoneBtn.addEventListener("click", () => {
    if (!selectedZone) return;

    zones = zones.filter(z => z !== selectedZone);

    const entryIndex = zoneShapes.findIndex(zs => zs.zone === selectedZone);
    if (entryIndex !== -1) {
        zoneShapes[entryIndex].rect.destroy();
        zoneShapes.splice(entryIndex, 1);
    }

    clearSelectedZone();
    refreshZonesList();
    if (layer) layer.draw();
    pushHistory();
});

duplicateZoneBtn.addEventListener("click", () => {
    if (!selectedZone) return;

    const newZone = JSON.parse(JSON.stringify(selectedZone));
    newZone.label = selectedZone.label + "_copy";
    const offset = 10;
    newZone.x1 += offset;
    newZone.y1 += offset;
    newZone.x2 += offset;
    newZone.y2 += offset;

    zones.push(newZone);

    if (newZone.page_index === currentPage - 1) {
        const rect = createKonvaRectForZone(newZone);
        refreshZonesList();
        selectZone(newZone, getRectForZone(newZone));
    } else {
        refreshZonesList();
    }

    if (layer) layer.draw();
    pushHistory();
});

// Delete via keyboard
document.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedZone) {
            deleteZoneBtn.click();
        }
    }
});


// ---------------------------------------------------------
// Rules UI (editable)
// ---------------------------------------------------------
addRuleBtn.onclick = () => {
    const rule = {
        label: "new_rule_" + (rules.length + 1),
        type: "regex",
        pattern: "",
        scope: "all_pages",
        style: "black"
    };
    rules.push(rule);
    addRuleToUI(rule);
    pushHistory();
};

function addRuleToUI(rule) {
    const div = document.createElement("div");
    div.className = "zone-item";

    const patternId = `pattern_${rule.label}`;
    const scopeId = `scope_${rule.label}`;
    const styleId = `style_${rule.label}`;

    div.innerHTML = `
        <p><strong>${rule.label}</strong></p>
        <label>Pattern:
            <input type="text" id="${patternId}" value="${rule.pattern || ""}">
        </label>
        <label>Scope:
            <select id="${scopeId}">
                <option value="all_pages">All pages</option>
                <option value="first_page">First page</option>
                <option value="last_page">Last page</option>
            </select>
        </label>
        <label>Style:
            <select id="${styleId}">
                <option value="black">Black</option>
                <option value="white">White</option>
                <option value="blur">Blur</option>
            </select>
        </label>
        <button class="danger">Delete Rule</button>
    `;

    const patternInput = div.querySelector(`#${patternId}`);
    const scopeSelect = div.querySelector(`#${scopeId}`);
    const styleSelect = div.querySelector(`#${styleId}`);
    const deleteBtn = div.querySelector("button.danger");

    patternInput.addEventListener("input", () => {
        rule.pattern = patternInput.value;
        pushHistory();
    });

    scopeSelect.value = rule.scope || "all_pages";
    scopeSelect.addEventListener("change", () => {
        rule.scope = scopeSelect.value;
        pushHistory();
    });

    styleSelect.value = rule.style || "black";
    styleSelect.addEventListener("change", () => {
        rule.style = styleSelect.value;
        pushHistory();
    });

    deleteBtn.addEventListener("click", () => {
        rules = rules.filter(r => r !== rule);
        div.remove();
        pushHistory();
    });

    rulesList.appendChild(div);
}


// ---------------------------------------------------------
// Page tools
// ---------------------------------------------------------
copyPageZonesToAllBtn.addEventListener("click", () => {
    const pageIndex = currentPage - 1;
    const pageZones = zones.filter(z => z.page_index === pageIndex);
    if (pageZones.length === 0) {
        alert("No zones on this page to copy.");
        return;
    }

    for (let p = 0; p < totalPages; p++) {
        if (p === pageIndex) continue;
        zones = zones.filter(z => !(z.page_index === p));
        pageZones.forEach(z => {
            const clone = JSON.parse(JSON.stringify(z));
            clone.page_index = p;
            zones.push(clone);
        });
    }

    refreshZonesList();
    if (layer) {
        layer.destroyChildren();
        layer.add(transformer);
        zoneShapes = [];
        drawZonesForCurrentPage();
        layer.draw();
    }
    pushHistory();
    alert("Zones copied to all pages.");
});


// ---------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------
undoBtn.addEventListener("click", async () => {
    if (historyIndex <= 0) return;
    historyIndex--;
    const state = historyStack[historyIndex];
    restoreState(state);
    updateUndoRedoButtons();
    await renderPage(currentPage);
    refreshZonesList();
    clearSelectedZone();
});

redoBtn.addEventListener("click", async () => {
    if (historyIndex >= historyStack.length - 1) return;
    historyIndex++;
    const state = historyStack[historyIndex];
    restoreState(state);
    updateUndoRedoButtons();
    await renderPage(currentPage);
    refreshZonesList();
    clearSelectedZone();
});


// ---------------------------------------------------------
// Zoom buttons
// ---------------------------------------------------------
zoomInBtn.addEventListener("click", () => {
    if (!stage) return;
    const center = {
        x: stage.width() / 2,
        y: stage.height() / 2
    };
    setZoom(currentZoom * 1.1, center);
    pushHistory();
});

zoomOutBtn.addEventListener("click", () => {
    if (!stage) return;
    const center = {
        x: stage.width() / 2,
        y: stage.height() / 2
    };
    setZoom(currentZoom / 1.1, center);
    pushHistory();
});


// ---------------------------------------------------------
// Template validation
// ---------------------------------------------------------
validateTemplateBtn.addEventListener("click", () => {
    const errors = [];

    const labels = new Set();
    for (const z of zones) {
        if (!z.label || z.label.trim() === "") {
            errors.push(`Zone on page ${z.page_index + 1} has empty label.`);
        }
        if (labels.has(z.label)) {
            errors.push(`Duplicate zone label: "${z.label}".`);
        }
        labels.add(z.label);

        if (z.x2 <= z.x1 || z.y2 <= z.y1) {
            errors.push(`Zone "${z.label}" on page ${z.page_index + 1} has invalid coordinates.`);
        }
    }

    for (const r of rules) {
        if (!r.pattern || r.pattern.trim() === "") {
            errors.push(`Rule "${r.label}" has empty pattern.`);
        }
    }

    for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
            const a = zones[i];
            const b = zones[j];
            if (a.page_index !== b.page_index) continue;
            if (rectsOverlap(a, b)) {
                errors.push(`Zones "${a.label}" and "${b.label}" overlap on page ${a.page_index + 1}.`);
            }
        }
    }

    if (errors.length === 0) {
        alert("Template validation passed. No issues found.");
    } else {
        alert("Template validation found issues:\n\n" + errors.join("\n"));
    }
});

function rectsOverlap(a, b) {
    return !(
        a.x2 <= b.x1 ||
        a.x1 >= b.x2 ||
        a.y2 <= b.y1 ||
        a.y1 >= b.y2
    );
}


// ---------------------------------------------------------
// Save Template
// ---------------------------------------------------------
saveTemplateBtn.onclick = async () => {
    if (!currentTemplate) {
        alert("No template loaded");
        return;
    }

    const keywords = detectionKeywordsEl.value
        .split(",")
        .map(k => k.trim())
        .filter(k => k.length > 0);

    currentTemplate.detection = currentTemplate.detection || {};
    currentTemplate.detection.text_contains = keywords;

    const pageMap = {};
    zones.forEach(z => {
        if (!pageMap[z.page_index]) pageMap[z.page_index] = [];
        pageMap[z.page_index].push(z);
    });

    currentTemplate.page_patterns = Object.keys(pageMap).map(pageIndex => ({
        page_type: "specific",
        page_index: parseInt(pageIndex),
        zones: pageMap[pageIndex]
    }));

    currentTemplate.rules = rules;

    const res = await fetch(apiBase + "/templates/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentTemplate)
    });

    if (!res.ok) {
        alert("Failed to save template");
        return;
    }

    alert("Template saved successfully");
    pushHistory();
};
