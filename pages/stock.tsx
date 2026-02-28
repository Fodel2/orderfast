import StockTab from '../components/StockTab';

export default function StockPage() {
  const categories = [
    {
      id: '1',
      name: 'Burgers',
      items: [
        {
          id: 'b1',
          name: 'Cheeseburger',
          stock_status: 'in_stock' as const,
          stock_return_date: null,
        },
        {
          id: 'b2',
          name: 'Veggie Burger',
          stock_status: 'scheduled' as const,
          stock_return_date: new Date().toISOString(),
        },
      ],
    },
    {
      id: '2',
      name: 'Drinks',
      items: [
        {
          id: 'd1',
          name: 'Cola',
          stock_status: 'out' as const,
          stock_return_date: null,
        },
        {
          id: 'd2',
          name: 'Lemonade',
          stock_status: 'in_stock' as const,
          stock_return_date: null,
        },
        {
          id: 'd3',
          name: 'Iced Tea',
          stock_status: 'scheduled' as const,
          stock_return_date: new Date().toISOString(),
        },
      ],
    },
  ];

  const addons = [
    {
      id: 'a1',
      name: 'Cheese',
      stock_status: 'in_stock' as const,
      stock_return_date: null,
      group_id: 'g1',
      group_name: 'Toppings',
    },
    {
      id: 'a2',
      name: 'Bacon',
      stock_status: 'out' as const,
      stock_return_date: null,
      group_id: 'g1',
      group_name: 'Toppings',
    },
    {
      id: 'a3',
      name: 'Avocado',
      stock_status: 'scheduled' as const,
      stock_return_date: new Date().toISOString(),
      group_id: 'g2',
      group_name: 'Sauces',
    },
  ];

  return (
    <div className="p-4">
      <StockTab categories={categories} addons={addons} />
    </div>
  );
}

