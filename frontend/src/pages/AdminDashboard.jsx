// src/pages/AdminDashboard.jsx - Store Administrator Panel
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatDate } from '../utils/format';
import API from '../config/api';
import Chart from 'chart.js/auto';
import '../styles/admin.css';
import ConfirmDialog from '../components/ConfirmDialog';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { escapeInvoiceData, fetchAdminProducts, orderStatusChoices } from '../utils/adminWorkflow';

const AdminDashboard = () => {
    const { isLoggedIn, user, loading: authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState(null);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [settings, setSettings] = useState({});
    const [rawSettings, setRawSettings] = useState([]);
    const [settingsSubTab, setSettingsSubTab] = useState('branding');

    // CRUD Loading/Form states
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal/Form toggle states
    const [productForm, setProductForm] = useState(null); // null or {name, price, stock, sizes, mainImage, category, description, ...}
    const [couponForm, setCouponForm] = useState(null); // null or {code, discountType, discountValue, minCartTotal, maxDiscount, expiresAt}
    const [productPendingDelete, setProductPendingDelete] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [orderPage, setOrderPage] = useState(1);
    const [orderPages, setOrderPages] = useState(1);
    const [customerPage, setCustomerPage] = useState(1);
    const [customerPages, setCustomerPages] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [trackingForm, setTrackingForm] = useState({ trackingNumber: '', trackingUrl: '' });
    const [selectedItemForDesign, setSelectedItemForDesign] = useState(null);
    const [lightboxSide, setLightboxSide] = useState('front');
    const lightbox3DRef = useRef(null);
    const salesChartRef = useRef(null);
    const categoryChartRef = useRef(null);
    const salesChartInstance = useRef(null);
    const categoryChartInstance = useRef(null);
    const [customers, setCustomers] = useState([]);
    const [analyticsSales, setAnalyticsSales] = useState(null);
    const [analyticsProducts, setAnalyticsProducts] = useState(null);
    const [analyticsPeriod, setAnalyticsPeriod] = useState('month');
    const [sidebarActive, setSidebarActive] = useState(false);
    const [notificationsActive, setNotificationsActive] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    useEffect(() => {
        setTrackingForm({ trackingNumber: selectedOrder?.shippingAddress?.trackingNumber || '', trackingUrl: selectedOrder?.shippingAddress?.trackingUrl || '' });
    }, [selectedOrder]);

    const handleTrackingSave = async (event) => {
        event.preventDefault();
        if (!selectedOrder || actionBusy) return;
        setActionBusy(true);
        try {
            const response = await API.put(`/orders/${selectedOrder._id || selectedOrder.id}/status`, { status: selectedOrder.status, ...trackingForm });
            if (!response.success) throw new Error(response.error || 'Could not save tracking.');
            const updated = response.data?.order || response.data;
            setSelectedOrder(updated);
            setOrders(previous => previous.map(order => (order._id || order.id) === (updated._id || updated.id) ? updated : order));
            window.Utils?.showToast?.('Shipment tracking saved.', 'success');
        } catch (error) { window.Utils?.showToast?.(error.message, 'error'); }
        finally { setActionBusy(false); }
    };

    useEffect(() => {
        if (lightboxSide !== '3d' || !lightbox3DRef.current || selectedItemForDesign === null || !selectedOrder) return;

        const container = lightbox3DRef.current;
        container.innerHTML = ''; // Clear previous preview

        const item = selectedOrder.items[selectedItemForDesign];
        const cd = item?.customDesign;
        if (!cd) return;

        let active = true;

        // Create scene, camera, renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f5f5);

        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0, 1.5);

        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dl1 = new THREE.DirectionalLight(0xffffff, 0.8);
        dl1.position.set(5, 5, 5);
        scene.add(dl1);
        const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
        dl2.position.set(-5, 5, 5);
        scene.add(dl2);

        const modelContainer = new THREE.Group();
        scene.add(modelContainer);

        // 2D Canvas Texture Setup
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 2048;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = cd.shirtColor || '#ffffff';
        ctx.fillRect(0, 0, 2048, 2048);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;

        const computeUVs = (geometry, worldMatrix, side) => {
            const posAttr = geometry.getAttribute('position');
            const normalAttr = geometry.getAttribute('normal');
            const uvAttr = geometry.getAttribute('uv');
            const index = geometry.getIndex();
            
            let minU = 1, minV = 1, maxU = 0, maxV = 0;
            const count = index ? index.count : posAttr.count;
            let found = 0;
            
            for (let i = 0; i < count; i += 3) {
                const a = index ? index.getX(i) : i;
                const b = index ? index.getX(i+1) : i+1;
                const c = index ? index.getX(i+2) : i+2;
                
                const nA = new THREE.Vector3(normalAttr.getX(a), normalAttr.getY(a), normalAttr.getZ(a));
                nA.transformDirection(worldMatrix);
                
                const isTarget = (side === 'front') ? (nA.z > 0.1) : (nA.z < -0.1);
                if (isTarget) {
                    minU = Math.min(minU, uvAttr.getX(a), uvAttr.getX(b), uvAttr.getX(c));
                    maxU = Math.max(maxU, uvAttr.getX(a), uvAttr.getX(b), uvAttr.getX(c));
                    minV = Math.min(minV, uvAttr.getY(a), uvAttr.getY(b), uvAttr.getY(c));
                    maxV = Math.max(maxV, uvAttr.getY(a), uvAttr.getY(b), uvAttr.getY(c));
                    found++;
                }
            }
            if (found === 0) return { u0: 0, v0: 0, u1: 1, v1: 1 };
            return { 
                u0: Math.max(0, minU - 0.05), 
                v0: Math.max(0, minV - 0.05), 
                u1: Math.min(1, maxU + 0.05), 
                v1: Math.min(1, maxV + 0.05) 
            };
        };

        const loadCleanImg = (src) => {
            return new Promise((resolve, reject) => {
                if (!src) return reject(new Error('No src'));
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
                    fetch(src).then(r => r.blob()).then(blob => {
                        const bUrl = URL.createObjectURL(blob);
                        const bImg = new Image();
                        bImg.onload = () => resolve(bImg);
                        bImg.onerror = reject;
                        bImg.src = bUrl;
                    }).catch(reject);
                };
                img.src = src;
            });
        };

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        loader.load('/assets/oversized_t-shirt.glb', (gltf) => {
            if (!active) return;
            const model = gltf.scene;
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
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            
            camera.position.set(0, 0, cameraZ * 1.3);
            controls.target.set(0, 0, 0);
            controls.update();

            let frontUVZone = null;
            let backUVZone = null;

            model.traverse((child) => {
                if (child.isMesh) {
                    const name = child.name.toLowerCase();
                    if (name.includes('plane') || name.includes('ground') || name.includes('shadow') || name.includes('backdrop') || name.includes('studio') || name.includes('environment')) {
                        child.visible = false;
                        return;
                    }

                    child.updateMatrixWorld();
                    if (!frontUVZone) {
                        frontUVZone = computeUVs(child.geometry, child.matrixWorld, 'front');
                        backUVZone = computeUVs(child.geometry, child.matrixWorld, 'back');
                    }

                    child.material = new THREE.MeshStandardMaterial({
                        map: texture,
                        color: 0xffffff,
                        roughness: 0.8,
                        side: THREE.DoubleSide
                    });
                }
            });
            modelContainer.add(model);

            // Render layers onto 3D Canvas Texture
            const drawLayers = async () => {
                ctx.fillStyle = cd.shirtColor || '#ffffff';
                ctx.fillRect(0, 0, 2048, 2048);

                const frontLayers = cd.frontLayers || (cd.frontUpload ? [{ rawSrc: cd.frontUpload, x: 0.30, y: 0.34, scale: 0.6, rotation: 0 }] : []);
                const backLayers = cd.backLayers || (cd.backUpload ? [{ rawSrc: cd.backUpload, x: 0.73, y: 0.34, scale: 0.6, rotation: 0 }] : []);

                const drawSide = async (layers, zone) => {
                    if (!layers.length || !zone) return;
                    const zW = (zone.u1 - zone.u0) * 2048;
                    const zH = (zone.v1 - zone.v0) * 2048;

                    for (const layer of layers) {
                        const src = layer.rawSrc || layer.textureSrc || layer.img || layer.src;
                        if (!src) continue;
                        try {
                            const img = await loadCleanImg(src);
                            ctx.save();
                            const cX = zone.u0 * 2048 + zW * (layer.x !== undefined ? layer.x : 0.5);
                            const cY = zone.v0 * 2048 + zH * (layer.y !== undefined ? layer.y : 0.5);

                            ctx.translate(cX, cY);
                            ctx.rotate((layer.rotation || 0) * Math.PI / 180);

                            const baseSize = zW * 0.5;
                            const dw = baseSize * (layer.scale || 0.8);
                            const dh = dw * (img.height / img.width);

                            ctx.scale(1, -1);
                            ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
                            ctx.restore();
                        } catch (e) {
                            console.error('Failed loading layer image for 3D admin preview:', e);
                        }
                    }
                };

                await drawSide(frontLayers, frontUVZone);
                await drawSide(backLayers, backUVZone);

                texture.needsUpdate = true;
            };

            drawLayers();
        });

        const animate = () => {
            if (!active) return;
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            active = false;
            controls.dispose();
            texture.dispose();
            scene.traverse(child => {
                child.geometry?.dispose();
                (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => material?.dispose());
            });
            renderer.dispose();
        };
    }, [lightboxSide, selectedItemForDesign, selectedOrder]);

    // Role check
    const isAdmin = isLoggedIn && user?.role === 'admin';

    useEffect(() => {
        if (!authLoading) {
            if (!isLoggedIn) {
                navigate('/login');
            }
        }
    }, [isLoggedIn, authLoading, navigate]);



    // Initialize and update Chart.js sales trend and categories charts
    useEffect(() => {
        if (activeTab !== 'analytics') return;

        let active = true;

        // Render charts after a small timeout to make sure canvases are drawn in DOM
        const timer = setTimeout(() => {
            if (!active) return;

            // 1. Sales Trend Chart
            if (salesChartRef.current && analyticsSales?.salesData) {
                const ctx = salesChartRef.current.getContext('2d');
                if (salesChartInstance.current) {
                    salesChartInstance.current.destroy();
                }

                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const labels = (analyticsSales.salesData || []).map(item => {
                    const num = Number(item._id);
                    if (!isNaN(num) && num >= 1 && num <= 12) {
                        return months[num - 1];
                    }
                    return String(item._id);
                });
                const dataValues = (analyticsSales.salesData || []).map(item => item.totalSales || 0);

                salesChartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Sales (₹)',
                            data: dataValues,
                            borderColor: '#0f766e',
                            backgroundColor: 'rgba(15, 118, 110, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top', labels: { color: '#e5e7eb' } },
                            tooltip: {
                                callbacks: {
                                    label: (context) => `₹${context.raw.toLocaleString('en-IN')}`
                                }
                            }
                        },
                        scales: {
                            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
                        }
                    }
                });
            }

            // 2. Sales by Category Chart
            if (categoryChartRef.current && analyticsProducts?.byCategory) {
                const ctx = categoryChartRef.current.getContext('2d');
                if (categoryChartInstance.current) {
                    categoryChartInstance.current.destroy();
                }

                const labels = (analyticsProducts.byCategory || []).map(item => item._id || 'Uncategorized');
                const dataValues = (analyticsProducts.byCategory || []).map(item => item.count);

                categoryChartInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels,
                        datasets: [{
                            data: dataValues,
                            backgroundColor: ['#0f766e', '#6366f1', '#f59e0b', '#ef4444', '#10b981'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { color: '#e5e7eb' } }
                        }
                    }
                });
            }
        }, 100);

        return () => {
            active = false;
            clearTimeout(timer);
            if (salesChartInstance.current) {
                salesChartInstance.current.destroy();
                salesChartInstance.current = null;
            }
            if (categoryChartInstance.current) {
                categoryChartInstance.current.destroy();
                categoryChartInstance.current = null;
            }
        };
    }, [activeTab, analyticsSales, analyticsProducts]);

    const fetchTabData = useCallback(async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        setLoadError('');
        try {
            if (activeTab === 'dashboard') {
                const res = await API.get('/admin/dashboard');
                if (res.success && res.data) {
                    setStats(res.data);
                }
            } else if (activeTab === 'products') {
                const res = await fetchAdminProducts(API);
                if (res.success) {
                    const prodList = res.data?.products || res.data?.data || res.data || [];
                    setProducts(Array.isArray(prodList) ? prodList : []);
                }
            } else if (activeTab === 'orders') {
                const res = await API.get(`/admin/orders?page=${orderPage}&limit=20`);
                if (res.success && res.data) {
                    setOrders(res.data.orders || res.data || []);
                    setOrderPages(Math.max(1, res.data.pagination?.totalPages || 1));
                }
            } else if (activeTab === 'pricing') {
                const [settingsRes, productsRes] = await Promise.all([
                    API.get('/settings'),
                    fetchAdminProducts(API)
                ]);
                if (settingsRes.success) {
                    setSettings(settingsRes.data || {});
                    setRawSettings(settingsRes.raw || []);
                }
                if (productsRes.success) {
                    const prodList = productsRes.data?.products || productsRes.data?.data || productsRes.data || [];
                    setProducts(Array.isArray(prodList) ? prodList : []);
                }
            } else if (activeTab === 'customers') {
                const res = await API.get(`/admin/customers?page=${customerPage}&limit=20`);
                if (res.success && res.data) {
                    setCustomers(res.data.customers || res.data || []);
                    setCustomerPages(Math.max(1, res.data.pagination?.totalPages || 1));
                }
            } else if (activeTab === 'coupons') {
                const res = await API.get('/coupons');
                if (res.success && res.data) {
                    setCoupons(res.data || []);
                }
            } else if (activeTab === 'settings') {
                const res = await API.get('/settings');
                if (res.success) {
                    setSettings(res.data || {});
                    setRawSettings(res.raw || []);
                }
            } else if (activeTab === 'analytics') {
                const [salesRes, productsRes, dashboardRes] = await Promise.all([
                    API.get(`/admin/analytics/sales?period=${analyticsPeriod}`),
                    API.get('/admin/analytics/products'),
                    API.get('/admin/dashboard')
                ]);
                if (salesRes.success) setAnalyticsSales(salesRes.data || {});
                if (productsRes.success) setAnalyticsProducts(productsRes.data || {});
                if (dashboardRes.success && dashboardRes.data) {
                    setStats(dashboardRes.data);
                }
            }
        } catch (err) {
            console.error('Admin fetch error:', err);
            setLoadError(err.message || 'Could not load this module.');
        } finally {
            setLoading(false);
        }
    }, [activeTab, analyticsPeriod, orderPage, customerPage]);

    useEffect(() => { if (isAdmin) void fetchTabData(); }, [isAdmin, fetchTabData]);

    // Product CRUD Actions
    const handleProductSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const isEdit = !!productForm._id;
            let res;
            
            // Format sizes array
            const formattedSizes = typeof productForm.sizes === 'string' 
                ? [...new Set(productForm.sizes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))]
                : productForm.sizes;

            if (!formattedSizes.length || !Number.isFinite(Number(productForm.price)) || Number(productForm.price) < 0 || !Number.isInteger(Number(productForm.stock)) || Number(productForm.stock) < 0) throw new Error('Enter valid sizes, a nonnegative price and a whole stock quantity.');
            const payload = {
                ...productForm,
                sizes: formattedSizes,
                price: Number(productForm.price),
                stock: Number(productForm.stock),
                sellingPrice: Number(productForm.price)
            };

            if (isEdit) {
                res = await API.put(`/products/${productForm._id}`, payload);
            } else {
                res = await API.post('/products', payload);
            }

            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Product saved successfully!', 'success');
                setProductForm(null);
                fetchTabData();
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Save failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleProductDelete = async (id) => {
        try {
            const res = await API.delete(`/products/${id}`);
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Product deleted', 'success');
                fetchTabData();
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Delete failed', 'error');
        }
    };

    // Order status change action
    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        if (actionBusy) return;
        setActionBusy(true);
        try {
            const res = await API.put(`/orders/${orderId}/status`, { status: newStatus });
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Order status updated!', 'success');
                // Update orders list in state
                setOrders(prev => prev.map(o => o._id === orderId || o.id === orderId ? { ...o, status: newStatus } : o));
                // Update selectedOrder if it is currently open
                if (selectedOrder && (selectedOrder._id === orderId || selectedOrder.id === orderId)) {
                    setSelectedOrder(prev => ({ ...prev, status: newStatus }));
                }
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Status update failed', 'error');
        } finally { setActionBusy(false); }
    };

    // Update single order payment status
    const handleUpdatePaymentStatus = async (orderId, newStatus) => {
        if (actionBusy) return;
        setActionBusy(true);
        try {
            const res = await API.put(`/admin/orders/${orderId}/payment-status`, { paymentStatus: newStatus });
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Payment status updated', 'success');
                setOrders(prev => prev.map(o => o._id === orderId || o.id === orderId ? { ...o, paymentStatus: newStatus } : o));
                if (selectedOrder && (selectedOrder._id === orderId || selectedOrder.id === orderId)) {
                    setSelectedOrder(prev => ({ ...prev, paymentStatus: newStatus }));
                }
            }
        } catch (err) {
            console.error(err);
            if (window.Utils?.showToast) window.Utils.showToast('Failed to update payment status', 'error');
        } finally { setActionBusy(false); }
    };

    // Staggered file asset downloader helper
    const downloadAsset = (src, filename) => {
        if (!src) return;
        if (src.startsWith('data:')) {
            const a = document.createElement('a');
            a.href = src;
            a.download = filename || 'download.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            const a = document.createElement('a');
            a.href = src;
            a.target = '_blank';
            a.download = filename || 'download.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    // Print order invoice print stream builder
    const handlePrintOrder = (order) => {
        order = escapeInvoiceData(order);
        const formattedDate = formatDate(order.createdAt);
        const subtotal = order.subtotal || order.totalAmount;
        const discount = order.discountAmount || 0;
        const shipping = order.shippingFee || 0;
        const total = order.totalAmount;

        const itemsHtml = (order.items || []).map(item => {
            const isCustom = item.productId?.startsWith('studio-') || (item.image && item.image.startsWith('data:image/')) || item.customDesign;
            return `
                <div class="order-item-row" style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 10px 0;">
                    <div style="display: flex; gap: 15px;">
                        <img src="${item.image || ''}" style="width: 60px; height: 60px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; padding: 2px;" />
                        <div>
                            <h4 style="margin: 0;">${item.name} ${isCustom ? '(Custom)' : ''}</h4>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #666;">Size: ${item.size} | Color: ${item.color} | Qty: ${item.quantity}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-weight: bold;">${formatINR(item.price * item.quantity)}</p>
                        <small style="color: #666;">${formatINR(item.price)} each</small>
                    </div>
                </div>
            `;
        }).join('');

        const printWindow = window.open('', '', 'height=600,width=800');
        if (!printWindow) {
            window.Utils?.showToast?.('Allow popups to print the invoice.', 'warning');
            return;
        }
        printWindow.opener = null;
        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice - Order #${order.orderNumber || order._id?.slice(-6).toUpperCase()}</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; padding: 30px; line-height: 1.5; }
                        .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                        .invoice-title { font-size: 24px; font-weight: bold; text-transform: uppercase; }
                        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
                        .section-title { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
                        .summary { margin-top: 30px; border-top: 2px solid #333; padding-top: 15px; text-align: right; width: 300px; margin-left: auto; }
                        .summary-row { display: flex; justify-content: space-between; padding: 5px 0; }
                    </style>
                </head>
                <body>
                    <div class="invoice-header">
                        <div>
                            <span class="invoice-title">DYD-Clothes Invoice</span>
                            <p style="margin: 5px 0 0 0; color: #666;">Order #${order.orderNumber || order._id?.slice(-6).toUpperCase()}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-weight: bold;">Date: ${formattedDate}</p>
                            <p style="margin: 5px 0 0 0; color: #666;">Payment: ${order.paymentMethod} (${order.paymentStatus || 'pending'})</p>
                        </div>
                    </div>

                    <div class="grid-2">
                        <div>
                            <div class="section-title">Customer Contact</div>
                            <p style="margin: 4px 0;"><strong>Name:</strong> ${order.customer?.name || 'Guest'}</p>
                            <p style="margin: 4px 0;"><strong>Email:</strong> ${order.customer?.email || 'N/A'}</p>
                            <p style="margin: 4px 0;"><strong>Phone:</strong> ${order.customer?.phone || 'N/A'}</p>
                        </div>
                        <div>
                            <div class="section-title">Shipping Address</div>
                            <p style="margin: 4px 0;">${order.shippingAddress?.street || 'N/A'}</p>
                            <p style="margin: 4px 0;">${order.shippingAddress?.city || 'N/A'}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zipCode || ''}</p>
                            <p style="margin: 4px 0;">${order.shippingAddress?.country || 'India'}</p>
                        </div>
                    </div>

                    <div class="section-title">Items Summary</div>
                    <div class="items-list">
                        ${itemsHtml}
                    </div>

                    <div class="summary">
                        <div class="summary-row">
                            <span>Subtotal:</span>
                            <span>${formatINR(subtotal)}</span>
                        </div>
                        ${discount > 0 ? `
                            <div class="summary-row" style="color: green;">
                                <span>Discount:</span>
                                <span>-${formatINR(discount)}</span>
                            </div>
                        ` : ''}
                        <div class="summary-row">
                            <span>Shipping:</span>
                            <span>${shipping === 0 ? 'FREE' : formatINR(shipping)}</span>
                        </div>
                        <div class="summary-row" style="font-size: 16px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;">
                            <span>Total:</span>
                            <span>${formatINR(total)}</span>
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    // Live bidirectional pricing changes calculator
    const handleProductPriceLiveChange = (productId, field, value) => {
        const val = value === '' ? '' : Number(value);
        setProducts(prev => prev.map(p => {
            if (p._id === productId || p.id === productId) {
                const updated = { ...p, [field]: val };
                // Live bidirectional calculation
                if (field === 'mrp' || field === 'discountPercent') {
                    const mrp = field === 'mrp' ? val : p.mrp;
                    const disc = field === 'discountPercent' ? val : p.discountPercent || 0;
                    if (mrp && mrp > 0) {
                        updated.price = Math.round(mrp * (1 - (disc || 0) / 100));
                    }
                } else if (field === 'price') {
                    const mrp = p.mrp;
                    const sell = val;
                    if (mrp && mrp > 0 && sell && sell > 0) {
                        updated.discountPercent = Math.round(((mrp - sell) / mrp) * 100);
                    }
                }
                return updated;
            }
            return p;
        }));
    };

    // Save all studio and product pricing bulk changes
    const handleSaveAllPricing = async () => {
        setSaving(true);
        try {
            // 1. Save Studio Pricing Settings
            const updates = rawSettings.filter(setting => setting.key.startsWith('price_')).map(({ key }) => ({
                key,
                value: settings[key]
            }));
            const settingsRes = await API.post('/settings', updates);
            
            // 2. Save Product Pricing Updates
            const pricingUpdates = products.map(p => ({
                // The admin route expects productId and sellingPrice. Keep the
                // editable price field as the source of truth for both values.
                productId: p._id || p.id,
                mrp: Number(p.mrp || p.price || 0),
                discountPercent: Number(p.discountPercent || 0),
                sellingPrice: Number(p.price ?? p.sellingPrice ?? 0),
                price: Number(p.price ?? p.sellingPrice ?? 0)
            }));
            const productsRes = await API.put('/admin/products/bulk/pricing', { updates: pricingUpdates });

            if (settingsRes.success && productsRes.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Pricing saved successfully!', 'success');
                fetchTabData();
            } else {
                if (window.Utils?.showToast) window.Utils.showToast('Failed to save pricing details', 'error');
            }
        } catch (err) {
            console.error('Save pricing error:', err);
            if (window.Utils?.showToast) window.Utils.showToast('Error saving pricing details', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Promote or revoke customer roles
    const handleUpdateUserRole = async (customerId, role) => {
        try {
            const res = await API.put(`/admin/customers/${customerId}/role`, { role });
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast(res.message || 'User role updated', 'success');
                setCustomers(prev => prev.map(c => c._id === customerId || c.id === customerId ? { ...c, role } : c));
            } else {
                if (window.Utils?.showToast) window.Utils.showToast(res.error || 'Failed to update role', 'error');
            }
        } catch (err) {
            console.error('Update user role error:', err);
            if (window.Utils?.showToast) window.Utils.showToast('Error updating role', 'error');
        }
    };

    // Deactivate customer account while retaining order history.
    const handleDeleteCustomer = async (customerId) => {
        try {
            const res = await API.delete(`/admin/customers/${customerId}`);
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Customer account deactivated', 'success');
                setCustomers(prev => prev.map(c => c._id === customerId || c.id === customerId ? { ...c, isActive: false } : c));
            } else {
                if (window.Utils?.showToast) window.Utils.showToast(res.error || 'Failed to delete customer', 'error');
            }
        } catch (err) {
            console.error('Delete customer error:', err);
            if (window.Utils?.showToast) window.Utils.showToast('Error deleting customer', 'error');
        }
    };

    // Admin logout action
    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    // Coupon CRUD Actions
    const handleCouponSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...couponForm,
                discountValue: Number(couponForm.discountValue),
                minimumOrderAmount: Number(couponForm.minimumOrderAmount || 0),
                maximumDiscountAmount: couponForm.maximumDiscountAmount === '' ? null : Number(couponForm.maximumDiscountAmount),
                endDate: new Date(couponForm.endDate).toISOString()
            };
            const res = couponForm._id ? await API.put(`/coupons/${couponForm._id}`, payload) : await API.post('/coupons', payload);
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Coupon saved!', 'success');
                setCouponForm(null);
                fetchTabData();
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Creation failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCouponToggle = async (coupon) => {
        setSaving(true);
        try {
            const response = await API.put(`/coupons/${coupon._id || coupon.id}`, { isActive: !coupon.isActive });
            if (!response.success) throw new Error(response.error || 'Could not update coupon.');
            setCoupons(previous => previous.map(item => (item._id || item.id) === (coupon._id || coupon.id) ? response.data : item));
        } catch (error) { window.Utils?.showToast?.(error.message, 'error'); }
        finally { setSaving(false); }
    };

    // Settings actions
    const handleSettingsSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const updates = rawSettings.map(({ key }) => ({
                key,
                value: settings[key]
            }));
            const res = await API.post('/settings', updates);
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Settings saved successfully!', 'success');
                fetchTabData(false);
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Save failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSettingsValueChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    if (authLoading) {
        return (
            <div className="loading-state" style={{ textAlign: 'center', padding: '100px' }}>
                <i className="fas fa-spinner fa-spin fa-2x"></i> Checking authorization...
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="container text-center" style={{ padding: '100px 20px' }}>
                <i className="fas fa-lock fa-3x" style={{ color: 'var(--danger)', marginBottom: '20px' }}></i>
                <h2>Access Denied</h2>
                <p>Only administrator accounts can view this dashboard page.</p>
                <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>Return Home</button>
            </div>
        );
    }

    const notifications = [];
    if (stats?.lowStockProducts && stats.lowStockProducts.length) {
        stats.lowStockProducts.slice(0, 5).forEach(p => {
            notifications.push({
                type: 'low-stock',
                icon: 'fa-exclamation-triangle',
                title: 'Low Stock Warning',
                message: `${p.name} is low on stock (${p.stock} left)`,
                time: 'Just now'
            });
        });
    }
    if (stats?.recentOrders && stats.recentOrders.length) {
        stats.recentOrders.slice(0, 3).forEach(o => {
            notifications.push({
                type: 'new-order',
                icon: 'fa-shopping-bag',
                title: 'New Order',
                message: `Order #${o.orderNumber || o._id?.slice(-6).toUpperCase()} received from ${o.customer?.name || 'Guest'}`,
                time: 'Recently'
            });
        });
    }

    return (
        <div className="admin-layout">
            {/* Sidebar Navigation */}
            <aside className={`admin-sidebar ${sidebarActive ? 'active' : ''}`} id="sidebar">
                <div className="sidebar-header">
                    <Link to="/" className="admin-logo" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} title="Go to Storefront Home">
                        <img src="/images/LOGO_DYD.png" className="logo-icon" alt="DYD Logo" style={{ height: '40px', width: 'auto', borderRadius: '4px', objectFit: 'contain', marginBottom: '10px' }} />
                        <span className="site-name">D<span style={{ color: 'var(--primary)' }}>Y</span>D-Clothes</span>
                    </Link>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '5px' }}>Admin Dashboard</p>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-group">
                        <p className="nav-group-title">MAIN</p>
                        <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setSidebarActive(false); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-tachometer-alt"></i>
                            <span>Dashboard</span>
                        </button>
                        <button className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => { setActiveTab('orders'); setSidebarActive(false); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-shopping-bag"></i>
                            <span>Orders</span>
                            {orders.length > 0 && <span className="nav-badge">{orders.length}</span>}
                        </button>
                        <button className={`nav-link ${activeTab === 'products' ? 'active' : ''}`} onClick={() => { setActiveTab('products'); setSidebarActive(false); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-tshirt"></i>
                            <span>Products</span>
                        </button>
                        <button className={`nav-link ${activeTab === 'pricing' ? 'active' : ''}`} onClick={() => { setActiveTab('pricing'); setSidebarActive(false); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-tags"></i>
                            <span>Pricing</span>
                        </button>
                        <button className={`nav-link ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => { setActiveTab('customers'); setSidebarActive(false); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-users"></i>
                            <span>Customers</span>
                        </button>
                        <button className={`nav-link ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => { setActiveTab('coupons'); setSidebarActive(false); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-ticket-alt"></i>
                            <span>Coupons</span>
                        </button>
                        <button className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setSidebarActive(false); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-cog"></i>
                            <span>Settings</span>
                        </button>
                    </div>

                    <div className="nav-group">
                        <p className="nav-group-title">SYSTEM</p>
                        <button className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveTab('analytics'); setSidebarActive(false); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-chart-line"></i>
                            <span>Analytics</span>
                        </button>
                        <button className="nav-link" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                            <i className="fas fa-store"></i>
                            <span>View Store</span>
                        </button>
                        <button className="nav-link" onClick={handleLogout} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--danger)' }}>
                            <i className="fas fa-sign-out-alt"></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                {/* Header */}
                <header className="admin-header">
                    <div className="header-left">
                        <button className="menu-toggle" id="menuToggle" onClick={() => setSidebarActive(!sidebarActive)}>
                            <i className="fas fa-bars"></i>
                        </button>
                        <h1 className="header-title" style={{ textTransform: 'capitalize' }}>{activeTab}</h1>
                    </div>
                    
                    <div className="header-actions">
                        {/* Notifications Bell Dropdown */}
                        <div className="notification-wrapper" style={{ position: 'relative' }}>
                            <button className="notification-btn" onClick={() => setNotificationsActive(!notificationsActive)}>
                                <i className="fas fa-bell"></i>
                                {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
                            </button>
                            {notificationsActive && (
                                <div className="notification-dropdown active" style={{ display: 'block' }}>
                                    <div className="dropdown-header">
                                        <h3>Notifications</h3>
                                        <button onClick={() => {
                                            setStats(prev => ({ ...prev, lowStockProducts: [], recentOrders: [] }));
                                            setNotificationsActive(false);
                                        }}>Mark all read</button>
                                    </div>
                                    <div className="notification-list">
                                        {notifications.length > 0 ? notifications.map((n, idx) => (
                                            <div key={idx} className={`notification-item ${n.type}`}>
                                                <div className="notification-icon">
                                                    <i className={`fas ${n.icon}`}></i>
                                                </div>
                                                <div className="notification-content">
                                                    <p><strong>{n.title}</strong></p>
                                                    <p>{n.message}</p>
                                                    <span className="notification-time">{n.time}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="empty-notifications">No new notifications</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User Menu Dropdown */}
                        <div className="user-menu-container" style={{ position: 'relative' }}>
                            <div className="user-menu" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                                <div className="user-avatar">{user?.name?.charAt(0).toUpperCase() || 'A'}</div>
                                <div className="user-info">
                                    <span className="user-name">{user?.name || 'Admin User'}</span>
                                    <span className="user-role">Administrator</span>
                                </div>
                                <i className="fas fa-chevron-down" style={{ fontSize: '0.8rem', marginLeft: '6px', color: 'var(--text-muted)' }}></i>
                            </div>
                            {userMenuOpen && (
                                <div className="user-dropdown-menu" style={{ display: 'block', position: 'absolute', right: 0, top: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: '180px', zIndex: 1000, padding: '0.5rem 0', marginTop: '0.5rem' }}>
                                    <a href="#" style={{ display: 'block', padding: '0.5rem 1rem', color: 'var(--text-primary)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); navigate('/profile'); }}><i className="fas fa-user" style={{ marginRight: '8px' }}></i> Edit Profile</a>
                                    <a href="#" style={{ display: 'block', padding: '0.5rem 1rem', color: 'var(--text-primary)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setActiveTab('settings'); setUserMenuOpen(false); }}><i className="fas fa-cog" style={{ marginRight: '8px' }}></i> Settings</a>
                                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }}></div>
                                    <a href="#" style={{ display: 'block', padding: '0.5rem 1rem', color: 'var(--danger)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); handleLogout(); }}><i className="fas fa-sign-out-alt" style={{ marginRight: '8px' }}></i> Logout</a>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="admin-content">
                    {loadError && <div role="alert" className="order-card"><p>{loadError}</p><button className="btn btn-outline" onClick={() => fetchTabData()}>Retry</button></div>}
                    {loading ? (
                        <div className="admin-loading">
                            <i className="fas fa-spinner fa-spin fa-2x"></i>
                            <p>Loading workspace...</p>
                        </div>
                    ) : (
                        <>
                            {/* Overview Dashboard Tab */}
                            {activeTab === 'dashboard' && stats && (
                                <div className="dashboard-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div className="stats-grid">
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                                <i className="fas fa-shopping-cart"></i>
                                            </div>
                                            <div className="stat-info">
                                                <span className="stat-label">TOTAL ORDERS</span>
                                                <h2 className="stat-value">{stats.overview?.totalOrders || 0}</h2>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                                <i className="fas fa-rupee-sign"></i>
                                            </div>
                                            <div className="stat-info">
                                                <span className="stat-label">REVENUE</span>
                                                <h2 className="stat-value">{formatINR(stats.overview?.totalSales || stats.overview?.totalRevenue || 0)}</h2>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                                <i className="fas fa-users"></i>
                                            </div>
                                            <div className="stat-info">
                                                <span className="stat-label">CUSTOMERS</span>
                                                <h2 className="stat-value">{stats.overview?.totalUsers || 0}</h2>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                                                <i className="fas fa-box"></i>
                                            </div>
                                            <div className="stat-info">
                                                <span className="stat-label">PRODUCTS</span>
                                                <h2 className="stat-value">{stats.overview?.totalProducts || 0}</h2>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr', gap: '24px' }}>
                                        <div className="section-card" style={{ padding: '24px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', width: '100%', gap: '15px' }}>
                                                <h3 style={{ margin: 0 }}><i className="fas fa-history" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>Recent Orders</h3>
                                                <button className="btn btn-sm" onClick={() => setActiveTab('orders')} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, width: 'auto', flexShrink: 0, cursor: 'pointer' }}>
                                                    View All Orders <i className="fas fa-arrow-right"></i>
                                                </button>
                                            </div>
                                            <div className="table-container">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>ORDER #</th>
                                                            <th>CUSTOMER</th>
                                                            <th>AMOUNT</th>
                                                            <th>STATUS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {orders.slice(0, 8).map(ord => (
                                                            <tr key={ord._id || ord.id}>
                                                                <td><strong>#ORD-{ord.orderNumber || ord._id?.slice(-6).toUpperCase()}</strong></td>
                                                                <td>{ord.customer?.name || 'Guest'}</td>
                                                                <td>{formatINR(ord.totalAmount)}</td>
                                                                <td>
                                                                    <span className={`status-badge status-${ord.status}`} style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', textTransform: 'capitalize' }}>{ord.status}</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="section-card" style={{ padding: '24px' }}>
                                            <h3 style={{ margin: '0 0 20px 0' }}><i className="fas fa-exclamation-triangle" style={{ color: '#eab308', marginRight: '8px' }}></i>Low Stock Warning</h3>
                                            <div className="low-stock-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                {stats.lowStockProducts && stats.lowStockProducts.length > 0 ? (
                                                    stats.lowStockProducts.slice(0, 8).map(p => (
                                                        <div key={p._id || p.id} className="low-stock-item" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                            <img src={p.mainImage || p.image || 'https://via.placeholder.com/40'} alt={p.name} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                                                            <div className="item-info">
                                                                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{p.name}</h4>
                                                                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>Only {p.stock} left in stock</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                                        <i className="fas fa-check-circle fa-2x" style={{ color: '#10b981', marginBottom: '10px', display: 'block' }}></i>
                                                        <span>All products well stocked!</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Products CRUD Tab */}
                            {activeTab === 'products' && (
                                <div>
                                    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', width: '100%', gap: '15px' }}>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '1.6rem' }}><i className="fas fa-tshirt" style={{ color: 'var(--primary)', marginRight: '10px' }}></i>Products</h2>
                                            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Manage product list, details, prices, and stock inventory.</p>
                                        </div>
                                        <button className="btn btn-sm" onClick={() => setProductForm({ name: '', price: '', stock: '', sizes: 'S,M,L,XL', mainImage: '', category: '', description: '', isActive: true })} style={{ background: 'var(--gradient-primary)', color: '#fff', border: 'none', display: 'inline-flex', gap: '8px', alignItems: 'center', width: 'auto', flexShrink: 0, cursor: 'pointer' }}>
                                            <i className="fas fa-plus"></i> Add Product
                                        </button>
                                    </div>

                                    {productForm && (
                                        <div className={`admin-modal ${productForm ? 'active' : ''}`}>
                                            <div className="modal-content">
                                                <div className="modal-header">
                                                    <h3 className="modal-title">{productForm._id ? 'Edit Product' : 'Add New Product'}</h3>
                                                    <button className="modal-close" onClick={() => setProductForm(null)}>&times;</button>
                                                </div>
                                                <form onSubmit={handleProductSave}>
                                                    <div className="modal-body">
                                                        <div className="form-group">
                                                            <label>Product Name</label>
                                                            <input type="text" className="form-control" value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} required />
                                                        </div>
                                                        <div className="form-grid-2">
                                                            <div className="form-group">
                                                                <label>Selling Price (₹)</label>
                                                                <input type="number" min="0" step="0.01" className="form-control" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: e.target.value})} required />
                                                            </div>
                                                            <div className="form-group">
                                                                <label>Inventory Stock</label>
                                                                <input type="number" min="0" step="1" className="form-control" value={productForm.stock} onChange={(e) => setProductForm({...productForm, stock: e.target.value})} required />
                                                            </div>
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Image URL</label>
                                                            <input type="text" className="form-control" value={productForm.mainImage} onChange={(e) => setProductForm({...productForm, mainImage: e.target.value})} required />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Sizes (Comma separated)</label>
                                                            <input type="text" className="form-control" value={productForm.sizes} onChange={(e) => setProductForm({...productForm, sizes: e.target.value})} required />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Category</label>
                                                            <input type="text" className="form-control" value={productForm.category} onChange={(e) => setProductForm({...productForm, category: e.target.value})} />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Description</label>
                                                            <textarea className="form-control" value={productForm.description} onChange={(e) => setProductForm({...productForm, description: e.target.value})} rows="3"></textarea>
                                                        </div>
                                                        <label><input type="checkbox" checked={productForm.isActive !== false} onChange={e => setProductForm({ ...productForm, isActive: e.target.checked })} /> Visible in the shop</label>
                                                    </div>
                                                    <div className="modal-footer">
                                                        <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                                                            {saving ? 'Saving...' : 'Save Product'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Thumbnail</th>
                                                    <th>Name</th>
                                                    <th>Category</th>
                                                    <th>Price</th>
                                                    <th>Stock</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {products.map(p => (
                                                    <tr key={p._id || p.id}>
                                                        <td>
                                                            <img src={p.mainImage || 'https://via.placeholder.com/40'} alt={p.name} className="table-img" />
                                                        </td>
                                                        <td>{p.name}</td>
                                                        <td>{p.category}</td>
                                                        <td>{formatINR(p.price)}</td>
                                                        <td>{p.stock}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                <button className="action-btn edit" onClick={() => setProductForm({ ...p, sizes: (p.sizes || []).join(','), isActive: p.isActive !== false })} title="Edit Product"><i className="fas fa-edit"></i></button>
                                                                <button className="action-btn delete" onClick={() => setProductPendingDelete(p._id)} title="Delete Product"><i className="fas fa-trash"></i></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Orders Management Tab */}
                            {activeTab === 'orders' && (
                                <div>
                                    <div className="page-header" style={{ marginBottom: '28px' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.6rem' }}><i className="fas fa-shopping-bag" style={{ color: 'var(--primary)', marginRight: '10px' }}></i>Orders</h2>
                                        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Inspect orders, print invoices, track custom designs, and update fulfillment status.</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}><button className="btn btn-outline btn-sm" disabled={orderPage <= 1} onClick={() => setOrderPage(page => page - 1)}>Previous</button><span>Page {orderPage} of {orderPages}</span><button className="btn btn-outline btn-sm" disabled={orderPage >= orderPages} onClick={() => setOrderPage(page => page + 1)}>Next</button></div>
                                    </div>
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Order ID</th>
                                                    <th>Customer</th>
                                                    <th>Amount</th>
                                                    <th>Status</th>
                                                    <th>Payment</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {orders.length > 0 ? orders.map(ord => {
                                                    const orderId = ord._id || ord.id;
                                                    return (
                                                        <tr key={orderId}>
                                                            <td><strong>#ORD-{ord.orderNumber || orderId?.slice(-6).toUpperCase()}</strong></td>
                                                            <td>
                                                                {ord.customer?.name || 'Guest'}
                                                                <br />
                                                                <small style={{ color: 'var(--text-muted)' }}>{ord.customer?.email || ''}</small>
                                                            </td>
                                                            <td>{formatINR(ord.totalAmount)}</td>
                                                            <td>
                                                                <select 
                                                                    className="form-control btn-sm" 
                                                                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px' }}
                                                                    value={ord.status} 
                                                                    disabled={actionBusy || orderStatusChoices(ord.status).length === 1} onChange={(e) => handleUpdateOrderStatus(orderId, e.target.value)}
                                                                >
                                                                    {orderStatusChoices(ord.status).map(s => (
                                                                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td>
                                                                <span className={`status-badge status-${ord.paymentStatus || 'pending'}`}>{ord.paymentStatus || 'pending'}</span>
                                                                {['cash_on_delivery', 'cod'].includes(ord.paymentMethod) && ord.status === 'delivered' && ord.paymentStatus !== 'paid' && (
                                                                    <button className="btn btn-outline btn-sm" disabled={actionBusy} onClick={() => setPendingAction({ title: 'Confirm cash collection?', message: 'Mark this delivered cash-on-delivery order as paid after the money has been collected.', confirmLabel: 'Mark paid', run: () => handleUpdatePaymentStatus(orderId, 'paid') })}>Mark cash collected</button>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                    <button className="action-btn view" onClick={() => setSelectedOrder(ord)} title="View Details">
                                                                        <i className="fas fa-eye"></i>
                                                                    </button>

                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }) : (
                                                    <tr>
                                                        <td colSpan="6" className="empty-state">No orders found</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Coupons management Tab */}
                            {activeTab === 'coupons' && (
                                <div>
                                    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', width: '100%', gap: '15px' }}>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '1.6rem' }}><i className="fas fa-ticket-alt" style={{ color: 'var(--primary)', marginRight: '10px' }}></i>Coupons</h2>
                                            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Create, view, and manage promotional discount coupons.</p>
                                        </div>
                                        <button className="btn btn-sm" onClick={() => setCouponForm({ code: '', discountType: 'percentage', discountValue: '', minimumOrderAmount: '', maximumDiscountAmount: '', endDate: '', isActive: true })} style={{ background: 'var(--gradient-primary)', color: '#fff', border: 'none', display: 'inline-flex', gap: '8px', alignItems: 'center', width: 'auto', flexShrink: 0, cursor: 'pointer' }}>
                                            <i className="fas fa-plus"></i> Create Coupon
                                        </button>
                                    </div>

                                    {couponForm && (
                                        <div className={`admin-modal ${couponForm ? 'active' : ''}`}>
                                            <div className="modal-content">
                                                <div className="modal-header">
                                                    <h3 className="modal-title">{couponForm._id ? 'Edit Coupon' : 'Create Coupon'}</h3>
                                                    <button className="modal-close" onClick={() => setCouponForm(null)}>&times;</button>
                                                </div>
                                                <form onSubmit={handleCouponSave}>
                                                    <div className="modal-body">
                                                        <div className="form-group">
                                                            <label>Coupon Code</label>
                                                            <input type="text" className="form-control" value={couponForm.code} onChange={(e) => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} placeholder="e.g. WELCOME10" required />
                                                        </div>
                                                        <div className="form-grid-2">
                                                            <div className="form-group">
                                                                <label>Discount Type</label>
                                                                <select className="form-control" value={couponForm.discountType} onChange={(e) => setCouponForm({...couponForm, discountType: e.target.value})}>
                                                                    <option value="percentage">Percentage (%)</option>
                                                                    <option value="fixed">Flat Value (₹)</option>
                                                                </select>
                                                            </div>
                                                            <div className="form-group">
                                                                <label>Discount Value</label>
                                                                <input type="number" min="0.01" step="0.01" max={couponForm.discountType === 'percentage' ? 100 : undefined} className="form-control" value={couponForm.discountValue} onChange={(e) => setCouponForm({...couponForm, discountValue: e.target.value})} required />
                                                            </div>
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Minimum Cart Total (₹)</label>
                                                            <input type="number" min="0" step="0.01" className="form-control" value={couponForm.minimumOrderAmount} onChange={(e) => setCouponForm({...couponForm, minimumOrderAmount: e.target.value})} />
                                                        </div>
                                                        <div className="form-group"><label>Maximum discount (₹, optional)</label><input type="number" min="0" step="0.01" className="form-control" value={couponForm.maximumDiscountAmount} onChange={e => setCouponForm({ ...couponForm, maximumDiscountAmount: e.target.value })} /></div>
                                                        <div className="form-group"><label>Expires at</label><input type="datetime-local" className="form-control" value={couponForm.endDate} required onChange={e => setCouponForm({ ...couponForm, endDate: e.target.value })} /></div>
                                                        <label><input type="checkbox" checked={couponForm.isActive} onChange={e => setCouponForm({ ...couponForm, isActive: e.target.checked })} /> Active</label>
                                                    </div>
                                                    <div className="modal-footer">
                                                        <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                                                            {saving ? 'Saving...' : 'Save Coupon'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Code</th>
                                                    <th>Type</th>
                                                    <th>Value</th>
                                                    <th>Min Cart</th>
                                                    <th>Status</th>
                                                    <th>Expires</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {coupons.map(c => (
                                                    <tr key={c._id || c.id}>
                                                        <td>{c.code}</td>
                                                        <td>{c.discountType}</td>
                                                        <td>{c.discountValue}</td>
                                                        <td>{formatINR(c.minimumOrderAmount || 0)}</td>
                                                        <td>
                                                            <span className={`status-badge status-${c.isActive ? 'confirmed' : 'cancelled'}`}>{!c.isActive ? 'Inactive' : new Date(c.endDate) < new Date() ? 'Expired' : 'Active'}</span>
                                                        </td>
                                                        <td>{formatDate(c.endDate)}</td>
                                                        <td><div style={{ display: 'flex', gap: '6px' }}><button className="btn btn-outline btn-sm" disabled={saving} onClick={() => {
                                                            const end = new Date(c.endDate);
                                                            const localDate = Number.isNaN(end.getTime()) ? '' : new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                            setCouponForm({ ...c, minimumOrderAmount: c.minimumOrderAmount || 0, maximumDiscountAmount: c.maximumDiscountAmount ?? '', endDate: localDate });
                                                        }}>Edit</button><button className="btn btn-outline btn-sm" disabled={saving} onClick={() => handleCouponToggle(c)}>{c.isActive ? 'Deactivate' : 'Activate'}</button></div></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Pricing Management Tab */}
                            {activeTab === 'pricing' && (
                                <div className="pricing-page">
                                    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', width: '100%', gap: '15px' }}>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '1.6rem' }}><i className="fas fa-tags" style={{ color: 'var(--primary)', marginRight: '10px' }}></i>Pricing Management</h2>
                                            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Control studio costs and product discounts. Changes reflect instantly in the store.</p>
                                        </div>
                                        <button className="btn btn-sm" onClick={handleSaveAllPricing} disabled={saving} style={{ background: 'var(--gradient-primary)', color: '#fff', border: 'none', display: 'inline-flex', gap: '8px', alignItems: 'center', width: 'auto', flexShrink: 0, cursor: 'pointer' }}>
                                            <i className="fas fa-save"></i> {saving ? 'Saving...' : 'Save All Changes'}
                                        </button>
                                    </div>

                                    <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                                        {/* Studio Pricing Card */}
                                        <div className="admin-card" style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)' }}>
                                            <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}><i className="fas fa-palette" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>Studio Design Pricing</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 20px' }}>Base prices and add-on costs shown in the Design Studio price calculator.</p>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Item</th>
                                                        <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Price (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { key: 'price_fabric_cotton',    label: '100% Cotton Base Price',    default: 299 },
                                                        { key: 'price_fabric_polycotton',label: 'Poly Cotton Base Price',     default: 349 },
                                                        { key: 'price_fabric_dryfit',    label: 'Dry Fit / Sports Base Price',default: 379 },
                                                        { key: 'price_fabric_premium',   label: 'Premium Cotton Base Price',  default: 449 },
                                                        { key: 'price_fabric_organic',   label: 'Organic Cotton Base Price',  default: 499 },
                                                        { key: 'price_print_per_side',   label: 'Print Cost per Image Side',  default: 150 },
                                                        { key: 'price_text_per_unit',    label: 'Text Cost per Text Element', default: 50  },
                                                    ].map(f => (
                                                        <tr key={f.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <td style={{ padding: '12px 0', fontSize: '0.88rem' }}>{f.label}</td>
                                                            <td style={{ padding: '12px 0', textAlign: 'right' }}>
                                                                <input type="number" className="form-control" min="0" step="1"
                                                                    value={settings[f.key] ?? f.default}
                                                                    onChange={(e) => setSettings(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                                                                    style={{ width: '90px', textAlign: 'right', display: 'inline-block', padding: '6px 10px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Product Pricing Card */}
                                        <div className="admin-card" style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)' }}>
                                            <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}><i className="fas fa-percent" style={{ color: '#f59e0b', marginRight: '8px' }}></i>Product Discount Pricing</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 20px' }}>Set MRP, discount %, and selling price. Changes reflect instantly in store.</p>
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '440px' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                            <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Product</th>
                                                            <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>MRP (₹)</th>
                                                            <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Discount %</th>
                                                            <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sell Price (₹)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {products.map(p => {
                                                            const mrp = p.mrp || '';
                                                            const disc = p.discountPercent || 0;
                                                            const sell = p.price || '';
                                                            return (
                                                                <tr key={p._id || p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                    <td style={{ padding: '10px 4px', fontSize: '0.82rem', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</td>
                                                                    <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                                                                        <input type="number" className="form-control" min="0" step="1"
                                                                            value={mrp} placeholder="—"
                                                                            onChange={(e) => handleProductPriceLiveChange(p._id || p.id, 'mrp', e.target.value)}
                                                                            style={{ width: '80px', textAlign: 'right', display: 'inline-block', padding: '5px 8px', fontSize: '0.82rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                                                                    </td>
                                                                    <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                                                                        <input type="number" className="form-control" min="0" max="100" step="1"
                                                                            value={disc} placeholder="0"
                                                                            onChange={(e) => handleProductPriceLiveChange(p._id || p.id, 'discountPercent', e.target.value)}
                                                                            style={{ width: '65px', textAlign: 'right', display: 'inline-block', padding: '5px 8px', fontSize: '0.82rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                                                                    </td>
                                                                    <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                                                                        <input type="number" className="form-control" min="0" step="1"
                                                                            value={sell} placeholder="Price"
                                                                            onChange={(e) => handleProductPriceLiveChange(p._id || p.id, 'price', e.target.value)}
                                                                            style={{ width: '85px', textAlign: 'right', display: 'inline-block', padding: '5px 8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {products.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No products found. Add products first.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Customer Management Tab */}
                            {activeTab === 'customers' && (
                                <div className="customers-page">
                                    <div className="page-header" style={{ marginBottom: '28px' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.6rem' }}><i className="fas fa-users" style={{ color: 'var(--primary)', marginRight: '10px' }}></i>Customers</h2>
                                        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Manage customer contact details, account roles and access.</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}><button className="btn btn-outline btn-sm" disabled={customerPage <= 1} onClick={() => setCustomerPage(page => page - 1)}>Previous</button><span>Page {customerPage} of {customerPages}</span><button className="btn btn-outline btn-sm" disabled={customerPage >= customerPages} onClick={() => setCustomerPage(page => page + 1)}>Next</button></div>
                                    </div>
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Email</th>
                                                    <th>Phone</th>
                                                    <th>Role</th>
                                                    <th>Joined</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {customers.length > 0 ? customers.map(c => {
                                                    const customerId = c._id || c.id;
                                                    return (
                                                        <tr key={customerId}>
                                                            <td><strong>{c.name || 'N/A'}</strong>{c.isActive === false && <small> · Inactive</small>}</td>
                                                            <td>{c.email || 'N/A'}</td>
                                                            <td>{c.phone || 'N/A'}</td>
                                                            <td><span className={`role-badge role-${c.role || 'user'}`} style={{ textTransform: 'capitalize', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: c.role === 'admin' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', color: c.role === 'admin' ? 'var(--danger)' : 'var(--primary)' }}>{c.role || 'user'}</span></td>
                                                            <td>{formatDate(c.createdAt)}</td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                    {c.role === 'admin' && customerId !== (user._id || user.id) && c.email !== 'admin@tshirtco.com' ? (
                                                                        <button className="action-btn edit" onClick={() => setPendingAction({ title: 'Revoke administrator access?', message: 'This account will become a customer.', run: () => handleUpdateUserRole(customerId, 'customer') })} title="Revoke Admin">
                                                                            <i className="fas fa-user-minus"></i>
                                                                        </button>
                                                                    ) : (
                                                                        c.role !== 'admin' && c.isActive !== false ? (
                                                                            <button className="action-btn view" onClick={() => setPendingAction({ title: 'Grant administrator access?', message: 'This account will be able to manage orders, customers and store settings.', run: () => handleUpdateUserRole(customerId, 'admin') })} title="Make Admin">
                                                                                <i className="fas fa-user-shield"></i>
                                                                            </button>
                                                                        ) : null
                                                                    )}
                                                                    {c.role !== 'admin' && c.isActive !== false && customerId !== (user._id || user.id) && (
                                                                        <button 
                                                                            className="action-btn delete" 
                                                                            onClick={() => setPendingAction({ title: 'Deactivate customer?', message: 'The customer will lose account access. Existing orders will be retained.', confirmLabel: 'Deactivate', run: () => handleDeleteCustomer(customerId) })} 
                                                                            title="Deactivate Customer"
                                                                        >
                                                                            <i className="fas fa-trash"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }) : (
                                                    <tr>
                                                        <td colSpan="6" className="empty-state">No customers found</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Analytics Tab */}
                            {activeTab === 'analytics' && (
                                <div className="analytics-page">
                                    <div className="page-header" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '1.6rem' }}><i className="fas fa-chart-line" style={{ color: 'var(--primary)', marginRight: '10px' }}></i>Analytics</h2>
                                            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>View real-time sales overview, revenue insights, styles distribution, and stock performance stats.</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                            {[
                                                { id: 'day', label: 'Last 30 Days' },
                                                { id: 'month', label: 'By Month' },
                                                { id: 'year', label: 'By Year' }
                                            ].map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setAnalyticsPeriod(p.id)}
                                                    style={{ 
                                                        padding: '6px 14px', 
                                                        fontSize: '0.85rem', 
                                                        fontWeight: '500',
                                                        background: analyticsPeriod === p.id ? 'var(--primary)' : 'transparent', 
                                                        color: analyticsPeriod === p.id ? '#fff' : 'var(--text-muted)', 
                                                        border: 'none', 
                                                        borderRadius: 'var(--radius-sm)', 
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="stats-grid">
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                                <i className="fas fa-chart-line"></i>
                                            </div>
                                            <div className="stat-info">
                                                <span className="stat-label">Revenue</span>
                                                <h2 className="stat-value">{formatINR(analyticsSales?.summary?.totalRevenue || stats?.overview?.totalRevenue || 0)}</h2>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                                                <i className="fas fa-shopping-bag"></i>
                                            </div>
                                            <div className="stat-info">
                                                <span className="stat-label">Orders</span>
                                                <h2 className="stat-value">{analyticsSales?.summary?.totalOrders || stats?.overview?.totalOrders || 0}</h2>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                                <i className="fas fa-receipt"></i>
                                            </div>
                                            <div className="stat-info">
                                                <span className="stat-label">Avg Order Value</span>
                                                <h2 className="stat-value">{formatINR(analyticsSales?.summary?.avgOrderValue || 0)}</h2>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                                                <i className="fas fa-tshirt"></i>
                                            </div>
                                            <div className="stat-info">
                                                <span className="stat-label">Total Products</span>
                                                <h2 className="stat-value">{stats?.overview?.totalProducts || 0}</h2>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                                        {/* Sales Trend Chart */}
                                        <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}><i className="fas fa-chart-line" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>Sales Trend ({analyticsPeriod === 'day' ? 'Last 30 Days' : analyticsPeriod === 'month' ? 'Monthly' : 'Yearly'})</h3>
                                            <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                                                <canvas ref={salesChartRef}></canvas>
                                            </div>
                                        </div>

                                        {/* Sales by Category Chart */}
                                        <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}><i className="fas fa-chart-pie" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>Sales by Category</h3>
                                            <div style={{ position: 'relative', height: '220px', width: '100%' }}>
                                                <canvas ref={categoryChartRef}></canvas>
                                            </div>
                                        </div>

                                        {/* Top Selling Products */}
                                        <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}><i className="fas fa-fire" style={{ color: '#ef4444', marginRight: '8px' }}></i>Top Selling Products</h3>
                                            <div className="low-stock-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                {(analyticsProducts?.topSelling || stats?.topSellingProducts || []).length > 0 ? (
                                                    (analyticsProducts?.topSelling || stats?.topSellingProducts || []).slice(0, 5).map((p, idx) => (
                                                        <div key={idx} className="low-stock-item" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                            <img src={p.productImage || 'https://via.placeholder.com/40'} alt={p.productName} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                                                            <div className="item-info">
                                                                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{p.productName}</h4>
                                                                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.totalSold || 0} sold · {formatINR(p.totalRevenue || 0)}</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">No sales data yet</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Products by Style */}
                                        <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}><i className="fas fa-layer-group" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>Products by Style</h3>
                                            <div className="metric-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {(analyticsProducts?.byCategory || []).length > 0 ? (
                                                    (analyticsProducts?.byCategory || []).map((item, idx) => (
                                                        <div key={idx} className="metric-row" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <span style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>{item._id || 'Uncategorized'}</span>
                                                            <strong style={{ fontSize: '0.875rem' }}>{item.count}</strong>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">No products categorised yet</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stock Health */}
                                        <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}><i className="fas fa-boxes" style={{ color: '#eab308', marginRight: '8px' }}></i>Stock Health</h3>
                                            <div className="metric-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {(analyticsProducts?.stockStatus || []).length > 0 ? (
                                                    (analyticsProducts?.stockStatus || []).map((item, idx) => (
                                                        <div key={idx} className="metric-row" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <span style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>{item._id}</span>
                                                            <strong style={{ fontSize: '0.875rem' }}>{item.count}</strong>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">No stock data yet</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Period Breakdown */}
                                        <div className="section-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '24px' }}>
                                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}><i className="fas fa-calendar-alt" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>Sales Breakdown</h3>
                                            <div className="bar-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                {(analyticsSales?.salesData || []).length > 0 ? (
                                                    (analyticsSales?.salesData || []).map((item, idx) => {
                                                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                                        const num = Number(item._id);
                                                        const periodLabel = (!isNaN(num) && num >= 1 && num <= 12) ? monthNames[num - 1] : String(item._id);
                                                        const maxSales = Math.max(...(analyticsSales?.salesData || []).map(s => s.totalSales || 1));
                                                        const percentage = Math.min(100, ((item.totalSales || 0) / maxSales) * 100);
                                                        return (
                                                            <div key={idx} className="bar-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                                                    <span>{periodLabel}</span>
                                                                    <strong>{formatINR(item.totalSales || 0)}</strong>
                                                                </div>
                                                                <div className="bar-track" style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', width: '100%' }}>
                                                                    <div className="bar-fill" style={{ width: `${percentage}%`, height: '100%', background: 'var(--gradient-primary) var(--primary)' }}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="empty-state">No sales data yet</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Settings Panel Tab */}
                            {activeTab === 'settings' && (
                                <form onSubmit={handleSettingsSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', width: '100%', gap: '15px' }}>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '1.6rem' }}><i className="fas fa-cog" style={{ color: 'var(--primary)', marginRight: '10px' }}></i>Site Settings</h2>
                                            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Manage website content, branding, dynamic banners, and pricing rules.</p>
                                        </div>
                                        <button type="submit" className="btn btn-sm" disabled={saving} style={{ background: 'var(--gradient-primary)', color: '#fff', border: 'none', display: 'inline-flex', gap: '8px', alignItems: 'center', width: 'auto', flexShrink: 0, cursor: 'pointer' }}>
                                            <i className="fas fa-save"></i> {saving ? 'Saving...' : 'Save All Changes'}
                                        </button>
                                    </div>

                                    <div className="settings-tabs">
                                        {['branding', 'homepage', 'contact', 'social'].map(cat => (
                                            <button 
                                                key={cat}
                                                type="button"
                                                className={`s-tab-btn ${settingsSubTab === cat ? 'active' : ''}`}
                                                onClick={() => setSettingsSubTab(cat)}
                                                style={{ textTransform: 'capitalize' }}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {rawSettings
                                            .filter(s => s.category === settingsSubTab)
                                            .map(setting => {
                                                const key = setting.key;
                                                const value = settings[key] !== undefined ? settings[key] : setting.value;

                                                let inputElement = null;

                                                if (setting.type === 'textarea') {
                                                    inputElement = (
                                                        <textarea 
                                                            className="form-control" 
                                                            value={value} 
                                                            onChange={(e) => handleSettingsValueChange(key, e.target.value)} 
                                                            rows="4"
                                                        />
                                                    );
                                                } else if (setting.type === 'image') {
                                                    inputElement = (
                                                        <div className="settings-input-wrapper">
                                                            <input 
                                                                type="text" 
                                                                className="form-control" 
                                                                value={value} 
                                                                onChange={(e) => handleSettingsValueChange(key, e.target.value)} 
                                                                placeholder="Image URL" 
                                                            />
                                                            <img 
                                                                src={value} 
                                                                className="image-preview-sm" 
                                                                onError={(e) => { e.target.src = 'https://via.placeholder.com/100'; }}
                                                            />
                                                        </div>
                                                    );
                                                } else if (setting.type === 'color') {
                                                    inputElement = (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <input 
                                                                type="color" 
                                                                value={value || '#000000'} 
                                                                onChange={(e) => handleSettingsValueChange(key, e.target.value)} 
                                                                style={{ width: '60px', height: '38px', padding: '2px', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                                                            />
                                                            <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{value}</span>
                                                        </div>
                                                    );
                                                } else if (key === 'enable_cod' || key === 'promo_banner_show') {
                                                    inputElement = (
                                                        <select 
                                                            className="form-control" 
                                                            value={String(value)} 
                                                            onChange={(e) => handleSettingsValueChange(key, e.target.value)}
                                                        >
                                                            <option value="true">Enable / Show</option>
                                                            <option value="false">Disable / Hide</option>
                                                        </select>
                                                    );
                                                } else {
                                                    inputElement = (
                                                        <input 
                                                            type={setting.type === 'number' ? 'number' : 'text'} 
                                                            className="form-control" 
                                                            value={value} 
                                                            onChange={(e) => handleSettingsValueChange(key, e.target.value)} 
                                                        />
                                                    );
                                                }

                                                return (
                                                    <div key={key} className="settings-item">
                                                        <label>{setting.label}</label>
                                                        {inputElement}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </main>
            
            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="admin-modal active">
                    <div className="modal-content order-modal-large" style={{ maxWidth: '850px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Order Details</h3>
                            <button className="modal-close" onClick={() => setSelectedOrder(null)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="order-detail-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px' }}>
                                <div className="order-detail-header-left">
                                    <h3>Order #{selectedOrder.orderNumber || selectedOrder._id?.slice(-6).toUpperCase()}</h3>
                                    <span>Placed on {formatDate(selectedOrder.createdAt)}</span>
                                </div>
                                <div className="order-detail-badges" style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                    <span className={`status-badge status-${selectedOrder.status}`}>{selectedOrder.status}</span>
                                    <span className={`status-badge status-${selectedOrder.paymentStatus || 'pending'}`}>{selectedOrder.paymentStatus || 'pending'}</span>
                                </div>
                            </div>

                            <div className="order-grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="order-info-section">
                                    <h4 className="order-section-title" style={{ margin: '0 0 10px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}><i className="fas fa-user"></i> Customer & Contact</h4>
                                    <div className="order-detail-card" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <p style={{ margin: '4px 0' }}><strong>Name:</strong> {selectedOrder.customer?.name || 'Guest'}</p>
                                        <p style={{ margin: '4px 0' }}><strong>Email:</strong> {selectedOrder.customer?.email || 'N/A'}</p>
                                        <p style={{ margin: '4px 0' }}><strong>Phone:</strong> {selectedOrder.customer?.phone || 'N/A'}</p>
                                        <p style={{ margin: '4px 0' }}><strong>Payment Method:</strong> {selectedOrder.paymentMethod || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="order-info-section">
                                    <h4 className="order-section-title" style={{ margin: '0 0 10px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}><i className="fas fa-truck"></i> Shipping Address</h4>
                                    <div className="order-detail-card" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <p style={{ margin: '4px 0' }}><strong>Street:</strong> {selectedOrder.shippingAddress?.street || 'N/A'}</p>
                                        <p style={{ margin: '4px 0' }}><strong>City:</strong> {selectedOrder.shippingAddress?.city || 'N/A'}</p>
                                        <p style={{ margin: '4px 0' }}><strong>State/ZIP:</strong> {selectedOrder.shippingAddress?.state || ''} {selectedOrder.shippingAddress?.zipCode || ''}</p>
                                        <p style={{ margin: '4px 0' }}><strong>Country:</strong> {selectedOrder.shippingAddress?.country || 'India'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="order-info-section" style={{ marginTop: '20px' }}>
                                <h4 className="order-section-title" style={{ margin: '0 0 10px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}><i className="fas fa-tshirt"></i> Products Ordered</h4>
                                <div className="order-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                                    {(selectedOrder.items || []).map((item, idx) => {
                                        const isCustom = item.productId?.startsWith('studio-') || (item.image && item.image.startsWith('data:image/')) || item.customDesign;
                                        return (
                                            <div key={idx} className="order-item-row" style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                <div className="order-item-media">
                                                    <img src={item.image || 'https://via.placeholder.com/70x70/eaeaea/999999?text=T-Shirt'} alt={item.name} style={{ width: '70px', height: '70px', borderRadius: '6px', objectFit: 'contain', background: '#fff' }} />
                                                </div>
                                                <div className="order-item-content" style={{ flexGrow: 1 }}>
                                                    <h4 className="order-item-title" style={{ margin: 0, fontSize: '0.95rem' }}>
                                                        {item.name}
                                                        {isCustom && <span className="custom-badge" style={{ marginLeft: '8px', fontSize: '0.75rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px' }}><i className="fas fa-magic"></i> Custom Design</span>}
                                                    </h4>
                                                    <p className="order-item-meta" style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        <span style={{ marginRight: '10px' }}>Size: <strong>{item.size || 'N/A'}</strong></span>
                                                        <span style={{ marginRight: '10px' }}>Color/Fabric: <strong>{item.color || 'N/A'}</strong></span>
                                                        <span>Qty: <strong>{item.quantity || 1}</strong></span>
                                                    </p>
                                                    {isCustom && item.customDesign && (
                                                        <div className="custom-preview-action" style={{ marginTop: '10px' }}>
                                                            <button className="btn btn-outline btn-sm" onClick={() => setSelectedItemForDesign(idx)}>
                                                                <i className="fas fa-search-plus"></i> View Design Options
                                                            </button>
                                                            {(() => {
                                                                if (item.customDesign.decals) {
                                                                    const uploads = item.customDesign.decals.filter(d => d.textureSrc && !d.textureText);
                                                                    if (uploads.length > 0) {
                                                                        return (
                                                                            <div style={{ marginTop: '10px' }}>
                                                                                <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Uploaded Images (Click to download):</small>
                                                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                                    {uploads.map((u, i) => (
                                                                                        <img 
                                                                                            key={i}
                                                                                            src={u.textureSrc} 
                                                                                            style={{ width: '60px', height: '60px', objectFit: 'contain', background: '#fff', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer', transition: '0.2s' }} 
                                                                                            onClick={() => downloadAsset(u.textureSrc, `customer-upload-${selectedOrder._id}-${i+1}.png`)}
                                                                                            title={`Download Image ${i+1}`}
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="order-item-pricing" style={{ textAlign: 'right', minWidth: '100px' }}>
                                                    <p className="order-item-price-unit" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatINR(item.price)} each</p>
                                                    <p className="order-item-price-total" style={{ margin: 0, fontWeight: '700' }}>{formatINR(item.price * item.quantity)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="order-summary-card" style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '600' }}>
                                <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span>Subtotal:</span>
                                    <span>{formatINR(selectedOrder.subtotal || selectedOrder.totalAmount)}</span>
                                </div>
                                {selectedOrder.discountAmount > 0 && (
                                    <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--success)' }}>
                                        <span>Discount:</span>
                                        <span>-{formatINR(selectedOrder.discountAmount)}</span>
                                    </div>
                                )}
                                <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span>Shipping:</span>
                                    <span>{selectedOrder.shippingFee === 0 ? 'FREE' : formatINR(selectedOrder.shippingFee)}</span>
                                </div>
                                <div className="summary-row total-row" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: '10px', fontSize: '1.1rem', fontWeight: '700' }}>
                                    <span>Total Amount:</span>
                                    <span style={{ color: 'var(--primary)' }}>{formatINR(selectedOrder.totalAmount)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <form onSubmit={handleTrackingSave} style={{ flex: 1, display: 'grid', gap: 8 }}>
                                <label htmlFor="shipment-number">Tracking number</label>
                                <input id="shipment-number" className="form-control" maxLength={120} value={trackingForm.trackingNumber} onChange={event => setTrackingForm(previous => ({ ...previous, trackingNumber: event.target.value }))} />
                                <label htmlFor="shipment-url">Carrier tracking link</label>
                                <input id="shipment-url" className="form-control" type="url" value={trackingForm.trackingUrl} onChange={event => setTrackingForm(previous => ({ ...previous, trackingUrl: event.target.value }))} />
                                <button className="btn btn-primary" disabled={actionBusy}>{actionBusy ? 'Saving…' : 'Save shipment tracking'}</button>
                                {selectedOrder.refundRequired && <p role="status">Refund pending: complete and reconcile this refund with the payment provider.</p>}
                            </form>
                            <button className="btn btn-outline" onClick={() => handlePrintOrder(selectedOrder)}>
                                <i className="fas fa-print"></i> Print Invoice
                            </button>
                            <button className="btn btn-primary" onClick={() => setSelectedOrder(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Design Previews Lightbox */}
            {selectedItemForDesign !== null && selectedOrder && (
                (() => {
                    const item = selectedOrder.items[selectedItemForDesign];
                    const cd = item?.customDesign;
                    if (!cd) return null;

                    const frontImg = cd.frontImage || item.image || '';
                    const backImg = cd.backImage || '';

                    // Gather raw artworks
                    const rawArtworks = [];
                    if (cd.frontLayers && Array.isArray(cd.frontLayers)) {
                        cd.frontLayers.forEach((l, i) => {
                            if (l.rawSrc) rawArtworks.push({ src: l.rawSrc, name: l.name || `Front Layer ${i + 1}`, side: 'Front' });
                        });
                    }
                    if (cd.backLayers && Array.isArray(cd.backLayers)) {
                        cd.backLayers.forEach((l, i) => {
                            if (l.rawSrc) rawArtworks.push({ src: l.rawSrc, name: l.name || `Back Layer ${i + 1}`, side: 'Back' });
                        });
                    }
                    if (rawArtworks.length === 0) {
                        if (cd.frontUpload) rawArtworks.push({ src: cd.frontUpload, name: 'Front Uploaded Image', side: 'Front' });
                        if (cd.backUpload) rawArtworks.push({ src: cd.backUpload, name: 'Back Uploaded Image', side: 'Back' });
                    }
                    if (rawArtworks.length === 0 && cd.decals && Array.isArray(cd.decals)) {
                        cd.decals.forEach((d, i) => {
                            if (d.textureSrc && !d.textureText) {
                                rawArtworks.push({ src: d.textureSrc, name: `Uploaded Artwork ${i + 1}`, side: 'Front/Back' });
                            }
                        });
                    }

                    const handleDownloadAll = () => {
                        const assetsToDownload = [];
                        const shortId = selectedOrder._id ? selectedOrder._id.slice(-6) : 'order';

                        if (cd.frontImage) assetsToDownload.push({ src: cd.frontImage, filename: `front-3d-preview-${shortId}.png` });
                        if (cd.backImage) assetsToDownload.push({ src: cd.backImage, filename: `back-3d-preview-${shortId}.png` });

                        rawArtworks.forEach((art, idx) => {
                            assetsToDownload.push({ src: art.src, filename: `${art.side.toLowerCase()}-artwork-${idx + 1}-${shortId}.png` });
                        });

                        if (assetsToDownload.length === 0) {
                            if (item.image) downloadAsset(item.image, `product-${shortId}.png`);
                            return;
                        }

                        if (window.Utils?.showToast) window.Utils.showToast(`Downloading ${assetsToDownload.length} files...`, 'info');
                        assetsToDownload.forEach((asset, idx) => {
                            setTimeout(() => {
                                downloadAsset(asset.src, asset.filename);
                            }, idx * 300);
                        });
                    };

                    return (
                        <div className="design-lightbox active">
                            <button className="lightbox-close-btn" onClick={() => setSelectedItemForDesign(null)}>&times;</button>
                            <div className="lightbox-content">
                                <h3 className="lightbox-title">{item.name} – Design Preview</h3>
                                
                                <div className="lightbox-shirt-preview" style={{ width: '100%' }}>
                                    <div className="preview-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
                                        <button className={`btn btn-outline ${lightboxSide === 'front' ? 'active' : ''}`} onClick={() => setLightboxSide('front')}><i className="fas fa-arrow-up"></i> Front View</button>
                                        <button className={`btn btn-outline ${lightboxSide === 'back' ? 'active' : ''}`} onClick={() => setLightboxSide('back')}><i className="fas fa-arrow-down"></i> Back View</button>
                                        <button className={`btn btn-outline ${lightboxSide === '3d' ? 'active' : ''}`} onClick={() => setLightboxSide('3d')}><i className="fas fa-cube"></i> 3D View</button>
                                        {rawArtworks.length > 0 && (
                                            <button className={`btn btn-outline ${lightboxSide === 'raw' ? 'active' : ''}`} onClick={() => setLightboxSide('raw')}><i className="fas fa-image"></i> Raw Artworks ({rawArtworks.length})</button>
                                        )}
                                        <button className="btn btn-outline" onClick={handleDownloadAll}><i className="fas fa-download"></i> Download All Assets</button>
                                    </div>

                                    {lightboxSide === '3d' && (
                                        <div ref={lightbox3DRef} style={{ height: '60vh', background: '#f5f5f5', borderRadius: '8px', position: 'relative', overflow: 'hidden', width: '100%' }} />
                                    )}

                                    {lightboxSide === 'front' && (
                                        <div style={{ textAlign: 'center' }}>
                                            <img src={frontImg} alt="Front View" style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block', margin: '0 auto', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', objectFit: 'contain' }} />
                                        </div>
                                    )}

                                    {lightboxSide === 'back' && (
                                        <div style={{ textAlign: 'center' }}>
                                            {backImg ? (
                                                <img src={backImg} alt="Back View" style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block', margin: '0 auto', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No back side design for this order.</div>
                                            )}
                                        </div>
                                    )}

                                    {lightboxSide === 'raw' && (
                                        <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                                            <h4 style={{ margin: '0 0 15px 0', fontSize: '15px', textAlign: 'center' }}><i className="fas fa-file-image"></i> Raw Customer Upload Artwork</h4>
                                            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {rawArtworks.map((art, idx) => (
                                                    <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', width: '220px', textAlign: 'center' }}>
                                                        <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '140px' }}>
                                                            <img src={art.src} alt={art.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                        </div>
                                                        <p style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 10px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{art.side}: {art.name}</p>
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                            <button className="btn btn-sm btn-primary" onClick={() => downloadAsset(art.src, `${art.side.toLowerCase()}-artwork-${idx + 1}.png`)}>
                                                                <i className="fas fa-download"></i> Download
                                                            </button>
                                                            <a href={art.src} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">
                                                                <i className="fas fa-external-link-alt"></i> View
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}

            {productPendingDelete && <ConfirmDialog title="Remove product from sale?" message="This product will be hidden from the shop. Existing order history is retained." confirmLabel="Remove" onCancel={() => setProductPendingDelete(null)} onConfirm={() => { handleProductDelete(productPendingDelete); setProductPendingDelete(null); }} />}
            {pendingAction && <ConfirmDialog title={pendingAction.title} message={pendingAction.message} confirmLabel={pendingAction.confirmLabel || 'Confirm'} onCancel={() => setPendingAction(null)} onConfirm={() => { pendingAction.run(); setPendingAction(null); }} />}
        </div>
    );
};

export default AdminDashboard;
