/**
 * DYD-Cloths Design Studio
 * Powered by Fabric.js — professional canvas-based T-shirt designer
 */

document.addEventListener('DOMContentLoaded', () => Studio.init());

const Studio = {
    canvas: null,
    currentSide: 'front',
    designs: { front: [], back: [] },     // Serialized JSON per side
    history: [],
    historyIndex: -1,
    maxHistory: 30,

    state: {
        shirtColor: '#ffffff',
        shirtColorName: 'White',
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

    /* ================================================
       INIT
    ================================================ */
    init: () => {
        Studio.initCanvas();
        Studio.bindControls();
        Studio.updatePrice();
        Studio.renderLayers();
    },

    initCanvas: () => {
        const canvasEl = document.getElementById('designCanvas');
        const wrapper = document.getElementById('tshirtMockup');

        // Canvas size matches the print area
        const W = 300, H = 350;
        canvasEl.width = W;
        canvasEl.height = H;

        Studio.canvas = new fabric.Canvas('designCanvas', {
            width: W,
            height: H,
            backgroundColor: 'transparent',
            selection: true,
            preserveObjectStacking: true
        });

        // Update layers panel and history on any canvas change
        Studio.canvas.on('object:added', () => { Studio.renderLayers(); Studio.saveHistory(); Studio.updatePrice(); });
        Studio.canvas.on('object:removed', () => { Studio.renderLayers(); Studio.saveHistory(); Studio.updatePrice(); });
        Studio.canvas.on('object:modified', () => { Studio.renderLayers(); Studio.saveHistory(); });
        Studio.canvas.on('selection:created', Studio.onSelectionChange);
        Studio.canvas.on('selection:updated', Studio.onSelectionChange);
        Studio.canvas.on('selection:cleared', Studio.onSelectionCleared);
    },

    /* ================================================
       CONTROLS BINDING
    ================================================ */
    bindControls: () => {
        // Shirt colors
        document.querySelectorAll('#shirtColorGrid .color-dot').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#shirtColorGrid .color-dot').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Studio.setShirtColor(btn.dataset.color, btn.title);
            });
        });

        document.getElementById('customShirtColor').addEventListener('input', (e) => {
            document.querySelectorAll('#shirtColorGrid .color-dot').forEach(b => b.classList.remove('active'));
            Studio.setShirtColor(e.target.value, 'Custom');
        });

        // Fabric
        document.getElementById('fabricSelect').addEventListener('change', (e) => {
            Studio.state.fabric = e.target.value;
            Studio.updatePrice();
        });

        // Size pills
        document.querySelectorAll('#sizeGrid .size-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#sizeGrid .size-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Studio.state.size = btn.dataset.size;
            });
        });

        // Quantity
        document.getElementById('qtyMinus').addEventListener('click', () => {
            if (Studio.state.quantity > 1) { Studio.state.quantity--; Studio.updateQtyDisplay(); }
        });
        document.getElementById('qtyPlus').addEventListener('click', () => {
            if (Studio.state.quantity < 99) { Studio.state.quantity++; Studio.updateQtyDisplay(); }
        });

        // Toolbar
        document.getElementById('btnAddText').addEventListener('click', Studio.addText);
        document.getElementById('btnUploadImage').addEventListener('click', () => document.getElementById('imageFileInput').click());
        document.getElementById('imageFileInput').addEventListener('change', Studio.handleImageUpload);
        document.getElementById('btnBringForward').addEventListener('click', () => Studio.canvas.getActiveObject()?.bringForward() && Studio.canvas.renderAll());
        document.getElementById('btnSendBackward').addEventListener('click', () => Studio.canvas.getActiveObject()?.sendBackwards() && Studio.canvas.renderAll());
        document.getElementById('btnDeleteSelected').addEventListener('click', Studio.deleteSelected);
        document.getElementById('btnUndo').addEventListener('click', Studio.undo);
        document.getElementById('btnRedo').addEventListener('click', Studio.redo);
        document.getElementById('btnClearCanvas').addEventListener('click', Studio.clearCanvas);

        // Text properties
        document.getElementById('btnApplyText').addEventListener('click', Studio.addText);
        document.getElementById('textInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') Studio.addText(); });
        document.getElementById('fontFamily').addEventListener('change', (e) => Studio.updateSelectedText('fontFamily', e.target.value));
        document.getElementById('fontSize').addEventListener('input', (e) => {
            document.getElementById('fontSizeValue').textContent = e.target.value + 'px';
            Studio.updateSelectedText('fontSize', parseInt(e.target.value));
        });
        document.getElementById('textColorPicker').addEventListener('input', (e) => Studio.updateSelectedText('fill', e.target.value));

        // Quick text colors
        document.querySelectorAll('.qtc').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('textColorPicker').value = btn.dataset.color;
                Studio.updateSelectedText('fill', btn.dataset.color);
            });
        });

        // Bold, italic, underline, align
        document.getElementById('btnBold').addEventListener('click', () => {
            const obj = Studio.canvas.getActiveObject();
            if (obj && obj.type === 'textbox') {
                obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
                Studio.canvas.renderAll();
            }
        });
        document.getElementById('btnItalic').addEventListener('click', () => {
            const obj = Studio.canvas.getActiveObject();
            if (obj && obj.type === 'textbox') {
                obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
                Studio.canvas.renderAll();
            }
        });
        document.getElementById('btnUnderline').addEventListener('click', () => {
            const obj = Studio.canvas.getActiveObject();
            if (obj && obj.type === 'textbox') {
                obj.set('underline', !obj.underline);
                Studio.canvas.renderAll();
            }
        });
        ['Left', 'Center', 'Right'].forEach(align => {
            document.getElementById(`btnAlign${align}`).addEventListener('click', () => {
                Studio.updateSelectedText('textAlign', align.toLowerCase());
            });
        });

        // Image opacity
        document.getElementById('imageOpacity').addEventListener('input', (e) => {
            document.getElementById('imageOpacityValue').textContent = e.target.value + '%';
            const obj = Studio.canvas.getActiveObject();
            if (obj) { obj.set('opacity', e.target.value / 100); Studio.canvas.renderAll(); }
        });

        // Add to cart
        document.getElementById('addToCartBtn').addEventListener('click', Studio.addToCart);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Delete' || e.key === 'Backspace') Studio.deleteSelected();
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); Studio.undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); Studio.redo(); }
        });
    },

    /* ================================================
       SHIRT COLOR
    ================================================ */
    setShirtColor: (color, name = 'Custom') => {
        Studio.state.shirtColor = color;
        Studio.state.shirtColorName = name;
        document.getElementById('tshirtShape').style.backgroundColor = color;
        // Update border for light colors
        const isLight = Studio.isLightColor(color);
        document.getElementById('tshirtShape').style.boxShadow = isLight
            ? '0 0 0 2px #ddd, var(--shadow-lg)'
            : 'var(--shadow-lg)';
    },

    isLightColor: (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 180;
    },

    /* ================================================
       SIDE MANAGEMENT
    ================================================ */
    setSide: (side) => {
        // Save current side's design JSON
        Studio.designs[Studio.currentSide] = Studio.canvas.toJSON(['id', 'label']);

        Studio.currentSide = side;

        // Update buttons
        document.getElementById('btnFront').classList.toggle('active', side === 'front');
        document.getElementById('btnBack').classList.toggle('active', side === 'back');
        document.getElementById('canvasSideLabel').textContent = side.toUpperCase();

        // Load saved design for this side
        const savedDesign = Studio.designs[side];
        Studio.canvas.clear();
        Studio.canvas.backgroundColor = 'transparent';

        if (savedDesign && savedDesign.objects && savedDesign.objects.length > 0) {
            Studio.canvas.loadFromJSON(savedDesign, () => {
                Studio.canvas.renderAll();
                Studio.renderLayers();
            });
        } else {
            Studio.canvas.renderAll();
            Studio.renderLayers();
        }
    },

    /* ================================================
       ADD TEXT
    ================================================ */
    addText: () => {
        const text = document.getElementById('textInput').value.trim() || 'Your Text';
        const font = document.getElementById('fontFamily').value;
        const size = parseInt(document.getElementById('fontSize').value) || 40;
        const color = document.getElementById('textColorPicker').value || '#111111';

        const textbox = new fabric.Textbox(text, {
            left: 60,
            top: 100,
            width: 200,
            fontSize: size,
            fontFamily: font,
            fill: color,
            fontWeight: 'bold',
            textAlign: 'center',
            editable: true,
            id: `text_${Date.now()}`,
            label: `Text: "${text.substring(0, 15)}"`
        });

        Studio.canvas.add(textbox);
        Studio.canvas.setActiveObject(textbox);
        Studio.canvas.renderAll();
        document.getElementById('textInput').value = '';
    },

    updateSelectedText: (prop, value) => {
        const obj = Studio.canvas.getActiveObject();
        if (obj) {
            obj.set(prop, value);
            Studio.canvas.renderAll();
            Studio.renderLayers();
        }
    },

    /* ================================================
       IMAGE UPLOAD
    ================================================ */
    handleImageUpload: (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            fabric.Image.fromURL(ev.target.result, (img) => {
                // Scale to fit nicely in the print area
                const maxW = 200, maxH = 200;
                const scale = Math.min(maxW / img.width, maxH / img.height, 1);
                img.set({
                    left: (Studio.canvas.width - img.width * scale) / 2,
                    top: (Studio.canvas.height - img.height * scale) / 2 - 40,
                    scaleX: scale,
                    scaleY: scale,
                    id: `img_${Date.now()}`,
                    label: `Image: ${file.name.substring(0, 20)}`
                });
                Studio.canvas.add(img);
                Studio.canvas.setActiveObject(img);
                Studio.canvas.renderAll();
            });
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // reset so same file can be re-uploaded
    },

    /* ================================================
       DELETE / CLEAR
    ================================================ */
    deleteSelected: () => {
        const active = Studio.canvas.getActiveObjects();
        if (!active.length) return;
        active.forEach(obj => Studio.canvas.remove(obj));
        Studio.canvas.discardActiveObject();
        Studio.canvas.renderAll();
    },

    clearCanvas: () => {
        if (!confirm('Clear all elements from this side?')) return;
        Studio.canvas.clear();
        Studio.canvas.backgroundColor = 'transparent';
        Studio.canvas.renderAll();
        Studio.renderLayers();
        Studio.updatePrice();
    },

    /* ================================================
       UNDO / REDO
    ================================================ */
    saveHistory: () => {
        // Trim future history on new action
        Studio.history = Studio.history.slice(0, Studio.historyIndex + 1);
        Studio.history.push(Studio.canvas.toJSON(['id', 'label']));
        if (Studio.history.length > Studio.maxHistory) Studio.history.shift();
        Studio.historyIndex = Studio.history.length - 1;
    },

    undo: () => {
        if (Studio.historyIndex <= 0) return;
        Studio.historyIndex--;
        Studio.canvas.loadFromJSON(Studio.history[Studio.historyIndex], () => {
            Studio.canvas.renderAll();
            Studio.renderLayers();
        });
    },

    redo: () => {
        if (Studio.historyIndex >= Studio.history.length - 1) return;
        Studio.historyIndex++;
        Studio.canvas.loadFromJSON(Studio.history[Studio.historyIndex], () => {
            Studio.canvas.renderAll();
            Studio.renderLayers();
        });
    },

    /* ================================================
       LAYER PANEL
    ================================================ */
    renderLayers: () => {
        const list = document.getElementById('layersList');
        const objects = Studio.canvas.getObjects();
        document.getElementById('layerCount').textContent = `(${objects.length})`;

        if (!objects.length) {
            list.innerHTML = '<p class="no-layers-msg">No elements yet. Add text or image.</p>';
            return;
        }

        list.innerHTML = [...objects].reverse().map((obj, reversedIdx) => {
            const actualIdx = objects.length - 1 - reversedIdx;
            const icon = obj.type === 'textbox' ? 'fa-font' : 'fa-image';
            const label = obj.label || obj.type;
            const isActive = Studio.canvas.getActiveObject() === obj;
            return `<div class="layer-item ${isActive ? 'active' : ''}" data-idx="${actualIdx}">
                <i class="fas ${icon}"></i>
                <span>${label}</span>
                <button class="layer-delete-btn" data-idx="${actualIdx}"><i class="fas fa-times"></i></button>
            </div>`;
        }).join('');

        list.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.layer-delete-btn')) return;
                const obj = objects[parseInt(item.dataset.idx)];
                Studio.canvas.setActiveObject(obj);
                Studio.canvas.renderAll();
                Studio.renderLayers();
            });
        });

        list.querySelectorAll('.layer-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const obj = objects[parseInt(btn.dataset.idx)];
                Studio.canvas.remove(obj);
                Studio.canvas.renderAll();
            });
        });
    },

    onSelectionChange: (e) => {
        const obj = Studio.canvas.getActiveObject();
        if (!obj) return;
        if (obj.type === 'textbox') {
            document.getElementById('fontFamily').value = obj.fontFamily || 'Inter';
            document.getElementById('fontSize').value = obj.fontSize || 40;
            document.getElementById('fontSizeValue').textContent = (obj.fontSize || 40) + 'px';
            document.getElementById('textColorPicker').value = obj.fill || '#111111';
        }
        if (obj.type === 'image') {
            document.getElementById('imageOpacity').value = Math.round((obj.opacity || 1) * 100);
            document.getElementById('imageOpacityValue').textContent = Math.round((obj.opacity || 1) * 100) + '%';
        }
        Studio.renderLayers();
    },

    onSelectionCleared: () => {
        Studio.renderLayers();
    },

    /* ================================================
       PRICING
    ================================================ */
    updatePrice: () => {
        const basePrice = Studio.pricing[Studio.state.fabric] || 299;

        // Print cost based on design complexity
        const objectCount = Studio.canvas ? Studio.canvas.getObjects().length : 0;
        const hasImage = Studio.canvas ? Studio.canvas.getObjects().some(o => o.type === 'image') : false;
        const hasText = Studio.canvas ? Studio.canvas.getObjects().some(o => o.type === 'textbox') : false;

        let printCost = 0;
        if (hasImage && hasText) printCost = 200;
        else if (hasImage) printCost = 150;
        else if (hasText) printCost = 100;

        const unitPrice = basePrice + printCost;
        const total = unitPrice * Studio.state.quantity;

        document.getElementById('priceLabel').textContent = `${Studio.state.fabric}`;
        document.getElementById('basePrice').textContent = `₹${basePrice}`;

        const printRow = document.getElementById('printPriceRow');
        if (printCost > 0) {
            printRow.style.display = 'flex';
            document.getElementById('printPrice').textContent = `+₹${printCost}`;
        } else {
            printRow.style.display = 'none';
        }

        document.getElementById('qtyNote').textContent = `×${Studio.state.quantity}`;
        document.getElementById('totalPrice').textContent = `₹${total.toLocaleString('en-IN')}`;
    },

    updateQtyDisplay: () => {
        document.getElementById('qtyDisplay').textContent = Studio.state.quantity;
        Studio.updatePrice();
    },

    /* ================================================
       ADD TO CART
    ================================================ */
    addToCart: () => {
        // Save current side before exporting
        Studio.designs[Studio.currentSide] = Studio.canvas.toJSON(['id', 'label']);

        const frontHasDesign = Studio.designs.front?.objects?.length > 0;
        const backHasDesign = Studio.designs.back?.objects?.length > 0;

        if (!frontHasDesign && !backHasDesign) {
            Utils.showToast('Please add at least one element to your design', 'warning');
            return;
        }

        // Export canvas as a data URL preview image
        const previewDataUrl = Studio.canvas.toDataURL({ format: 'png', multiplier: 1.5 });

        const basePrice = Studio.pricing[Studio.state.fabric] || 299;
        const hasImage = Studio.canvas.getObjects().some(o => o.type === 'image');
        const hasText = Studio.canvas.getObjects().some(o => o.type === 'textbox');
        let printCost = 0;
        if (hasImage && hasText) printCost = 200;
        else if (hasImage) printCost = 150;
        else if (hasText) printCost = 100;

        const unitPrice = basePrice + printCost;
        let designDescription = 'Custom Design T-Shirt';
        if (hasImage && hasText) designDescription = 'Image + Text Printed T-Shirt';
        else if (hasImage) designDescription = 'Image Printed T-Shirt';
        else if (hasText) designDescription = 'Text Printed T-Shirt';

        const success = CartManager.addItem({
            id: `studio-${Date.now()}`,
            name: designDescription,
            price: unitPrice,
            image: previewDataUrl,
            size: Studio.state.size,
            color: `${Studio.state.shirtColorName} / ${Studio.state.fabric}`,
            quantity: Studio.state.quantity,
            maxStock: 999,
            isCustom: true,
            designFront: JSON.stringify(Studio.designs.front),
            designBack: JSON.stringify(Studio.designs.back)
        });

        if (success) {
            Utils.showToast(`Custom T-shirt added to cart! (${Studio.state.quantity}×₹${unitPrice})`, 'success');
            if (typeof window.openCart === 'function') window.openCart();
        }
    }
};

window.Studio = Studio;
