import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

export default function MenuBuilder() {
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        fetchCategories();
      }
    };

    getSession();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error.message);
    } else {
      setCategories(data);
    }
    setLoading(false);
  };

  const addCategory = async () => {
    const name = prompt('Enter category name:');
    if (!name) return;

    const { error } = await supabase
      .from('menu_categories')
      .insert([{ name, description: '', sort_order: categories.length }]);

    if (error) {
      console.error('Error adding category:', error.message);
    } else {
      fetchCategories(); // Refresh after adding
    }
  };

  if (!session) return <p>Loading session...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Menu Builder</h1>
      <p>Here you'll manage categories, items, and addons.</p>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={addCategory}>+ Add Category</button>
      </div>

      {loading ? (
        <p>Loading categories...</p>
      ) : (
        <ul>
          {categories.map((cat) => (
            <li key={cat.id}>
              <strong>{cat.name}</strong>: {cat.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
