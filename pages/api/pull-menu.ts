import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import cheerio from 'cheerio';

interface Item {
  name: string;
  description: string;
  price: number;
}

interface Category {
  name: string;
  items: Item[];
}

function parseMenuItems(data: any): Item[] {
  if (!data) return [];
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((it) => ({
    name: it.name || '',
    description: it.description || '',
    price: parseFloat(it.offers?.price || it.price || '0') || 0,
  }));
}

function extractFromJsonLd(obj: any): Category[] {
  const categories: Category[] = [];
  function traverse(node: any) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(traverse);
      return;
    }
    if (typeof node !== 'object') return;
    if (node['@type'] === 'MenuSection') {
      if (node.hasMenuItem) {
        categories.push({
          name: node.name || 'Menu',
          items: parseMenuItems(node.hasMenuItem),
        });
      }
      if (node.hasMenuSection) traverse(node.hasMenuSection);
    } else {
      Object.values(node).forEach(traverse);
    }
  }
  traverse(obj);
  return categories;
}

function parseHtml(html: string): Category[] {
  const $ = cheerio.load(html);
  const categories: Category[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    try {
      const json = JSON.parse(text);
      const cats = extractFromJsonLd(json);
      if (cats.length) categories.push(...cats);
    } catch (err) {
      // ignore
    }
  });
  return categories;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body as { url?: string };
  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  try {
    const response = await axios.get(url);
    const categories = parseHtml(response.data as string);
    if (!categories.length) {
      return res
        .status(400)
        .json({ error: 'Unable to parse menu from provided link' });
    }
    return res.status(200).json({ categories });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch or parse menu' });
  }
}
