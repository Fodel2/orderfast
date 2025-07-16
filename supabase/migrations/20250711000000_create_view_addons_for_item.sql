CREATE OR REPLACE VIEW view_addons_for_item AS
SELECT
  ial.item_id,
  ag.id AS addon_group_id,
  ag.name AS addon_group_name,
  ag.required,
  ag.multiple_choice,
  ao.id AS addon_option_id,
  ao.name AS addon_option_name,
  ao.price
FROM item_addon_links ial
JOIN addon_groups ag ON ag.id = ial.group_id
LEFT JOIN addon_options ao ON ao.group_id = ag.id AND ao.available = true;
