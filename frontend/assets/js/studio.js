import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Utility: Print Zone UV Computation ---
function computePrintZoneUVs(geometry, worldMatrix, side = 'front') {
    const posAttr = geometry.getAttribute('position');
    const normalAttr = geometry.getAttribute('normal');
    const uvAttr = geometry.getAttribute('uv');
    const index = geometry.getIndex();
    
    let minU = 1, minV = 1, maxU = 0, maxV = 0;
    const count = index ? index.count : posAttr.count;
    let foundFaces = 0;
    
    for (let i = 0; i < count; i += 3) {
        const a = index ? index.getX(i) : i;
        const b = index ? index.getX(i+1) : i+1;
        const c = index ? index.getX(i+2) : i+2;
        
        // Check normal
        const nA = new THREE.Vector3(normalAttr.getX(a), normalAttr.getY(a), normalAttr.getZ(a));
        nA.transformDirection(worldMatrix); // Get world normal
        
        const isTargetSide = (side === 'front') ? (nA.z > 0.1) : (nA.z < -0.1);
        
        if (isTargetSide) {
            const uA = uvAttr.getX(a), vA = uvAttr.getY(a);
            const uB = uvAttr.getX(b), vB = uvAttr.getY(b);
            const uC = uvAttr.getX(c), vC = uvAttr.getY(c);
            
            minU = Math.min(minU, uA, uB, uC);
            maxU = Math.max(maxU, uA, uB, uC);
            minV = Math.min(minV, vA, vB, vC);
            maxV = Math.max(maxV, vA, vB, vC);
            foundFaces++;
        }
    }
    
    if (foundFaces === 0) {
        return { u0: 0, v0: 0, u1: 1, v1: 1 };
    }
    
    // Add small padding
    return { 
        u0: Math.max(0, minU - 0.05), 
        v0: Math.max(0, minV - 0.05), 
        u1: Math.min(1, maxU + 0.05), 
        v1: Math.min(1, maxV + 0.05) 
    };
}


document.addEventListener('DOMContentLoaded', () => {
    if (!AuthManager || !AuthManager.user) {
        Utils.showToast('Please sign in to use the Design Studio', 'warning');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }
    Studio3D.init();
});

const Studio3D = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    tshirtMesh: null,
    tshirtMeshes: [],
    modelContainer: null,

    // Interaction Raycasting
    mouse: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    
    // Canvas Texture System
    printCanvas: null,
    printCtx: null,
    printTexture: null,
    printZoneUV: null,
    printZoneUVs: {
        front: null,
        back: null
    },
    
    // Helper to safely load clean (non-tainting) HTMLImageElement
    loadCleanImage: (src) => {
        return new Promise((resolve, reject) => {
            if (!src) return reject(new Error('No src provided'));
            if (src.startsWith('data:') || src.startsWith('blob:')) {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
                return;
            }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => {
                fetch(src)
                    .then(res => res.blob())
                    .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        const bImg = new Image();
                        bImg.onload = () => resolve(bImg);
                        bImg.onerror = reject;
                        bImg.src = blobUrl;
                    })
                    .catch(reject);
            };
            img.src = src;
        });
    },

    generatePreviewSnapshot: (side = 'front') => {
        if (!Studio3D.renderer || !Studio3D.scene || !Studio3D.camera) return null;
        try {
            const oldRotY = Studio3D.modelContainer ? Studio3D.modelContainer.rotation.y : 0;
            if (Studio3D.modelContainer) {
                Studio3D.modelContainer.rotation.y = (side === 'back') ? Math.PI : 0;
            }
            Studio3D.renderer.render(Studio3D.scene, Studio3D.camera);
            const screenshot = Studio3D.renderer.domElement.toDataURL('image/png');
            if (Studio3D.modelContainer) {
                Studio3D.modelContainer.rotation.y = oldRotY;
            }
            if (screenshot && screenshot.length > 200) {
                return screenshot;
            }
            return Studio3D.printCanvas ? Studio3D.printCanvas.toDataURL('image/png') : null;
        } catch (e) {
            console.error('Snapshot generation error:', e);
            return Studio3D.printCanvas ? Studio3D.printCanvas.toDataURL('image/png') : null;
        }
    },
    
    // General T-shirt State
    state: {
        shirtColor: '#ffffff',
        fabric: '100% Cotton',
        size: 'M',
        quantity: 1
    },

    // Multi-Layer Design State
    designs: {
        front: [], // Array of layer objects {id, name, type, img, rawSrc, x, y, scale, rotation}
        back:  []
    },
    currentSide: 'front',
    activeLayerId: null,

    getActiveLayer: () => {
        const layers = Studio3D.designs[Studio3D.currentSide] || [];
        if (!layers.length) return null;
        let found = layers.find(l => l.id === Studio3D.activeLayerId);
        if (!found && layers.length > 0) {
            found = layers[layers.length - 1];
            Studio3D.activeLayerId = found.id;
        }
        return found;
    },

    setActiveLayer: (id) => {
        Studio3D.activeLayerId = id;
        Studio3D.syncTextControlsFromActiveLayer();
        Studio3D.syncSlidersFromActiveLayer();
        Studio3D.updateLayers();
        Studio3D.renderDesignToTexture();
    },

    syncSlidersFromActiveLayer: () => {
        const layer = Studio3D.getActiveLayer();
        if (!layer) return;
        
        const scaleSlider = document.getElementById('designScale');
        const scaleVal = document.getElementById('designScaleValue');
        if (scaleSlider) { scaleSlider.value = Math.round(layer.scale * 100); if(scaleVal) scaleVal.textContent = Math.round(layer.scale * 100); }
        
        const posXSlider = document.getElementById('designPosX');
        const posXVal = document.getElementById('designPosXValue');
        if (posXSlider) { posXSlider.value = Math.round(layer.x * 100); if(posXVal) posXVal.textContent = Math.round(layer.x * 100); }
        
        const posYSlider = document.getElementById('designPosY');
        const posYVal = document.getElementById('designPosYValue');
        if (posYSlider) { posYSlider.value = Math.round(layer.y * 100); if(posYVal) posYVal.textContent = Math.round(layer.y * 100); }
        
        const rotSlider = document.getElementById('designRot');
        const rotVal = document.getElementById('designRotValue');
        if (rotSlider) { rotSlider.value = Math.round(layer.rotation); if(rotVal) rotVal.textContent = Math.round(layer.rotation); }
    },

    syncTextControlsFromActiveLayer: () => {
        const layer = Studio3D.getActiveLayer();
        if (!layer || layer.type !== 'text') return;

        if (layer.textContent) document.getElementById('textInput').value = layer.textContent;
        if (layer.textStyle) Object.assign(Studio3D.textStyle, layer.textStyle);

        const textColorPicker = document.getElementById('textColorPicker');
        if (textColorPicker) textColorPicker.value = Studio3D.textStyle.color;

        const fontFamily = document.getElementById('fontFamily');
        if (fontFamily && layer.textSettings?.fontFamily) fontFamily.value = layer.textSettings.fontFamily;

        const fontSize = document.getElementById('fontSize');
        const fontSizeValue = document.getElementById('fontSizeValue');
        if (fontSize && layer.textSettings?.fontSize) {
            fontSize.value = layer.textSettings.fontSize;
            if (fontSizeValue) fontSizeValue.textContent = `${layer.textSettings.fontSize}px`;
        }
    },

    addLayer: (img, name = 'Design Layer', type = 'image', rawSrc = null) => {
        if (!Studio3D.designs[Studio3D.currentSide]) Studio3D.designs[Studio3D.currentSide] = [];
        const layers = Studio3D.designs[Studio3D.currentSide];
        const count = layers.length;
        const offset = (count * 0.04) % 0.25;

        const newLayer = {
            id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            name: name,
            type: type,
            img: img,
            rawSrc: rawSrc || (img ? img.src : null),
            x: 0.3,
            y: 0.3,
            scale: 0.6,
            rotation: 0
        };

        layers.push(newLayer);
        Studio3D.activeLayerId = newLayer.id;
        Studio3D.syncSlidersFromActiveLayer();
        Studio3D.renderDesignToTexture();
        Studio3D.updateLayers();
        Studio3D.updatePrice();
    },

    removeLayer: (id) => {
        let layers = Studio3D.designs[Studio3D.currentSide] || [];
        Studio3D.designs[Studio3D.currentSide] = layers.filter(l => l.id !== id);
        if (Studio3D.activeLayerId === id) {
            const remaining = Studio3D.designs[Studio3D.currentSide];
            Studio3D.activeLayerId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
            Studio3D.syncSlidersFromActiveLayer();
        }
        Studio3D.renderDesignToTexture();
        Studio3D.updateLayers();
        Studio3D.updatePrice();
    },

    textStyle: {
        bold: false,
        italic: false,
        underline: false,
        align: 'center',
        color: '#111111'
    },

    pricing: {
        '100% Cotton': 299,
        'Poly Cotton': 349,
        'Dry Fit': 379,
        'Premium Cotton': 449,
        'Organic Cotton': 499
    },
    printCostPerSide: 150,
    textCostPerUnit: 50,

    init: async () => {
        Studio3D.initThreeJS();
        Studio3D.bindControls();
        // Fetch admin-configured pricing (non-blocking — fall back to defaults)
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const json = await res.json();
                const s = json.data || {};
                if (s.price_fabric_cotton)    Studio3D.pricing['100% Cotton']    = Number(s.price_fabric_cotton);
                if (s.price_fabric_polycotton) Studio3D.pricing['Poly Cotton']   = Number(s.price_fabric_polycotton);
                if (s.price_fabric_dryfit)    Studio3D.pricing['Dry Fit']        = Number(s.price_fabric_dryfit);
                if (s.price_fabric_premium)   Studio3D.pricing['Premium Cotton'] = Number(s.price_fabric_premium);
                if (s.price_fabric_organic)   Studio3D.pricing['Organic Cotton'] = Number(s.price_fabric_organic);
                if (s.price_print_per_side)   Studio3D.printCostPerSide          = Number(s.price_print_per_side);
                if (s.price_text_per_unit)    Studio3D.textCostPerUnit           = Number(s.price_text_per_unit);
                // Refresh fabric select labels
                Studio3D.refreshFabricLabels();
            }
        } catch (e) { /* silently use defaults */ }
        Studio3D.updatePrice();
    },

    refreshFabricLabels: () => {
        const sel = document.getElementById('fabricSelect');
        if (!sel) return;
        const fabricMap = {
            '100% Cotton':    sel.options[0],
            'Poly Cotton':    sel.options[1],
            'Dry Fit':        sel.options[2],
            'Premium Cotton': sel.options[3],
            'Organic Cotton': sel.options[4]
        };
        const labelMap = {
            '100% Cotton':    '100% Cotton',
            'Poly Cotton':    'Poly Cotton Blend',
            'Dry Fit':        'Dry Fit / Sports',
            'Premium Cotton': 'Premium Cotton',
            'Organic Cotton': 'Organic Cotton'
        };
        Object.entries(fabricMap).forEach(([key, opt]) => {
            if (opt) opt.textContent = `${labelMap[key]} (\u20B9${Studio3D.pricing[key]})`;
        });
    },


    initThreeJS: () => {
        const container = document.getElementById('threeCanvasContainer');
        
        // Scene Setup
        Studio3D.scene = new THREE.Scene();
        Studio3D.scene.background = new THREE.Color(0xf5f5f5); // Match the studio background

        // Camera Setup
        Studio3D.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        Studio3D.camera.position.set(0, 0, 1.5);

        // Renderer Setup
        Studio3D.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        Studio3D.renderer.setSize(container.clientWidth, container.clientHeight);
        Studio3D.renderer.setPixelRatio(window.devicePixelRatio);
        Studio3D.renderer.outputColorSpace = THREE.SRGBColorSpace;
        Studio3D.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        container.appendChild(Studio3D.renderer.domElement);

        // Controls Setup
        Studio3D.controls = new OrbitControls(Studio3D.camera, Studio3D.renderer.domElement);
        Studio3D.controls.enableDamping = true;
        Studio3D.controls.minDistance = 1;
        Studio3D.controls.maxDistance = 5;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        Studio3D.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 5, 5);
        Studio3D.scene.add(dirLight);
        
        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight2.position.set(-5, 5, 5);
        Studio3D.scene.add(dirLight2);

        // Container for model to allow rotation
        Studio3D.modelContainer = new THREE.Group();
        Studio3D.scene.add(Studio3D.modelContainer);
        Studio3D.modelContainer.position.set(0, 0, 0);

        // Load Model
        const loader = new GLTFLoader();
        loader.load(
            'assets/oversized_t-shirt.glb',
            (gltf) => {
                const model = gltf.scene;
                
                // Adjust model size and position
                model.scale.set(1.5, 1.5, 1.5);
                
                // Center model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.x += (model.position.x - center.x);
                model.position.y += (model.position.y - center.y);
                model.position.z += (model.position.z - center.z);

                // Auto-adjust camera
                const newBox = new THREE.Box3().setFromObject(model);
                const size = newBox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = Studio3D.camera.fov * (Math.PI / 180);
                let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                
                Studio3D.camera.position.set(0, 0, cameraZ * 1.3); // 30% margin
                Studio3D.controls.target.set(0, 0, 0);
                Studio3D.controls.update();
                
                // Initialize CanvasTexture
                Studio3D.printCanvas = document.createElement('canvas');
                Studio3D.printCanvas.width = 2048;
                Studio3D.printCanvas.height = 2048;
                Studio3D.printCtx = Studio3D.printCanvas.getContext('2d');
                Studio3D.printCtx.fillStyle = Studio3D.state.shirtColor;
                Studio3D.printCtx.fillRect(0, 0, 2048, 2048);
                
                Studio3D.printTexture = new THREE.CanvasTexture(Studio3D.printCanvas);
                Studio3D.printTexture.colorSpace = THREE.SRGBColorSpace;
                Studio3D.printTexture.flipY = false;

                // Find the main mesh to apply canvas texture to
                model.traverse((child) => {
                    if (child.isMesh) {
                        const name = child.name.toLowerCase();
                        if (name.includes('plane') || name.includes('ground') || name.includes('shadow') || name.includes('backdrop') || name.includes('studio') || name.includes('environment')) {
                            child.visible = false;
                            return;
                        }

                        // Compute UV print zone for both Front and Back
                        child.updateMatrixWorld();
                        if (!Studio3D.printZoneUVs.front) {
                            Studio3D.printZoneUVs.front = computePrintZoneUVs(child.geometry, child.matrixWorld, 'front');
                            Studio3D.printZoneUVs.back = computePrintZoneUVs(child.geometry, child.matrixWorld, 'back');
                            Studio3D.printZoneUV = Studio3D.printZoneUVs.front;
                            console.log('Computed Print Zone UVs:', Studio3D.printZoneUVs);
                        }

                        Studio3D.tshirtMeshes.push(child);
                        if (!Studio3D.tshirtMesh) Studio3D.tshirtMesh = child;
                        
                        // Replace material with one that uses our CanvasTexture
                        child.material = new THREE.MeshStandardMaterial({
                            map: Studio3D.printTexture,
                            color: 0xffffff, // White because canvas handles color
                            roughness: 0.8,
                            side: THREE.DoubleSide
                        });
                    }
                });

                Studio3D.modelContainer.add(model);
                Studio3D.renderDesignToTexture(); // Initial draw
                document.getElementById('loadingOverlay').style.display = 'none';
            },
            (xhr) => {
                // console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
            },
            (error) => {
                console.error('An error happened loading the GLB model', error);
                document.getElementById('loadingOverlay').innerHTML = '<span>Error Loading Model</span>';
            }
        );

        // Events for interaction
        window.addEventListener('resize', Studio3D.onWindowResize);
        const canvasDom = Studio3D.renderer.domElement;
        canvasDom.addEventListener('pointerdown', Studio3D.onPointerDown);
        canvasDom.addEventListener('pointermove', Studio3D.onPointerMove);
        canvasDom.addEventListener('pointerup', Studio3D.onPointerUp);
        canvasDom.addEventListener('pointerleave', Studio3D.onPointerUp);

        // Animation Loop
        Studio3D.renderer.setAnimationLoop(() => {
            Studio3D.controls.update();
            Studio3D.renderer.render(Studio3D.scene, Studio3D.camera);
        });
    },

    onWindowResize: () => {
        const container = document.getElementById('threeCanvasContainer');
        if (!container) return;
        Studio3D.camera.aspect = container.clientWidth / container.clientHeight;
        Studio3D.camera.updateProjectionMatrix();
        Studio3D.renderer.setSize(container.clientWidth, container.clientHeight);
    },

    /* ================================================
       INTERACTION (DRAGGING ON MESH)
    ================================================ */
    updateRaycaster: (e) => {
        const container = document.getElementById('threeCanvasContainer');
        const rect = container.getBoundingClientRect();
        Studio3D.mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
        Studio3D.mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
        Studio3D.raycaster.setFromCamera(Studio3D.mouse, Studio3D.camera);
    },

    onPointerDown: (e) => {
        const side = Studio3D.currentSide;
        const layers = Studio3D.designs[side] || [];
        if (!Studio3D.tshirtMesh || layers.length === 0) return;

        Studio3D.updateRaycaster(e);
        const intersects = Studio3D.raycaster.intersectObjects(Studio3D.tshirtMeshes);
        
        if (intersects.length > 0) {
            const uv = intersects[0].uv;
            const uvZone = (Studio3D.printZoneUVs && Studio3D.printZoneUVs[side]) 
                           ? Studio3D.printZoneUVs[side] 
                           : (Studio3D.printZoneUV || null);
            if (uvZone) {
                const u0 = uvZone.u0;
                const u1 = uvZone.u1;
                const v0 = uvZone.v0;
                const v1 = uvZone.v1;
                const nx = (uv.x - u0) / (u1 - u0);
                const ny = (uv.y - v0) / (v1 - v0);

                let closest = layers[layers.length - 1];
                let minDist = Infinity;
                layers.forEach(l => {
                    const dist = Math.hypot(l.x - nx, l.y - ny);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = l;
                    }
                });
                if (closest) {
                    Studio3D.setActiveLayer(closest.id);
                }
            }
            Studio3D.controls.enabled = false;
            Studio3D.isDraggingDesign = true;
            Studio3D.updateDesignPositionFromUV(intersects[0].uv);
        }
    },

    onPointerMove: (e) => {
        if (!Studio3D.isDraggingDesign) return;

        Studio3D.updateRaycaster(e);
        const intersects = Studio3D.raycaster.intersectObjects(Studio3D.tshirtMeshes);

        if (intersects.length > 0) {
            Studio3D.updateDesignPositionFromUV(intersects[0].uv);
        }
    },

    onPointerUp: (e) => {
        Studio3D.isDraggingDesign = false;
        if(Studio3D.controls) Studio3D.controls.enabled = true;
    },

    updateDesignPositionFromUV: (uv) => {
        const side = Studio3D.currentSide;
        const uvZone = (Studio3D.printZoneUVs && Studio3D.printZoneUVs[side]) 
                       ? Studio3D.printZoneUVs[side] 
                       : (Studio3D.printZoneUV || null);
        if (!uvZone) return;
        const activeLayer = Studio3D.getActiveLayer();
        if (!activeLayer) return;

        const u0 = uvZone.u0;
        const u1 = uvZone.u1;
        const v0 = uvZone.v0;
        const v1 = uvZone.v1;

        let nx = (uv.x - u0) / (u1 - u0);
        let ny = (uv.y - v0) / (v1 - v0); 

        nx = Math.max(0, Math.min(1, nx));
        ny = Math.max(0, Math.min(1, ny));

        activeLayer.x = nx;
        activeLayer.y = ny;

        Studio3D.syncSlidersFromActiveLayer();
        Studio3D.renderDesignToTexture();
    },

    /* ================================================
       CANVAS TEXTURE RENDERING
    ================================================ */
    renderDesignToTexture: () => {
        if (!Studio3D.printCtx) return;
        
        // 1. Fill base shirt color
        Studio3D.printCtx.fillStyle = Studio3D.state.shirtColor;
        Studio3D.printCtx.fillRect(0, 0, 2048, 2048);
        
        // 2. Draw all layers for BOTH sides (front & back)
        ['front', 'back'].forEach(side => {
            const layers = Studio3D.designs[side] || [];
            const uvZone = (Studio3D.printZoneUVs && Studio3D.printZoneUVs[side]) 
                           ? Studio3D.printZoneUVs[side] 
                           : (Studio3D.printZoneUV || null);

            if (layers.length > 0 && uvZone) {
                const ctx = Studio3D.printCtx;
                const u0 = uvZone.u0;
                const v0 = uvZone.v0;
                const u1 = uvZone.u1;
                const v1 = uvZone.v1;
                
                const zWidth = (u1 - u0) * 2048;
                const zHeight = (v1 - v0) * 2048;
                
                layers.forEach(layer => {
                    if (!layer.img) return;
                    ctx.save();
                    
                    const cX = u0 * 2048 + zWidth * layer.x;
                    const cY = v0 * 2048 + zHeight * layer.y; 
                    
                    ctx.translate(cX, cY);
                    ctx.rotate(layer.rotation * Math.PI / 180);
                    
                    const baseSize = zWidth * 0.5;
                    const dw = baseSize * layer.scale;
                    const dh = dw * (layer.img.height / layer.img.width);
                    
                    ctx.scale(1, -1);
                    ctx.drawImage(layer.img, -dw/2, -dh/2, dw, dh);
                    ctx.restore();
                });
            }
        });
        
        if (Studio3D.printTexture) {
            Studio3D.printTexture.needsUpdate = true;
        }
    },

    /* ================================================
       CONTROLS & UI BINDING
    ================================================ */
    bindControls: () => {
        // Shirt colors
        document.querySelectorAll('#shirtColorGrid .color-dot').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#shirtColorGrid .color-dot').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Studio3D.setShirtColor(btn.dataset.color);
            });
        });

        document.getElementById('customShirtColor').addEventListener('input', (e) => {
            document.querySelectorAll('#shirtColorGrid .color-dot').forEach(b => b.classList.remove('active'));
            Studio3D.setShirtColor(e.target.value);
        });

        // Fabric & Size & Quantity
        document.getElementById('fabricSelect').addEventListener('change', (e) => {
            Studio3D.state.fabric = e.target.value;
            Studio3D.updatePrice();
        });
        document.querySelectorAll('#sizeGrid .size-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#sizeGrid .size-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Studio3D.state.size = btn.dataset.size;
            });
        });
        document.getElementById('qtyMinus').addEventListener('click', () => {
            if (Studio3D.state.quantity > 1) { Studio3D.state.quantity--; Studio3D.updateQtyDisplay(); }
        });
        document.getElementById('qtyPlus').addEventListener('click', () => {
            if (Studio3D.state.quantity < 99) { Studio3D.state.quantity++; Studio3D.updateQtyDisplay(); }
        });

        // Side toggle buttons
        document.getElementById('btnFront').addEventListener('click', () => Studio3D.setSide('front'));
        document.getElementById('btnBack').addEventListener('click', () => Studio3D.setSide('back'));

        // Per-side image upload buttons
        document.getElementById('btnUploadFront').addEventListener('click', () => {
            Studio3D.setSide('front');
            setTimeout(() => document.getElementById('frontFileInput').click(), 200);
        });
        document.getElementById('btnUploadBack').addEventListener('click', () => {
            Studio3D.setSide('back');
            setTimeout(() => document.getElementById('backFileInput').click(), 200);
        });
        document.getElementById('frontFileInput').addEventListener('change', (e) => Studio3D.handleSideUpload(e, 'front'));
        document.getElementById('backFileInput').addEventListener('change', (e) => Studio3D.handleSideUpload(e, 'back'));

        // Clear per-side image
        document.getElementById('btnClearFront').addEventListener('click', () => Studio3D.clearSideDesign('front'));
        document.getElementById('btnClearBack').addEventListener('click', () => Studio3D.clearSideDesign('back'));

        // Toolbar image button still works (uploads for current side)
        document.getElementById('btnAddText').addEventListener('click', () => {
            document.getElementById('textPropertiesPanel').style.display = 'block';
            document.getElementById('aiMagicPanel').style.display = 'none';
            document.getElementById('textInput').focus();
        });

        document.getElementById('btnUploadImage').addEventListener('click', () => {
            const inputId = Studio3D.currentSide === 'front' ? 'frontFileInput' : 'backFileInput';
            document.getElementById(inputId).click();
        });

        // Delete Selected Layer
        document.getElementById('btnDeleteSelected').addEventListener('click', async () => {
            const activeLayer = Studio3D.getActiveLayer();
            if (activeLayer && await Utils.confirmAction(`Remove "${activeLayer.name}"?`, { title: 'Remove design layer', confirmText: 'Remove', destructive: true })) {
                Studio3D.removeLayer(activeLayer.id);
            }
        });

        // Clear Canvas
        document.getElementById('btnClearCanvas').addEventListener('click', async () => {
            if (await Utils.confirmAction('Clear all design elements from this side of the T-shirt?', { title: 'Clear design', confirmText: 'Clear', destructive: true })) {
                Studio3D.clearSideDesign(Studio3D.currentSide);
            }
        });
        
        // Design Transformation Sliders
        const setupSlider = (id, prop, isMultiplier = 1) => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(`${id}Value`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const activeLayer = Studio3D.getActiveLayer();
                    if (activeLayer) {
                        activeLayer[prop] = parseFloat(e.target.value) * isMultiplier;
                        if (valueSpan) valueSpan.textContent = e.target.value;
                        Studio3D.renderDesignToTexture();
                    }
                });
            }
        };
        
        setupSlider('designScale', 'scale', 0.01);
        setupSlider('designPosX', 'x', 0.01);
        setupSlider('designPosY', 'y', 0.01);
        setupSlider('designRot', 'rotation', 1);

        // Add Text logic
        const btnApplyText = document.getElementById('btnApplyText');
        if (btnApplyText) {
            btnApplyText.addEventListener('click', () => {
                const text = document.getElementById('textInput').value;
                if (!text) return;
                
                Studio3D.addTextLayer();
                document.getElementById('canvasHint').innerHTML = '<i class="fas fa-hand-pointer"></i> Click anywhere on the 3D T-shirt to place your text. Drag to move it.';
            });
        }

        // --- TEXT STYLING BUTTONS ---
        const toggleStyle = (btnId, prop, value) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            btn.addEventListener('click', () => {
                if (typeof value === 'boolean') {
                    Studio3D.textStyle[prop] = !Studio3D.textStyle[prop];
                    btn.classList.toggle('active', Studio3D.textStyle[prop]);
                } else {
                    Studio3D.textStyle[prop] = value;
                    document.querySelectorAll('.style-btns .style-btn').forEach(b => {
                        if (b.id.startsWith('btnAlign')) b.classList.remove('active');
                    });
                    btn.classList.add('active');
                }
                Studio3D.updateActiveTextLayer();
            });
        };

        toggleStyle('btnBold', 'bold', true);
        toggleStyle('btnItalic', 'italic', true);
        toggleStyle('btnUnderline', 'underline', true);
        toggleStyle('btnAlignLeft', 'align', 'left');
        toggleStyle('btnAlignCenter', 'align', 'center');
        toggleStyle('btnAlignRight', 'align', 'right');

        const applyTextColor = (color) => {
            Studio3D.textStyle.color = color;
            document.getElementById('textColorPicker').value = color;
            Studio3D.updateActiveTextLayer();
        };

        const textColorPicker = document.getElementById('textColorPicker');
        if (textColorPicker) {
            textColorPicker.addEventListener('input', (e) => applyTextColor(e.target.value));
        }

        document.querySelectorAll('.qtc').forEach(btn => {
            btn.addEventListener('click', () => applyTextColor(btn.dataset.color));
        });

        document.getElementById('fontFamily')?.addEventListener('change', () => Studio3D.updateActiveTextLayer());
        document.getElementById('fontSize')?.addEventListener('input', (event) => {
            const value = document.getElementById('fontSizeValue');
            if (value) value.textContent = `${event.target.value}px`;
            Studio3D.updateActiveTextLayer();
        });

        // Add to Cart integration
        const btnAddToCart = document.getElementById('addToCartBtn');
        if (btnAddToCart) {
            btnAddToCart.addEventListener('click', async () => {
                const btnOriginalText = btnAddToCart.innerHTML;
                btnAddToCart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Capturing...';
                btnAddToCart.disabled = true;

                try {
                    // Capture Front and Back 3D Screenshots
                    const frontScreenshot = Studio3D.generatePreviewSnapshot('front') || (Studio3D.printCanvas ? Studio3D.printCanvas.toDataURL('image/png') : '');
                    const backScreenshot = Studio3D.generatePreviewSnapshot('back') || (Studio3D.printCanvas ? Studio3D.printCanvas.toDataURL('image/png') : '');

                    // Restore user's current side view
                    Studio3D.setSide(Studio3D.currentSide);

                    const customDesignInfo = {
                        isCustom: true,
                        shirtColor: Studio3D.state.shirtColor,
                        fabric: Studio3D.state.fabric,
                        size: Studio3D.state.size,
                        frontImage: frontScreenshot,
                        backImage: backScreenshot,
                        frontLayers: Studio3D.designs.front.map(l => ({ name: l.name, type: l.type, rawSrc: l.rawSrc, x: l.x, y: l.y, scale: l.scale, rotation: l.rotation })),
                        backLayers: Studio3D.designs.back.map(l => ({ name: l.name, type: l.type, rawSrc: l.rawSrc, x: l.x, y: l.y, scale: l.scale, rotation: l.rotation }))
                    };

                    const mainPreviewImage = (Studio3D.designs.front.length > 0 || Studio3D.designs.back.length === 0) 
                                           ? frontScreenshot 
                                           : backScreenshot;

                    const cartItem = {
                        id: `studio-${Date.now()}`,
                        name: 'Custom T-Shirt Design',
                        price: parseInt(document.getElementById('totalPrice').textContent.replace(/[^0-9]/g, '')) / Studio3D.state.quantity,
                        quantity: Studio3D.state.quantity,
                        size: Studio3D.state.size,
                        color: Studio3D.state.shirtColor,
                        image: mainPreviewImage,
                        customDesign: customDesignInfo
                    };

                    if (window.CartManager && window.CartManager.addItem) {
                        await window.CartManager.addItem(cartItem);
                        document.querySelector('.cart-sidebar').classList.add('active');
                        document.querySelector('.cart-overlay').classList.add('active');
                        if (window.CartManager.updateCartUI) window.CartManager.updateCartUI();
                    } else {
                        Utils.showToast('Cart is unavailable. Please refresh and try again.', 'error');
                    }
                } catch (error) {
                    console.error('Add to cart error:', error);
                    Utils.showToast('Unable to add this design to your cart.', 'error');
                } finally {
                    btnAddToCart.innerHTML = btnOriginalText;
                    btnAddToCart.disabled = false;
                }
            });
        }
        // AI Magic Integration
        const btnAiMagic = document.getElementById('btnAiMagic');
        const aiMagicPanel = document.getElementById('aiMagicPanel');
        const btnGenerateAi = document.getElementById('btnGenerateAi');
        const btnAddAiToShirt = document.getElementById('btnAddAiToShirt');
        const aiPromptInput = document.getElementById('aiPromptInput');
        const aiLoadingIndicator = document.getElementById('aiLoadingIndicator');
        const aiResultsArea = document.getElementById('aiResultsArea');
        const aiResultImage = document.getElementById('aiResultImage');

        if (btnAiMagic) {
            btnAiMagic.addEventListener('click', () => {
                // Hide other panels, show AI panel
                document.getElementById('textPropertiesPanel').style.display = 'none';
                document.getElementById('imagePropertiesPanel').style.display = 'none';
                aiMagicPanel.style.display = 'block';
            });
        }

        if (btnGenerateAi) {
            btnGenerateAi.addEventListener('click', async () => {
                const prompt = aiPromptInput.value.trim();
                if (!prompt) {
                    Utils.showToast('Please enter a description for your design.', 'warning');
                    return;
                }

                btnGenerateAi.disabled = true;
                aiLoadingIndicator.style.display = 'block';
                aiResultsArea.style.display = 'none';

                try {
                    // Use API_BASE_URL to ensure it hits the backend regardless of where frontend is hosted
                    const res = await fetch(`${window.API_BASE_URL || '/api'}/ai/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt })
                    });
                    
                    const data = await res.json();
                    if (data.success && data.data && data.data.length > 0) {
                        aiResultImage.src = data.data[0].url;
                        aiResultsArea.style.display = 'block';
                    } else {
                        Utils.showToast(data.message || 'Failed to generate image.', 'error');
                    }
                } catch (err) {
                    console.error('AI Gen Error:', err);
                    Utils.showToast('An error occurred while generating the design.', 'error');
                } finally {
                    btnGenerateAi.disabled = false;
                    aiLoadingIndicator.style.display = 'none';
                }
            });
        }

        if (btnAddAiToShirt) {
            btnAddAiToShirt.addEventListener('click', async () => {
                const imgSrc = aiResultImage.src;
                if (!imgSrc) return;

                try {
                    const img = await Studio3D.loadCleanImage(imgSrc);
                    const count = (Studio3D.designs[Studio3D.currentSide] || []).length + 1;
                    Studio3D.addLayer(img, `AI Design ${count}`, 'image', imgSrc);
                } catch (err) {
                    console.error('Failed to load AI image:', err);
                    Utils.showToast('Failed to load design onto the T-shirt.', 'error');
                }
            });
        }

        // Remove Background
        const btnRemoveBackground = document.getElementById('btnRemoveBackground');
        if (btnRemoveBackground) {
            btnRemoveBackground.addEventListener('click', async () => {
                const activeLayer = Studio3D.getActiveLayer();
                if (!activeLayer || !activeLayer.img) {
                    Utils.showToast('Please select an image design layer on the T-shirt first.', 'warning');
                    return;
                }
                
                const imgSrc = activeLayer.rawSrc || activeLayer.img.src;
                if (!imgSrc || imgSrc.startsWith('data:image/svg+xml')) {
                    Utils.showToast('Please select a valid image layer to remove the background.', 'warning');
                    return;
                }

                const originalText = btnRemoveBackground.innerHTML;
                btnRemoveBackground.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                btnRemoveBackground.disabled = true;

                try {
                    const res = await fetch('/api/ai/remove-bg', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: imgSrc })
                    });
                    
                    const data = await res.json();
                    if (data.success && data.url) {
                        const img = await Studio3D.loadCleanImage(data.url);
                        activeLayer.img = img;
                        activeLayer.rawSrc = data.url;
                        Studio3D.renderDesignToTexture();
                    } else {
                        Utils.showToast(data.message || 'Failed to remove background.', 'error');
                    }
                } catch (err) {
                    console.error('Remove BG Error:', err);
                    Utils.showToast('An error occurred while removing the background.', 'error');
                } finally {
                    btnRemoveBackground.innerHTML = originalText;
                    btnRemoveBackground.disabled = false;
                }
            });
        }
    },

    setSide: (side) => {
        if (!Studio3D.modelContainer) return;
        Studio3D.currentSide = side;
        document.querySelectorAll('.side-btn').forEach(btn => btn.classList.remove('active'));
        
        const frontSlot = document.getElementById('frontUploadSlot');
        const backSlot = document.getElementById('backUploadSlot');

        if (side === 'front') {
            document.getElementById('btnFront').classList.add('active');
            Studio3D.modelContainer.rotation.y = 0;
            if (frontSlot) frontSlot.style.display = 'block';
            if (backSlot) backSlot.style.display = 'none';
        } else {
            document.getElementById('btnBack').classList.add('active');
            Studio3D.modelContainer.rotation.y = Math.PI;
            if (frontSlot) frontSlot.style.display = 'none';
            if (backSlot) backSlot.style.display = 'block';
        }

        const layers = Studio3D.designs[side] || [];
        Studio3D.activeLayerId = layers.length > 0 ? layers[layers.length - 1].id : null;
        Studio3D.syncSlidersFromActiveLayer();
        Studio3D.renderDesignToTexture();
        Studio3D.updateLayers();
    },

    setShirtColor: (hexColor) => {
        Studio3D.state.shirtColor = hexColor;
        Studio3D.renderDesignToTexture();
    },

    handleSideUpload: (e, side) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Studio3D.setSide(side);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const rawSrc = ev.target.result;
            
            const thumbWrap = document.getElementById(side === 'front' ? 'frontThumbWrap' : 'backThumbWrap');
            const clearBtn = document.getElementById(side === 'front' ? 'btnClearFront' : 'btnClearBack');
            if (thumbWrap) {
                thumbWrap.innerHTML = `<img src="${rawSrc}" style="max-width:100%; max-height:100px; border-radius:6px; border:1px solid #ddd; object-fit:contain;">`;
            }
            if (clearBtn) clearBtn.style.display = 'inline-flex';

            Studio3D.loadCleanImage(rawSrc).then(img => {
                const count = (Studio3D.designs[side] || []).length + 1;
                Studio3D.addLayer(img, `Uploaded Design ${count}`, 'image', rawSrc);
            }).catch(err => console.error('Side upload load error:', err));
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    },

    clearSideDesign: (side) => {
        Studio3D.designs[side] = [];
        if (Studio3D.currentSide === side) {
            Studio3D.activeLayerId = null;
        }
        const thumbWrap = document.getElementById(side === 'front' ? 'frontThumbWrap' : 'backThumbWrap');
        const clearBtn = document.getElementById(side === 'front' ? 'btnClearFront' : 'btnClearBack');
        if (thumbWrap) thumbWrap.innerHTML = '<span class="side-thumb-empty">No image uploaded</span>';
        if (clearBtn) clearBtn.style.display = 'none';
        
        Studio3D.renderDesignToTexture();
        Studio3D.updateLayers();
        Studio3D.updatePrice();
        Studio3D.setSide(side);
    },

    handleImageUpload: (e) => {
        Studio3D.handleSideUpload(e, Studio3D.currentSide);
    },

    /* ================================================
       PRICING
    ================================================ */
    updatePrice: () => {
        const basePrice = Studio3D.pricing[Studio3D.state.fabric] || 299;
        const hasFront = (Studio3D.designs.front || []).some(l => l.type !== 'text');
        const hasBack = (Studio3D.designs.back || []).some(l => l.type !== 'text');
        const printCost = (hasFront ? Studio3D.printCostPerSide : 0) + (hasBack ? Studio3D.printCostPerSide : 0);
        const textCount = [...(Studio3D.designs.front || []), ...(Studio3D.designs.back || [])]
            .filter(layer => layer.type === 'text').length;
        const textCost = textCount * Studio3D.textCostPerUnit;

        const unitPrice = basePrice + printCost + textCost;
        const total = unitPrice * Studio3D.state.quantity;

        document.getElementById('priceLabel').textContent = `${Studio3D.state.fabric}`;
        document.getElementById('basePrice').textContent = `₹${basePrice}`;

        const printRow = document.getElementById('printPriceRow');
        if (printCost > 0) {
            printRow.style.display = 'flex';
            document.getElementById('printPrice').textContent = `+₹${printCost}`;
        } else {
            printRow.style.display = 'none';
        }

        const textRow = document.getElementById('textPriceRow');
        if (textCost > 0) {
            textRow.style.display = 'flex';
            document.getElementById('textPrice').textContent = `+\u20B9${textCost}`;
        } else {
            textRow.style.display = 'none';
        }

        document.getElementById('qtyNote').textContent = `×${Studio3D.state.quantity}`;
        document.getElementById('totalPrice').textContent = `₹${total.toLocaleString('en-IN')}`;
    },

    updateQtyDisplay: () => {
        document.getElementById('qtyDisplay').textContent = Studio3D.state.quantity;
        Studio3D.updatePrice();
    },

    updateLayers: () => {
        const layersList = document.getElementById('layersList');
        const layerCount = document.getElementById('layerCount');
        if (!layersList || !layerCount) return;

        const layers = Studio3D.designs[Studio3D.currentSide] || [];
        layerCount.textContent = `(${layers.length})`;

        if (layers.length === 0) {
            layersList.innerHTML = '<p class="no-layers-msg">No elements yet. Add text or image.</p>';
            return;
        }

        layersList.innerHTML = '';
        const activeLayer = Studio3D.getActiveLayer();

        layers.slice().reverse().forEach((layer) => {
            const isActive = activeLayer && activeLayer.id === layer.id;
            const icon = layer.type === 'text' ? 'fa-font' : 'fa-image';
            
            const div = document.createElement('div');
            div.className = `layer-item ${isActive ? 'active' : ''}`;
            div.style.cssText = `
                display: flex; justify-content: space-between; align-items: center; 
                padding: 10px; background: ${isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)'}; 
                border-radius: 6px; margin-bottom: 8px; cursor: pointer;
                border: 1px solid ${isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)'};
            `;
            
            div.innerHTML = `
                <div class="layer-info" style="display:flex; align-items:center; gap:10px; flex:1;">
                    <i class="fas ${icon}" style="color:${isActive ? 'var(--primary)' : 'var(--text-muted)'}"></i>
                    <span style="font-size:13px; font-weight:${isActive ? '600' : '400'}">${layer.name}</span>
                </div>
                <button class="layer-delete-btn" data-id="${layer.id}" title="Delete Layer" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px 8px;"><i class="fas fa-trash"></i></button>
            `;

            div.addEventListener('click', (e) => {
                if (e.target.closest('.layer-delete-btn')) return;
                Studio3D.setActiveLayer(layer.id);
            });

            div.querySelector('.layer-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                Studio3D.removeLayer(layer.id);
            });

            layersList.appendChild(div);
        });
    },

    createTextTexture: async (text) => {
        const textInput = document.getElementById('textInput');
        if (!textInput || !text) return null;

        const fontFam = document.getElementById('fontFamily') ? document.getElementById('fontFamily').value : 'Inter';
        const fontSize = Number(document.getElementById('fontSize')?.value || 40);
        const fontColor = Studio3D.textStyle.color;
        const weight = Studio3D.textStyle.bold ? 'bold' : 'normal';
        const style = Studio3D.textStyle.italic ? 'italic' : 'normal';
        const align = Studio3D.textStyle.align; 

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 256;

        ctx.fillStyle = fontColor;
        const canvasFontSize = Math.round(fontSize * 3);
        ctx.font = `${style} ${weight} ${canvasFontSize}px "${fontFam}"`;
        ctx.textBaseline = 'middle';

        if (align === 'left') {
            ctx.textAlign = 'left';
            ctx.fillText(text, 50, 128);
        } else if (align === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(text, 974, 128);
        } else {
            ctx.textAlign = 'center';
            ctx.fillText(text, 512, 128);
        }

        if (Studio3D.textStyle.underline) {
            const metrics = ctx.measureText(text);
            const w = metrics.width;
            let startX = 512 - w/2;
            if (align === 'left') startX = 50;
            if (align === 'right') startX = 974 - w;
            ctx.fillRect(startX, 128 + canvasFontSize / 2 + 8, w, Math.max(4, Math.round(canvasFontSize / 12)));
        }

        const dataUrl = canvas.toDataURL('image/png');
        const img = await Studio3D.loadCleanImage(dataUrl);
        return { img, dataUrl };
    },

    addTextLayer: async () => {
        const text = document.getElementById('textInput')?.value.trim();
        if (!text) return;

        try {
            const texture = await Studio3D.createTextTexture(text);
            if (!texture) return;
            const textSnippet = text.length > 10 ? `${text.substring(0, 10)}...` : text;
            Studio3D.addLayer(texture.img, `Text: "${textSnippet}"`, 'text', texture.dataUrl);
            const layer = Studio3D.getActiveLayer();
            if (layer) {
                layer.textContent = text;
                layer.textStyle = { ...Studio3D.textStyle };
                layer.textSettings = {
                    fontFamily: document.getElementById('fontFamily')?.value || 'Inter',
                    fontSize: Number(document.getElementById('fontSize')?.value || 40)
                };
            }
        } catch (error) {
            console.error('Text texture load error:', error);
            Utils.showToast('Unable to add text to the design.', 'error');
        }
    },

    updateActiveTextLayer: async () => {
        const layer = Studio3D.getActiveLayer();
        if (!layer || layer.type !== 'text') return;

        const text = document.getElementById('textInput')?.value.trim() || layer.textContent;
        if (!text) return;

        try {
            const texture = await Studio3D.createTextTexture(text);
            if (!texture) return;
            layer.img = texture.img;
            layer.rawSrc = texture.dataUrl;
            layer.textContent = text;
            layer.textStyle = { ...Studio3D.textStyle };
            layer.textSettings = {
                fontFamily: document.getElementById('fontFamily')?.value || 'Inter',
                fontSize: Number(document.getElementById('fontSize')?.value || 40)
            };
            const textSnippet = text.length > 10 ? `${text.substring(0, 10)}...` : text;
            layer.name = `Text: "${textSnippet}"`;
            Studio3D.renderDesignToTexture();
            Studio3D.updateLayers();
        } catch (error) {
            console.error('Text texture update error:', error);
            Utils.showToast('Unable to update the selected text.', 'error');
        }
    }
};

window.Studio = Studio3D; // For external compatibility
