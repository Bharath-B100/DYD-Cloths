// src/pages/Shop.jsx - Catalog Collection Shop Page
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../config/api';
import ProductCard from '../components/ProductCard';
import { productPrice } from '../utils/cart';
import '../styles/shop.css';

const parseFilterValues = (value) => value
    ? value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean)
    : [];

const normalizeProductValues = (value) => Array.isArray(value)
    ? value.map(item => String(item).toLowerCase())
    : parseFilterValues(typeof value === 'string' ? value : '');

const Shop = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const searchQuery = searchParams.get('search') || '';
    const selectedTypes = parseFilterValues(searchParams.get('type') || searchParams.get('productTypes'));
    const selectedCategories = parseFilterValues(searchParams.get('category'));
    const selectedCatalogs = parseFilterValues(searchParams.get('catalog') || searchParams.get('catalogTypes'));
    const selectedPriceRange = searchParams.get('price') || 'all';
    const selectedSort = searchParams.get('sort') || 'new';
    const setFilter = (key, value) => {
        setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            if (value && value !== 'all' && value !== 'new') next.set(key, value); else next.delete(key);
            if (key === 'type') next.delete('productTypes');
            return next;
        });
    };
    const setSelectedPriceRange = value => setFilter('price', value);
    const setSelectedSort = value => setFilter('sort', value);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        const fetchAll = async () => {
            try {
                let page = 1;
                let totalPages = 1;
                const products = [];
                do {
                    const res = await API.get(`/products?page=${page}&limit=100`);
                    if (cancelled) return;
                    if (!res.success) throw new Error(res.error || 'Unable to load products.');
                    const batch = res.data?.products || res.data?.data || res.data;
                    if (!Array.isArray(batch)) throw new Error('The catalog response was invalid.');
                    products.push(...batch);
                    totalPages = Number(res.totalPages ?? res.data?.totalPages ?? 1);
                    if (batch.length === 0) break;
                    page++;
                } while (page <= totalPages);
                setAllProducts(Array.from(new Map(products.map(product => [product._id || product.id, product])).values()));
            } catch (err) {
                if (!cancelled) setError(err.message || 'Unable to load the catalog.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchAll();
        return () => { cancelled = true; };
    }, [reload]);

    // Apply filter/sort whenever products or filter selections update
    const filteredProducts = useMemo(() => {
        let result = [...allProducts];

        // Search match
        if (searchQuery.trim()) {
            const sq = searchQuery.trim().toLowerCase();
            result = result.filter(p => 
                (p.name && p.name.toLowerCase().includes(sq)) || 
                (p.category && p.category.toLowerCase().includes(sq)) ||
                (p.description && p.description.toLowerCase().includes(sq)) ||
                normalizeProductValues(p.tags).some(tag => tag.includes(sq))
            );
        }

        // Product Types match
        if (selectedTypes.length > 0) {
            result = result.filter(p => 
                normalizeProductValues(p.productTypes).some(type => selectedTypes.includes(type))
            );
        }

        // Category match
        if (selectedCategories.length > 0) {
            result = result.filter(p => 
                p.category && selectedCategories.includes(p.category.toLowerCase())
            );
        }

        // Legacy catalog pages use catalogTypes (oversized, premium-cotton, bulk-cotton).
        if (selectedCatalogs.length > 0) {
            result = result.filter(p =>
                normalizeProductValues(p.catalogTypes).some(catalog => selectedCatalogs.includes(catalog))
            );
        }

        // Price range match
        if (selectedPriceRange !== 'all') {
            result = result.filter(p => {
                const price = productPrice(p);
                if (selectedPriceRange === 'under-500') return price < 500;
                if (selectedPriceRange === '500-1000') return price >= 500 && price <= 1000;
                if (selectedPriceRange === 'over-1000') return price > 1000;
                return true;
            });
        }

        // Sort match
        if (selectedSort === 'low') {
            result.sort((a, b) => productPrice(a) - productPrice(b));
        } else if (selectedSort === 'high') {
            result.sort((a, b) => productPrice(b) - productPrice(a));
        } else if (selectedSort === 'new') {
            result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else if (selectedSort === 'popular') {
            result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }

        return result;
    }, [allProducts, searchQuery, selectedTypes, selectedCategories, selectedCatalogs, selectedPriceRange, selectedSort]);

    const handleTypeCheckbox = type => setFilter('type', (selectedTypes.includes(type) ? selectedTypes.filter(value => value !== type) : [...selectedTypes, type]).join(','));
    const handleCategoryCheckbox = category => setFilter('category', (selectedCategories.includes(category) ? selectedCategories.filter(value => value !== category) : [...selectedCategories, category]).join(','));
    const resetFilters = () => setSearchParams({});

    return (
        <div className="shop-page">
            <section className="page-header shop-hero">
                <div className="container">
                    <h1>Our <span className="highlight">Collection</span></h1>
                    <p>Premium quality custom t-shirts for every occasion</p>
                </div>
            </section>

            <div className="shop-container">
                {/* Filters Sidebar */}
                <aside className="filters-sidebar">
                    <div className="filter-section">
                        <h3>Storefront Categories</h3>
                        <div className="filter-options">
                            <label className="filter-option">
                                <input 
                                    type="checkbox" 
                                    checked={selectedTypes.includes('men')}
                                    onChange={() => handleTypeCheckbox('men')}
                                /> Men's T-Shirts
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="checkbox" 
                                    checked={selectedTypes.includes('women')}
                                    onChange={() => handleTypeCheckbox('women')}
                                /> Women's T-Shirts
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="checkbox" 
                                    checked={selectedTypes.includes('kids')}
                                    onChange={() => handleTypeCheckbox('kids')}
                                /> Kids' T-Shirts
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="checkbox" 
                                    checked={selectedTypes.includes('performance')}
                                    onChange={() => handleTypeCheckbox('performance')}
                                /> Performance Tees
                            </label>
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3>Style</h3>
                        <div className="filter-options">
                            <label className="filter-option">
                                <input 
                                    type="checkbox" 
                                    checked={selectedCategories.includes('graphic')}
                                    onChange={() => handleCategoryCheckbox('graphic')}
                                /> Graphic
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="checkbox" 
                                    checked={selectedCategories.includes('plain')}
                                    onChange={() => handleCategoryCheckbox('plain')}
                                /> Plain
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="checkbox" 
                                    checked={selectedCategories.includes('sports')}
                                    onChange={() => handleCategoryCheckbox('sports')}
                                /> Sports
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="checkbox" 
                                    checked={selectedCategories.includes('custom')}
                                    onChange={() => handleCategoryCheckbox('custom')}
                                /> Custom
                            </label>
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3>Price Range</h3>
                        <div className="filter-options">
                            <label className="filter-option">
                                <input 
                                    type="radio" 
                                    name="price" 
                                    checked={selectedPriceRange === 'all'}
                                    onChange={() => setSelectedPriceRange('all')}
                                /> All Prices
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="radio" 
                                    name="price" 
                                    checked={selectedPriceRange === 'under-500'}
                                    onChange={() => setSelectedPriceRange('under-500')}
                                /> Under ₹500
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="radio" 
                                    name="price" 
                                    checked={selectedPriceRange === '500-1000'}
                                    onChange={() => setSelectedPriceRange('500-1000')}
                                /> ₹500 - ₹1,000
                            </label>
                            <label className="filter-option">
                                <input 
                                    type="radio" 
                                    name="price" 
                                    checked={selectedPriceRange === 'over-1000'}
                                    onChange={() => setSelectedPriceRange('over-1000')}
                                /> Over ₹1,000
                            </label>
                        </div>
                    </div>

                    <button className="btn btn-outline btn-full" onClick={resetFilters} style={{ marginTop: '1.25rem' }}>Clear All Filters</button>
                </aside>

                {/* Products Area */}
                <main className="shop-content">
                    <div className="shop-header">
                        <p>
                            {searchQuery ? `Results for “${searchQuery}”: ` : 'Showing '}<span className="count-badge">{filteredProducts.length}</span> Products
                        </p>
                        <div className="sort-wrapper">
                            <label htmlFor="sortSelect">Sort by:</label>
                            <select 
                                id="sortSelect" 
                                className="sort-select"
                                value={selectedSort}
                                onChange={(e) => setSelectedSort(e.target.value)}
                            >
                                <option value="new">Newest Arrivals</option>
                                <option value="popular">Popularity</option>
                                <option value="low">Price: Low to High</option>
                                <option value="high">Price: High to Low</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading-state" style={{ textAlign: 'center', padding: '60px' }}>
                            <i className="fas fa-spinner fa-spin fa-2x"></i> Loading products...
                        </div>
                    ) : error ? <div role="alert" className="no-results"><p>{error}</p><button className="btn btn-primary" onClick={() => setReload(value => value + 1)}>Try again</button></div> : (
                        <div className="products-grid">
                            {filteredProducts.map(prod => (
                                <ProductCard key={prod._id || prod.id} product={prod} />
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="no-results" style={{ textAlign: 'center', padding: '60px' }}>
                                    <i className="fas fa-search fa-3x" style={{ opacity: 0.3, marginBottom: '16px' }}></i>
                                    <p>No products found matching your criteria.</p>
                                    <button onClick={resetFilters} className="btn btn-outline" style={{ marginTop: '12px' }}>Reset Filters</button>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Shop;
