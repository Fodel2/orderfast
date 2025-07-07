import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

export default function MenuBuilder() {
  const [session, setSession] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
      }
    };
    getSession();
  }, []);

  if (!session) return <p>Loading...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Menu Builder</h1>
      <p>Here you'll manage categories, items, and addons.</p>
    </div>
  );
}
import { useState } from 'react';

export default function MenuBuilder() {
  const [categories, setCategories] = useState<string[]>([]);

  const addCategory = () => {
    const name = prompt("Enter category name:");
    if (name) {
      setCategories([...categories, name]);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: 'auto' }}>
      <h1>Menu Builder</h1>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={addCategory}>+ Add Category</button>
        <button style={{ marginLeft: '1rem' }}>+ Add Item</button>
        <button style={{ marginLeft: '1rem' }}>+ Manage Add-ons</button>
      </div>

      {categories.length === 0 ? (
        <p>No categories yet. Click "Add Category" to get started.</p>
      ) : (
        categories.map((cat, index) => (
          <div key={index} style={{ padding: '0.5rem', border: '1px solid #ccc', marginBottom: '0.5rem' }}>
            <strong>{cat}</strong>
          </div>
        ))
      )}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

export default function MenuBuilder() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
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

    fetchCategories();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Menu Builder</h1>
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
