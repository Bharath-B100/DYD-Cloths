import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Utility: Print Zone UV Computation ---
function computePrintZoneUVs(geometry, worldMatrix) {
    const posAttr = geometry.getAttribute('position');
    const normalAttr = geometry.getAttribute('normal');
    const uvAttr = geometry.getAttribute('uv');
    const index = geometry.getIndex();
    
    let minU = 1, minV = 1, maxU = 0, maxV = 0;
    
    const count = index ? index.count : posAttr.count;
    
    for (let i = 0; i < count; i += 3) {
        const a = index ? index.getX(i) : i;
        const b = index ? index.getX(i+1) : i+1;
        const c = index ? index.getX(i+2) : i+2;
        
        // Check normal
        const nA = new THREE.Vector3(normalAttr.getX(a), normalAttr.getY(a), normalAttr.getZ(a));
        nA.transformDirection(worldMatrix); // Get world normal
        
        // If face is roughly pointing forward (Z > 0.5)
        if (nA.z > 0.1) {
            const uA = uvAttr.getX(a), vA = uvAttr.getY(a);
            const uB = uvAttr.getX(b), vB = uvAttr.getY(b);
            const uC = uvAttr.getX(c), vC = uvAttr.getY(c);
            
            minU = Math.min(minU, uA, uB, uC);
            maxU = Math.max(maxU, uA, uB, uC);
            minV = Math.min(minV, vA, vB, vC);
            maxV = Math.max(maxV, vA, vB, vC);
        }
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
    
    // Canvas Texture System
    printCanvas: null,
    printCtx: null,
    printTexture: null,
    printZoneUV: null,
    
    // Design Overlay State
    designImage: null,    // The HTMLImageElement of the uploaded/AI design
    isDraggingDesign: false, // For mouse drag
    designState: {
        x: 0.5,           // Center X in print zone (0 to 1)
        y: 0.5,           // Center Y in print zone (0 to 1)
        scale: 0.8,
        rotation: 0
    },

    state: {
        shirtColor: '#ffffff',
        fabric: '100% Cotton',
        size: 'M',
        quantity: 1
    },

    // Per-side raw uploaded images
    designs: {
        front: { rawSrc: null },
        back:  { rawSrc: null }
    },
    currentSide: 'front',

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

    init: () => {
        Studio3D.initThreeJS();
        Studio3D.bindControls();
        Studio3D.updatePrice();
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
        Studio3D.renderer = new THREE.WebGLRenderer({ antialias: true });
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

                        // Compute UV print zone
                        child.updateMatrixWorld();
                        if (!Studio3D.printZoneUV) {
                            Studio3D.printZoneUV = computePrintZoneUVs(child.geometry, child.matrixWorld);
                            console.log('Computed Print Zone UVs:', Studio3D.printZoneUV);
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
        if (!Studio3D.tshirtMesh || !Studio3D.designImage) return;

        Studio3D.updateRaycaster(e);
        const intersects = Studio3D.raycaster.intersectObjects(Studio3D.tshirtMeshes);
        
        if (intersects.length > 0) {
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
        if (!Studio3D.printZoneUV) return;

        const u0 = Studio3D.printZoneUV.u0;
        const u1 = Studio3D.printZoneUV.u1;
        const v0 = Studio3D.printZoneUV.v0;
        const v1 = Studio3D.printZoneUV.v1;

        let nx = (uv.x - u0) / (u1 - u0);
        // Canvas is Y-down, but UV might be Y-up. Let's map it so dragging follows the mouse.
        // We'll invert it if it feels backward, usually 1 - ny works for UV -> canvas Y mapping
        let ny = 1.0 - ((uv.y - v0) / (v1 - v0)); 

        // Clamp to 0-1
        nx = Math.max(0, Math.min(1, nx));
        ny = Math.max(0, Math.min(1, ny));

        Studio3D.designState.x = nx;
        Studio3D.designState.y = ny;

        // Update UI sliders to reflect new position
        const sliderX = document.getElementById('designPosX');
        const valX = document.getElementById('designPosXValue');
        if(sliderX) { sliderX.value = Math.round(nx * 100); if(valX) valX.textContent = Math.round(nx * 100); }

        const sliderY = document.getElementById('designPosY');
        const valY = document.getElementById('designPosYValue');
        if(sliderY) { sliderY.value = Math.round(ny * 100); if(valY) valY.textContent = Math.round(ny * 100); }

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
        
        // 2. Draw design if present
        if (Studio3D.designImage && Studio3D.printZoneUV) {
            const ctx = Studio3D.printCtx;
            ctx.save();
            
            // The print zone in pixels (2048x2048 canvas)
            const u0 = Studio3D.printZoneUV.u0;
            const v0 = Studio3D.printZoneUV.v0;
            const u1 = Studio3D.printZoneUV.u1;
            const v1 = Studio3D.printZoneUV.v1;
            
            const zWidth = (u1 - u0) * 2048;
            const zHeight = (v1 - v0) * 2048;
            
            // Center of design
            const cX = u0 * 2048 + zWidth * Studio3D.designState.x;
            // WebGL V is usually bottom-up, so V=0 is bottom, V=1 is top.
            // On a flipY=false canvas, Y=0 is bottom, Y=2048 is top.
            const cY = v0 * 2048 + zHeight * Studio3D.designState.y; 
            
            ctx.translate(cX, cY);
            ctx.rotate(Studio3D.designState.rotation * Math.PI / 180);
            
            // Scale: default size is 50% of the print zone width
            const baseSize = zWidth * 0.5;
            const dw = baseSize * Studio3D.designState.scale;
            const dh = dw * (Studio3D.designImage.height / Studio3D.designImage.width);
            
            // Invert Y drawing if needed (since canvas is 2D and ThreeJS might map it upside down if flipY is false)
            ctx.scale(1, -1);
            
            ctx.drawImage(Studio3D.designImage, -dw/2, -dh/2, dw, dh);
            ctx.restore();
        }
        
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
        document.getElementById('btnUploadImage').addEventListener('click', () => {
            const inputId = Studio3D.currentSide === 'front' ? 'frontFileInput' : 'backFileInput';
            document.getElementById(inputId).click();
        });

        // Delete Layer
        document.getElementById('btnDeleteSelected').addEventListener('click', () => {
            if (confirm('Remove the current design?')) {
                Studio3D.designImage = null;
                Studio3D.renderDesignToTexture();
                Studio3D.updatePrice();
            }
        });

        // Clear Canvas
        document.getElementById('btnClearCanvas').addEventListener('click', () => {
            if (confirm('Clear all images from the T-shirt?')) {
                Studio3D.designImage = null;
                Studio3D.renderDesignToTexture();
                Studio3D.updatePrice();
                Studio3D.updateLayers();
            }
        });
        
        // Design Transformation Sliders
        const setupSlider = (id, prop, isMultiplier = 1) => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(`${id}Value`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    Studio3D.designState[prop] = parseFloat(e.target.value) * isMultiplier;
                    if (valueSpan) valueSpan.textContent = e.target.value;
                    Studio3D.renderDesignToTexture();
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
                
                Studio3D.generateTextTexture();
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
                Studio3D.generateTextTexture();
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
            Studio3D.generateTextTexture();
        };

        const textColorPicker = document.getElementById('textColorPicker');
        if (textColorPicker) {
            textColorPicker.addEventListener('input', (e) => applyTextColor(e.target.value));
        }

        document.querySelectorAll('.qtc').forEach(btn => {
            btn.addEventListener('click', () => applyTextColor(btn.dataset.color));
        });

        // Add to Cart integration
        const btnAddToCart = document.getElementById('addToCartBtn');
        if (btnAddToCart) {
            btnAddToCart.addEventListener('click', async () => {
                const btnOriginalText = btnAddToCart.innerHTML;
                btnAddToCart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Capturing...';
                btnAddToCart.disabled = true;

                try {
                    const frontScreenshot = Studio3D.renderer.domElement.toDataURL('image/png');
                    const backScreenshot = Studio3D.renderer.domElement.toDataURL('image/png');

                    const customDesignInfo = {
                        isCustom: true,
                        shirtColor: Studio3D.state.shirtColor,
                        fabric: Studio3D.state.fabric,
                        size: Studio3D.state.size,
                        frontImage: frontScreenshot,
                        backImage: backScreenshot,
                        frontUpload: Studio3D.designs.front.rawSrc,
                        backUpload: Studio3D.designs.back.rawSrc,
                        designState: Studio3D.designState
                    };

                    const cartItem = {
                        id: `studio-${Date.now()}`,
                        name: 'Custom T-Shirt Design',
                        price: parseInt(document.getElementById('totalPrice').textContent.replace(/[^0-9]/g, '')) / Studio3D.state.quantity,
                        quantity: Studio3D.state.quantity,
                        size: Studio3D.state.size,
                        color: Studio3D.state.shirtColor,
                        image: frontScreenshot,
                        customDesign: customDesignInfo
                    };

                    if (window.CartManager && window.CartManager.addItem) {
                        await window.CartManager.addItem(cartItem);
                        document.querySelector('.cart-sidebar').classList.add('active');
                        document.querySelector('.cart-overlay').classList.add('active');
                        if (window.CartManager.updateCartUI) window.CartManager.updateCartUI();
                    } else {
                        alert('Cart system not found.');
                    }
                } catch (error) {
                    console.error('Add to cart error:', error);
                    alert('Error adding to cart.');
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
                    alert('Please enter a description for your design.');
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
                        alert(data.message || 'Failed to generate image.');
                    }
                } catch (err) {
                    console.error('AI Gen Error:', err);
                    alert('An error occurred while generating the design.');
                } finally {
                    btnGenerateAi.disabled = false;
                    aiLoadingIndicator.style.display = 'none';
                }
            });
        }

        if (btnAddAiToShirt) {
            btnAddAiToShirt.addEventListener('click', () => {
                const imgSrc = aiResultImage.src;
                if (!imgSrc) return;

                const img = new Image();
                img.onload = () => {
                    Studio3D.designImage = img;
                    Studio3D.renderDesignToTexture();
                    Studio3D.updatePrice();
                    Studio3D.updateLayers();
                };
                img.src = imgSrc;
            });
        }

        // Remove Background
        const btnRemoveBackground = document.getElementById('btnRemoveBackground');
        if (btnRemoveBackground) {
            btnRemoveBackground.addEventListener('click', async () => {
                if (!Studio3D.designImage) {
                    alert('Please add an image design to the t-shirt first.');
                    return;
                }
                
                const imgSrc = Studio3D.designImage.src;
                if (!imgSrc || imgSrc.startsWith('data:image/svg+xml')) {
                    alert('Please select a valid image (not text) to remove the background.');
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
                        const img = new Image();
                        img.onload = () => {
                            Studio3D.designImage = img;
                            Studio3D.renderDesignToTexture();
                        };
                        img.src = data.url;
                    } else {
                        alert(data.message || 'Failed to remove background.');
                    }
                } catch (err) {
                    console.error('Remove BG Error:', err);
                    alert('An error occurred while removing the background.');
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
    },

    setShirtColor: (hexColor) => {
        Studio3D.state.shirtColor = hexColor;
        Studio3D.renderDesignToTexture();
    },

    handleSideUpload: (e, side) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Ensure we are on the correct side
        Studio3D.setSide(side);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const rawSrc = ev.target.result;
            // Store the raw file
            Studio3D.designs[side].rawSrc = rawSrc;

            // Show thumbnail in the slot
            const thumbWrap = document.getElementById(side === 'front' ? 'frontThumbWrap' : 'backThumbWrap');
            const clearBtn = document.getElementById(side === 'front' ? 'btnClearFront' : 'btnClearBack');
            if (thumbWrap) {
                thumbWrap.innerHTML = `<img src="${rawSrc}" style="max-width:100%; max-height:100px; border-radius:6px; border:1px solid #ddd; object-fit:contain;">`;
            }
            if (clearBtn) clearBtn.style.display = 'inline-flex';

            // Load into designImage
            const img = new Image();
            img.onload = () => {
                Studio3D.designImage = img;
                Studio3D.renderDesignToTexture();
                Studio3D.updatePrice();
            };
            img.src = rawSrc;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    },

    clearSideDesign: (side) => {
        Studio3D.designs[side].rawSrc = null;
        const thumbWrap = document.getElementById(side === 'front' ? 'frontThumbWrap' : 'backThumbWrap');
        const clearBtn = document.getElementById(side === 'front' ? 'btnClearFront' : 'btnClearBack');
        if (thumbWrap) thumbWrap.innerHTML = '<span class="side-thumb-empty">No image uploaded</span>';
        if (clearBtn) clearBtn.style.display = 'none';
        
        Studio3D.designImage = null;
        Studio3D.renderDesignToTexture();
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
        const printCost = Studio3D.designImage ? 150 : 0; // Simple print cost rule

        const unitPrice = basePrice + printCost;
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

        if (!Studio3D.designImage) {
            layerCount.textContent = `(0)`;
            layersList.innerHTML = '<p class="no-layers-msg">No elements yet. Add text or image.</p>';
            return;
        }

        layerCount.textContent = `(1)`;
        layersList.innerHTML = '';
        
        const div = document.createElement('div');
        div.className = `layer-item active`;
        div.style.cssText = `
            display: flex; justify-content: space-between; align-items: center; 
            padding: 10px; background: rgba(255,255,255,0.05); 
            border-radius: 6px; margin-bottom: 8px; cursor: pointer;
            border: 1px solid var(--primary);
        `;
        
        div.innerHTML = `
            <div class="layer-info" style="display:flex; align-items:center; gap:10px;">
                <i class="fas fa-image" style="color:var(--text-muted)"></i>
                <span style="font-size:13px">Design Layer</span>
            </div>
            <button class="layer-delete-btn" title="Delete Layer" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-trash"></i></button>
        `;

        div.querySelector('.layer-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            Studio3D.designImage = null;
            Studio3D.renderDesignToTexture();
            Studio3D.updateLayers();
            Studio3D.updatePrice();
        });

        layersList.appendChild(div);
    },

    generateTextTexture: () => {
        const textInput = document.getElementById('textInput');
        if (!textInput || !textInput.value) return;
        const text = textInput.value;

        const fontFam = document.getElementById('fontFamily') ? document.getElementById('fontFamily').value : 'Inter';
        const fontColor = Studio3D.textStyle.color;
        const weight = Studio3D.textStyle.bold ? 'bold' : 'normal';
        const style = Studio3D.textStyle.italic ? 'italic' : 'normal';
        const align = Studio3D.textStyle.align; 

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 256;

        ctx.fillStyle = fontColor;
        ctx.font = `${style} ${weight} 120px "${fontFam}"`;
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
            ctx.fillRect(startX, 190, w, 10);
        }

        const img = new Image();
        img.onload = () => {
            Studio3D.designImage = img;
            Studio3D.renderDesignToTexture();
            Studio3D.updatePrice();
        };
        img.src = canvas.toDataURL('image/png');
    }
};

window.Studio = Studio3D; // For external compatibility
