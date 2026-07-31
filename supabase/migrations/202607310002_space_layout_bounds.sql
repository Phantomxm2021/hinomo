alter table public.space_layouts
  drop constraint if exists space_layouts_y_percent_check,
  drop constraint if exists space_layouts_height_percent_check;

alter table public.space_layouts
  add constraint space_layouts_y_percent_check
    check (y_percent between 0 and 90),
  add constraint space_layouts_height_percent_check
    check (height_percent between 10 and 50);
