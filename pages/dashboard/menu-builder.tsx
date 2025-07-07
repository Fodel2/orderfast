import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

export default function MenuBuilder() {
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        fetchData();
      }
    };

    getSession();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: categoriesData, error: catError } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    const { data: itemsData, error: itemsError } = await supabase
      .from('menu_items')
      .select('*')
      .order('name', { ascending: true });

    if (catError || itemsError) {
      console.error('Error fetching data:', catError || itemsError);
    } else {
      setCategories(categoriesData);
      setItems(itemsData);
    }

    setLoading(false);
  };

  if (!session) return <p>Loading session...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Menu Builder</h1>
      <p>Manage categories and items here.</p>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {categories.map((cat) => (
            <div key={cat.id} style={{ marginBottom: '2rem' }}>
              <h2>{cat.name}</h2>
              <p>{cat.description}</p>
              <ul>
                {items
                  .filter(item => item.category_id === cat.id)
                  .map(item => (
                    <li key={item.id}>
                      <strong>{item.name}</strong> – ${item.price.toFixed(2)}<br />
                      <small>{item.description}</small>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
