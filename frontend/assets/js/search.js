/**
 * DYD-Cloths Search with Autocomplete
 */

document.addEventListener('DOMContentLoaded', () => {
    Search.init();
});

const Search = {
    searchInput: null,
    suggestionsContainer: null,
    debounceTimer: null,
    currentQuery: '',

    init: () => {
        Search.searchInput = document.getElementById('searchInput');
        Search.suggestionsContainer = document.getElementById('searchSuggestions');
        
        if (!Search.searchInput) return;
        
        Search.setupEventListeners();
    },

    setupEventListeners: () => {
        Search.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            Search.currentQuery = query;
            
            if (Search.debounceTimer) clearTimeout(Search.debounceTimer);
            
            if (query.length >= 2) {
                Search.debounceTimer = setTimeout(() => {
                    Search.fetchSuggestions(query);
                }, 300);
            } else {
                Search.hideSuggestions();
            }
        });
        
        Search.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                Search.hideSuggestions();
                window.location.href = `shop.html?search=${encodeURIComponent(Search.currentQuery)}`;
            }
        });
        
        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!Search.searchInput?.contains(e.target) && 
                !Search.suggestionsContainer?.contains(e.target)) {
                Search.hideSuggestions();
            }
        });
    },

    fetchSuggestions: async (query) => {
        try {
            const response = await API.get(`/search/suggest?q=${encodeURIComponent(query)}&limit=5`);
            
            if (response.success) {
                Search.renderSuggestions(response.data);
            }
        } catch (error) {
            console.error('Search suggestions error:', error);
            Search.hideSuggestions();
        }
    },

    renderSuggestions: (data) => {
        if (!Search.suggestionsContainer) return;
        
        const { products, categories } = data;
        
        if (products.length === 0 && categories.length === 0) {
            Search.hideSuggestions();
            return;
        }
        
        let html = '';
        
        // Product suggestions
        if (products.length > 0) {
            html += `<div class="suggestion-divider">Products</div>`;
            html += products.map(product => `
                <div class="suggestion-item" onclick="Search.goToProduct('${product._id}')">
                    <img src="${product.mainImage}" alt="${product.name}" class="suggestion-img">
                    <div class="suggestion-info">
                        <div class="suggestion-name">${Utils.escapeHtml(product.name)}</div>
                        <div class="suggestion-category">${product.category || 'T-shirt'}</div>
                    </div>
                    <div class="suggestion-price">${Utils.formatINR(product.price)}</div>
                </div>
            `).join('');
        }
        
        // Category suggestions
        if (categories.length > 0) {
            html += `<div class="suggestion-divider">Categories</div>`;
            html += categories.map(category => `
                <div class="category-suggestion" onclick="Search.goToCategory('${category}')">
                    <i class="fas fa-tag"></i>
                    <span>${Utils.escapeHtml(category)}</span>
                </div>
            `).join('');
        }
        
        // View all results link
        html += `
            <div class="suggestion-item" onclick="Search.viewAllResults()">
                <i class="fas fa-search"></i>
                <div class="suggestion-info">
                    <div class="suggestion-name">View all results for "${Utils.escapeHtml(Search.currentQuery)}"</div>
                </div>
                <i class="fas fa-arrow-right"></i>
            </div>
        `;
        
        Search.suggestionsContainer.innerHTML = html;
        Search.suggestionsContainer.classList.add('active');
    },

    hideSuggestions: () => {
        if (Search.suggestionsContainer) {
            Search.suggestionsContainer.classList.remove('active');
            Search.suggestionsContainer.innerHTML = '';
        }
    },

    goToProduct: (productId) => {
        window.location.href = `product.html?id=${productId}`;
    },

    goToCategory: (category) => {
        window.location.href = `shop.html?category=${encodeURIComponent(category)}`;
    },

    viewAllResults: () => {
        window.location.href = `shop.html?search=${encodeURIComponent(Search.currentQuery)}`;
    }
};

window.Search = Search;