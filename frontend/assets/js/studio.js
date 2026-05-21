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
    decalScale: new THREE.Vector3(0.3, 0.3, 0.3), // Initial size of decal
    
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    
    isDraggingDecal: false,

    state: {
        shirtColor: '#ffffff',
        fabric: '100% Cotton',
        size: 'M',
        quantity: 1
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
        Studio3D.camera.position.set(0, 0, 3);

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
        Studio3D.modelContainer.position.set(0, -0.4, 0);

        // Load Model
        const loader = new GLTFLoader();
        loader.load(
            'assets/oversized_t-shirt.glb',
            (gltf) => {
                const model = gltf.scene;
                
                // Adjust model size and position
                model.scale.set(1.5, 1.5, 1.5);
                model.position.set(0, 0, 0);

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
            const shirtIntersects = Studio3D.raycaster.intersectObject(Studio3D.tshirtMesh);
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
        const shirtIntersects = Studio3D.raycaster.intersectObject(Studio3D.tshirtMesh);

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
            polygonOffsetFactor: -4, // Ensure decal is rendered on top of the shirt
            wireframe: false,
            side: THREE.DoubleSide
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
    },

    updateDecalPosition: (decalMesh, intersect) => {
        const position = intersect.point;
        // Orient the decal towards the normal of the surface
        const normal = intersect.face.normal.clone();
        normal.transformDirection(Studio3D.tshirtMesh.matrixWorld);
        
        const orientation = new THREE.Euler();
        const dummy = new THREE.Object3D();
        dummy.position.copy(position);
        dummy.lookAt(position.clone().add(normal));
        orientation.copy(dummy.rotation);
        
        // Adjust orientation slightly so it aligns upright with the model
        // orientation.z = Math.PI;

        const decalGeometry = new DecalGeometry(
            Studio3D.tshirtMesh,
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
                const scaleVal = e.target.value / 100; // 0.1 to 1.0
                Studio3D.decalScale.set(scaleVal, scaleVal, scaleVal);
                
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
                
                const fontFam = document.getElementById('fontFamily').value;
                const fontColor = document.getElementById('textColorPicker').value;
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 1024;
                canvas.height = 256;
                
                ctx.fillStyle = fontColor;
                ctx.font = `bold 120px "${fontFam}"`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 512, 128);
                
                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                
                Studio3D.currentTexture = texture;
                Studio3D.currentTextureSrc = canvas.toDataURL('image/png');
                Studio3D.currentTextureText = text;
                
                Studio3D.decalScale.set(0.3 * (1024/256), 0.3, 0.3);
                
                document.getElementById('canvasHint').innerHTML = '<i class="fas fa-hand-pointer"></i> Click anywhere on the 3D T-shirt to place your text. Drag to move it.';
            });
        }

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

                    if (window.Cart && window.Cart.addItem) {
                        await window.Cart.addItem(cartItem);
                        document.querySelector('.cart-sidebar').classList.add('active');
                        document.querySelector('.cart-overlay').classList.add('active');
                        window.Cart.updateCartUI();
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
                // Add aspect ratio to decal scale based on image dimensions
                const aspect = texture.image.width / texture.image.height;
                Studio3D.decalScale.set(0.3 * aspect, 0.3, 0.3); // Adjust base scale
                
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
    }
};

window.Studio = Studio3D; // For external compatibility
