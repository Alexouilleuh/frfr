let defaultImagePath = 'montagne.jpg';
let img;
let imgLoaded = false;
let inputFileName = "montagne";
let padding = 40;
let noise_scale = 0.001;
let noise_speed = 0.005;
let noise_intensity = 3600;
let noise_active = true;
let noise_z_frozen = 0;
let mouse_active = true;
let mouse_influence_radius = 200;
let mouse_deadzone = 0; 
let angleTL = 0;
let angleTR = 90;
let angleBL = 0;
let angleBR = 90;
let strokeWDefault = 1;

let export_mode_SVG = false;
let export_mode_PNG = false;

let isRecording = false;
let recordedFrames = [];
let recordingStartFrame = 0;
let targetFPS = 30;
let exportWidth = 1920;

let isRecordingSVG = false;
let svgFramesData = [];
let svgRecordingStartFrame = 0;
let arrowsRegistry = new Map();

let cellSizeSlider, sizeFactorSlider, contrastSlider, strokeSlider;
let noiseScaleSlider, noiseSpeedSlider, noiseIntensitySlider;
let fileInput;
let lastFocusedSlider = null;
let lastFocusedKnob = null;

let canvasZoom = 1.0;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;
const ZOOM_SPEED = 0.1;

function preload() {
    if (defaultImagePath) {
        try {
            img = loadImage(defaultImagePath, () => { imgLoaded = true; });
        } catch (e) {
            imgLoaded = false;
        }
    }
}

function setup() {
    if (imgLoaded) {
        createCanvas(img.width + padding * 2, img.height + padding * 2);
    } else {
        createCanvas(640, 420);
        background(230);
        text("Import img", 20, 40);
    }

    createUI();
    initCanvasZoom();

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;        
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

function draw() {
    if (!imgLoaded) return;

    if (isRecordingSVG) {
        captureFrameSVGData();
    }

    let noise_z;
    if (noise_active) {
        noise_z = frameCount * noise_speed;
        noise_z_frozen = noise_z; 
    } else {
        noise_z = noise_z_frozen; 
    }

    let variation_souris = 0;
    let mouseInfluence = false;
    if (!noise_active && mouse_active && mouseX >= padding && mouseX <= width - padding && 
        mouseY >= padding && mouseY <= height - padding) {
        mouseInfluence = true;
    }

    background(255);
    img.loadPixels();

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

    for (let y = 0; y < img.height; y += cellSize) {
        let ty = y / cellSize / rows;

        for (let x = 0; x < img.width; x += cellSize) {
            let tx = x / cellSize / cols;

            let angleTop = lerp(angleTL, angleTR, tx);
            let angleBottom = lerp(angleBL, angleBR, tx);
            let angle = lerp(angleTop, angleBottom, ty);

            let couleur = img.get(x, y);
            let bright = (0.2126 * red(couleur) + 0.7152 * green(couleur) + 0.0722 * blue(couleur)) / 255;
            let mapped = pow(map(bright, 0, 1, 1, 0), contrastFactor);
            let size = mapped * cellSize * sizeFactor;
            if (size < 0.5) continue;

            let variation = noise(x * noise_scale, y * noise_scale, noise_z) * noise_intensity;
            let finalAngle = angle + variation;
            let skipArrow = false;
            
            if (mouseInfluence) {
                let arrowX = x + cellSize * 0.5 + padding;
                let arrowY = y + cellSize * 0.5 + padding;                
                let dx = mouseX - arrowX;
                let dy = mouseY - arrowY;
                let distance = sqrt(dx * dx + dy * dy);
                let deadzoneRadius = mouse_deadzone * cellSize;
                
                if (distance < deadzoneRadius) {
                    skipArrow = true;
                }
                else if (distance < mouse_influence_radius) {
                    let angleToMouseRad = atan2(dy, dx);
                    
                    let coreRadius = mouse_influence_radius * 0.1;
                    
                    if (distance < coreRadius) {
                        finalAngle = degrees(angleToMouseRad);
                    } else {
                        let transitionDistance = distance - coreRadius;
                        let transitionZone = mouse_influence_radius - coreRadius;
                        let influence = 1 - (transitionDistance / transitionZone);
                        let angleToMouse = degrees(angleToMouseRad);                        
                        let baseAngle = angle + variation;
                        
                        while (baseAngle > 180) baseAngle -= 360;
                        while (baseAngle < -180) baseAngle += 360;
                        while (angleToMouse > 180) angleToMouse -= 360;
                        while (angleToMouse < -180) angleToMouse += 360;
                        
                        let angleDiff = angleToMouse - baseAngle;
                        while (angleDiff > 180) angleDiff -= 360;
                        while (angleDiff < -180) angleDiff += 360;
                        
                        finalAngle = baseAngle + angleDiff * influence;
                    }
                }
            }

            if (skipArrow) continue;

            push();
            translate(x + cellSize * 0.5 + padding, y + cellSize * 0.5 + padding);
            rotate(radians(finalAngle));
            line(-size / 2, 0, size / 2, 0);
            line(size / 2, 0, size / 4, -size / 4);
            line(size / 2, 0, size / 4, size / 4);
            pop();

            // DEBUG
            // if (mouseInfluence && distance < mouse_influence_radius) {
            //     stroke(255, 0, 0, 50);
            //     strokeWeight(1);
            //     line(x + cellSize * 0.5 + padding, y + cellSize * 0.5 + padding, mouseX, mouseY);
            //     stroke(0);
            //     strokeWeight(strokeW);
            // }

            if (isRecordingSVG) {
                recordArrowData({
                    x: x + cellSize * 0.5,
                    y: y + cellSize * 0.5,
                    angle: finalAngle,
                    size: size,
                    strokeWidth: strokeW,
                    gridX: x,
                    gridY: y
                });
            }

            if (export_mode_SVG) {
                svg += `<g transform="translate(${x + cellSize*0.5},${y + cellSize*0.5}) rotate(${finalAngle})">\n`;
                svg += `<line x1="${-size/2}" y1="0" x2="${size/2}" y2="0"/>\n`;
                svg += `<line x1="${size/2}" y1="0" x2="${size/4}" y2="${-size/4}"/>\n`;
                svg += `<line x1="${size/2}" y1="0" x2="${size/4}" y2="${size/4}"/>\n`;
                svg += `</g>\n`;
            }
        }
    }

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

    if (export_mode_PNG) {
        save(inputFileName + ".png");
        export_mode_PNG = false;
    }

    if (isRecording) {
        captureFrameForMP4();
    }

    if (mouseInfluence && !isRecording) {
        push();
        noFill();
        stroke(255, 0, 0, 150);
        strokeWeight(2);
        circle(mouseX, mouseY, mouse_influence_radius * 2);
        
        stroke(0, 255, 0, 150);
        if (mouse_deadzone > 0) {
            let deadzoneRadius = mouse_deadzone * cellSizeSlider.value();
            circle(mouseX, mouseY, deadzoneRadius * 2);
        }
        
        fill(255, 0, 0);
        noStroke();
        circle(mouseX, mouseY, 10);
        pop();
    }
}

function startRecording() {
    recordedFrames = [];
    recordingStartFrame = frameCount;
    isRecording = true;
    frameRate(targetFPS);
    console.log('enregistrement de la séquence .png (ffmpeg) démarré');
}

function captureFrameForMP4() {
    let mainCanvas = document.querySelector('canvas');
    
    const canvasWidth = img.width + padding * 2;
    const canvasHeight = img.height + padding * 2;
    const aspectRatio = canvasHeight / canvasWidth;
    const exportHeight = Math.round(exportWidth * aspectRatio);
    
    let tempCanvas = document.createElement('canvas');
    tempCanvas.width = exportWidth;
    tempCanvas.height = exportHeight;
    let tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high'; 
    
    tempCtx.drawImage(mainCanvas, 0, 0, exportWidth, exportHeight);
    
    recordedFrames.push(tempCanvas.toDataURL('image/png'));
    
    const frameNumber = recordedFrames.length;
    if (frameNumber % 30 === 0) {
        console.log(`frame ${frameNumber} enregistrée (${(frameNumber / 30).toFixed(1)}s)`);
    }
}

function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    frameRate(60);
    console.log(`enregistrement terminé : ${recordedFrames.length} frames capturées`);
    
    createZipAndDownload();
}

async function createZipAndDownload() {
    if (recordedFrames.length === 0) {
        console.error("aucune frame à exporter");
        return;
    }
    
    const canvasWidth = img.width + padding * 2;
    const canvasHeight = img.height + padding * 2;
    const aspectRatio = canvasHeight / canvasWidth;
    const exportHeight = Math.round(exportWidth * aspectRatio);
    
    console.log(`création du dossier : ${recordedFrames.length} images ${exportWidth}x${exportHeight}px à 30 FPS`);
    console.log(`durée de la vidéo : ${(recordedFrames.length / 30).toFixed(2)} secondes`);
    
    const zip = new JSZip();
    const folderName = `${inputFileName}_sequence`;
    
    console.log('ajout des frames au dossier...');
    
    for (let i = 0; i < recordedFrames.length; i++) {
        const frameNumber = String(i + 1).padStart(5, '0');
        const filename = `${inputFileName}_frame_${frameNumber}.png`;
        const base64Data = recordedFrames[i].split(',')[1];
        
        zip.file(filename, base64Data, {base64: true});
        
        const progress = ((i + 1) / recordedFrames.length * 100);
        if (progress % 10 < (100 / recordedFrames.length) || i === recordedFrames.length - 1) {
            console.log(`${progress.toFixed(0)}% - ${i + 1}/${recordedFrames.length} frames ajoutées`);
        }
    }
    
    const infoText = `Séquence .png (ffmpeg) - ${inputFileName}
———
Nombre de frames : ${recordedFrames.length}
Framerate : 30 FPS
Dimensions : ${exportWidth}x${exportHeight}px
Durée : ${(recordedFrames.length / 30).toFixed(2)} sec

Prérequis : FFmpeg
———
Ouvrir un onglet terminal et taper :
brew install ffmpeg

Conversion vidéo MP4 (FFmpeg) :
———
Ouvrir un terminal dans le dossier téléchargé puis taper : 
ffmpeg -framerate 30 -i ${inputFileName}_frame_%05d.png -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p output.mp4
La vidéo se trouvera dans le dossier téléchargé

Importer dans After Effects :
———
1. Fichier > Importer > Fichier
2. Sélectionner ${inputFileName}_frame_00001.png
3. Cocher "Sequence PNG"
4. Cliquer sur Importer
`;
    
    zip.file('_README.txt', infoText);
    
    console.log('création du dossier...');
    
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE'
    }, function updateCallback(metadata) {
        const percent = metadata.percent.toFixed(0);
        if (percent % 5 === 0 || percent === '100') {
            console.log(`  📦 ${percent}%`);
        }
    });
    
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    
    const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(2);
    console.log(`dossier téléchargé : ${folderName}.zip (${sizeMB} MB)`);
    console.log(`${recordedFrames.length} frames exportées !`);
    
    recordedFrames = [];
}


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
        timestamp: frameIndex / 30,
        arrows: []
    };
    
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
    const arrowTimelines = buildArrowTimelines();
    
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

    for (const [arrowId, timeline] of arrowTimelines.entries()) {
        svg += generateArrowWithAnimation(arrowId, timeline, duration, fps);
    }
    
    svg += `  </g>
</svg>`;
    
    downloadSVG(svg);
}

function buildArrowTimelines() {
    const timelines = new Map();
    
    svgFramesData.forEach((frameData, frameIndex) => {
        frameData.arrows.forEach((arrow, arrowIndex) => {
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
    const firstFrame = timeline[0];    
    const isStatic = timeline.every(frame => 
        Math.abs(frame.angle - firstFrame.angle) < 0.1 &&
        Math.abs(frame.size - firstFrame.size) < 0.1
    );
    
    let arrowSVG = `    <g id="${arrowId}">\n`;
    
    if (isStatic) {
        arrowSVG += generateStaticArrow(firstFrame);
    } else {
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
    const rotationKeyTimes = timeline.map((frame, i) => (i / (timeline.length - 1)).toFixed(3)).join(';');
    const rotationValues = timeline.map(frame => frame.angle.toFixed(2)).join(';');    
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
function initCanvasZoom() {
    let canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
        const newZoom = constrain(canvasZoom + delta, MIN_ZOOM, MAX_ZOOM);
        
        setCanvasZoom(newZoom);
    }, { passive: false });
    
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        if (e.key === '+' || e.key === '=' && !e.shiftKey) {
            e.preventDefault();
            const newZoom = constrain(canvasZoom + ZOOM_SPEED, MIN_ZOOM, MAX_ZOOM);
            setCanvasZoom(newZoom);
        }
        
        if (e.key === '-' && !e.shiftKey) {
            e.preventDefault();
            const newZoom = constrain(canvasZoom - ZOOM_SPEED, MIN_ZOOM, MAX_ZOOM);
            setCanvasZoom(newZoom);
        }
    });
}

function setCanvasZoom(zoom) {
    canvasZoom = zoom;
    let canvas = document.querySelector('canvas');
    if (canvas) {
        canvas.style.transform = `scale(${canvasZoom})`;
        canvas.style.transformOrigin = 'top left';
        console.log(`zoom: ${Math.round(canvasZoom * 100)}%`);
    }
}