-- Migração de dados: remove o benefício "Desconto em produtos selecionados" (parceiro) dos planos.
-- Regra: tira de packages.perks todo item cujo título começa com "Desconto em produtos".
UPDATE "packages"
SET "perks" = COALESCE(
  (SELECT jsonb_agg(p) FROM jsonb_array_elements("perks") AS p WHERE NOT (coalesce(p->>'title', '') ILIKE 'Desconto em produtos%')),
  '[]'::jsonb
)
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("perks") AS p WHERE coalesce(p->>'title', '') ILIKE 'Desconto em produtos%');
