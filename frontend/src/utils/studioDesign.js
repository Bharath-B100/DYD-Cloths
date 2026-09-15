// Keep decoded images in memory for undo. Serializing DOM images turns them into {}.
export const cloneDesigns = (designs) => Object.fromEntries(['front', 'back'].map(side => [
    side,
    (designs[side] || []).map(layer => ({
        ...layer,
        ...(layer.textStyle ? { textStyle: { ...layer.textStyle } } : {}),
        ...(layer.textSettings ? { textSettings: { ...layer.textSettings } } : {})
    }))
]));

export const serializeDesigns = (designs) => Object.fromEntries(['front', 'back'].map(side => [
    side, (designs[side] || []).map(({ img: _img, ...layer }) => layer)
]));

export const studioPriceSetting = (value, fallback) => value !== '' && value != null &&
    Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;

export function validateDraft(value) {
    if (!value || value.version !== 1 || !/^#[a-f\d]{6}$/i.test(value.shirtColor || '') ||
        !['100% Cotton', 'Poly Cotton', 'Dry Fit', 'Premium Cotton', 'Organic Cotton'].includes(value.fabric) ||
        !['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].includes(value.size) ||
        !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 99) {
        throw new Error('This is not a supported studio draft.');
    }
    for (const side of ['front', 'back']) {
        if (!Array.isArray(value.designs?.[side]) || value.designs[side].length > 30) {
            throw new Error('A draft can contain up to 30 layers on each side.');
        }
        for (const layer of value.designs[side]) {
            if (!layer || !['image', 'text'].includes(layer.type) || typeof layer.rawSrc !== 'string' ||
                !/^(data:image\/(png|jpeg|webp);base64,|https?:\/\/)/i.test(layer.rawSrc) ||
                !Number.isFinite(layer.x) || layer.x < 0 || layer.x > 1 ||
                !Number.isFinite(layer.y) || layer.y < 0 || layer.y > 1 ||
                !Number.isFinite(layer.scale) || layer.scale < 0.1 || layer.scale > 3 ||
                !Number.isFinite(layer.rotation)) {
                throw new Error('This draft contains an invalid design layer.');
            }
        }
    }
    return value;
}
