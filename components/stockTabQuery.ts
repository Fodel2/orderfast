export const STOCK_TAB_QUERY = `
SELECT
  c.id AS category_id,
  c.name AS category_name,
  i.id AS item_id,
  i.name AS item_name,
  i.stock_status,
  i.stock_return_date
FROM menu_categories c
JOIN menu_items i ON i.category_id = c.id
WHERE c.archived_at IS NULL AND i.archived_at IS NULL
ORDER BY c.sort_order NULLS LAST, c.name ASC, i.sort_order NULLS LAST, i.name ASC;`;
