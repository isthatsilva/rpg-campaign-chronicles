import { useState } from 'react';
import { api } from '../api.js';

// list + create/update/remove for one per-character resource (attributes, equipment or journal).
// each call returns the server error so forms can show field messages.
export function useChildResource(characterId, path, initialItems, sort) {
    const [items, setItems] = useState(initialItems);
    const base = `/characters/${characterId}/${path}`;
    const apply = (next) => setItems(sort ? [...next].sort(sort) : next);

    return {
        items,
        async create(body) {
            const { item } = await api.post(base, body);
            apply([...items, item]);
            return item;
        },
        async update(id, body) {
            const { item } = await api.put(`${base}/${id}`, body);
            apply(items.map((it) => (it.id === id ? item : it)));
            return item;
        },
        async remove(id) {
            await api.del(`${base}/${id}`);
            apply(items.filter((it) => it.id !== id));
        },
    };
}
