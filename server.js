require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();



app.use(express.static(__dirname));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    if (req.method === 'OPTIONS') {
         return res.sendStatus(204);
    }
    next();
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/search', async (req, res) => {
    try {
        const response = await fetch(
            `https://api.search.tinyfish.ai?query=${encodeURIComponent(req.query.topic || 'AI research papers')}`,
            {
                headers: {
                    'X-API-Key': process.env.TINYFISH_API_KEY
                }
            }
        );

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/papers', async (req, res) => {
    try {
        const topic = (req.query.topic || '').trim();

        if (!topic) {
            return res.status(400).json({ error: 'Please provide a topic.' });
        }

        const url = new URL('https://api.openalex.org/works');
        url.searchParams.set('search', topic);
        url.searchParams.set('filter', 'from_publication_date:2023-01-01,to_publication_date:2026-11-01,type:article');
        url.searchParams.set('per_page', '10');
        url.searchParams.set('sort', 'publication_date:desc');
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        const results = (data.results || [])
        .filter(p => p.publication_year >= 2023 && p.publication_year <= 2026)
        .map(p => ({
            title: p.title || 'Untitled',
            year: p.publication_year || 'Year unavailable',
            authors: (p.authorships || [])
                .slice(0, 3)
                .map(a => a.author?.display_name)
                .filter(Boolean)
                .join(', ') || 'Authors unavailable',
            url: p.primary_location?.landing_page_url || p.doi || p.id,
            pdf: p.open_access?.oa_url || p.primary_location?.pdf_url || null,
            isOpenAccess: Boolean(p.open_access?.is_oa),
            citations: p.cited_by_count ?? 0,
            doi: p.doi || null
        }));

        res.json({
            query: topic,
            results,
            total_results: data.meta?.count ?? results.length
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3001, () => {
    console.log('PaperTrail running at http://localhost:3001');
});