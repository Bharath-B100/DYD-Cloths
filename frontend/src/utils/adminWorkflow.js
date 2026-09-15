export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// Printing writes an HTML document; all customer-controlled text needs escaping.
export function escapeInvoiceData(value) {
    if (Array.isArray(value)) return value.map(escapeInvoiceData);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, escapeInvoiceData(field)]));
    return typeof value === 'string' ? escapeHtml(value) : value;
}

export const orderStatusChoices = status => [status, ...({
    pending: ['confirmed', 'processing', 'cancelled'],
    confirmed: ['processing', 'shipped', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: []
}[status] || [])];

export async function fetchAdminProducts(api) {
    const products = [];
    let page = 1;
    let totalPages = 1;
    do {
        const response = await api.get(`/admin/products?page=${page}&limit=100`);
        if (!response.success) throw new Error(response.error || 'Could not load products.');
        products.push(...(response.data?.products || response.data || []));
        totalPages = Number(response.totalPages || response.pagination?.totalPages || 1);
        page += 1;
    } while (page <= totalPages);
    return { success: true, data: products };
}
