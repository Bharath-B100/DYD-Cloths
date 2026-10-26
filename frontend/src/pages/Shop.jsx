// src/pages/Shop.jsx - Catalog Collection Shop Page
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../config/api';
import ProductCard from '../components/ProductCard';
import '../styles/shop.css';

const parseFilterValues = (value) => value
    ? value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean)
    : [];

const Shop = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [catalog, setCatalog] = useState({ products: [], total: 0, page: 1, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const resultsRef = useRef(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
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
            next.delete('page');
            return next;
        });
    };
    const setSelectedPriceRange = value => setFilter('price', value);
    const setSelectedSort = value => setFilter('sort', value);

    const requestParams = new URLSearchParams(searchParams);
    if (selectedTypes.length) requestParams.set('type', selectedTypes.join(','));
    if (selectedCatalogs.length) requestParams.set('catalog', selectedCatalogs.join(','));
    requestParams.delete('productTypes');
    requestParams.delete('catalogTypes');
    requestParams.set('limit', '12');
    const requestQuery = requestParams.toString();
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        API.get(`/products?${requestQuery}`, { signal: controller.signal }).then(res => {
            if (cancelled) return;
            if (!res.success || !Array.isArray(res.data)) throw new Error(res.error || 'The catalog response was invalid.');
            setCatalog({ products: res.data, total: res.total, page: res.currentPage, pages: Math.max(1, res.totalPages) });
        }).catch(err => {
            if (!cancelled) setError(err.message || 'Unable to load the catalog.');
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; controller.abort(); };
    }, [requestQuery, reload]);
    const visibleProducts = catalog.products;
    const pageCount = catalog.pages;
    const currentPage = catalog.page;
    const changePage = page => {
        setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            if (page === 1) next.delete('page'); else next.set('page', String(page));
            return next;
        });
        resultsRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    };

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
                <button className="btn btn-outline mobile-filter-toggle" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(!filtersOpen)}>{filtersOpen ? 'Hide filters' : 'Show filters'} ({selectedTypes.length + selectedCategories.length + selectedCatalogs.length + (selectedPriceRange !== 'all' ? 1 : 0)})</button>
                <aside id="catalog-filters" className={`filters-sidebar ${filtersOpen ? 'filters-open' : ''}`}>
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
                <div className="shop-content" ref={resultsRef} aria-busy={loading}>
                    <div className="shop-header">
                        <p>
                            {loading ? 'Loading products…' : error ? 'Catalog unavailable' : <>{searchQuery ? `Results for “${searchQuery}”: ` : 'Showing '}<span className="count-badge">{catalog.total}</span> Products</>}
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
                            {visibleProducts.map(prod => (
                                <ProductCard key={prod._id || prod.id} product={prod} />
                            ))}
                            {catalog.total === 0 && (
                                <div className="no-results">
                                    <i className="fas fa-search fa-3x" style={{ opacity: 0.3, marginBottom: '16px' }}></i>
                                    <p>No products found matching your criteria.</p>
                                    <button onClick={resetFilters} className="btn btn-outline" style={{ marginTop: '12px' }}>Reset Filters</button>
                                </div>
                            )}
                        </div>
                    )}
                    {!loading && !error && pageCount > 1 && <nav className="pagination" aria-label="Product pages">
                        <button className="btn btn-outline" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Previous</button>
                        <span aria-live="polite">Page {currentPage} of {pageCount}</span>
                        <button className="btn btn-outline" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>Next</button>
                    </nav>}
                </div>
            </div>
        </div>
    );
};

export default Shop;
