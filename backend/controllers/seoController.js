// controllers/seoController.js

const Product = require('../models/Product');

exports.getSitemap = async (req, res) => {
    try {
        const baseUrl = 'http://localhost:5000';
        const products = await Product.find({ isActive: true }).select('_id updatedAt');
        
        const staticPages = [
            '',
            '/shop.html',
            '/studio.html',
            '/oversized-tshirts.html',
            '/premium-cotton-tshirts.html',
            '/bulk-cotton-tshirts.html',
            '/support.html',
            '/faq.html',
            '/shipping-policy.html',
            '/returns-exchanges.html',
            '/privacy-policy.html',
            '/terms-of-service.html',
            '/login.html',
            '/register.html'
        ];
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        staticPages.forEach(page => {
            xml += '  <url>\n';
            xml += `    <loc>${baseUrl}${page}</loc>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
            xml += '  </url>\n';
        });
        
        products.forEach(product => {
            xml += '  <url>\n';
            xml += `    <loc>${baseUrl}/product.html?id=${product._id}</loc>\n`;
            xml += `    <lastmod>${new Date(product.updatedAt).toISOString()}</lastmod>\n`;
            xml += `    <changefreq>daily</changefreq>\n`;
            xml += `    <priority>0.9</priority>\n`;
            xml += '  </url>\n';
        });
        
        xml += '</urlset>';
        
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        console.error('Sitemap error:', error);
        res.status(500).send('Error generating sitemap');
    }
};

exports.getRobotsTxt = (req, res) => {
    const baseUrl = 'http://localhost:5000';
    
    let txt = 'User-agent: *\n';
    txt += 'Allow: /\n';
    txt += 'Disallow: /api/\n';
    txt += 'Disallow: /profile.html\n';
    txt += 'Disallow: /admin.html\n';
    txt += 'Disallow: /checkout.html\n';
    txt += `Sitemap: ${baseUrl}/sitemap.xml\n`;
    
    res.header('Content-Type', 'text/plain');
    res.send(txt);
};
