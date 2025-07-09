import type { NextApiRequest, NextApiResponse } from 'next';

interface Item {
  name: string;
  description: string;
  price: number;
}

interface Category {
  name: string;
  items: Item[];
}

/**
 * Dummy endpoint that simulates scraping a menu from the provided URL.
 * In a real application this would fetch the remote page and parse it.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body as { url?: string };
  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  // Example static data used instead of real scraping
  const categories: Category[] = [
    {
      name: 'Burgers',
      items: [
        {
          name: 'Classic Burger',
          description: 'Beef patty with lettuce and tomato',
          price: 8.99,
        },
        {
          name: 'Veggie Burger',
          description: 'Black bean patty with fixings',
          price: 7.49,
        },
      ],
    },
    {
      name: 'Drinks',
      items: [
        { name: 'Cola', description: 'Chilled can', price: 1.99 },
        { name: 'Lemonade', description: 'Freshly squeezed', price: 2.49 },
      ],
    },
  ];

  // Simulate a small delay so the loading animation is visible
  setTimeout(() => {
    res.status(200).json({ categories });
  }, 500);
}
