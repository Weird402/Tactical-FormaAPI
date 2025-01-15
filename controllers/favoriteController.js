const db = require('../config/db'); // Підключаємо базу даних
const MEDIA_BASE_URL=process.env.URL;


const favoriteController = {

    // Отримати список обраних продуктів з медіа
    getFavorites: (req, res) => {
        const favoriteIds = req.cookies.favorites ? JSON.parse(req.cookies.favorites) : [];
    
        if (favoriteIds.length > 0) {
            const query = `
                SELECT 
                    p.product_id, 
                    p.name, 
                    p.description, 
                    p.price,  
                    p.category_id, 
                    p.created_at,  
                    pm.media_url, 
                    pm.media_type, 
                    pm.color_id
                FROM products p
                LEFT JOIN product_media pm ON p.product_id = pm.product_id
                WHERE p.product_id IN (?)
                ORDER BY pm.color_id IS NULL, pm.color_id
            `;
    
            db.query(query, [favoriteIds], (err, results) => {
                if (err) {
                    res.status(500).json({ error: 'Failed to retrieve favorites: ' + err.message });
                } else {
                    // Структуруємо результати
                    const favorites = results.reduce((acc, row) => {
                        const productId = row.product_id;
    
                        if (!acc[productId]) {
                            acc[productId] = {
                                product_id: row.product_id,
                                name: row.name,
                                description: row.description,
                                price: row.price,
                                category_id: row.category_id,
                                created_at: row.created_at,
                                media: []
                            };
                        }
    
                        // Додаємо медіа до списку
                        if (row.media_url) {
                            acc[productId].media.push({
                                media_url: `${MEDIA_BASE_URL}${row.media_url}`,
                                media_type: row.media_type
                            });
                        }
    
                        return acc;
                    }, {});
    
                    res.json({ favorites: Object.values(favorites) });
                }
            });
        } else {
            res.json({ favorites: [] });
        }
    },
    
    

    // Додати товар до обраних
    addToFavorites: (req, res) => {
        const product_id = req.params.product_id; // Отримуємо product_id з параметрів URL
        let favorites = req.cookies.favorites ? JSON.parse(req.cookies.favorites) : [];
    
        if (!favorites.includes(product_id)) {
            favorites.push(product_id);
        }
    
        // Оновлюємо cookies
        res.cookie('favorites', JSON.stringify(favorites), { httpOnly: true, maxAge: 7 * 86400 * 1000  });
        res.json({ message: 'Product added to favorites', favorites });
    },
    // Видалити товар з обраних
    removeFromFavorites: (req, res) => {
        const { product_id } = req.params;
        let favorites = req.cookies.favorites ? JSON.parse(req.cookies.favorites) : [];
        favorites = favorites.filter(id => id !== product_id);

        res.cookie('favorites', JSON.stringify(favorites), { httpOnly: true, maxAge: 7 * 86400 * 1000  });
        res.json({ message: 'Product removed from favorites', favorites });
    }
};

module.exports = favoriteController;


