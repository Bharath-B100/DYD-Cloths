import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

document.addEventListener('DOMContentLoaded', () => Studio3D.init());

const Studio3D = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    tshirtMesh: null,
    tshirtMeshes: [],
    modelContainer: null,
    decals: [],
    customDesignConfig: { decals: [] },
    
    currentTexture: null,
    currentTextureSrc: null,
    currentTextureText: null,
    currentDecalMesh: null,
    decalBaseScale: new THREE.Vector3(0.3, 0.3, 0.1),
    decalScale: new THREE.Vector3(0.3, 0.3, 0.1), // Initial size of decal
    
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    
    isDraggingDecal: false,

    state: {
        shirtColor: '#ffffff',
        fabric: '100% Cotton',
        size: 'M',
        quantity: 1
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

                // Find the main mesh to apply decals to
                model.traverse((child) => {
                    if (child.isMesh) {
                        Studio3D.tshirtMeshes.push(child);
                        if (!Studio3D.tshirtMesh) Studio3D.tshirtMesh = child;
                        
                        // Clone the material so we can change its color freely
                        child.material = child.material.clone();
                        child.material.color.setHex(0xffffff);
                        child.material.roughness = 0.8;
                        child.material.side = THREE.DoubleSide;
                    }
                });

                Studio3D.modelContainer.add(model);
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
        container.addEventListener('pointerdown', Studio3D.onPointerDown);
        container.addEventListener('pointermove', Studio3D.onPointerMove);
        container.addEventListener('pointerup', Studio3D.onPointerUp);

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
       INTERACTION & DECALS
    ================================================ */
    onPointerDown: (e) => {
        if (!Studio3D.tshirtMesh) return;

        // Check if we clicked on an existing decal to start dragging
        Studio3D.updateRaycaster(e);
        const intersects = Studio3D.raycaster.intersectObjects(Studio3D.decals);
        
        if (intersects.length > 0) {
            // Clicked a decal, start dragging
            Studio3D.controls.enabled = false;
            Studio3D.isDraggingDecal = true;
            Studio3D.currentDecalMesh = intersects[0].object;
            return;
        }

        // If not dragging an existing decal and we have a new texture, try placing it
        if (Studio3D.currentTexture) {
            const shirtIntersects = Studio3D.raycaster.intersectObjects(Studio3D.tshirtMeshes);
            if (shirtIntersects.length > 0) {
                Studio3D.placeDecal(shirtIntersects[0]);
                // Set as active decal for properties (like scale)
                Studio3D.currentDecalMesh = Studio3D.decals[Studio3D.decals.length - 1];
                Studio3D.isDraggingDecal = true;
                Studio3D.controls.enabled = false;
            }
        }
    },

    onPointerMove: (e) => {
        if (!Studio3D.isDraggingDecal || !Studio3D.currentDecalMesh || !Studio3D.tshirtMesh) return;

        // Update raycaster to new mouse position
        Studio3D.updateRaycaster(e);
        const shirtIntersects = Studio3D.raycaster.intersectObjects(Studio3D.tshirtMeshes);

        if (shirtIntersects.length > 0) {
            // Move the decal by completely re-generating its geometry at the new spot
            Studio3D.updateDecalPosition(Studio3D.currentDecalMesh, shirtIntersects[0]);
        }
    },

    onPointerUp: (e) => {
        Studio3D.isDraggingDecal = false;
        Studio3D.controls.enabled = true; // Re-enable orbit controls
    },

    updateRaycaster: (e) => {
        const container = document.getElementById('threeCanvasContainer');
        const rect = container.getBoundingClientRect();
        Studio3D.mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
        Studio3D.mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
        Studio3D.raycaster.setFromCamera(Studio3D.mouse, Studio3D.camera);
    },

    placeDecal: (intersect) => {
        if (!Studio3D.currentTexture) return;

        const material = new THREE.MeshPhongMaterial({
            map: Studio3D.currentTexture,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -10, // Pull decal forward to prevent z-fighting
            polygonOffsetUnits: -10,
            wireframe: false
        });

        const decalMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
        Studio3D.scene.add(decalMesh);
        Studio3D.decals.push(decalMesh);

        Studio3D.customDesignConfig.decals.push({
            mesh: decalMesh,
            textureSrc: Studio3D.currentTextureSrc,
            textureText: Studio3D.currentTextureText,
            position: [0, 0, 0],
            orientation: [0, 0, 0],
            scale: Studio3D.decalScale.toArray()
        });

        Studio3D.updateDecalPosition(decalMesh, intersect);
        Studio3D.updatePrice();
        Studio3D.updateLayers();
    },

    updateDecalPosition: (decalMesh, intersect) => {
        const position = intersect.point;
        const intersectedMesh = intersect.object;
        // Orient the decal towards the normal of the surface
        const normal = intersect.face.normal.clone();
        normal.transformDirection(intersectedMesh.matrixWorld);
        
        const orientation = new THREE.Euler();
        const dummy = new THREE.Object3D();
        dummy.position.copy(position);
        
        // Sometimes normals can point inward depending on the model
        // So we just orient the dummy properly
        dummy.lookAt(position.clone().add(normal));
        orientation.copy(dummy.rotation);

        const decalGeometry = new DecalGeometry(
            intersectedMesh,
            position,
            orientation,
            Studio3D.decalScale
        );
        
        decalMesh.geometry.dispose(); // clean up old geometry
        decalMesh.geometry = decalGeometry;
        
        // Update config
        const configItem = Studio3D.customDesignConfig.decals.find(d => d.mesh === decalMesh);
        if (configItem) {
            configItem.position = position.toArray();
            configItem.orientation = orientation.toArray();
            configItem.scale = Studio3D.decalScale.toArray();
            configItem.targetMeshName = intersectedMesh.name;
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

        // Upload Image
        document.getElementById('btnUploadImage').addEventListener('click', () => document.getElementById('imageFileInput').click());
        document.getElementById('imageFileInput').addEventListener('change', Studio3D.handleImageUpload);

        // Delete Decal
        document.getElementById('btnDeleteSelected').addEventListener('click', () => {
            if (Studio3D.currentDecalMesh) {
                Studio3D.scene.remove(Studio3D.currentDecalMesh);
                Studio3D.decals = Studio3D.decals.filter(d => d !== Studio3D.currentDecalMesh);
                Studio3D.customDesignConfig.decals = Studio3D.customDesignConfig.decals.filter(d => d.mesh !== Studio3D.currentDecalMesh);
                Studio3D.currentDecalMesh = null;
                Studio3D.updatePrice();
            }
        });

        // Clear Canvas
        document.getElementById('btnClearCanvas').addEventListener('click', () => {
            if (confirm('Clear all images from the T-shirt?')) {
                Studio3D.decals.forEach(d => Studio3D.scene.remove(d));
                Studio3D.decals = [];
                Studio3D.customDesignConfig.decals = [];
                Studio3D.currentDecalMesh = null;
                Studio3D.currentTexture = null;
                Studio3D.currentTextureSrc = null;
                Studio3D.currentTextureText = null;
                Studio3D.updatePrice();
                Studio3D.updateLayers();
            }
        });
        
        // Decal Size Slider (using font size slider for now or we can map image opacity to scale)
        const sizeSlider = document.getElementById('imageOpacity');
        const sizeValue = document.getElementById('imageOpacityValue');
        if(sizeSlider) {
            // Repurpose image opacity slider as Decal Scale
            if (sizeSlider.parentElement && sizeSlider.parentElement.previousElementSibling) {
                sizeSlider.parentElement.previousElementSibling.textContent = "Image Size";
            }
            sizeSlider.min = "10";
            sizeSlider.max = "100";
            sizeSlider.value = "30";
            sizeValue.textContent = "30%";
            
            sizeSlider.addEventListener('input', (e) => {
                sizeValue.textContent = e.target.value + '%';
                const scaleVal = e.target.value / 30; // Assuming 30 is the default base 1.0 multiplier
                
                // Preserve aspect ratio and keep projector Z depth constant
                Studio3D.decalScale.set(
                    Studio3D.decalBaseScale.x * scaleVal, 
                    Studio3D.decalBaseScale.y * scaleVal, 
                    Studio3D.decalBaseScale.z
                );
                
                // Update current active decal if any
                if (Studio3D.currentDecalMesh && Studio3D.tshirtMesh) {
                    // Need to reconstruct DecalGeometry with new scale.
                    // To do this, we need the original intersect position.
                    // For simplicity, let's just wait for them to click again to update, 
                    // or we can raycast from center of bounding box.
                    // This is a complex step. We'll leave it as setting the scale for the NEXT placement for now.
                    // Better yet, update the mesh scale (which works if the underlying geometry is centered, but DecalGeometry is absolute).
                    Studio3D.currentDecalMesh.scale.setScalar(scaleVal / 0.3); // Relative scale adjustment
                }
            });
        }

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
                btnAddToCart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
                btnAddToCart.disabled = true;

                try {
                    // Take screenshot
                    Studio3D.renderer.render(Studio3D.scene, Studio3D.camera);
                    const screenshot = Studio3D.renderer.domElement.toDataURL('image/png');

                    // Clean decals data for storage
                    const cleanDecals = Studio3D.customDesignConfig.decals.map(d => ({
                        textureSrc: d.textureSrc,
                        textureText: d.textureText,
                        position: d.position,
                        orientation: d.orientation,
                        scale: d.scale
                    }));

                    const customDesignInfo = {
                        isCustom: true,
                        shirtColor: Studio3D.state.shirtColor,
                        fabric: Studio3D.state.fabric,
                        size: Studio3D.state.size,
                        decals: cleanDecals
                    };

                    const cartItem = {
                        id: `studio-${Date.now()}`,
                        name: 'Custom T-Shirt Design',
                        price: parseInt(document.getElementById('totalPrice').textContent.replace(/[^0-9]/g, '')) / Studio3D.state.quantity,
                        quantity: Studio3D.state.quantity,
                        size: Studio3D.state.size,
                        color: Studio3D.state.shirtColor,
                        image: screenshot,
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
    },

    setSide: (side) => {
        if (!Studio3D.modelContainer) return;
        document.querySelectorAll('.side-btn').forEach(btn => btn.classList.remove('active'));
        if (side === 'front') {
            document.getElementById('btnFront').classList.add('active');
            Studio3D.modelContainer.rotation.y = 0;
        } else {
            document.getElementById('btnBack').classList.add('active');
            Studio3D.modelContainer.rotation.y = Math.PI;
        }
    },

    setShirtColor: (hexColor) => {
        Studio3D.state.shirtColor = hexColor;
        Studio3D.tshirtMeshes.forEach(mesh => {
            mesh.material.color.setHex(parseInt(hexColor.replace('#', '0x')));
        });
    },

    handleImageUpload: (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(ev.target.result, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                const aspect = texture.image.width / texture.image.height;
                Studio3D.decalBaseScale.set(0.3 * aspect, 0.3, 0.1);
                Studio3D.decalScale.copy(Studio3D.decalBaseScale); // Reset scale
                
                Studio3D.currentTexture = texture;
                Studio3D.currentTextureSrc = ev.target.result;
                Studio3D.currentTextureText = null;
                
                // Show a hint or automatically place in center
                document.getElementById('canvasHint').innerHTML = '<i class="fas fa-hand-pointer"></i> Click anywhere on the 3D T-shirt to place your image. Drag to move it.';
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    },

    /* ================================================
       PRICING
    ================================================ */
    updatePrice: () => {
        const basePrice = Studio3D.pricing[Studio3D.state.fabric] || 299;
        const printCost = Studio3D.decals.length > 0 ? 150 : 0; // Simple print cost rule

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

        layerCount.textContent = `(${Studio3D.decals.length})`;

        if (Studio3D.decals.length === 0) {
            layersList.innerHTML = '<p class="no-layers-msg">No elements yet. Add text or image.</p>';
            return;
        }

        layersList.innerHTML = '';
        Studio3D.decals.forEach((decal, index) => {
            const configItem = Studio3D.customDesignConfig.decals.find(d => d.mesh === decal);
            if (!configItem) return;

            const isText = !!configItem.textureText;
            const name = isText ? `Text: "${configItem.textureText.substring(0,10)}${configItem.textureText.length>10?'...':''}"` : `Image Layer ${index + 1}`;
            const icon = isText ? 'fa-font' : 'fa-image';

            const div = document.createElement('div');
            div.className = `layer-item ${Studio3D.currentDecalMesh === decal ? 'active' : ''}`;
            div.style.cssText = `
                display: flex; justify-content: space-between; align-items: center; 
                padding: 10px; background: rgba(255,255,255,0.05); 
                border-radius: 6px; margin-bottom: 8px; cursor: pointer;
                border: 1px solid ${Studio3D.currentDecalMesh === decal ? 'var(--primary)' : 'transparent'};
            `;
            
            div.innerHTML = `
                <div class="layer-info" style="display:flex; align-items:center; gap:10px;">
                    <i class="fas ${icon}" style="color:var(--text-muted)"></i>
                    <span style="font-size:13px">${name}</span>
                </div>
                <button class="layer-delete-btn" title="Delete Layer" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-trash"></i></button>
            `;

            div.querySelector('.layer-info').addEventListener('click', () => {
                Studio3D.currentDecalMesh = decal;
                // Update opacity/scale slider to match this layer's scale
                const slider = document.getElementById('imageOpacity');
                if (slider) {
                    slider.value = Math.round((configItem.scale[0] / Studio3D.decalBaseScale.x) * 30);
                    const sizeValue = document.getElementById('imageOpacityValue');
                    if(sizeValue) sizeValue.textContent = slider.value + '%';
                }
                Studio3D.updateLayers();
            });

            div.querySelector('.layer-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                Studio3D.scene.remove(decal);
                Studio3D.decals = Studio3D.decals.filter(d => d !== decal);
                Studio3D.customDesignConfig.decals = Studio3D.customDesignConfig.decals.filter(d => d.mesh !== decal);
                if (Studio3D.currentDecalMesh === decal) Studio3D.currentDecalMesh = null;
                Studio3D.updateLayers();
                Studio3D.updatePrice();
            });

            layersList.appendChild(div);
        });
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

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        Studio3D.currentTexture = texture;
        Studio3D.currentTextureSrc = canvas.toDataURL('image/png');
        Studio3D.currentTextureText = text;

        const aspect = canvas.width / canvas.height;
        Studio3D.decalBaseScale.set(0.3 * aspect, 0.3, 0.1);
        Studio3D.decalScale.copy(Studio3D.decalBaseScale);

        if (Studio3D.currentDecalMesh) {
            const configItem = Studio3D.customDesignConfig.decals.find(d => d.mesh === Studio3D.currentDecalMesh);
            if (configItem && configItem.textureText) {
                Studio3D.currentDecalMesh.material.map = texture;
                Studio3D.currentDecalMesh.material.needsUpdate = true;
                configItem.textureSrc = Studio3D.currentTextureSrc;
                configItem.textureText = Studio3D.currentTextureText;
            }
        }
    }
};

window.Studio = Studio3D; // For external compatibility
