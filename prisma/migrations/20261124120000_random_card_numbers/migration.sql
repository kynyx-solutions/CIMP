-- ID-card numbers become random (CB-YYYY-XXXXXXXX) instead of sequential, so the public
-- verification page cannot be used to list card holders. Renumber the cards issued so far.
UPDATE "IdCard" c
SET "number" = substr(c."number", 1, 8) || (
  SELECT string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 32)::int, 1), '')
  FROM generate_series(1, 8) g
  WHERE c."id" IS NOT NULL -- correlated, so every row gets its own code
)
WHERE c."number" ~ '^CB-[0-9]{4}-[0-9]{4,6}$';
