// controllers/seoController.js

const Product = require('../models/Product');

exports.getSitemap = async (req, res) => {
    try {
        const baseUrl = (process.env.PUBLIC_SITE_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/&/g, '&amp;');
        const products = await Product.find({ isActive: true }).select('_id updatedAt');
        
        const staticPages = [
            '',
            '/shop',
            '/studio',
            '/shop?catalog=oversized',
            '/shop?catalog=premium-cotton',
            '/shop?catalog=bulk-cotton',
            '/support',
            '/faq',
            '/shipping-policy',
            '/returns-exchanges',
            '/privacy-policy',
            '/terms-of-service',
            '/login',
            '/register'
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
            xml += `    <loc>${baseUrl}/product/${product._id}</loc>\n`;
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
    const baseUrl = (process.env.PUBLIC_SITE_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/&/g, '&amp;');
    
    let txt = 'User-agent: *\n';
    txt += 'Allow: /\n';
    txt += 'Disallow: /api/\n';
    txt += 'Disallow: /profile\n';
    txt += 'Disallow: /admin\n';
    txt += 'Disallow: /checkout\n';
    txt += `Sitemap: ${baseUrl}/sitemap.xml\n`;
    
    res.header('Content-Type', 'text/plain');
    res.send(txt);
};
