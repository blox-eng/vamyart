import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const pieces = [
  {
    slug: "whispers",
    year: 2026,
    medium: "Oil on canvas",
    dimensions: null,
    excerpt: `Muted abstract seascape with warm tones and stormy sea textures, capturing the quiet intensity of coastal weather.`,
    description: `Muted abstract seascape with warm, earthy tones and stormy sea textures. This piece captures the quiet intensity of coastal weather through subtle color gradations and textured brushwork. The warm palette suggests late afternoon light filtering through clouds, while the turbulent lower section conveys the restless energy of the sea. Painted with oil on canvas to achieve depth and richness in the muted color range.`,
    seoTitle: `Whispers`,
    seoDescription: `Whispers - Muted abstract seascape with warm tones and stormy sea textures, painted with oil on canvas.`,
    sortOrder: 0,
  },
  {
    slug: "first-contact",
    year: 2025,
    medium: "Oil on canvas",
    dimensions: null,
    excerpt: `This painting is inspired by humanity's drive to break barriers and chase what seems out of reach. To anyone out there with a dream: stay bold, aim high, stay on aim, don't give up.`,
    description: `This painting is inspired by humanity's drive to break barriers and chase what seems out of reach. To anyone out there with a dream: stay bold, aim high, stay on aim, don't give up.`,
    seoTitle: `First Contact`,
    seoDescription: `First Contact - A painting inspired by humanity's drive to break barriers and chase what seems out of reach.`,
    sortOrder: 1,
  },
  {
    slug: "on-the-horizon",
    year: 2026,
    medium: "Acrylic on canvas",
    dimensions: "90 × 70 cm",
    excerpt: `Abstract seascape exploring the boundary between sea and sky, painted with acrylic on canvas to capture the luminous quality of coastal light.`,
    description: `Abstract seascape exploring the boundary between sea and sky. The piece captures the luminous quality of coastal light with textured brushwork in the upper portion suggesting atmospheric depth, while the lower section features dark, moody tones punctuated by white wave foam. Painted with acrylic on canvas to achieve both the bold contrast and delicate light effects characteristic of seascapes.`,
    seoTitle: `On the Horizon`,
    seoDescription: `On the Horizon - Abstract seascape exploring the boundary between sea and sky with acrylic on canvas.`,
    sortOrder: 2,
  },
];

async function main() {
  for (const p of pieces) {
    const res = await sql`
      update artworks set
        excerpt = ${p.excerpt},
        description = ${p.description},
        year = ${p.year},
        medium = ${p.medium},
        dimensions = ${p.dimensions},
        seo_title = ${p.seoTitle},
        seo_description = ${p.seoDescription},
        published = true,
        sort_order = ${p.sortOrder},
        updated_at = now()
      where slug = ${p.slug}
      returning id`;
    if (res.length === 0) console.warn(`No artworks row for slug "${p.slug}" — skipped.`);
    else console.log(`Updated ${p.slug}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
