-- The mobile floor plan supports dragging a card's lower-right corner to any
-- valid size. Keep persistence bounds in sync with that direct manipulation.
alter table public.space_layouts
  drop constraint if exists space_layouts_x_percent_check,
  drop constraint if exists space_layouts_y_percent_check,
  drop constraint if exists space_layouts_width_percent_check,
  drop constraint if exists space_layouts_height_percent_check;

alter table public.space_layouts
  add constraint space_layouts_x_percent_check
    check (x_percent between 0 and 100),
  add constraint space_layouts_y_percent_check
    check (y_percent between 0 and 100),
  add constraint space_layouts_width_percent_check
    check (width_percent between 8 and 100),
  add constraint space_layouts_height_percent_check
    check (height_percent between 8 and 100);
