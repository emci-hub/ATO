-- Wave 40: two new profile categories.
-- Structure vs. spontaneity is a map (openness x conscientiousness are traded off
-- against each other in the onboarding scenario, same reason Love/Independence are
-- maps rather than bars). Resilience under pressure is a bar (all three axes
-- reinforce rather than trade off).

insert into public.category_defs (id, name, shape, axis_weights, min_axes_required_stable, texture_axes) values
  ('cat_structure', 'Structure vs. spontaneity', 'map',
    '{"openness":1,"conscientiousness":1}'::jsonb, 2, '{}'),
  ('cat_resilience', 'Resilience under pressure', 'bar',
    '{"competence":1,"growth_mindset":1,"steadiness":1}'::jsonb, 2, '{}')
on conflict (id) do update set
  name = excluded.name,
  shape = excluded.shape,
  axis_weights = excluded.axis_weights,
  min_axes_required_stable = excluded.min_axes_required_stable,
  texture_axes = excluded.texture_axes;
