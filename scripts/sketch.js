// ========== VARIABLES D'IMAGE ==========
let defaultImagePath = 'montagne.jpg';
let img;
let imgLoaded = false;
let inputFileName = "montagne";

// ========== PARAMÈTRES DE RENDU ==========
let padding = 40;

// noise
let noise_scale = 0.001;
let noise_speed = 0.005;
let noise_intensity = 3600;
let noise_active = true; // Animation activée par défaut
let noise_z_frozen = 0; // Position figée du noise quand on pause

// mouse
let mouse_active = true;
let mouse_influence_radius = 200; // Rayon d'influence de la souris en pixels

// corner angles (contrôlés par les knobs dans l'interface)
let angleTL = 0;
let angleTR = 90;
let angleBL = 0;
let angleBR = 90;

// stroke default
let strokeWDefault = 1;

// ========== EXPORT FLAGS ==========
let export_mode_SVG = false;
let export_mode_PNG = false;

// ========== ENREGISTREMENT VIDÉO ==========
let isRecording = false;
let videoRecorder;
let recordedChunks = [];

// ========== ENREGISTREMENT SVG ANIMÉ ==========
let isRecordingSVG = false;
let svgFramesData = [];
let svgRecordingStartFrame = 0;
let arrowsRegistry = new Map();

// ========== RÉFÉRENCES UI (définies dans interface.js) ==========
let cellSizeSlider, sizeFactorSlider, contrastSlider, strokeSlider;
let noiseScaleSlider, noiseSpeedSlider, noiseIntensitySlider;
let fileInput;
let lastFocusedSlider = null;
let lastFocusedKnob = null;

// ========== PRELOAD ==========
function preload() {
    if (defaultImagePath) {
        try {
            img = loadImage(defaultImagePath, () => { imgLoaded = true; });
        } catch (e) {
            imgLoaded = false;
        }
    }
}

// ========== SETUP ==========
function setup() {
    // Créer le canvas
    if (imgLoaded) {
        createCanvas(img.width + padding * 2, img.height + padding * 2);
    } else {
        createCanvas(640, 420);
        background(230);
        text("Import img", 20, 40);
    }

    // Initialiser l'interface (définie dans interface.js)
    createUI();

    // Ajouter la gestion des touches fléchées
    document.addEventListener('keydown', (e) => {
        // Ignorer si on tape dans un input text
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
        
        // Contrôle des sliders avec les flèches
        if (lastFocusedSlider) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                let currentValue = lastFocusedSlider.value();
                let min = parseFloat(lastFocusedSlider.elt.min);
                let stepValue = parseFloat(lastFocusedSlider.elt.step);
                let newValue = Math.max(min, currentValue - stepValue);
                lastFocusedSlider.value(newValue);
                lastFocusedSlider.elt.dispatchEvent(new Event('input'));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                let currentValue = lastFocusedSlider.value();
                let max = parseFloat(lastFocusedSlider.elt.max);
                let stepValue = parseFloat(lastFocusedSlider.elt.step);
                let newValue = Math.min(max, currentValue + stepValue);
                lastFocusedSlider.value(newValue);
                lastFocusedSlider.elt.dispatchEvent(new Event('input'));
            }
        }
        
        // Contrôle des knobs avec les flèches
        if (lastFocusedKnob) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                lastFocusedKnob.setAngle(lastFocusedKnob.angle - 5);
                if (lastFocusedKnob.onChange) lastFocusedKnob.onChange(lastFocusedKnob.angle);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                lastFocusedKnob.setAngle(lastFocusedKnob.angle + 5);
                if (lastFocusedKnob.onChange) lastFocusedKnob.onChange(lastFocusedKnob.angle);
            }
        }
    });
}

// ========== DRAW (LOGIQUE DE RENDU) ==========
function draw() {
    if (!imgLoaded) return;

    // Initialiser la frame pour l'enregistrement SVG
    if (isRecordingSVG) {
        captureFrameSVGData();
    }

    // Calcul du noise avec vitesse fixe (seulement si activé)
    let noise_z;
    if (noise_active) {
        noise_z = frameCount * noise_speed;
        noise_z_frozen = noise_z; // Sauvegarder la position actuelle
    } else {
        noise_z = noise_z_frozen; // Utiliser la position figée
    }

    // Variation souris (seulement si la souris est sur le canvas ET l'animation est désactivée)
    let variation_souris = 0;
    let mouseInfluence = false;
    if (!noise_active && mouse_active && mouseX >= padding && mouseX <= width - padding && 
        mouseY >= padding && mouseY <= height - padding) {
        mouseInfluence = true;
    }

    background(255);
    img.loadPixels();

    // Récupérer les valeurs des sliders
    let cellSize = cellSizeSlider.value();
    let sizeFactor = sizeFactorSlider.value();
    let contrastFactor = contrastSlider.value();
    let strokeW = strokeSlider.value();

    stroke(0);
    strokeWeight(strokeW);
    strokeCap(ROUND);
    noFill();

    let cols = floor(img.width / cellSize);
    let rows = floor(img.height / cellSize);

    let svg;
    if (export_mode_SVG) {
        svg = '<?xml version="1.0" encoding="utf-8"?>\n';
        svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}" viewBox="0 0 ${img.width} ${img.height}">\n`;
        svg += `<g stroke="black" stroke-width="${strokeW}" stroke-linecap="round" fill="none">\n`;
    }

    // Boucle de rendu des flèches
    for (let y = 0; y < img.height; y += cellSize) {
        let ty = y / cellSize / rows;

        for (let x = 0; x < img.width; x += cellSize) {
            let tx = x / cellSize / cols;

            // Interpolation bilinéaire de l'angle
            let angleTop = lerp(angleTL, angleTR, tx);
            let angleBottom = lerp(angleBL, angleBR, tx);
            let angle = lerp(angleTop, angleBottom, ty);

            // Calcul de la luminosité
            let couleur = img.get(x, y);
            let bright = (0.2126 * red(couleur) + 0.7152 * green(couleur) + 0.0722 * blue(couleur)) / 255;
            let mapped = pow(map(bright, 0, 1, 1, 0), contrastFactor);
            let size = mapped * cellSize * sizeFactor;
            if (size < 0.5) continue;

            // Variation de bruit
            let variation = noise(x * noise_scale, y * noise_scale, noise_z) * noise_intensity;

            // Calculer l'angle vers la souris si elle est active
            let finalAngle = angle + variation;
            if (mouseInfluence) {
                // Position de la flèche dans le canvas
                let arrowX = x + cellSize * 0.5 + padding;
                let arrowY = y + cellSize * 0.5 + padding;
                
                // Calculer la distance entre la flèche et la souris
                let dx = mouseX - arrowX;
                let dy = mouseY - arrowY;
                let distance = sqrt(dx * dx + dy * dy);
                
                // Si la flèche est dans le rayon d'influence
                if (distance < mouse_influence_radius) {
                    // Calculer l'angle vers la souris
                    let angleToMouse = atan2(dy, dx) * 180 / PI;
                    
                    // Créer une transition nette avec des cercles concentriques
                    // Diviser le rayon en zones : zone centrale (100% effet) + zone de transition
                    let coreRadius = mouse_influence_radius * 0.1; // 30% du rayon = zone centrale
                    
                    if (distance < coreRadius) {
                        // Dans le cercle central : 100% vers la souris
                        finalAngle = angleToMouse;
                    } else {
                        // Dans la zone de transition : interpolation basée sur la distance du cercle central
                        let transitionDistance = distance - coreRadius;
                        let transitionZone = mouse_influence_radius - coreRadius;
                        let influence = 1 - (transitionDistance / transitionZone);
                        influence = pow(influence, 1.5); // Courbe plus douce
                        
                        // Mélanger l'angle original et l'angle vers la souris
                        finalAngle = lerp(angle + variation, angleToMouse, influence);
                    }
                }
            }

            // Capturer les données pour l'export SVG
            if (isRecordingSVG) {
                recordArrowData({
                    gridX: floor(x / cellSize),
                    gridY: floor(y / cellSize),
                    x: x + cellSize * 0.5,
                    y: y + cellSize * 0.5,
                    angle: finalAngle,
                    size: size,
                    strokeWidth: strokeW
                });
            }

            // Dessiner la flèche
            push();
            translate(x + cellSize * 0.5 + padding, y + cellSize * 0.5 + padding);
            rotate(radians(finalAngle));
            line(-size / 2, 0, size / 2, 0);
            line(size / 2, 0, size / 4, -size / 4);
            line(size / 2, 0, size / 4, size / 4);
            pop();

            // Export SVG
            if (export_mode_SVG) {
                svg += `<g transform="translate(${x + cellSize*0.5},${y + cellSize*0.5}) rotate(${finalAngle})">\n`;
                svg += `<line x1="${-size/2}" y1="0" x2="${size/2}" y2="0"/>\n`;
                svg += `<line x1="${size/2}" y1="0" x2="${size/4}" y2="${-size/4}"/>\n`;
                svg += `<line x1="${size/2}" y1="0" x2="${size/4}" y2="${size/4}"/>\n`;
                svg += `</g>\n`;
            }
        }
    }

    // Finalisation export SVG
    if (export_mode_SVG) {
        svg += `</g>\n</svg>`;
        let blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        let url = URL.createObjectURL(blob);
        let a = createA(url, "export.svg");
        a.attribute("download", inputFileName + ".svg");
        a.hide();
        a.elt.click();
        URL.revokeObjectURL(url);
        export_mode_SVG = false;
    }

    // Export PNG
    if (export_mode_PNG) {
        save(inputFileName + ".png");
        export_mode_PNG = false;
    }
}

// ========== FONCTIONS D'ENREGISTREMENT VIDÉO ==========
function startRecording() {
    recordedChunks = [];
    
    // Capturer le canvas
    let canvas = document.querySelector('canvas');
    let stream = canvas.captureStream(60); // 60 FPS pour plus de fluidité
    
    // Options pour une meilleure qualité
    let options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8000000 // 8 Mbps pour meilleure qualité
    };
    
    // Fallback si vp9 n'est pas supporté
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = {
            mimeType: 'video/webm;codecs=h264',
            videoBitsPerSecond: 8000000
        };
    }
    
    // Second fallback
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = {
            mimeType: 'video/webm',
            videoBitsPerSecond: 8000000
        };
    }
    
    videoRecorder = new MediaRecorder(stream, options);
    
    videoRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };
    
    videoRecorder.onstop = () => {
        let blob = new Blob(recordedChunks, { type: 'video/webm' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = inputFileName + '_recording.webm';
        a.click();
        URL.revokeObjectURL(url);
    };
    
    videoRecorder.start(100); // Enregistrer par chunks de 100ms
    isRecording = true;
    console.log('enregistrement .svg démarré');
}

function stopRecording() {
    if (videoRecorder && isRecording) {
        videoRecorder.stop();
        isRecording = false;
        console.log('enregistrement .svg réussi');
    }
}

// ========== FONCTIONS D'ENREGISTREMENT SVG ANIMÉ ==========

function startSVGRecording() {
    isRecordingSVG = true;
    svgFramesData = [];
    arrowsRegistry.clear();
    svgRecordingStartFrame = frameCount;
    console.log('enregistrement .svg démarré');
}

function stopSVGRecording() {
    if (!isRecordingSVG) return;
    
    isRecordingSVG = false;
    console.log(`enregistrement reussi : ${svgFramesData.length} frames`);
    console.log('en cours');
    
    generateAnimatedSVG();
}

function captureFrameSVGData() {
    if (!isRecordingSVG) return;
    
    const frameIndex = frameCount - svgRecordingStartFrame;
    const frameData = {
        frameIndex: frameIndex,
        timestamp: frameIndex / 60, // 60 FPS
        arrows: []
    };
    
    // Cette fonction sera appelée depuis draw() avec les données de chaque flèche
    svgFramesData.push(frameData);
}

function recordArrowData(arrowData) {
    if (!isRecordingSVG || svgFramesData.length === 0) return;
    
    const currentFrame = svgFramesData[svgFramesData.length - 1];
    currentFrame.arrows.push(arrowData);
}

function generateAnimatedSVG() {
    if (svgFramesData.length === 0) {
        console.error("aucun svg a exporter");
        return;
    }
    
    const fps = 60;
    const duration = svgFramesData.length / fps;
    
    // Organiser les données par flèche (grouper toutes les frames d'une même flèche)
    const arrowTimelines = buildArrowTimelines();
    
    // Générer le SVG
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${img.width}" 
     height="${img.height}" 
     viewBox="0 0 ${img.width} ${img.height}">
  <defs>
    <style>
      .arrow-line { fill: none; stroke: black; stroke-linecap: round; }
    </style>
  </defs>
  <g id="animation-group">
`;

    // Générer chaque flèche avec son animation
    for (const [arrowId, timeline] of arrowTimelines.entries()) {
        svg += generateArrowWithAnimation(arrowId, timeline, duration, fps);
    }
    
    svg += `  </g>
</svg>`;
    
    // Télécharger le fichier
    downloadSVG(svg);
}

function buildArrowTimelines() {
    const timelines = new Map();
    
    svgFramesData.forEach((frameData, frameIndex) => {
        frameData.arrows.forEach((arrow, arrowIndex) => {
            // ID unique par flèche (basé sur sa position dans la grille)
            const arrowId = `arrow_${arrow.gridX}_${arrow.gridY}`;
            
            if (!timelines.has(arrowId)) {
                timelines.set(arrowId, []);
            }
            
            timelines.get(arrowId).push({
                time: frameData.timestamp,
                ...arrow
            });
        });
    });
    
    return timelines;
}

function generateArrowWithAnimation(arrowId, timeline, duration, fps) {
    if (timeline.length === 0) return '';
    
    // Prendre la première frame comme référence
    const firstFrame = timeline[0];
    
    // Détecter si la flèche est statique (même angle sur toutes les frames)
    const isStatic = timeline.every(frame => 
        Math.abs(frame.angle - firstFrame.angle) < 0.1 &&
        Math.abs(frame.size - firstFrame.size) < 0.1
    );
    
    let arrowSVG = `    <g id="${arrowId}">\n`;
    
    if (isStatic) {
        // Flèche statique : pas d'animation
        arrowSVG += generateStaticArrow(firstFrame);
    } else {
        // Flèche animée : utiliser SMIL
        arrowSVG += generateAnimatedArrow(timeline, duration, fps);
    }
    
    arrowSVG += `    </g>\n`;
    
    return arrowSVG;
}

function generateStaticArrow(frame) {
    const { x, y, angle, size, strokeWidth } = frame;
    
    return `      <g transform="translate(${x},${y}) rotate(${angle})">
        <line x1="${-size/2}" y1="0" x2="${size/2}" y2="0" 
              class="arrow-line" stroke-width="${strokeWidth}"/>
        <line x1="${size/2}" y1="0" x2="${size/4}" y2="${-size/4}" 
              class="arrow-line" stroke-width="${strokeWidth}"/>
        <line x1="${size/2}" y1="0" x2="${size/4}" y2="${size/4}" 
              class="arrow-line" stroke-width="${strokeWidth}"/>
      </g>\n`;
}

function generateAnimatedArrow(timeline, duration, fps) {
    const firstFrame = timeline[0];
    const { x, y } = firstFrame;
    
    // Construire les keyframes pour l'animation de rotation
    const rotationKeyTimes = timeline.map((frame, i) => (i / (timeline.length - 1)).toFixed(3)).join(';');
    const rotationValues = timeline.map(frame => frame.angle.toFixed(2)).join(';');
    
    // Construire les keyframes pour l'animation de taille
    const sizeValues = timeline.map(frame => frame.size.toFixed(2)).join(';');
    
    let arrowSVG = `      <g transform="translate(${x},${y})">
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          values="${rotationValues}"
          keyTimes="${rotationKeyTimes}"
          dur="${duration}s"
          repeatCount="indefinite"
          additive="sum"/>
        
        <g id="arrow-shape">
          <line x1="0" y1="0" x2="0" y2="0" class="arrow-line" stroke-width="${firstFrame.strokeWidth}">
            <animate attributeName="x1" 
                     values="${timeline.map(f => (-f.size/2).toFixed(2)).join(';')}"
                     keyTimes="${rotationKeyTimes}"
                     dur="${duration}s" repeatCount="indefinite"/>
            <animate attributeName="x2" 
                     values="${timeline.map(f => (f.size/2).toFixed(2)).join(';')}"
                     keyTimes="${rotationKeyTimes}"
                     dur="${duration}s" repeatCount="indefinite"/>
          </line>
          <line x1="0" y1="0" x2="0" y2="0" class="arrow-line" stroke-width="${firstFrame.strokeWidth}">
            <animate attributeName="x1" 
                     values="${timeline.map(f => (f.size/2).toFixed(2)).join(';')}"
                     keyTimes="${rotationKeyTimes}"
                     dur="${duration}s" repeatCount="indefinite"/>
            <animate attributeName="x2" 
                     values="${timeline.map(f => (f.size/4).toFixed(2)).join(';')}"
                     keyTimes="${rotationKeyTimes}"
                     dur="${duration}s" repeatCount="indefinite"/>
            <animate attributeName="y2" 
                     values="${timeline.map(f => (-f.size/4).toFixed(2)).join(';')}"
                     keyTimes="${rotationKeyTimes}"
                     dur="${duration}s" repeatCount="indefinite"/>
          </line>
          <line x1="0" y1="0" x2="0" y2="0" class="arrow-line" stroke-width="${firstFrame.strokeWidth}">
            <animate attributeName="x1" 
                     values="${timeline.map(f => (f.size/2).toFixed(2)).join(';')}"
                     keyTimes="${rotationKeyTimes}"
                     dur="${duration}s" repeatCount="indefinite"/>
            <animate attributeName="x2" 
                     values="${timeline.map(f => (f.size/4).toFixed(2)).join(';')}"
                     keyTimes="${rotationKeyTimes}"
                     dur="${duration}s" repeatCount="indefinite"/>
            <animate attributeName="y2" 
                     values="${timeline.map(f => (f.size/4).toFixed(2)).join(';')}"
                     keyTimes="${rotationKeyTimes}"
                     dur="${duration}s" repeatCount="indefinite"/>
          </line>
        </g>
      </g>\n`;
    
    return arrowSVG;
}

function downloadSVG(svgContent) {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = inputFileName + '_animé.svg';
    a.click();
    URL.revokeObjectURL(url);
    
    console.log("svg animé téléchargé");
}

// ========== GESTION DES FICHIERS ==========
function handleFile(file) {
    if (file.type === 'image') {
        let name = file.name;
        inputFileName = name.substring(0, name.lastIndexOf(".")) || name;

        loadImage(file.data, (loaded) => {
            img = loaded;
            imgLoaded = true;
            resizeCanvas(img.width + padding * 2, img.height + padding * 2);
        });
    }
}