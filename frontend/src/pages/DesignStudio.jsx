// src/pages/DesignStudio.jsx - 3D Customizer Studio Single-Page App Component
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { cloneDesigns, serializeDesigns, validateDraft, studioPriceSetting } from '../utils/studioDesign';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import API from '../config/api';
import { formatINR } from '../utils/format';
import '../styles/studio.css';
import ConfirmDialog from '../components/ConfirmDialog';

// Print Zone UV calculation helper
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
        
        const nA = new THREE.Vector3(normalAttr.getX(a), normalAttr.getY(a), normalAttr.getZ(a));
        nA.transformDirection(worldMatrix);
        
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
    
    return { 
        u0: Math.max(0, minU - 0.05), 
        v0: Math.max(0, minV - 0.05), 
        u1: Math.min(1, maxU + 0.05), 
        v1: Math.min(1, maxV + 0.05) 
    };
}

const DesignStudio = () => {
    const { user, isLoggedIn, loading: authLoading } = useAuth();
    const { addItem } = useCart();
    const navigate = useNavigate();

    const canvasContainerRef = useRef(null);
    const frontFileInputRef = useRef(null);
    const backFileInputRef = useRef(null);
    const toolbarFileInputRef = useRef(null);
    const draftFileInputRef = useRef(null);
    const textRenderVersionRef = useRef({});

    // ThreeJS References
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const modelContainerRef = useRef(null);
    const tshirtMeshRef = useRef(null);
    const tshirtMeshesRef = useRef([]);

    // Texture Canvas References
    const printCanvasRef = useRef(null);
    const printCtxRef = useRef(null);
    const printTextureRef = useRef(null);
    const printZoneUVsRef = useRef({ front: null, back: null });

    // Component states
    const [modelLoading, setModelLoading] = useState(true);
    const [modelError, setModelError] = useState('');
    const [draftLoading, setDraftLoading] = useState(false);
    const [draftMessage, setDraftMessage] = useState('');
    const [, setHistoryVersion] = useState(0);
    const [currentSide, setCurrentSide] = useState('front');
    const [shirtColor, setShirtColor] = useState('#ffffff');
    const [fabric, setFabric] = useState('100% Cotton');
    const [selectedSize, setSelectedSize] = useState('M');
    const [quantity, setQuantity] = useState(1);

    // Design Layers State
    const [designs, setDesigns] = useState({ front: [], back: [] });
    const [activeLayerId, setActiveLayerId] = useState(null);
    const [clearSidePending, setClearSidePending] = useState(false);
    const [deleteLayerPending, setDeleteLayerPending] = useState(false);
    const [activeRightPanel, setActiveRightPanel] = useState('text'); // 'text', 'image', 'ai'

    // Active layer parameters
    const [scale, setScale] = useState(100);
    const [posX, setPosX] = useState(0);
    const [posY, setPosY] = useState(0);
    const [rotation, setRotation] = useState(0);

    // Text options
    const [textInput, setTextInput] = useState('');
    const [textColor, setTextColor] = useState('#111111');
    const [fontFamily, setFontFamily] = useState('Inter');
    const [fontSize, setFontSize] = useState(40);
    const [textStyle, setTextStyle] = useState({ bold: false, italic: false, underline: false, align: 'center' });

    // AI options
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiResultUrl, setAiResultUrl] = useState('');
    const [removingBg, setRemovingBg] = useState(false);
    const [backgroundRemovalAvailable, setBackgroundRemovalAvailable] = useState(false);

    // Pricing Config
    const [pricing, setPricing] = useState({
        '100% Cotton': 299,
        'Poly Cotton': 349,
        'Dry Fit': 379,
        'Premium Cotton': 449,
        'Organic Cotton': 499,
        'printCostPerSide': 150,
        'textCostPerUnit': 50
    });

    const [addingToCart, setAddingToCart] = useState(false);

    // Refs for fresh closures in event listeners
    const designsRef = useRef(designs);
    useEffect(() => {
        designsRef.current = designs;
    }, [designs]);

    const currentSideRef = useRef(currentSide);
    useEffect(() => {
        currentSideRef.current = currentSide;
    }, [currentSide]);

    const activeLayerIdRef = useRef(activeLayerId);
    useEffect(() => {
        activeLayerIdRef.current = activeLayerId;
    }, [activeLayerId]);

    const shirtColorRef = useRef(shirtColor);
    useEffect(() => {
        shirtColorRef.current = shirtColor;
    }, [shirtColor]);

    // History stack refs for Undo/Redo
    const historyRef = useRef([{ front: [], back: [] }]);
    const historyIndexRef = useRef(0);

    const pushHistory = useCallback((newDesigns) => {
        const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        if (JSON.stringify(serializeDesigns(nextHistory[nextHistory.length - 1])) === JSON.stringify(serializeDesigns(newDesigns))) return;
        nextHistory.push(cloneDesigns(newDesigns));
        historyRef.current = nextHistory.slice(-50);
        historyIndexRef.current = historyRef.current.length - 1;
        setHistoryVersion(version => version + 1);
    }, []);

    const handleUndo = useCallback(() => {
        if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            const prevDesigns = cloneDesigns(historyRef.current[historyIndexRef.current]);
            designsRef.current = prevDesigns;
            setDesigns(prevDesigns);
            setActiveLayerId(null);

        }
    }, []);

    const handleRedo = useCallback(() => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            const nextDesigns = cloneDesigns(historyRef.current[historyIndexRef.current]);
            designsRef.current = nextDesigns;
            setDesigns(nextDesigns);
            setActiveLayerId(null);

        }
    }, []);

    // Redirect guest users
    useEffect(() => {
        if (!authLoading && !isLoggedIn) {
            if (window.Utils?.showToast) window.Utils.showToast('Please sign in to use the Design Studio', 'warning');
            navigate('/login');
        }
    }, [isLoggedIn, authLoading, navigate]);

    // Fetch dynamic pricing settings
    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const res = await API.get('/settings');
                if (res.success && res.data) {
                    const s = res.data;
                    setBackgroundRemovalAvailable(s.background_removal_available === true);
                    setPricing(prev => ({
                        ...prev,
                        '100% Cotton': studioPriceSetting(s.price_fabric_cotton, prev['100% Cotton']),
                        'Poly Cotton': studioPriceSetting(s.price_fabric_polycotton, prev['Poly Cotton']),
                        'Dry Fit': studioPriceSetting(s.price_fabric_dryfit, prev['Dry Fit']),
                        'Premium Cotton': studioPriceSetting(s.price_fabric_premium, prev['Premium Cotton']),
                        'Organic Cotton': studioPriceSetting(s.price_fabric_organic, prev['Organic Cotton']),
                        'printCostPerSide': studioPriceSetting(s.price_print_per_side, prev.printCostPerSide),
                        'textCostPerUnit': studioPriceSetting(s.price_text_per_unit, prev.textCostPerUnit)
                    }));
                }
            } catch {
                console.warn('Could not load studio settings, using defaults');
            }
        };
        fetchPricing();
    }, []);

    // Load clean image helper
    const loadCleanImage = useCallback((src) => {
        return new Promise((resolve, reject) => {
            if (!src) return reject(new Error('No source provided'));
            const img = new Image();
            if (src.startsWith('data:') || src.startsWith('blob:')) {
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
                return;
            }
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => {
                fetch(src)
                    .then(res => res.blob())
                    .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        const bImg = new Image();
                        bImg.onload = () => { URL.revokeObjectURL(blobUrl); resolve(bImg); };
                        bImg.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Could not load image.')); };
                        bImg.src = blobUrl;
                    })
                    .catch(reject);
            };
            img.src = src;
        });
    }, []);

    // Canvas Draw Orchestration
    const renderDesignToTexture = useCallback((currentSideValue = currentSideRef.current, currentDesigns = designsRef.current, currentColor = shirtColorRef.current) => {
        const ctx = printCtxRef.current;
        if (!ctx) return;

        // 1. Fill base shirt color
        ctx.fillStyle = currentColor;
        ctx.fillRect(0, 0, 2048, 2048);

        // 2. Draw all layers for BOTH sides
        ['front', 'back'].forEach(side => {
            const layers = currentDesigns[side] || [];
            const uvZone = printZoneUVsRef.current[side];

            if (layers.length > 0 && uvZone) {
                const zWidth = (uvZone.u1 - uvZone.u0) * 2048;
                const zHeight = (uvZone.v1 - uvZone.v0) * 2048;

                layers.forEach(layer => {
                    if (!layer.img) return;
                    ctx.save();

                    const cX = uvZone.u0 * 2048 + zWidth * layer.x;
                    const cY = uvZone.v0 * 2048 + zHeight * layer.y;

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

        if (printTextureRef.current) {
            printTextureRef.current.needsUpdate = true;
        }
    }, [currentSideRef, designsRef, shirtColorRef]);

    // Track active layer params state syncing
    useEffect(() => {
        const layers = designs[currentSide] || [];
        const active = layers.find(l => l.id === activeLayerId);
        if (active) {
            setScale(Math.round(active.scale * 100));
            setPosX(Math.round(active.x * 100));
            setPosY(Math.round(active.y * 100));
            setRotation(active.rotation);

            if (active.type === 'text') {
                setTextInput(active.textContent || '');
                setTextColor(active.textStyle?.color || '#111111');
                setFontFamily(active.textSettings?.fontFamily || 'Inter');
                setFontSize(active.textSettings?.fontSize || 40);
                setTextStyle(active.textStyle || { bold: false, italic: false, underline: false, align: 'center' });
            }
        }
    }, [activeLayerId, currentSide, designs]);

    // Update active layer on color, side or designs change manually
    useEffect(() => {
        renderDesignToTexture(currentSide, designs, shirtColor);
    }, [currentSide, designs, shirtColor, renderDesignToTexture]);



    // Handle shirt color change
    const handleShirtColorChange = (hex) => {
        setShirtColor(hex);
        const nextDesigns = designsRef.current;
        renderDesignToTexture(currentSide, nextDesigns, hex);
    };

    // Update active layer transform values
    const updateActiveLayerProp = (prop, value) => {
        setDesigns(prev => {
            const sideLayers = prev[currentSide] || [];
            const updated = sideLayers.map(l => {
                if (l.id === activeLayerId) {
                    return { ...l, [prop]: value };
                }
                return l;
            });
            const newDesigns = { ...prev, [currentSide]: updated };

            return newDesigns;
        });
    };

    // Text texture generator
    const createTextTexture = async (text, colorValue = textColor, fontValue = fontFamily, sizeValue = fontSize, styleValue = textStyle) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const canvasFontSize = Math.round(sizeValue * 3);
        const weight = styleValue.bold ? 'bold' : 'normal';
        const italic = styleValue.italic ? 'italic' : 'normal';
        const font = `${italic} ${weight} ${canvasFontSize}px "${fontValue}"`;
        ctx.font = font;
        canvas.width = Math.max(1024, Math.min(4096, Math.ceil(ctx.measureText(text).width + 100)));
        canvas.height = Math.max(256, canvasFontSize * 2);
        ctx.fillStyle = colorValue;
        ctx.font = font;
        ctx.textBaseline = 'middle';
        const centerY = canvas.height / 2;

        if (styleValue.align === 'left') {
            ctx.textAlign = 'left';
            ctx.fillText(text, 50, centerY, canvas.width - 100);
        } else if (styleValue.align === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(text, canvas.width - 50, centerY, canvas.width - 100);
        } else {
            ctx.textAlign = 'center';
            ctx.fillText(text, canvas.width / 2, centerY, canvas.width - 100);
        }

        if (styleValue.underline) {
            const metrics = ctx.measureText(text);
            const w = Math.min(metrics.width, canvas.width - 100);
            let startX = canvas.width / 2 - w/2;
            if (styleValue.align === 'left') startX = 50;
            if (styleValue.align === 'right') startX = canvas.width - 50 - w;
            ctx.fillRect(startX, centerY + canvasFontSize / 2 + 8, w, Math.max(4, Math.round(canvasFontSize / 12)));
        }

        const dataUrl = canvas.toDataURL('image/png');
        const img = await loadCleanImage(dataUrl);
        return { img, dataUrl };
    };

    const handleAddTextLayer = async () => {
        if (!textInput.trim()) return;
        if (designsRef.current[currentSide].length >= 30) {
            window.Utils?.showToast?.('A side can contain up to 30 layers.', 'warning');
            return;
        }

        try {
            const texture = await createTextTexture(textInput);
            if (!texture) return;

            const textSnippet = textInput.length > 10 ? `${textInput.substring(0, 10)}...` : textInput;
            const newLayer = {
                id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                name: `Text: "${textSnippet}"`,
                type: 'text',
                img: texture.img,
                rawSrc: texture.dataUrl,
                x: currentSide === 'back' ? 0.73 : 0.30,
                y: 0.34,
                scale: 0.6,
                rotation: 0,
                textContent: textInput,
                textStyle: { ...textStyle, color: textColor },
                textSettings: { fontFamily, fontSize }
            };

            setDesigns(prev => {
                const sideLayers = [...(prev[currentSide] || []), newLayer];
                const newDesigns = { ...prev, [currentSide]: sideLayers };
                setActiveLayerId(newLayer.id);
                setActiveRightPanel('text');

                pushHistory(newDesigns);
                return newDesigns;
            });
            setTextInput('');
        } catch (err) {
            console.error(err);
            if (window.Utils?.showToast) window.Utils.showToast('Failed to generate text layer', 'error');
        }
    };

    const handleUpdateActiveTextLayer = async (updatedFields = {}) => {
        const sideLayers = designs[currentSide] || [];
        const active = sideLayers.find(l => l.id === activeLayerId);
        if (!active || active.type !== 'text') return;
        const renderVersion = (textRenderVersionRef.current[active.id] || 0) + 1;
        textRenderVersionRef.current[active.id] = renderVersion;

        const text = updatedFields.textContent !== undefined ? updatedFields.textContent : textInput;
        const color = updatedFields.color !== undefined ? updatedFields.color : textColor;
        const font = updatedFields.fontFamily !== undefined ? updatedFields.fontFamily : fontFamily;
        const size = updatedFields.fontSize !== undefined ? updatedFields.fontSize : fontSize;
        const style = updatedFields.textStyle !== undefined ? updatedFields.textStyle : textStyle;

        try {
            const texture = await createTextTexture(text, color, font, size, style);
            if (!texture || textRenderVersionRef.current[active.id] !== renderVersion) return;

            const textSnippet = text.length > 10 ? `${text.substring(0, 10)}...` : text;
            setDesigns(prev => {
                const updated = prev[currentSide].map(l => {
                    if (l.id === activeLayerId) {
                        return {
                            ...l,
                            name: `Text: "${textSnippet}"`,
                            img: texture.img,
                            rawSrc: texture.dataUrl,
                            textContent: text,
                            textStyle: { ...style, color },
                            textSettings: { fontFamily: font, fontSize: size }
                        };
                    }
                    return l;
                });
                const newDesigns = { ...prev, [currentSide]: updated };
                pushHistory(newDesigns);

                return newDesigns;
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleSideFileUpload = (e, side) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            window.Utils?.showToast?.('Upload a PNG, JPEG or WebP image.', 'error');
            e.target.value = '';
            return;
        }
        if (designsRef.current[side].length >= 30) {
            window.Utils?.showToast?.('A side can contain up to 30 layers.', 'warning');
            e.target.value = '';
            return;
        }

        // Check size limit: 2MB
        if (file.size > 2 * 1024 * 1024) {
            if (window.Utils?.showToast) {
                window.Utils.showToast('Image size must be below 2MB', 'error');
            }
            e.target.value = '';
            return;
        }

        handleSideUpload(file, side);
        e.target.value = '';
    };

    const handleSideUpload = (file, side) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const rawSrc = ev.target.result;
            try {
                const img = await loadCleanImage(rawSrc);
                const count = (designs[side] || []).length + 1;
                const newLayer = {
                    id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    name: `Uploaded Design ${count}`,
                    type: 'image',
                    img,
                    rawSrc,
                    x: side === 'back' ? 0.73 : 0.30,
                    y: 0.34,
                    scale: 0.6,
                    rotation: 0
                };

                setDesigns(prev => {
                    const sideLayers = [...(prev[side] || []), newLayer];
                    const newDesigns = { ...prev, [side]: sideLayers };
                    setActiveLayerId(newLayer.id);
                    setActiveRightPanel('image');
                    setCurrentSide(side);
                    if (cameraRef.current && controlsRef.current && currentSideRef.current !== side) {
                        cameraRef.current.position.set(0, 0, side === 'back' ? -1.8 : 1.8);
                        controlsRef.current.update();
                    }

                    pushHistory(newDesigns);
                    return newDesigns;
                });
            } catch (err) {
                console.error(err);
                window.Utils?.showToast?.('This image could not be loaded. Try a different PNG, JPEG or WebP.', 'error');
            }
        };
        reader.readAsDataURL(file);
    };

    // Clear active side designs
    const handleClearSide = (side = currentSide) => {
        setDesigns(prev => {
            const newDesigns = { ...prev, [side]: [] };
            if (currentSide === side) {
                setActiveLayerId(null);
            }

            pushHistory(newDesigns);
            return newDesigns;
        });
    };

    // Delete active layer
    const handleDeleteActiveLayer = () => {
        if (!activeLayerId) return;
        handleDeleteLayer(activeLayerId);
        setDeleteLayerPending(false);
    };

    // Delete single layer
    const handleDeleteLayer = (layerId) => {
        setDesigns(prev => {
            const filtered = prev[currentSide].filter(l => l.id !== layerId);
            const newDesigns = { ...prev, [currentSide]: filtered };
            if (activeLayerId === layerId) {
                setActiveLayerId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
                if (filtered.length > 0) {
                    setActiveRightPanel(filtered[filtered.length - 1].type);
                } else {
                    setActiveRightPanel('text');
                }
            }

            pushHistory(newDesigns);
            return newDesigns;
        });
    };

    // Generate AI magic graphic
    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) {
            if (window.Utils?.showToast) window.Utils.showToast('Please enter a description for your design.', 'warning');
            return;
        }

        setAiGenerating(true);
        try {
            const res = await API.post('/ai/generate', { prompt: aiPrompt });
            if (res.success && res.data?.length > 0) {
                setAiResultUrl(res.data[0].url);
            } else {
                if (window.Utils?.showToast) window.Utils.showToast(res.message || 'Failed to generate image', 'error');
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'AI Generation failed', 'error');
        } finally {
            setAiGenerating(false);
        }
    };

    const handleAddAiToShirt = async () => {
        if (!aiResultUrl) return;
        if (designsRef.current[currentSide].length >= 30) {
            window.Utils?.showToast?.('A side can contain up to 30 layers.', 'warning');
            return;
        }

        try {
            const img = await loadCleanImage(aiResultUrl);
            const count = (designs[currentSide] || []).length + 1;
            const newLayer = {
                id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                name: `AI Design ${count}`,
                type: 'image',
                img,
                rawSrc: aiResultUrl,
                x: currentSide === 'back' ? 0.73 : 0.30,
                y: 0.34,
                scale: 0.6,
                rotation: 0
            };

            setDesigns(prev => {
                const sideLayers = [...(prev[currentSide] || []), newLayer];
                const newDesigns = { ...prev, [currentSide]: sideLayers };
                setActiveLayerId(newLayer.id);
                setActiveRightPanel('image');

                pushHistory(newDesigns);
                return newDesigns;
            });
        } catch (err) {
            console.error(err);
        }
    };

    // Remove background of active layer image
    const handleRemoveBackground = async () => {
        if (!backgroundRemovalAvailable || removingBg) return;
        const sideLayers = designs[currentSide] || [];
        const active = sideLayers.find(l => l.id === activeLayerId);

        if (!active || !active.img || active.type !== 'image') {
            if (window.Utils?.showToast) window.Utils.showToast('Please select an image layer first', 'warning');
            return;
        }

        setRemovingBg(true);
        try {
            const res = await API.post('/ai/remove-bg', { imageUrl: active.rawSrc });
            if (res.success && res.url) {
                const img = await loadCleanImage(res.url);
                setDesigns(prev => {
                    const updated = prev[currentSide].map(l => {
                        if (l.id === activeLayerId) {
                            return { ...l, img, rawSrc: res.url };
                        }
                        return l;
                    });
                    const newDesigns = { ...prev, [currentSide]: updated };

                    pushHistory(newDesigns);
                    return newDesigns;
                });
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Background removal failed', 'error');
        } finally {
            setRemovingBg(false);
        }
    };

    // Capture front/back previews
    const generatePreviewSnapshot = (side = 'front') => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const container = modelContainerRef.current;

        if (!renderer || !scene || !camera || !container) return '';

        // A dedicated camera keeps previews consistent after orbiting, panning or zooming.
        const previewCamera = camera.clone();
        previewCamera.position.set(0, 0, side === 'back' ? -1.8 : 1.8);
        previewCamera.lookAt(0, 0, 0);
        const oldRotation = container.rotation.clone();
        try {
            container.rotation.set(0, 0, 0);
            renderer.render(scene, previewCamera);
            const canvas = document.createElement('canvas');
            const ratio = Math.min(1, 720 / Math.max(renderer.domElement.width, renderer.domElement.height));
            canvas.width = Math.max(1, Math.round(renderer.domElement.width * ratio));
            canvas.height = Math.max(1, Math.round(renderer.domElement.height * ratio));
            canvas.getContext('2d').drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.85);
        } finally {
            container.rotation.copy(oldRotation);
            renderer.render(scene, camera);
        }
    };

    const getDraft = () => ({ version: 1, savedAt: new Date().toISOString(), shirtColor, fabric,
        size: selectedSize, quantity, designs: serializeDesigns(designs) });

    const handleSaveDraft = () => {
        try {
            localStorage.setItem(`studio-draft:${user?._id || user?.id}`, JSON.stringify(getDraft()));
            setDraftMessage('Draft saved on this device.');
        } catch {
            setDraftMessage('Device storage is full or unavailable. Download your draft to keep it.');
        }
    };

    const handleDownloadDraft = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(getDraft())], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'my-tshirt-design.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const restoreDraft = async (raw) => {
        setDraftLoading(true);
        try {
            const draft = validateDraft(JSON.parse(raw));
            const restored = { front: [], back: [] };
            for (const side of ['front', 'back']) {
                restored[side] = await Promise.all(draft.designs[side].map(async (layer, index) => ({
                    ...layer, id: `${side}-${Date.now()}-${index}`, img: await loadCleanImage(layer.rawSrc)
                })));
            }
            designsRef.current = restored;
            setDesigns(restored);
            setShirtColor(draft.shirtColor);
            setFabric(draft.fabric);
            setSelectedSize(draft.size);
            setQuantity(draft.quantity);
            setActiveLayerId(null);
            pushHistory(restored);
            setDraftMessage('Draft restored.');
        } catch (error) {
            setDraftMessage(error.message || 'Could not restore this draft.');
        } finally {
            setDraftLoading(false);
        }
    };

    const handleLoadDraft = () => {
        try {
            const saved = localStorage.getItem(`studio-draft:${user?._id || user?.id}`);
            if (saved) restoreDraft(saved);
            else setDraftMessage('No saved draft on this device yet.');
        } catch {
            setDraftMessage('Device storage is unavailable. Import a downloaded draft instead.');
        }
    };

    // Add custom design to checkout cart
    const handleAddToCart = async () => {
        if (addingToCart || modelLoading || modelError || draftLoading) return;
        setAddingToCart(true);
        try {
            const frontSnap = generatePreviewSnapshot('front') || (printCanvasRef.current ? printCanvasRef.current.toDataURL('image/png') : '');
            const backSnap = generatePreviewSnapshot('back') || (printCanvasRef.current ? printCanvasRef.current.toDataURL('image/png') : '');
            const mainSnap = designs.front.length > 0 || designs.back.length === 0 ? frontSnap : backSnap;

            const unitPrice = getUnitPrice();

            const customDesignInfo = {
                isCustom: true,
                shirtColor,
                fabric,
                size: selectedSize,
                frontImage: frontSnap,
                backImage: backSnap,
                frontLayers: serializeDesigns(designs).front,
                backLayers: serializeDesigns(designs).back
            };

            const success = addItem({
                id: `studio-${Date.now()}`,
                name: 'Custom T-Shirt Design',
                price: unitPrice,
                quantity,
                size: selectedSize,
                color: shirtColor,
                image: mainSnap,
                customDesign: customDesignInfo
            }, window.Utils?.showToast);

            if (success) {
                navigate('/checkout');
            }
        } catch (err) {
            console.error('Failed to capture custom T-shirt snapshots:', err);
            window.Utils?.showToast?.('Could not prepare your design. Save a draft and try again.', 'error');
        } finally {
            setAddingToCart(false);
        }
    };

    // Initialize ThreeJS scene
    useEffect(() => {
        const container = canvasContainerRef.current;
        if (!container) return;
        let disposed = false;
        tshirtMeshesRef.current = [];
        tshirtMeshRef.current = null;
        printZoneUVsRef.current = { front: null, back: null };

        // Scene Setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f5f5);
        sceneRef.current = scene;

        // Camera Setup
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0, 1.8);
        cameraRef.current = camera;

        // WebGL Renderer Setup
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        } catch {
            setModelLoading(false);
            setModelError('3D preview is unavailable in this browser. Enable hardware acceleration or try another browser.');
            return;
        }
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls Setup
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 1;
        controls.maxDistance = 5;
        controlsRef.current = controls;

        // Light Setup
        const ambient = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambient);

        const dir1 = new THREE.DirectionalLight(0xffffff, 0.85);
        dir1.position.set(5, 5, 5);
        scene.add(dir1);

        const dir2 = new THREE.DirectionalLight(0xffffff, 0.45);
        dir2.position.set(-5, 5, 5);
        scene.add(dir2);

        // Group container
        const modelContainer = new THREE.Group();
        scene.add(modelContainer);
        modelContainerRef.current = modelContainer;

        // Create Print Canvas
        const printCanvas = document.createElement('canvas');
        printCanvas.width = 2048;
        printCanvas.height = 2048;
        const printCtx = printCanvas.getContext('2d');
        printCtx.fillStyle = '#ffffff';
        printCtx.fillRect(0, 0, 2048, 2048);

        printCanvasRef.current = printCanvas;
        printCtxRef.current = printCtx;

        const printTexture = new THREE.CanvasTexture(printCanvas);
        printTexture.colorSpace = THREE.SRGBColorSpace;
        printTexture.flipY = false;
        printTextureRef.current = printTexture;

        const startLoadingGLTF = () => {
            const loader = new GLTFLoader();
            loader.setMeshoptDecoder(MeshoptDecoder);
            loader.load(
                '/assets/oversized_t-shirt.glb',
                (gltf) => {
                    if (disposed) return;
                    const model = gltf.scene;
                    model.scale.set(1.5, 1.5, 1.5);

                    // Center Model
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.x += (model.position.x - center.x);
                    model.position.y += (model.position.y - center.y);
                    model.position.z += (model.position.z - center.z);

                    model.traverse((child) => {
                        if (child.isMesh) {
                            const childName = child.name.toLowerCase();
                            if (childName.includes('plane') || childName.includes('ground') || childName.includes('shadow') || childName.includes('backdrop') || childName.includes('studio') || childName.includes('environment')) {
                                child.visible = false;
                                return;
                            }

                            // Compute Print Zone UVs
                            child.updateMatrixWorld();
                            if (!printZoneUVsRef.current.front) {
                                printZoneUVsRef.current.front = computePrintZoneUVs(child.geometry, child.matrixWorld, 'front');
                                printZoneUVsRef.current.back = computePrintZoneUVs(child.geometry, child.matrixWorld, 'back');
                            }

                            tshirtMeshesRef.current.push(child);
                            if (!tshirtMeshRef.current) tshirtMeshRef.current = child;

                            child.material = new THREE.MeshStandardMaterial({
                                map: printTexture,
                                color: 0xffffff,
                                roughness: 0.8,
                                side: THREE.DoubleSide
                            });
                        }
                    });

                    modelContainer.add(model);
                    setModelLoading(false);
                    renderDesignToTexture(currentSideRef.current, designsRef.current, shirtColorRef.current);
                },
                undefined,
                (err) => {
                    console.error('Error loading T-shirt model:', err);
                    if (!disposed) {
                        setModelLoading(false);
                        setModelError('The T-shirt model could not load. Save your draft, then reload to try again.');
                    }
                }
            );
        };

        startLoadingGLTF();

        // Raycasting for dragging on mesh
        let isDragging = false;
        const mouse = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();

        const updatePosition = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects(tshirtMeshesRef.current);
            if (intersects.length > 0) {
                const uv = intersects[0].uv;
                const side = currentSideRef.current;
                const uvZone = printZoneUVsRef.current[side];
                if (uv && uvZone) {
                    let nx = (uv.x - uvZone.u0) / (uvZone.u1 - uvZone.u0);
                    let ny = (uv.y - uvZone.v0) / (uvZone.v1 - uvZone.v0);
                    nx = Math.max(0, Math.min(1, nx));
                    ny = Math.max(0, Math.min(1, ny));

                    const activeId = activeLayerIdRef.current;
                    setDesigns(prev => {
                        const sideLayers = prev[side] || [];
                        const updated = sideLayers.map(l => {
                            if (l.id === activeId) {
                                return { ...l, x: nx, y: ny };
                            }
                            return l;
                        });
                        const newDesigns = { ...prev, [side]: updated };
                        renderDesignToTexture(side, newDesigns, shirtColorRef.current);
                        return newDesigns;
                    });
                }
            }
        };

        const handlePointerDown = (e) => {
            const side = currentSideRef.current;
            const sideLayers = designsRef.current[side] || [];
            if (!tshirtMeshRef.current || sideLayers.length === 0) return;

            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects(tshirtMeshesRef.current);
            if (intersects.length > 0) {
                const uv = intersects[0].uv;
                const uvZone = printZoneUVsRef.current[side];
                if (uv && uvZone) {
                    const nx = (uv.x - uvZone.u0) / (uvZone.u1 - uvZone.u0);
                    const ny = (uv.y - uvZone.v0) / (uvZone.v1 - uvZone.v0);

                    let closest = sideLayers[sideLayers.length - 1];
                    let minDist = Infinity;
                    sideLayers.forEach(l => {
                        const dist = Math.hypot(l.x - nx, l.y - ny);
                        if (dist < minDist) {
                            minDist = dist;
                            closest = l;
                        }
                    });
                    if (closest) {
                        activeLayerIdRef.current = closest.id;
                        setActiveLayerId(closest.id);
                        setActiveRightPanel(closest.type);
                    }
                }
                controls.enabled = false;
                isDragging = true;
                updatePosition(e);
            }
        };

        const handlePointerMove = (e) => {
            if (isDragging) updatePosition(e);
        };

        const handlePointerUp = () => {
            if (isDragging) {
                isDragging = false;
                pushHistory(designsRef.current);
            }
            controls.enabled = true;
        };

        const canvasEl = renderer.domElement;
        canvasEl.addEventListener('pointerdown', handlePointerDown);
        canvasEl.addEventListener('pointermove', handlePointerMove);
        canvasEl.addEventListener('pointerup', handlePointerUp);
        canvasEl.addEventListener('pointerleave', handlePointerUp);

        // Animation loop
        let animationFrameId;
        const animate = () => {
            controls.update();

            // Detect view side rotation auto-sync
            if (modelContainer && camera) {
                const isRotated = Math.abs(modelContainer.rotation.y - Math.PI) < 0.1;
                const isCameraZPositive = camera.position.z > 0;
                let visible = 'front';
                if (isRotated) {
                    visible = isCameraZPositive ? 'back' : 'front';
                } else {
                    visible = isCameraZPositive ? 'front' : 'back';
                }
                if (visible !== currentSideRef.current) {
                    setCurrentSide(visible);
                }
            }

            renderer.render(scene, camera);
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        // Resize handler
        const handleResize = () => {
            if (!container) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            disposed = true;
            cancelAnimationFrame(animationFrameId);
            controls.dispose();
            printTexture.dispose();
            scene.traverse(child => {
                child.geometry?.dispose();
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => material?.dispose());
            });
            renderer.dispose();
            window.removeEventListener('resize', handleResize);
            canvasEl.removeEventListener('pointerdown', handlePointerDown);
            canvasEl.removeEventListener('pointermove', handlePointerMove);
            canvasEl.removeEventListener('pointerup', handlePointerUp);
            canvasEl.removeEventListener('pointerleave', handlePointerUp);
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [pushHistory, renderDesignToTexture]);

    // Price Calculations
    const getUnitPrice = () => {
        const base = pricing[fabric] ?? 299;
        const hasFront = (designs.front || []).some(l => l.type !== 'text');
        const hasBack = (designs.back || []).some(l => l.type !== 'text');
        const prints = (hasFront ? pricing.printCostPerSide : 0) + (hasBack ? pricing.printCostPerSide : 0);
        const textCount = [...(designs.front || []), ...(designs.back || [])].filter(l => l.type === 'text').length;
        const texts = textCount * pricing.textCostPerUnit;

        return base + prints + texts;
    };

    const unitPrice = getUnitPrice();
    const totalPrice = unitPrice * quantity;
    const activeLayer = (designs[currentSide] || []).find(l => l.id === activeLayerId);

    const handleSideToggle = (side) => {
        setCurrentSide(side);
        if (cameraRef.current && controlsRef.current) {
            cameraRef.current.position.set(0, 0, side === 'back' ? -1.8 : 1.8);
            controlsRef.current.update();
        }
    };

    const handleBringForward = () => {
        if (!activeLayerId) return;
        setDesigns(prev => {
            const sideLayers = [...(prev[currentSide] || [])];
            const idx = sideLayers.findIndex(l => l.id === activeLayerId);
            if (idx !== -1 && idx < sideLayers.length - 1) {
                const temp = sideLayers[idx];
                sideLayers[idx] = sideLayers[idx + 1];
                sideLayers[idx + 1] = temp;
            }
            const newDesigns = { ...prev, [currentSide]: sideLayers };

            pushHistory(newDesigns);
            return newDesigns;
        });
    };

    const handleSendBackward = () => {
        if (!activeLayerId) return;
        setDesigns(prev => {
            const sideLayers = [...(prev[currentSide] || [])];
            const idx = sideLayers.findIndex(l => l.id === activeLayerId);
            if (idx > 0) {
                const temp = sideLayers[idx];
                sideLayers[idx] = sideLayers[idx - 1];
                sideLayers[idx - 1] = temp;
            }
            const newDesigns = { ...prev, [currentSide]: sideLayers };

            pushHistory(newDesigns);
            return newDesigns;
        });
    };

    // Derived states for upload thumbnails & clear buttons
    const lastFrontImage = [...designs.front].reverse().find(l => l.type === 'image');
    const lastBackImage = [...designs.back].reverse().find(l => l.type === 'image');
    const hasFrontLayers = designs.front.length > 0;
    const hasBackLayers = designs.back.length > 0;

    return (
        <div className="studio-layout">
            {/* Left Design Tools Panel */}
            <aside className="studio-panel studio-panel-left" id="leftPanel">
                <div className="panel-header">
                    <h3><i className="fas fa-magic"></i> Design Tools</h3>
                </div>

                <div className="tool-section">
                    <label className="tool-label">Keep your design</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={handleSaveDraft} disabled={draftLoading}>Save draft</button>
                        <button className="btn btn-outline btn-sm" onClick={handleLoadDraft} disabled={draftLoading}>Restore saved</button>
                        <button className="btn btn-outline btn-sm" onClick={handleDownloadDraft}>Download draft</button>
                        <button className="btn btn-outline btn-sm" onClick={() => draftFileInputRef.current.click()} disabled={draftLoading}>Import draft</button>
                    </div>
                    <input ref={draftFileInputRef} type="file" accept="application/json,.json" hidden onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        if (file.size > 20 * 1024 * 1024) { setDraftMessage('Draft files must be below 20 MB.'); return; }
                        try { await restoreDraft(await file.text()); }
                        catch { setDraftMessage('Could not read this draft file.'); }
                    }} />
                    <p role="status" style={{ fontSize: '12px', marginTop: '8px' }}>{draftLoading ? 'Restoring draft…' : draftMessage || 'Save on this device or download a file to edit later.'}</p>
                </div>

                {/* Garment Side Switch */}
                <div className="tool-section">
                    <label className="tool-label">Garment Side</label>
                    <div className="side-toggle">
                        <button className={`side-btn ${currentSide === 'front' ? 'active' : ''}`} id="btnFront" onClick={() => handleSideToggle('front')}>
                            <i className="fas fa-arrow-up"></i> Front
                        </button>
                        <button className={`side-btn ${currentSide === 'back' ? 'active' : ''}`} id="btnBack" onClick={() => handleSideToggle('back')}>
                            <i className="fas fa-arrow-down"></i> Back
                        </button>
                    </div>

                    {/* Front Upload Slot */}
                    <div className="side-upload-slot" id="frontUploadSlot" style={{ display: currentSide === 'front' ? 'block' : 'none' }}>
                        <p className="side-upload-label"><i className="fas fa-arrow-up" style={{ color: 'var(--primary)' }}></i> Front Design</p>
                        <div className="side-thumb-wrap" id="frontThumbWrap">
                            {lastFrontImage ? (
                                <img src={lastFrontImage.rawSrc} style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: '6px', border: '1px solid #ddd', objectFit: 'contain' }} alt="Front Thumbnail" />
                            ) : (
                                <span className="side-thumb-empty">No image uploaded</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button className="studio-btn-outline" id="btnUploadFront" onClick={() => frontFileInputRef.current.click()}>
                                <i className="fas fa-upload"></i> Upload
                            </button>
                            {hasFrontLayers && (
                                <button className="studio-btn-outline danger" id="btnClearFront" onClick={() => handleClearSide('front')}>
                                    <i className="fas fa-times"></i> Clear
                                </button>
                            )}
                        </div>
                        <small className="upload-size-note" style={{ display: 'block', marginTop: '6px', opacity: 0.5, fontSize: '0.75rem', color: '#aaa' }}>Max size: 2MB</small>
                        <input 
                            type="file" 
                            ref={frontFileInputRef} 
                            accept="image/png,image/jpeg,image/webp" 
                            onChange={(e) => handleSideFileUpload(e, 'front')} 
                            hidden 
                        />
                    </div>

                    {/* Back Upload Slot */}
                    <div className="side-upload-slot" id="backUploadSlot" style={{ display: currentSide === 'back' ? 'block' : 'none' }}>
                        <p className="side-upload-label"><i className="fas fa-arrow-down" style={{ color: '#f59e0b' }}></i> Back Design</p>
                        <div className="side-thumb-wrap" id="backThumbWrap">
                            {lastBackImage ? (
                                <img src={lastBackImage.rawSrc} style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: '6px', border: '1px solid #ddd', objectFit: 'contain' }} alt="Back Thumbnail" />
                            ) : (
                                <span className="side-thumb-empty">No image uploaded</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button className="studio-btn-outline" id="btnUploadBack" onClick={() => backFileInputRef.current.click()}>
                                <i className="fas fa-upload"></i> Upload
                            </button>
                            {hasBackLayers && (
                                <button className="studio-btn-outline danger" id="btnClearBack" onClick={() => handleClearSide('back')}>
                                    <i className="fas fa-times"></i> Clear
                                </button>
                            )}
                        </div>
                        <small className="upload-size-note" style={{ display: 'block', marginTop: '6px', opacity: 0.5, fontSize: '0.75rem', color: '#aaa' }}>Max size: 2MB</small>
                        <input 
                            type="file" 
                            ref={backFileInputRef} 
                            accept="image/png,image/jpeg,image/webp" 
                            onChange={(e) => handleSideFileUpload(e, 'back')} 
                            hidden 
                        />
                    </div>
                </div>

                {/* Garment Color selector */}
                <div className="tool-section">
                    <label className="tool-label">T-Shirt Color</label>
                    <div className="color-grid" id="shirtColorGrid">
                        {[
                            { hex: '#ffffff', name: 'White' },
                            { hex: '#111827', name: 'Black' },
                            { hex: '#1e3a8a', name: 'Navy Blue' },
                            { hex: '#b91c1c', name: 'Red' },
                            { hex: '#15803d', name: 'Green' },
                            { hex: '#ca8a04', name: 'Yellow' },
                            { hex: '#7c3aed', name: 'Purple' },
                            { hex: '#0284c7', name: 'Sky Blue' },
                            { hex: '#ea580c', name: 'Orange' },
                            { hex: '#be185d', name: 'Pink' },
                            { hex: '#374151', name: 'Charcoal' },
                            { hex: '#f3f4f6', name: 'Light Grey' }
                        ].map(col => (
                            <button 
                                key={col.hex} 
                                className={`color-dot ${shirtColor === col.hex ? 'active' : ''}`}
                                style={{ backgroundColor: col.hex, border: col.hex === '#ffffff' || col.hex === '#f3f4f6' ? '1px solid #ccc' : 'none' }}
                                onClick={() => handleShirtColorChange(col.hex)}
                                title={col.name}
                            />
                        ))}
                    </div>
                    <div className="custom-color-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                        <label>Custom:</label>
                        <input type="color" value={shirtColor} onChange={(e) => handleShirtColorChange(e.target.value)} />
                    </div>
                </div>

                {/* Fabric Selector */}
                <div className="tool-section">
                    <label className="tool-label">Fabric</label>
                    <select className="studio-select" id="fabricSelect" value={fabric} onChange={(e) => setFabric(e.target.value)}>
                        <option value="100% Cotton">100% Cotton (₹{pricing['100% Cotton']})</option>
                        <option value="Poly Cotton">Poly Cotton Blend (₹{pricing['Poly Cotton']})</option>
                        <option value="Dry Fit">Dry Fit / Sports (₹{pricing['Dry Fit']})</option>
                        <option value="Premium Cotton">Premium Cotton (₹{pricing['Premium Cotton']})</option>
                        <option value="Organic Cotton">Organic Cotton (₹{pricing['Organic Cotton']})</option>
                    </select>
                </div>

                {/* Size Selector */}
                <div className="tool-section">
                    <label className="tool-label">Size</label>
                    <div className="size-grid" id="sizeGrid">
                        {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(sz => (
                            <button key={sz} className={`size-pill ${selectedSize === sz ? 'active' : ''}`} onClick={() => setSelectedSize(sz)} data-size={sz}>
                                {sz}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quantity */}
                <div className="tool-section">
                    <label className="tool-label">Quantity</label>
                    <div className="qty-control">
                        <button className="qty-btn" id="qtyMinus" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                        <span id="qtyDisplay">{quantity}</span>
                        <button className="qty-btn" id="qtyPlus" disabled={quantity >= 99} onClick={() => setQuantity(q => Math.min(99, q + 1))}>+</button>
                    </div>
                </div>
            </aside>

            {/* Center Canvas Area */}
            <main className="studio-canvas-area">
                <div className="canvas-toolbar">
                    <button className="toolbar-btn" id="btnAddText" title="Add Text" onClick={() => {
                        setActiveRightPanel('text');
                    }}>
                        <i className="fas fa-font"></i> <span>Text</span>
                    </button>
                    <button className="toolbar-btn" id="btnUploadImage" title="Upload Image (Max 2MB)" onClick={() => toolbarFileInputRef.current.click()}>
                        <i className="fas fa-image"></i> <span>Image</span>
                    </button>
                    <input 
                        type="file" 
                        ref={toolbarFileInputRef} 
                        accept="image/png,image/jpeg,image/webp" 
                        onChange={(e) => handleSideFileUpload(e, currentSide)} 
                        hidden 
                    />
                    <button className="toolbar-btn" id="btnAiMagic" title="AI Design Generation" onClick={() => {
                        setActiveRightPanel('ai');
                    }}>
                        <i className="fas fa-wand-magic-sparkles"></i> <span>AI Magic</span>
                    </button>
                    <div className="toolbar-separator"></div>
                    <button className="toolbar-btn" id="btnBringForward" title="Bring Forward" onClick={handleBringForward}>
                        <i className="fas fa-level-up-alt"></i>
                    </button>
                    <button className="toolbar-btn" id="btnSendBackward" title="Send Backward" onClick={handleSendBackward}>
                        <i className="fas fa-level-down-alt"></i>
                    </button>
                    <button className="toolbar-btn danger" id="btnDeleteSelected" title="Delete Selected" onClick={() => {
                        if (activeLayerId) {
                            setDeleteLayerPending(true);
                        }
                    }}>
                        <i className="fas fa-trash"></i>
                    </button>
                    <div className="toolbar-separator"></div>
                    <button className="toolbar-btn" id="btnUndo" title="Undo layers" onClick={handleUndo} disabled={historyIndexRef.current === 0}>
                        <i className="fas fa-undo"></i>
                    </button>
                    <button className="toolbar-btn" id="btnRedo" title="Redo layers" onClick={handleRedo} disabled={historyIndexRef.current >= historyRef.current.length - 1}>
                        <i className="fas fa-redo"></i>
                    </button>
                    <div className="toolbar-separator"></div>
                    <button className="toolbar-btn" id="btnClearCanvas" title="Clear Design" onClick={() => {
                        if (designs[currentSide] && designs[currentSide].length > 0) {
                            setClearSidePending(true);
                        }
                    }}>
                        <i className="fas fa-eraser"></i> <span>Clear</span>
                    </button>
                </div>

                {/* 3D Model Rendering Target */}
                <div className="canvas-wrapper" id="canvasWrapper" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
                    <div ref={canvasContainerRef} id="threeCanvasContainer" style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {modelError && <p role="alert" style={{ padding: '30px' }}>{modelError}</p>}
                        {modelLoading && (
                            <div id="loadingOverlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.8)', color: 'white', zIndex: 10, borderRadius: '12px', flexDirection: 'column' }}>
                                <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '10px' }}></i>
                                <span>Loading 3D Model...</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="canvas-hint" id="canvasHint">
                    <i className="fas fa-mouse-pointer"></i> Click a design to select it and drag to move. Use the Properties sliders to resize or rotate.
                </div>
            </main>

            {/* Right Properties Panel */}
            <aside className="studio-panel studio-panel-right" id="rightPanel" style={{ overflowY: 'auto' }}>
                <div className="panel-header">
                    <h3><i className="fas fa-sliders-h"></i> Properties</h3>
                </div>

                {/* Image Properties Tab view */}
                {activeRightPanel === 'image' && (
                    <div className="tool-section" id="imagePropertiesPanel">
                        <label className="tool-label">Image Options</label>
                        
                        <label className="tool-label" style={{ marginTop: '12px' }}>Resize (Scale)</label>
                        <div className="range-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                                type="range" 
                                id="designScale" 
                                min="10" 
                                max="300" 
                                value={scale} 
                                className="studio-range" 
                                style={{ flex: 1 }}
                                onChange={(e) => {
                                    setScale(Number(e.target.value));
                                    updateActiveLayerProp('scale', Number(e.target.value) / 100);
                                }}
                                onMouseUp={() => pushHistory(designs)}
                                onTouchEnd={() => pushHistory(designs)} onKeyUp={() => pushHistory(designsRef.current)}
                            />
                            <span id="designScaleValue" style={{ minWidth: '45px', textAlign: 'right', fontFamily: 'monospace' }}>{scale}%</span>
                        </div>

                        <label className="tool-label" style={{ marginTop: '12px' }}>Move Horizontally</label>
                        <div className="range-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                                type="range" 
                                id="designPosX" 
                                min="0" 
                                max="100" 
                                value={posX} 
                                className="studio-range" 
                                style={{ flex: 1 }}
                                onChange={(e) => {
                                    setPosX(Number(e.target.value));
                                    updateActiveLayerProp('x', Number(e.target.value) / 100);
                                }}
                                onMouseUp={() => pushHistory(designs)}
                                onTouchEnd={() => pushHistory(designs)} onKeyUp={() => pushHistory(designsRef.current)}
                            />
                            <span id="designPosXValue" style={{ minWidth: '45px', textAlign: 'right', fontFamily: 'monospace' }}>{posX}%</span>
                        </div>

                        <label className="tool-label" style={{ marginTop: '12px' }}>Move Vertically</label>
                        <div className="range-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                                type="range" 
                                id="designPosY" 
                                min="0" 
                                max="100" 
                                value={posY} 
                                className="studio-range" 
                                style={{ flex: 1 }}
                                onChange={(e) => {
                                    setPosY(Number(e.target.value));
                                    updateActiveLayerProp('y', Number(e.target.value) / 100);
                                }}
                                onMouseUp={() => pushHistory(designs)}
                                onTouchEnd={() => pushHistory(designs)} onKeyUp={() => pushHistory(designsRef.current)}
                            />
                            <span id="designPosYValue" style={{ minWidth: '45px', textAlign: 'right', fontFamily: 'monospace' }}>{posY}%</span>
                        </div>

                        <label className="tool-label" style={{ marginTop: '12px' }}>Rotate</label>
                        <div className="range-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                                type="range" 
                                id="designRot" 
                                min="0" 
                                max="360" 
                                value={rotation} 
                                className="studio-range" 
                                style={{ flex: 1 }}
                                onChange={(e) => {
                                    setRotation(Number(e.target.value));
                                    updateActiveLayerProp('rotation', Number(e.target.value));
                                }}
                                onMouseUp={() => pushHistory(designs)}
                                onTouchEnd={() => pushHistory(designs)} onKeyUp={() => pushHistory(designsRef.current)}
                            />
                            <span id="designRotValue" style={{ minWidth: '45px', textAlign: 'right', fontFamily: 'monospace' }}>{rotation}°</span>
                        </div>
                    </div>
                )}

                {/* Text Properties Tab view */}
                {activeRightPanel === 'text' && (
                    <div className="tool-section" id="textPropertiesPanel">
                        <label className="tool-label">Add / Edit Text</label>
                        <input 
                            type="text" 
                            className="studio-input" 
                            id="textInput" 
                            placeholder="Type your text..." 
                            maxLength="60"
                            value={textInput}
                            onChange={(e) => {
                                setTextInput(e.target.value);
                                if (activeLayer && activeLayer.type === 'text') {
                                    handleUpdateActiveTextLayer({ textContent: e.target.value });
                                }
                            }}
                            onBlur={() => pushHistory(designs)}
                        />
                        {(!activeLayer || activeLayer.type !== 'text') && (
                            <button className="studio-btn-full" id="btnApplyText" onClick={handleAddTextLayer}>
                                <i className="fas fa-plus"></i> Add Text to Design
                            </button>
                        )}

                        <label className="tool-label" style={{ marginTop: '12px' }}>Font</label>
                        <select 
                            className="studio-select" 
                            id="fontFamily"
                            value={fontFamily}
                            onChange={(e) => {
                                setFontFamily(e.target.value);
                                if (activeLayer && activeLayer.type === 'text') {
                                    handleUpdateActiveTextLayer({ fontFamily: e.target.value });

                                }
                            }}
                        >
                            <option value="Inter">Inter (Modern)</option>
                            <option value="Impact">Impact (Bold)</option>
                            <option value="Georgia">Georgia (Classic)</option>
                            <option value="Courier New">Courier (Retro)</option>
                            <option value="Arial Black">Arial Black (Heavy)</option>
                            <option value="Brush Script MT">Brush (Handwritten)</option>
                            <option value="Trebuchet MS">Trebuchet (Clean)</option>
                        </select>

                        <label className="tool-label" style={{ marginTop: '12px' }}>Font Size</label>
                        <div className="range-row">
                            <input 
                                type="range" 
                                id="fontSize" 
                                min="12" 
                                max="120" 
                                value={fontSize} 
                                className="studio-range"
                                onChange={(e) => {
                                    setFontSize(Number(e.target.value));
                                    if (activeLayer && activeLayer.type === 'text') {
                                        handleUpdateActiveTextLayer({ fontSize: Number(e.target.value) });
                                    }
                                }}
                                onMouseUp={() => pushHistory(designs)}
                                onTouchEnd={() => pushHistory(designs)} onKeyUp={() => pushHistory(designsRef.current)}
                            />
                            <span id="fontSizeValue">{fontSize}px</span>
                        </div>

                        <label className="tool-label" style={{ marginTop: '12px' }}>Text Color</label>
                        <div className="color-row">
                            <input 
                                type="color" 
                                id="textColorPicker" 
                                value={textColor}
                                onChange={(e) => {
                                    setTextColor(e.target.value);
                                    if (activeLayer && activeLayer.type === 'text') {
                                        handleUpdateActiveTextLayer({ color: e.target.value });

                                    }
                                }}
                            />
                            <div className="quick-text-colors">
                                {['#111111', '#ffffff', '#ef4444', '#3b82f6', '#f59e0b', '#10b981'].map(c => (
                                    <button 
                                        key={c}
                                        className="qtc" 
                                        data-color={c} 
                                        style={{ background: c, border: c === '#ffffff' ? '1px solid #ccc' : '2px solid var(--border-color)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer' }}
                                        onClick={() => {
                                            setTextColor(c);
                                            if (activeLayer && activeLayer.type === 'text') {
                                                handleUpdateActiveTextLayer({ color: c });

                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <label className="tool-label" style={{ marginTop: '12px' }}>Style</label>
                        <div className="style-btns">
                            <button 
                                className={`style-btn ${textStyle.bold ? 'active' : ''}`} 
                                id="btnBold" 
                                title="Bold"
                                onClick={() => {
                                    const next = { ...textStyle, bold: !textStyle.bold };
                                    setTextStyle(next);
                                    if (activeLayer && activeLayer.type === 'text') {
                                        handleUpdateActiveTextLayer({ textStyle: next });

                                    }
                                }}
                            >
                                <i className="fas fa-bold"></i>
                            </button>
                            <button 
                                className={`style-btn ${textStyle.italic ? 'active' : ''}`} 
                                id="btnItalic" 
                                title="Italic"
                                onClick={() => {
                                    const next = { ...textStyle, italic: !textStyle.italic };
                                    setTextStyle(next);
                                    if (activeLayer && activeLayer.type === 'text') {
                                        handleUpdateActiveTextLayer({ textStyle: next });

                                    }
                                }}
                            >
                                <i className="fas fa-italic"></i>
                            </button>
                            <button 
                                className={`style-btn ${textStyle.underline ? 'active' : ''}`} 
                                id="btnUnderline" 
                                title="Underline"
                                onClick={() => {
                                    const next = { ...textStyle, underline: !textStyle.underline };
                                    setTextStyle(next);
                                    if (activeLayer && activeLayer.type === 'text') {
                                        handleUpdateActiveTextLayer({ textStyle: next });

                                    }
                                }}
                            >
                                <i className="fas fa-underline"></i>
                            </button>
                            <button 
                                className={`style-btn ${textStyle.align === 'left' ? 'active' : ''}`} 
                                id="btnAlignLeft" 
                                title="Align Left"
                                onClick={() => {
                                    const next = { ...textStyle, align: 'left' };
                                    setTextStyle(next);
                                    if (activeLayer && activeLayer.type === 'text') {
                                        handleUpdateActiveTextLayer({ textStyle: next });

                                    }
                                }}
                            >
                                <i className="fas fa-align-left"></i>
                            </button>
                            <button 
                                className={`style-btn ${textStyle.align === 'center' ? 'active' : ''}`} 
                                id="btnAlignCenter" 
                                title="Center"
                                onClick={() => {
                                    const next = { ...textStyle, align: 'center' };
                                    setTextStyle(next);
                                    if (activeLayer && activeLayer.type === 'text') {
                                        handleUpdateActiveTextLayer({ textStyle: next });

                                    }
                                }}
                            >
                                <i className="fas fa-align-center"></i>
                            </button>
                            <button 
                                className={`style-btn ${textStyle.align === 'right' ? 'active' : ''}`} 
                                id="btnAlignRight" 
                                title="Align Right"
                                onClick={() => {
                                    const next = { ...textStyle, align: 'right' };
                                    setTextStyle(next);
                                    if (activeLayer && activeLayer.type === 'text') {
                                        handleUpdateActiveTextLayer({ textStyle: next });

                                    }
                                }}
                            >
                                <i className="fas fa-align-right"></i>
                            </button>
                        </div>
                    </div>
                )}

                {/* AI Magic Panel */}
                {activeRightPanel === 'ai' && (
                    <div className="tool-section" id="aiMagicPanel">
                        <label className="tool-label">AI Design Generator</label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Describe what you want to see on your t-shirt, and our AI will generate it for you.</p>
                        <textarea 
                            className="studio-input" 
                            id="aiPromptInput" 
                            placeholder="E.g., A neon cyberpunk samurai cat..." 
                            style={{ minHeight: '80px', resize: 'vertical', marginBottom: '10px' }}
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                        />
                        <button className="studio-btn-full" id="btnGenerateAi" style={{ background: 'var(--primary)', color: '#fff', border: 'none', marginBottom: '10px' }} onClick={handleAiGenerate} disabled={aiGenerating}>
                            <i className="fas fa-wand-magic-sparkles"></i> Generate Design
                        </button>
                        
                        {aiGenerating && (
                            <div id="aiLoadingIndicator" style={{ textAlign: 'center', padding: '15px 0' }}>
                                <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--primary)', marginBottom: '8px' }}></i>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Generating your masterpiece...</p>
                            </div>
                        )}
                        
                        {aiResultUrl && !aiGenerating && (
                            <div id="aiResultsArea" style={{ marginTop: '15px' }}>
                                <label className="tool-label">Result</label>
                                <div id="aiImageContainer" style={{ width: '100%', aspectRatio: '1', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '10px', border: '1px solid var(--border-color)' }}>
                                    <img id="aiResultImage" src={aiResultUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="AI Result" />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                                    <button className="studio-btn-full" id="btnAddAiToShirt" style={{ flex: 1, padding: '8px' }} onClick={handleAddAiToShirt}>
                                        <i className="fas fa-plus"></i> Add to Shirt
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Remove Background Section */}
                <div className="tool-section" id="removeBgSection">
                    <button 
                        className="studio-btn-outline" 
                        id="btnRemoveBackground" 
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        onClick={handleRemoveBackground}
                        disabled={!backgroundRemovalAvailable || removingBg || !activeLayer || activeLayer.type !== 'image'}
                        title={backgroundRemovalAvailable ? 'Remove the background of the selected image' : 'Background removal is currently unavailable'}
                    >
                        {removingBg ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Processing...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-eraser"></i> Remove Background
                            </>
                        )}
                    </button>
                </div>

                {/* Layers Section */}
                <div className="tool-section">
                    <label className="tool-label">Layers <span id="layerCount" style={{ color: 'var(--text-muted)' }}>({(designs[currentSide] || []).length})</span></label>
                    <div className="layers-list" id="layersList">
                        {(designs[currentSide] || []).length === 0 ? (
                            <p className="no-layers-msg">No elements yet. Add text or image.</p>
                        ) : (
                            [...(designs[currentSide] || [])].reverse().map((layer) => {
                                const isActive = layer.id === activeLayerId;
                                const iconClass = layer.type === 'text' ? 'fa-font' : 'fa-image';
                                return (
                                    <div 
                                        key={layer.id}
                                        className={`layer-item ${isActive ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveLayerId(layer.id);
                                            setActiveRightPanel(layer.type);
                                        }}
                                        style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                            padding: '10px', background: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', 
                                            borderRadius: '6px', marginBottom: '8px', cursor: 'pointer',
                                            border: `1px solid ${isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`
                                        }}
                                    >
                                        <div className="layer-info" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                                            <i className={`fas ${iconClass}`} style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }}></i>
                                            <span style={{ fontSize: '13px', fontWeight: isActive ? '600' : '400', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{layer.name}</span>
                                        </div>
                                        <button 
                                            className="layer-delete-btn" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteLayer(layer.id);
                                            }}
                                            title="Delete Layer" 
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 8px' }}
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Price Summary Panel */}
                <div className="price-summary-panel">
                    <div className="price-row-s">
                        <span id="priceLabel">{fabric}</span>
                        <span id="basePrice">{formatINR(pricing[fabric])}</span>
                    </div>
                    {((designs.front || []).some(l => l.type !== 'text') || (designs.back || []).some(l => l.type !== 'text')) && (
                        <div className="price-row-s" id="printPriceRow">
                            <span>Print Cost</span>
                            <span id="printPrice">+{formatINR(((designs.front || []).some(l => l.type !== 'text') ? pricing.printCostPerSide : 0) + ((designs.back || []).some(l => l.type !== 'text') ? pricing.printCostPerSide : 0))}</span>
                        </div>
                    )}
                    {[...(designs.front || []), ...(designs.back || [])].filter(l => l.type === 'text').length > 0 && (
                        <div className="price-row-s" id="textPriceRow">
                            <span>Text Customization</span>
                            <span id="textPrice">+{formatINR([...(designs.front || []), ...(designs.back || [])].filter(l => l.type === 'text').length * pricing.textCostPerUnit)}</span>
                        </div>
                    )}
                    <div className="price-row-s final-s">
                        <span>Total <small id="qtyNote">(×{quantity})</small></span>
                        <span id="totalPrice">{formatINR(totalPrice)}</span>
                    </div>
                    <button className="studio-add-cart-btn" id="addToCartBtn" onClick={handleAddToCart} disabled={addingToCart || modelLoading || Boolean(modelError) || draftLoading}>
                        {addingToCart ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Capturing...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-shopping-bag"></i> Add to Cart
                            </>
                        )}
                    </button>
                    <a className="studio-whatsapp-btn" href="https://wa.me/919943935576" target="_blank" rel="noopener noreferrer">
                        <i className="fab fa-whatsapp"></i> WhatsApp for Bulk Orders
                    </a>
                </div>
            </aside>

            {clearSidePending && (
                <ConfirmDialog 
                    title="Clear side design?" 
                    message="Are you sure you want to remove all design elements from this side of the T-shirt?" 
                    confirmLabel="Clear side" 
                    onCancel={() => setClearSidePending(false)} 
                    onConfirm={() => { handleClearSide(); setClearSidePending(false); }} 
                />
            )}

            {deleteLayerPending && (
                <ConfirmDialog 
                    title="Remove Design Layer?" 
                    message={`Are you sure you want to remove the selected design element?`} 
                    confirmLabel="Remove" 
                    onCancel={() => setDeleteLayerPending(false)} 
                    onConfirm={handleDeleteActiveLayer} 
                />
            )}
        </div>
    );
};

export default DesignStudio;
