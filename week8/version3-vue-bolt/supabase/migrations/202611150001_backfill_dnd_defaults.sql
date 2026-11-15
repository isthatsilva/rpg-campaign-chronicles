-- one-time backfill: characters with no attributes get the six d&d defaults (each 10).
-- run this ONCE in the supabase sql editor, after 202611020001_create_rpg_chronicles.sql.
-- it only touches characters that have no attributes at all, so running it again later would
-- also refill characters whose owner has since removed every attribute; don't re-run it.
INSERT INTO public.character_attributes (character_id, name, value, position)
SELECT c.id, d.name, '10', d.position
FROM public.characters c
CROSS JOIN (VALUES ('Strength', 0), ('Dexterity', 1), ('Constitution', 2),
                   ('Intelligence', 3), ('Wisdom', 4), ('Charisma', 5)) AS d(name, position)
WHERE NOT EXISTS (SELECT 1 FROM public.character_attributes a WHERE a.character_id = c.id);
