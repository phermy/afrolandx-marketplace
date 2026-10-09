import type { Category } from '@/types';
import { ArrowUpRight, Gem, House, Scissors, Shirt, Flower2 } from 'lucide-react';
import textilesImage from '@/assets/catalog/category-textiles.jpg';
import craftImage from '@/assets/catalog/category-craft.jpg';
import fashionImage from '@/assets/catalog/category-fashion.jpg';
import homeImage from '@/assets/catalog/category-home.jpg';
import accessoriesImage from '@/assets/catalog/category-accessories.jpg';
import beautyImage from '@/assets/catalog/category-beauty.jpg';
import asoOkeImage from '@/assets/catalog/category-aso-oke.jpg';
import beadsImage from '@/assets/catalog/category-beads-jewelry.jpg';
import footwearImage from '@/assets/catalog/category-footwear.jpg';

interface CatalogCategoryStripProps {
  categories: Category[];
  selectedCategory: number | null;
  onSelect: (categoryId: number | null) => void;
}

const categoryArt = [
  'catalog-art--indigo',
  'catalog-art--clay',
  'catalog-art--ochre',
  'catalog-art--leaf',
  'catalog-art--plum',
  'catalog-art--sand',
];
const categoryIcons = [Shirt, Scissors, Gem, House, Flower2];
const categoryInspiration: Record<string, string> = {
  'ankara-kente': textilesImage,
  'aso-oke': asoOkeImage,
  'traditional-wear': fashionImage,
  accessories: accessoriesImage,
  'beads-jewelry': beadsImage,
  footwear: footwearImage,
  'home-crafts': homeImage,
  'beauty-wellness': beautyImage,
  crafts: craftImage,
  handcrafts: craftImage,
  others: '',
};

export default function CatalogCategoryStrip({ categories, selectedCategory, onSelect }: CatalogCategoryStripProps) {
  if (!categories.length) return null;

  return (
    <section className="catalog-categories" aria-labelledby="catalog-categories-title">
      <div className="catalog-section-heading">
        <div>
          <p className="catalog-eyebrow">Find your thread</p>
          <h2 id="catalog-categories-title">Browse by craft</h2>
        </div>
        <span className="catalog-section-note">A living directory of African style &amp; making</span>
      </div>
      <div className="catalog-category-rail">
        {categories.map((category, index) => {
          const Icon = categoryIcons[index % categoryIcons.length];
          const isSelected = selectedCategory === category.id;
          const inspirationImage = categoryInspiration[category.slug];
          return (
            <button
              key={category.id}
              type="button"
              className={`catalog-category-tile ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelect(isSelected ? null : category.id)}
              aria-pressed={isSelected}
            >
              <span className={`catalog-category-art ${categoryArt[index % categoryArt.length]} ${inspirationImage ? 'has-photo' : ''}`} aria-hidden="true">
                {inspirationImage ? <img src={inspirationImage} alt="" /> : (
                  <>
                    <span className="catalog-art-shape catalog-art-shape--one" />
                    <span className="catalog-art-shape catalog-art-shape--two" />
                    <span className="catalog-art-mark"><Icon size={25} strokeWidth={1.5} /></span>
                    <span className="catalog-art-index">{String(index + 1).padStart(2, '0')}</span>
                  </>
                )}
              </span>
              <span className="catalog-category-copy">
                <span className="catalog-category-kicker">{category.slug === 'others' ? 'Abstract' : 'Inspiration'}</span>
                <span className="catalog-category-name">{category.name}</span>
                <span className="catalog-category-description">{category.description || 'Explore this collection'}</span>
              </span>
              <ArrowUpRight className="catalog-category-arrow" size={17} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}