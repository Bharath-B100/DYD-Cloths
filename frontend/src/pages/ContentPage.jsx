import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/content-page.css';
import { useAuth } from '../context/AuthContext';
import API from '../config/api';

const pages = {
    '/faq': {
        title: 'Frequently Asked Questions',
        intro: 'Quick answers before you place an order.',
        sections: [
            ['Can I upload my own design?', 'Yes. Use Design Studio to add images, text, colours, size and fabric, then preview your T-shirt before adding it to your cart.'],
            ['What are custom T-shirt prices?', 'The Design Studio displays the current fabric price plus charges for text elements and sides with images. Your checkout quote confirms the final total, discount and shipping before you place an order.'],
            ['Do you take bulk orders?', 'Yes. We accept bulk, school, event and team orders. Contact support with your quantity and design requirements.']
        ]
    },
    '/support': {
        title: 'Support', intro: 'We are here to help with your order or design.',
        sections: [['Order help', 'Use Track Order with your order number and checkout email, or contact us if you need assistance.'], ['Custom designs', 'For help preparing a design or a bulk order, please share your requirements with our support team.']]
    },
    '/shipping-policy': {
        title: 'Shipping Policy', intro: 'Clear delivery information for every order.',
        sections: [['Processing', 'Custom products are made after the order is confirmed. Processing and delivery estimates are displayed with your order status.'], ['Tracking', 'When tracking details are available, they appear in the Track Order page.']]
    },
    '/returns-exchanges': {
        title: 'Returns & Exchanges', intro: 'We want you to be happy with your order.',
        sections: [['Before contacting us', 'Keep your order number and photos of the item ready so we can review your request quickly.'], ['Custom products', 'Because custom items are made specifically for you, eligibility may depend on the issue reported.']]
    },
    '/privacy-policy': {
        title: 'Privacy Policy', intro: 'How your account and order information is used.',
        sections: [['Information we use', 'We use the details you provide to create your account, fulfil orders, provide support and improve the store.'], ['Your account', 'Keep your password private and contact support if you believe your account has been accessed without permission.']]
    },
    '/terms-of-service': {
        title: 'Terms of Service', intro: 'The terms for using the DYD-Clothes storefront.',
        sections: [['Orders', 'Orders are subject to product availability, design approval where applicable, and payment confirmation.'], ['Acceptable content', 'You are responsible for ensuring designs you upload do not infringe rights or violate applicable laws.']]
    }
};

export default function ContentPage() {
    const pathname = useLocation().pathname;
    const page = pages[pathname] || pages['/faq'];
    const { settings } = useAuth();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const unsubscribe = async event => {
        event.preventDefault(); setBusy(true);
        try { const response = await API.post('/unsubscribe', { email }); setMessage(response.message); }
        catch (error) { setMessage(error.message); }
        finally { setBusy(false); }
    };
    return (
        <div className="content-page">
            <header className="page-header">
                <div className="container">
                    <h1>{page.title}</h1>
                    <p>{page.intro}</p>
                </div>
            </header>
            <main className="container content-shell">
                <section className="content-panel">
                    {page.sections.map(([heading, text]) => (
                        <React.Fragment key={heading}>
                            <h3>{heading}</h3>
                            <p>{text}</p>
                        </React.Fragment>
                    ))}
                    {pathname === '/support' && <div>
                        <h3>Contact the store</h3>
                        <p><a href={`mailto:${settings?.contact_email || 'ngtbharath@gmail.com'}`}>{settings?.contact_email || 'ngtbharath@gmail.com'}</a></p>
                        {settings?.contact_phone && <p><a href={`tel:${settings.contact_phone.replace(/[^+\d]/g, '')}`}>{settings.contact_phone}</a></p>}
                        <p><Link to="/track-order">Track your order</Link></p>
                    </div>}
                    {pathname === '/privacy-policy' && <form onSubmit={unsubscribe} style={{ marginTop: 24 }}>
                        <h3>Unsubscribe from the newsletter</h3>
                        <label htmlFor="unsubscribe-email">Email address</label>
                        <input className="form-control" id="unsubscribe-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} />
                        <button className="btn btn-outline" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Updating…' : 'Unsubscribe'}</button>
                        {message && <p role="status">{message}</p>}
                    </form>}
                    <div style={{ marginTop: '2rem' }}>
                        <Link to="/shop" className="btn btn-primary">Continue shopping</Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
