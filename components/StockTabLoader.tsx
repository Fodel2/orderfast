import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import StockTab, { StockTabProps } from './StockTab';

interface Row {
  category_id: string;
  category_name: string;
  item_id: string;
  item_name: string;
  stock_status: 'in_stock' | 'scheduled' | 'out';
  stock_return_date: string | null;
}

export default function StockTabLoader() {
  const [categories, setCategories] = useState<StockTabProps['categories']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const query = `\
SELECT
  c.id AS category_id,
  c.name AS category_name,
  i.id AS item_id,
  i.name AS item_name,
  i.stock_status,
  i.stock_return_date
FROM menu_categories c
JOIN menu_items i ON i.category_id = c.id;`;
      const { data, error } = await supabase.rpc('sql', { query });
      if (error) {
        console.error('Failed to fetch stock data', error);
        setError(error.message);
        setLoading(false);
        return;
      }

      const map = new Map<string, { id: string; name: string; items: StockTabProps['categories'][0]['items'] }>();
      (data as Row[] | null)?.forEach((row) => {
        if (!map.has(row.category_id)) {
          map.set(row.category_id, { id: row.category_id, name: row.category_name, items: [] });
        }
        map.get(row.category_id)!.items.push({
          id: row.item_id,
          name: row.item_name,
          stock_status: row.stock_status,
          stock_return_date: row.stock_return_date,
        });
      });
      const mapped = Array.from(map.values());
      console.log('Mapped stock result', mapped);
      setCategories(mapped);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return <StockTab categories={categories} />;
}
