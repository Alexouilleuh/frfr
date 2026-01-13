// ========== CONFIGURATION INTERFACE ==========
let knobSize = 150;
let knobMargin = 20;
let knobsPanel;
let knobTL, knobTR, knobBL, knobBR;

// ========== CLASSE DRAGGABLE PANEL ==========
class DraggablePanel {
    constructor(element, hasGridLayout = false) {
        this.panel = element.elt;
        this.hasGridLayout = hasGridLayout;
        this.isDragging = false;
        this.offsetX = 0;
        this.offsetY = 0;
        // Rendre tout le panel draggable
        this.panel.addEventListener('mousedown', this.onMouseDown.bind(this));
    }

    onMouseDown(e) {
        // Ne pas drag si on interagit avec un slider, bouton, checkbox ou knob canvas
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'BUTTON' || 
            e.target.tagName === 'CANVAS' ||
            e.target.type === 'range' ||
            e.target.classList.contains('p5Slider')) {
            return;
        }

        this.isDragging = true;
        let rect = this.panel.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        
        this.panel.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    }

    onMouseMove = (e) => {
        if (!this.isDragging) return;
        
        let newLeft = e.clientX - this.offsetX;
        let newTop = e.clientY - this.offsetY;
        
        this.panel.style.left = newLeft + 'px';
        this.panel.style.top = newTop + 'px';
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
    }

    onMouseUp = () => {
        this.isDragging = false;
        this.panel.style.cursor = 'default';
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }
}

// ========== CLASSE KNOB ==========
class SimpleKnob {
    constructor(parent, label, initialAngleDeg, onChange) {
        this.label = label;
        this.angle = initialAngleDeg;
        this.onChange = onChange;

        this.wrapper = createDiv();
        this.wrapper.parent(parent);
        this.wrapper.addClass('knob-wrapper');
        this.wrapper.style('width', knobSize + 'px');
        this.wrapper.style('height', knobSize + 24 + 'px');

        this.canvas = document.createElement('canvas');
        this.canvas.width = knobSize;
        this.canvas.height = knobSize;
        this.canvas.className = 'knob-canvas';
        this.wrapper.elt.appendChild(this.canvas);

        this.labelEl = createDiv(this.label).parent(this.wrapper);
        this.labelEl.addClass('knob-label');
        this.valueEl = createDiv(this.angle.toFixed(0) + '°').parent(this.wrapper);
        this.valueEl.addClass('knob-value');

        this.ctx = this.canvas.getContext('2d');
        this.dragging = false;
        this.center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };

        this._onPointerDown = (e) => {
            e.preventDefault();
            this.canvas.setPointerCapture ? this.canvas.setPointerCapture(e.pointerId) : null;
            this.dragging = true;
            this.canvas.style.cursor = 'grabbing';
            this.updateFromEvent(e);
        };
        this._onPointerMove = (e) => {
            if (!this.dragging) return;
            this.updateFromEvent(e);
        };
        this._onPointerUp = (e) => {
            if (!this.dragging) return;
            this.dragging = false;
            this.canvas.style.cursor = 'grab';
            this.updateFromEvent(e);
        };

        this.canvas.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);

        this.draw();
    }

    updateFromEvent(e) {
        let rect = this.canvas.getBoundingClientRect();
        let px = e.clientX - rect.left;
        let py = e.clientY - rect.top;
        let dx = px - this.center.x;
        let dy = py - this.center.y;
        let rad = Math.atan2(dy, dx);
        let deg = rad * 180 / Math.PI;
        this.angle = deg;
        if (this.angle > 180) this.angle -= 360;
        if (this.angle < -180) this.angle += 360;

        if (this.onChange) this.onChange(this.angle);
        this.valueEl.html(Math.round(this.angle) + '°');
        this.draw();
        // Enregistrer ce knob comme dernier utilisé
        lastFocusedKnob = this;
        lastFocusedSlider = null;
    }

    setAngle(deg) {
        this.angle = deg;
        this.valueEl.html(Math.round(this.angle) + '°');
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, w * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffffff';
        ctx.fill();

        ctx.save();
        ctx.translate(this.center.x, this.center.y);
        ctx.rotate((Math.PI / 180) * this.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w * 0.38, 0);
        ctx.strokeStyle = '#000000ff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    }

    remove() {
        this.canvas.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
        this.wrapper.remove();
    }
}

// ========== FONCTION PRINCIPALE DE CRÉATION UI ==========
function createUI() {
    // File input
    fileInput = createFileInput(handleFile);
    let fileContainer = createDiv("");
    fileContainer.id('file-input-container');
    fileInput.parent(fileContainer);

    // Colonne gauche : sliders principaux
    let leftCol = createDiv();
    leftCol.addClass('panel panel-main-controls');

    // Colonne droite : sélecteur d'écran + exports
    let rightCol = createDiv();
    rightCol.addClass('panel panel-export');

    // Créer les sliders principaux
    createMainSliders(leftCol);

    // Créer le sélecteur d'écran et les boutons export
    createExportButtons(rightCol);

    // Créer le panneau de noise séparé
    createNoisePanel();

    // Créer le panneau de knobs
    createKnobsPanel();

        // Créer le panneau de knobs
    createMousePanel();

    // Rendre tous les panneaux draggables
    new DraggablePanel(leftCol);
    new DraggablePanel(rightCol);
}

// ========== SLIDERS PRINCIPAUX ==========
function createMainSliders(parent) {
    let cellSizeLabel, sizeFactorLabel, contrastLabel, strokeLabel;

    cellSizeSlider = createSlider(5, 60, 15, 1).parent(parent);
    createDiv("grid-size").parent(parent);
    cellSizeLabel = createSpan(" 15").parent(parent);
    cellSizeLabel.addClass('slider-label');
    cellSizeSlider.input(() => { 
        cellSizeLabel.html(" " + cellSizeSlider.value()); 
        lastFocusedSlider = cellSizeSlider;
        lastFocusedKnob = null;
    });

    sizeFactorSlider = createSlider(0.2, 10, 1.8, 0.1).parent(parent);
    createDiv("arrow-size (x)").parent(parent);
    sizeFactorLabel = createSpan(" 1.8").parent(parent);
    sizeFactorLabel.addClass('slider-label');
    sizeFactorSlider.input(() => { 
        sizeFactorLabel.html(" " + sizeFactorSlider.value().toFixed(1)); 
        lastFocusedSlider = sizeFactorSlider;
        lastFocusedKnob = null;
    });

    contrastSlider = createSlider(0.1, 4, 1.8, 0.1).parent(parent);
    createDiv("contrast").parent(parent);
    contrastLabel = createSpan(" 1.8").parent(parent);
    contrastLabel.addClass('slider-label');
    contrastSlider.input(() => { 
        contrastLabel.html(" " + contrastSlider.value().toFixed(1)); 
        lastFocusedSlider = contrastSlider;
        lastFocusedKnob = null;
    });

    strokeSlider = createSlider(0.2, 8, strokeWDefault, 0.1).parent(parent);
    createDiv("épaisseur du trait").parent(parent);
    strokeLabel = createSpan(" " + strokeWDefault).parent(parent);
    strokeLabel.addClass('slider-label');
    strokeSlider.input(() => { 
        strokeLabel.html(" " + strokeSlider.value().toFixed(1));
        lastFocusedSlider = strokeSlider;
        lastFocusedKnob = null;
    });
}

function createMousePanel() {
    let mousePanel = createDiv();
    mousePanel.addClass('panel panel-mouse');
    // Slider pour le rayon d'influence de la souris
    let mouseRadiusSlider = createSlider(50, 1500, mouse_influence_radius, 10).parent(mousePanel);
    createDiv("mouse influence radius").parent(mousePanel);
    radiusLabel = createSpan(" " + mouse_influence_radius).parent(mousePanel);
    radiusLabel.addClass('slider-label');
    mouseRadiusSlider.input(() => {
        mouse_influence_radius = mouseRadiusSlider.value();
        radiusLabel.html(" " + mouse_influence_radius);
        lastFocusedSlider = mouseRadiusSlider;
        lastFocusedKnob = null;
    });

    // Rendre le panneau draggable
    new DraggablePanel(mousePanel);
}

// ========== SLIDERS NOISE ==========
function createNoisePanel() {
    let noisePanel = createDiv();
    noisePanel.addClass('panel panel-noise');
    
    let scaleLabel, speedLabel, intensityLabel;

    // Bouton toggle animation
    let toggleBtn = createButton("Stop").parent(noisePanel);
    toggleBtn.addClass('btn-toggle-noise');
    toggleBtn.mousePressed(() => {
        noise_active = !noise_active;
         // + désactiver aussi la souris ? (conflit avec la convergence des flèches !)
        if (!noise_active) {
            toggleBtn.html("Play");
            noise_scale=0
            noise_speed=0
            noise_intensity=0
            noisePanel.style('background-color', '#bbbbbbff');
            mousePanel.style('background-color', '#ff0000ff');
            
        } else {
            toggleBtn.html("Stop");
            noise_scale=noiseScaleSlider.value();
            noise_speed=noiseSpeedSlider.value();
            noise_intensity=noiseIntensitySlider.value();
            noisePanel.style('background-color', '#2aff66');
            mousePanel.style('background-color', '#bbbbbbff');
        }
    });

    noiseScaleSlider = createSlider(0.0001, 0.01, noise_scale, 0.0001).parent(noisePanel);
    createDiv("noise scale").parent(noisePanel);
    scaleLabel = createSpan(" " + noise_scale.toFixed(4)).parent(noisePanel);
    scaleLabel.addClass('slider-label');
    noiseScaleSlider.input(() => {
        noise_scale = noiseScaleSlider.value();
        scaleLabel.html(" " + noise_scale.toFixed(4));
        lastFocusedSlider = noiseScaleSlider;
        lastFocusedKnob = null;
    });

    noiseSpeedSlider = createSlider(0.001, 0.02, noise_speed, 0.001).parent(noisePanel);
    createDiv("noise speed").parent(noisePanel);
    speedLabel = createSpan(" " + noise_speed.toFixed(3)).parent(noisePanel);
    speedLabel.addClass('slider-label');
    noiseSpeedSlider.input(() => {
        noise_speed = noiseSpeedSlider.value();
        speedLabel.html(" " + noise_speed.toFixed(3));
        lastFocusedSlider = noiseSpeedSlider;
        lastFocusedKnob = null;
    });

    noiseIntensitySlider = createSlider(0, 7200, noise_intensity, 10).parent(noisePanel);
    createDiv("noise intensity").parent(noisePanel);
    intensityLabel = createSpan(" " + noise_intensity).parent(noisePanel);
    intensityLabel.addClass('slider-label');
    noiseIntensitySlider.input(() => {
        noise_intensity = noiseIntensitySlider.value();
        intensityLabel.html(" " + noise_intensity);
        lastFocusedSlider = noiseIntensitySlider;
        lastFocusedKnob = null;
    });

    // Rendre le panneau draggable
    new DraggablePanel(noisePanel);
}



// ========== BOUTONS EXPORT ==========
function createExportButtons(parent) {
    let btns = createDiv().parent(parent);
    btns.addClass('export-buttons');

    let svgb = createButton(".svg").parent(btns);
    svgb.addClass('btn-export');
    svgb.mousePressed(() => {
        export_mode_SVG = true;
        console.log("Export SVG statique demandé");
    });

    let pngb = createButton(".png").parent(btns);
    pngb.addClass('btn-export');
    pngb.mousePressed(() => {
        export_mode_PNG = true;
        console.log("Export PNG demandé");
    });

    // Bouton enregistrement vidéo WebM
    let videoBtn = createButton("● REC").parent(btns);
    videoBtn.addClass('btn-export btn-video');
    videoBtn.mousePressed(() => {
        console.log("Bouton REC cliqué, isRecording:", isRecording, "isRecordingSVG:", isRecordingSVG);
        
        if (!isRecording && !isRecordingSVG) {
            console.log("Démarrage enregistrement vidéo");
            startRecording();
            videoBtn.html("■ STOP");
            videoBtn.style('background-color', '#ff0000');
        } else if (isRecording) {
            console.log("Arrêt enregistrement vidéo");
            stopRecording();
            videoBtn.html("● REC");
            videoBtn.style('background-color', '#333');
        }
    });

    // Nouveau bouton pour SVG animé
    let svgAnimBtn = createButton("● SVG").parent(btns);
    svgAnimBtn.addClass('btn-export btn-svg-anim');
    svgAnimBtn.mousePressed(() => {
        console.log("Bouton SVG cliqué, isRecordingSVG:", isRecordingSVG, "isRecording:", isRecording);
        
        if (!isRecordingSVG && !isRecording) {
            console.log("Démarrage enregistrement SVG");
            startSVGRecording();
            svgAnimBtn.html("■ STOP");
            svgAnimBtn.style('background-color', '#ff0000');
        } else if (isRecordingSVG) {
            console.log("Arrêt enregistrement SVG");
            stopSVGRecording();
            svgAnimBtn.html("● SVG");
            svgAnimBtn.style('background-color', '#333');
        }
    });
}

// ========== PANNEAU DE KNOBS ==========
function createKnobsPanel() {
    knobsPanel = createDiv();
    knobsPanel.addClass('panel panel-knobs');

    let cellTL = createDiv().parent(knobsPanel);
    cellTL.addClass('knob-cell');
    
    let cellTR = createDiv().parent(knobsPanel);
    cellTR.addClass('knob-cell');
    
    let cellBL = createDiv().parent(knobsPanel);
    cellBL.addClass('knob-cell');
    
    let cellBR = createDiv().parent(knobsPanel);
    cellBR.addClass('knob-cell');

    knobTL = new SimpleKnob(cellTL, 'haut-gauche', angleTL, (deg) => { angleTL = deg; });
    knobTR = new SimpleKnob(cellTR, 'haut-droite', angleTR, (deg) => { angleTR = deg; });
    knobBL = new SimpleKnob(cellBL, 'bas-gauche', angleBL, (deg) => { angleBL = deg; });
    knobBR = new SimpleKnob(cellBR, 'bas-droite', angleBR, (deg) => { angleBR = deg; });

    knobTL.setAngle(angleTL);
    knobTR.setAngle(angleTR);
    knobBL.setAngle(angleBL);
    knobBR.setAngle(angleBR);

    // Rendre le panneau draggable (avec layout grid)
    new DraggablePanel(knobsPanel, "ANGLE CONTROLS", true);
}
