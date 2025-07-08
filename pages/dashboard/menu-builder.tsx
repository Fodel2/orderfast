import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function MenuBuilder() {
  // Session and data state
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const [catError, setCatError] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [itemError, setItemError] = useState('');

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
    // eslint-disable-next-line
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: categoriesData } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    const { data: itemsData } = await supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true });
    setCategories(categoriesData || []);
    setItems(itemsData || []);
    setLoading(false);
  };

  // --- Category Modal Logic ---
  function CategoryModal({ open, onClose, onSubmit, initial, error }) {
    const [name, setName] = useState(initial?.name || '');
    const [description, setDescription] = useState(initial?.description || '');

    useEffect(() => {
      setName(initial?.name || '');
      setDescription(initial?.description || '');
    }, [initial, open]);

    if (!open) return null;
    return (
      <div className="modal">
        <h3>{initial ? 'Edit' : 'Add'} Category</h3>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => onSubmit({ name, description })}>{initial ? 'Save' : 'Create'}</button>
          <button onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
        <style jsx>{`
          .modal { background: #fff; border: 1px solid #ccc; padding: 1rem; position: fixed; top: 20%; left: 50%; transform: translate(-50%, 0); z-index: 999; }
        `}</style>
      </div>
    );
  }

  // --- Item Modal Logic ---
  function AddItemModal({ open, onClose, onSubmit, initial, categories, error }) {
    const [name, setName] = useState(initial?.name || '');
    const [description, setDescription] = useState(initial?.description || '');
    const [price, setPrice] = useState(initial?.price || '');
    const [categoryId, setCategoryId] = useState(initial?.category_id || categories[0]?.id);
    const [is18, setIs18] = useState(initial?.is_18_plus || false);
    const [vegan, setVegan] = useState(initial?.vegan || false);
    const [vegetarian, setVegetarian] = useState(initial?.vegetarian || false);
    const [outOfStock, setOutOfStock] = useState(initial?.out_of_stock || false);

    useEffect(() => {
      setName(initial?.name || '');
      setDescription(initial?.description || '');
      setPrice(initial?.price || '');
      setCategoryId(initial?.category_id || categories[0]?.id);
      setIs18(initial?.is_18_plus || false);
      setVegan(initial?.vegan || false);
      setVegetarian(initial?.vegetarian || false);
      setOutOfStock(initial?.out_of_stock || false);
    }, [initial, categories, open]);

    if (!open) return null;
    return (
      <div className="modal">
        <h3>{initial ? 'Edit' : 'Add'} Item</h3>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <input type="number" step="0.01" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} />
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label><input type="checkbox" checked={is18} onChange={e => setIs18(e.target.checked)} /> 18+</label>
        <label><input type="checkbox" checked={vegan} onChange={e => setVegan(e.target.checked)} /> Vegan</label>
        <label><input type="checkbox" checked={vegetarian} onChange={e => setVegetarian(e.target.checked)} /> Vegetarian</label>
        <label><input type="checkbox" checked={outOfStock} onChange={e => setOutOfStock(e.target.checked)} /> Out of Stock</label>
        {error && <div style={{ color: 'red', marginTop: '0.5rem' }}>{error}</div>}
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() =>
            onSubmit({
              name,
              description,
              price: parseFloat(price),
              category_id: Number(categoryId),
              is_18_plus: is18,
              vegan,
              vegetarian,
              out_of_stock: outOfStock,
            })
          }>{initial ? 'Save' : 'Create'}</button>
          <button onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
        <style jsx>{`
          .modal { background: #fff; border: 1px solid #ccc; padding: 1rem; position: fixed; top: 20%; left: 50%; transform: translate(-50%, 0); z-index: 999; }
        `}</style>
      </div>
    );
  }

  // Handlers for add/edit/delete category
  const handleAddCategory = async (cat: any) => {
    setCatError('');
    try {
      const { error } = await supabase.from('menu_categories').insert([{
        ...cat,
        sort_order: categories.length
      }]);
      if (error) throw error;
      setShowCatModal(false);
      fetchData();
    } catch (err: any) {
      setCatError(err.message || 'Something went wrong');
    }
  };
  const handleEditCategory = async (cat: any) => {
    setCatError('');
    try {
      const { error } = await supabase.from('menu_categories').update({
        name: cat.name,
        description: cat.description
      }).eq('id', editCat.id);
      if (error) throw error;
      setEditCat(null);
      setShowCatModal(false);
      fetchData();
    } catch (err: any) {
      setCatError(err.message || 'Something went wrong');
    }
  };
  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Delete this category?")) return;
    const { error } = await supabase.from('menu_categories').delete().eq('id', id);
    if (error) alert(error.message);
    fetchData();
  };

  // Handlers for add/edit/delete items
  const handleAddItem = async (item: any) => {
    setItemError('');
    try {
      const catItems = items.filter(i => i.category_id === item.category_id);
      const { error } = await supabase.from('menu_items').insert([{
        ...item,
        sort_order: catItems.length
      }]);
      if (error) throw error;
      setShowItemModal(false);
      fetchData();
    } catch (err: any) {
      setItemError(err.message || 'Something went wrong');
    }
  };
  const handleEditItem = async (item: any) => {
    setItemError('');
    try {
      const { error } = await supabase.from('menu_items').update({
        name: item.name,
        description: item.description,
        price: item.price,
        category_id: item.category_id,
        is_18_plus: item.is_18_plus,
        vegan: item.vegan,
        vegetarian: item.vegetarian,
        out_of_stock: item.out_of_stock
      }).eq('id', editItem.id);
      if (error) throw error;
      setEditItem(null);
      setShowItemModal(false);
      fetchData();
    } catch (err: any) {
      setItemError(err.message || 'Something went wrong');
    }
  };
  const handleDeleteItem = async (id: number) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) alert(error.message);
    fetchData();
  };

  // Drag and drop reorder handlers
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    // Reorder categories
    if (result.type === 'category') {
      const reordered = Array.from(categories);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);

      setCategories(reordered);
      // update sort_order in DB
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('menu_categories').update({ sort_order: i }).eq('id', reordered[i].id);
      }
      fetchData();
      return;
    }

    // Reorder items within the same category
    const catId = parseInt(result.source.droppableId.split('-')[1]);
    const filteredItems = items.filter(i => i.category_id === catId);
    const reorderedItems = Array.from(filteredItems);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    for (let i = 0; i < reorderedItems.length; i++) {
      await supabase.from('menu_items').update({ sort_order: i }).eq('id', reorderedItems[i].id);
    }
    fetchData();
  };

  if (!session) return <p>Loading session...</p>;
  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Menu Builder</h1>
      <button onClick={() => { setEditCat(null); setShowCatModal(true); setCatError(''); }}>Add Category</button>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="categories" type="category">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {categories.map((cat, catIdx) => (
                <Draggable key={cat.id} draggableId={'cat-' + cat.id} index={catIdx}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={{
                        border: '1px solid #ccc', margin: '1rem 0', padding: '1rem', ...provided.draggableProps.style
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span {...provided.dragHandleProps} style={{ marginRight: 8, cursor: 'grab' }}>☰</span>
                        <h2 style={{ flex: 1 }}>{cat.name}</h2>
                        <button onClick={() => { setEditCat(cat); setShowCatModal(true); setCatError(''); }}>Edit</button>
                        <button onClick={() => handleDeleteCategory(cat.id)}>Delete</button>
                        <button onClick={() => { setEditItem(null); setSelectedCat(cat.id); setShowItemModal(true); setItemError(''); }} style={{ marginLeft: 8 }}>Add Item</button>
                      </div>
                      <p>{cat.description}</p>
                      {/* List items in category */}
                      <Droppable droppableId={`cat-${cat.id}`} type="item">
                        {(itemProvided) => (
                          <ul ref={itemProvided.innerRef} {...itemProvided.droppableProps}>
                            {items.filter(i => i.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order).map((item, itemIdx) => (
                              <Draggable key={item.id} draggableId={'item-' + item.id} index={itemIdx}>
                                {(dragProvided) => (
                                  <li
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    style={{
                                      border: '1px solid #eee', margin: '0.5rem 0', padding: '0.5rem', display: 'flex', alignItems: 'center', ...dragProvided.draggableProps.style
                                    }}
                                  >
                                    <span {...dragProvided.dragHandleProps} style={{ marginRight: 8, cursor: 'grab' }}>≡</span>
                                    <div style={{ flex: 1 }}>
                                      <strong>{item.name}</strong> – ${item.price?.toFixed(2)}
                                      {item.out_of_stock && <span style={{ color: 'red', marginLeft: 8 }}>(Out of Stock)</span>}
                                      <br />
                                      <small>{item.description}</small>
                                      <br />
                                      {item.is_18_plus && <span style={{ color: 'orange', marginRight: 8 }}>18+</span>}
                                      {item.vegan && <span style={{ color: 'green', marginRight: 8 }}>Vegan</span>}
                                      {item.vegetarian && <span style={{ color: 'limegreen', marginRight: 8 }}>Vegetarian</span>}
                                    </div>
                                    <button onClick={() => { setEditItem(item); setShowItemModal(true); setItemError(''); }}>Edit</button>
                                    <button onClick={() => handleDeleteItem(item.id)}>Delete</button>
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {itemProvided.placeholder}
                          </ul>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {/* Modals */}
      <CategoryModal
        open={showCatModal}
        onClose={() => { setShowCatModal(false); setEditCat(null); setCatError(''); }}
        onSubmit={editCat ? handleEditCategory : handleAddCategory}
        initial={editCat}
        error={catError}
      />
      <AddItemModal
        open={showItemModal}
        onClose={() => { setShowItemModal(false); setEditItem(null); setSelectedCat(null); setItemError(''); }}
        onSubmit={editItem ? handleEditItem : handleAddItem}
        initial={editItem || (selectedCat ? { category_id: selectedCat } : undefined)}
        categories={categories}
        error={itemError}
      />
    </div>
  );
}
