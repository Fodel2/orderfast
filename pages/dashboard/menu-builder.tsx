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
      }
    };
    getSession();
  }, []);

  useEffect(() => {
    if (session) {
      fetchCategories();
    }
  }, [session]);

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

  const addCategory = async () => {
    const name = prompt("Enter category name:");
    if (name) {
      const { data, error } = await supabase
        .from('menu_categories')
        .insert([{ name, description: '', sort_order: categories.length + 1 }]);

      if (error) {
        console.error('Error adding category:', error.message);
      } else {
        fetchCategories(); // Refresh list
      }
    }
  };

  if (!session) return <p>Loading...</p>;

    return (
  <div style={{ padding: '2rem' }}>

