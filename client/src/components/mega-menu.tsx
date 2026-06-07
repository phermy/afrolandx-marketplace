import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ChevronDown } from 'lucide-react';

interface MenuLink { label: string; href: string; }
interface MenuColumn { heading: string; links: MenuLink[]; }
interface MenuSection { featured: MenuLink[]; columns: MenuColumn[]; }

const MENU: Record<string, MenuSection> = {
  Women: {
    featured: [
      { label: 'Discover Women', href: '/products?gender=women' },
      { label: 'New In', href: '/products?gender=women' },
      { label: 'Sale', href: '/products?gender=women' },
    ],
    columns: [
      {
        heading: 'Traditional Dresses',
        links: [
          { label: 'Shop All Women\'s', href: '/products?gender=women' },
          { label: 'Ankara Dress', href: '/products?search=ankara+dress&gender=women' },
          { label: 'Boubou & Kaftan', href: '/products?search=boubou+kaftan' },
          { label: 'Aso Oke Sets', href: '/products?search=aso+oke' },
          { label: 'George Wrappers', href: '/products?search=george+wrapper' },
          { label: 'Adire & Tie-Dye', href: '/products?search=adire' },
          { label: 'Lace Gowns', href: '/products?search=lace+gown' },
        ],
      },
      {
        heading: 'Accessories',
        links: [
          { label: 'Shop All Accessories', href: '/products?search=accessories' },
          { label: 'Coral Beads', href: '/products?search=coral+beads' },
          { label: 'Headwear & Gele', href: '/products?search=gele' },
          { label: 'Jewellery Sets', href: '/products?search=jewellery' },
          { label: 'Waist Beads', href: '/products?search=waist+beads' },
          { label: 'Handbags', href: '/products?search=bag' },
        ],
      },
      {
        heading: 'By Occasion',
        links: [
          { label: 'Traditional Wedding', href: '/events' },
          { label: 'Owambe & Festival', href: '/products?search=owambe' },
          { label: 'Church & Sunday Best', href: '/products?search=church' },
          { label: 'Naming Ceremony', href: '/products?search=naming' },
          { label: 'Birthday & Party', href: '/products?search=party' },
        ],
      },
      {
        heading: 'By Heritage',
        links: [
          { label: 'Yoruba Styles', href: '/products?search=yoruba' },
          { label: 'Igbo Fashion', href: '/products?search=igbo' },
          { label: 'Hausa Fashion', href: '/products?search=hausa' },
          { label: '🇬🇭 Ghanaian Kente', href: '/products?originCountry=Ghana' },
          { label: '🇰🇪 Kenyan Styles', href: '/products?originCountry=Kenya' },
          { label: '🇸🇳 Senegalese Wear', href: '/products?originCountry=Senegal' },
        ],
      },
    ],
  },

  Men: {
    featured: [
      { label: 'Discover Men', href: '/products?gender=men' },
      { label: 'New In', href: '/products?gender=men' },
      { label: 'Sale', href: '/products?gender=men' },
    ],
    columns: [
      {
        heading: 'Traditional Wear',
        links: [
          { label: 'Shop All Men\'s', href: '/products?gender=men' },
          { label: 'Agbada Sets', href: '/products?search=agbada' },
          { label: 'Kaftan & Jalabiya', href: '/products?search=kaftan' },
          { label: 'Buba & Sokoto', href: '/products?search=buba+sokoto' },
          { label: 'Dashiki Shirts', href: '/products?search=dashiki' },
          { label: 'Babban Riga', href: '/products?search=babban+riga' },
          { label: 'Senator Suits', href: '/products?search=senator' },
        ],
      },
      {
        heading: 'Accessories',
        links: [
          { label: 'Shop All Accessories', href: '/products?search=men+accessories' },
          { label: 'Fila & Kufi Caps', href: '/products?search=fila+cap' },
          { label: 'Coral Bead Necklaces', href: '/products?search=coral+beads' },
          { label: 'Traditional Shoes', href: '/products?search=traditional+shoes' },
          { label: 'Walking Sticks', href: '/products?search=staff' },
        ],
      },
      {
        heading: 'By Occasion',
        links: [
          { label: 'Wedding Agbada', href: '/products?search=wedding+agbada' },
          { label: 'Owambe Wear', href: '/products?search=owambe' },
          { label: 'Friday Mosque Wear', href: '/products?search=friday+kaftan' },
          { label: 'Naming Ceremony', href: '/products?search=naming' },
          { label: 'Corporate Casual', href: '/products?search=senator' },
        ],
      },
      {
        heading: 'By Heritage',
        links: [
          { label: 'Yoruba Agbada', href: '/products?search=yoruba+agbada' },
          { label: 'Igbo Isi-Agu', href: '/products?search=isi+agu' },
          { label: 'Hausa Babban Riga', href: '/products?search=babban+riga' },
          { label: '🇬🇭 Ghanaian Kente', href: '/products?originCountry=Ghana' },
          { label: '🇪🇹 Ethiopian Habesha', href: '/products?originCountry=Ethiopia' },
        ],
      },
    ],
  },

  Kids: {
    featured: [
      { label: 'Discover Kids', href: '/products?gender=kids' },
      { label: 'New In', href: '/products?gender=kids' },
      { label: 'Sale', href: '/products?gender=kids' },
      { label: 'Baby & Toddler', href: '/products?search=baby' },
    ],
    columns: [
      {
        heading: 'Girls',
        links: [
          { label: 'Shop All Girls', href: '/products?search=girls' },
          { label: 'Ankara Dresses', href: '/products?search=girls+ankara' },
          { label: 'Aso Ebi Sets', href: '/products?search=girls+aso+ebi' },
          { label: 'Traditional Sets', href: '/products?search=girls+traditional' },
          { label: 'Accessories', href: '/products?search=girls+accessories' },
        ],
      },
      {
        heading: 'Boys',
        links: [
          { label: 'Shop All Boys', href: '/products?search=boys' },
          { label: 'Agbada Sets', href: '/products?search=boys+agbada' },
          { label: 'Dashiki Shirts', href: '/products?search=boys+dashiki' },
          { label: 'Kaftan Sets', href: '/products?search=boys+kaftan' },
          { label: 'Traditional Sets', href: '/products?search=boys+traditional' },
        ],
      },
      {
        heading: 'Baby & Toddler',
        links: [
          { label: 'Shop All Baby', href: '/products?search=baby' },
          { label: 'Baby Ankara', href: '/products?search=baby+ankara' },
          { label: 'Naming Ceremony Sets', href: '/products?search=naming+baby' },
          { label: 'Christening Sets', href: '/products?search=christening' },
        ],
      },
      {
        heading: 'Kids Accessories',
        links: [
          { label: 'Kids Jewellery', href: '/products?search=kids+jewellery' },
          { label: 'Headwear', href: '/products?search=kids+headwear' },
          { label: 'Bags', href: '/products?search=kids+bag' },
        ],
      },
    ],
  },

  Accessories: {
    featured: [
      { label: 'Discover', href: '/products?search=accessories' },
      { label: 'New In', href: '/products?search=accessories' },
      { label: 'Sale', href: '/products?search=accessories' },
      { label: 'Jewellery', href: '/products?search=jewellery' },
    ],
    columns: [
      {
        heading: 'Jewellery & Beads',
        links: [
          { label: 'Shop All Jewellery', href: '/products?search=jewellery' },
          { label: 'Coral Beads', href: '/products?search=coral+beads' },
          { label: 'Waist Beads', href: '/products?search=waist+beads' },
          { label: 'Gold Jewellery', href: '/products?search=gold' },
          { label: 'Silver Jewellery', href: '/products?search=silver' },
          { label: 'Earrings', href: '/products?search=earrings' },
          { label: 'Necklaces', href: '/products?search=necklace' },
          { label: 'Bracelets & Bangles', href: '/products?search=bracelet' },
        ],
      },
      {
        heading: 'Headwear',
        links: [
          { label: 'Shop All Headwear', href: '/products?search=headwear' },
          { label: 'Gele Headtie', href: '/products?search=gele' },
          { label: 'Fila & Kufi', href: '/products?search=fila' },
          { label: 'Fascinators', href: '/products?search=fascinator' },
          { label: 'Turbans & Wraps', href: '/products?search=turban' },
        ],
      },
      {
        heading: 'Bags & Footwear',
        links: [
          { label: 'Shop All Bags', href: '/products?search=bag' },
          { label: 'Clutch Bags', href: '/products?search=clutch' },
          { label: 'Ankara Bags', href: '/products?search=ankara+bag' },
          { label: 'Traditional Shoes', href: '/products?search=traditional+shoes' },
        ],
      },
      {
        heading: 'Cultural',
        links: [
          { label: 'Ivory & Coral', href: '/products?search=ivory+coral' },
          { label: 'Walking Sticks', href: '/products?search=staff' },
          { label: 'Isiagu Scarves', href: '/products?search=scarf' },
          { label: 'African Fans', href: '/products?search=fan' },
        ],
      },
    ],
  },

  Fabrics: {
    featured: [
      { label: 'Shop All Fabrics', href: '/products?search=fabric' },
      { label: 'New Arrivals', href: '/products' },
      { label: 'Trending', href: '/products' },
    ],
    columns: [
      {
        heading: 'West African',
        links: [
          { label: 'Ankara / Wax Print', href: '/products?search=ankara' },
          { label: 'Aso Oke', href: '/products?search=aso+oke' },
          { label: 'George Fabric', href: '/products?search=george' },
          { label: 'Adire (Tie-Dye)', href: '/products?search=adire' },
          { label: 'Kente (Ghana)', href: '/products?search=kente' },
          { label: 'Boubou & Bazin', href: '/products?search=boubou' },
        ],
      },
      {
        heading: 'East & South African',
        links: [
          { label: 'Kitenge', href: '/products?search=kitenge' },
          { label: 'Kanga & Kikoi', href: '/products?search=kanga' },
          { label: 'Habesha (Ethiopia)', href: '/products?search=habesha' },
          { label: 'Shweshwe (S.Africa)', href: '/products?search=shweshwe' },
          { label: 'Ndebele Beadwork', href: '/products?search=ndebele' },
        ],
      },
      {
        heading: 'North African',
        links: [
          { label: 'Djellaba (Morocco)', href: '/products?search=djellaba' },
          { label: 'Kaftan Fabric', href: '/products?search=kaftan' },
          { label: 'Takchita', href: '/products?search=takchita' },
          { label: 'Burnous', href: '/products?search=burnous' },
        ],
      },
      {
        heading: 'Luxury Lace',
        links: [
          { label: 'French Lace', href: '/products?search=french+lace' },
          { label: 'Swiss Voile Lace', href: '/products?search=swiss+lace' },
          { label: 'Austrian Lace', href: '/products?search=austrian+lace' },
          { label: 'Sequence Fabric', href: '/products?search=sequence' },
        ],
      },
    ],
  },

  Occasions: {
    featured: [
      { label: 'Event Collections', href: '/events' },
      { label: 'Collab Drops', href: '/collab-drops' },
      { label: 'Lookbook Studio', href: '/lookbook' },
    ],
    columns: [
      {
        heading: 'Weddings',
        links: [
          { label: 'Traditional Wedding', href: '/products?search=traditional+wedding' },
          { label: 'Engagement Outfits', href: '/products?search=engagement' },
          { label: 'Bridal Coral Beads', href: '/products?search=bridal+coral' },
          { label: 'Aso Ebi Sets', href: '/products?search=aso+ebi' },
          { label: 'Groom Agbada', href: '/products?search=groom+agbada' },
        ],
      },
      {
        heading: 'Celebrations',
        links: [
          { label: 'Owambe & Festival', href: '/products?search=owambe' },
          { label: 'Naming Ceremony', href: '/products?search=naming' },
          { label: 'Birthday Party', href: '/products?search=birthday' },
          { label: 'Graduation', href: '/products?search=graduation' },
          { label: 'Chieftaincy', href: '/products?search=chieftaincy' },
        ],
      },
      {
        heading: 'Religious',
        links: [
          { label: 'Church Sunday Best', href: '/products?search=church' },
          { label: 'Friday Mosque Wear', href: '/products?search=friday+kaftan' },
          { label: 'Hajj & Umrah', href: '/products?search=hajj' },
        ],
      },
      {
        heading: 'Festivals',
        links: [
          { label: 'Durbar Festival', href: '/products?search=durbar' },
          { label: 'New Yam Festival', href: '/products?search=new+yam' },
          { label: 'Osun-Osogbo', href: '/products?search=festival' },
          { label: 'Carnival', href: '/products?search=carnival' },
        ],
      },
    ],
  },

  'By Country': {
    featured: [
      { label: 'All Countries', href: '/products' },
      { label: 'Featured Vendors', href: '/products' },
      { label: 'New Arrivals', href: '/products' },
    ],
    columns: [
      {
        heading: 'West Africa',
        links: [
          { label: '🇳🇬 Nigeria', href: '/products?originCountry=Nigeria' },
          { label: '🇬🇭 Ghana', href: '/products?originCountry=Ghana' },
          { label: '🇸🇳 Senegal', href: '/products?originCountry=Senegal' },
          { label: '🇨🇮 Côte d\'Ivoire', href: '/products?originCountry=C%C3%B4te+d%27Ivoire' },
          { label: '🇲🇱 Mali', href: '/products?originCountry=Mali' },
          { label: '🇧🇯 Benin', href: '/products?originCountry=Benin' },
        ],
      },
      {
        heading: 'East Africa',
        links: [
          { label: '🇰🇪 Kenya', href: '/products?originCountry=Kenya' },
          { label: '🇪🇹 Ethiopia', href: '/products?originCountry=Ethiopia' },
          { label: '🇹🇿 Tanzania', href: '/products?originCountry=Tanzania' },
          { label: '🇺🇬 Uganda', href: '/products?originCountry=Uganda' },
          { label: '🇷🇼 Rwanda', href: '/products?originCountry=Rwanda' },
        ],
      },
      {
        heading: 'North Africa',
        links: [
          { label: '🇲🇦 Morocco', href: '/products?originCountry=Morocco' },
          { label: '🇪🇬 Egypt', href: '/products?originCountry=Egypt' },
          { label: '🇹🇳 Tunisia', href: '/products?originCountry=Tunisia' },
          { label: '🇩🇿 Algeria', href: '/products?originCountry=Algeria' },
        ],
      },
      {
        heading: 'Southern Africa',
        links: [
          { label: '🇿🇦 South Africa', href: '/products?originCountry=South+Africa' },
          { label: '🇿🇼 Zimbabwe', href: '/products?originCountry=Zimbabwe' },
          { label: '🇿🇲 Zambia', href: '/products?originCountry=Zambia' },
          { label: '🇧🇼 Botswana', href: '/products?originCountry=Botswana' },
        ],
      },
    ],
  },
};

const TABS = ['Women', 'Men', 'Kids', 'Accessories', 'Fabrics', 'Occasions', 'By Country'];

export default function MegaMenu() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setActiveTab(null), 120);
  }, []);

  const openTab = useCallback((tab: string) => {
    cancelClose();
    setActiveTab(tab);
  }, [cancelClose]);

  const handleLinkClick = (href: string) => {
    setActiveTab(null);
    // Parse out search params and navigate
    const url = new URL(href, window.location.origin);
    navigate(url.pathname + url.search);
  };

  const section = activeTab ? MENU[activeTab] : null;

  return (
    <div
      className="relative bg-gray-50 border-b border-gray-200"
      onMouseLeave={scheduleClose}
    >
      {/* ── Tab row ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onMouseEnter={() => openTab(tab)}
              onClick={() => {
                if (window.innerWidth < 768) {
                  handleLinkClick(MENU[tab].featured[0].href);
                } else {
                  setActiveTab(activeTab === tab ? null : tab);
                }
              }}
              className={`
                flex items-center gap-1 px-3 md:px-4 py-3 text-xs md:text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors duration-150
                ${activeTab === tab
                  ? 'border-nigerian-green text-nigerian-green bg-white'
                  : 'border-transparent text-gray-600 hover:text-nigerian-green hover:border-nigerian-green/40'
                }
              `}
            >
              {tab}
              <ChevronDown
                className={`hidden md:inline-block w-3.5 h-3.5 transition-transform duration-200 ${activeTab === tab ? 'rotate-180' : ''}`}
              />
            </button>
          ))}

          {/* Quick links on the right — desktop only */}
          <div className="ml-auto hidden md:flex items-center gap-0 pl-4 border-l border-gray-200">
            <button
              onClick={() => handleLinkClick('/products')}
              className="px-3 py-3 text-sm font-medium text-gray-600 hover:text-nigerian-green whitespace-nowrap transition-colors"
            >
              New In
            </button>
            <button
              onClick={() => handleLinkClick('/collab-drops')}
              className="px-3 py-3 text-sm font-medium text-nigerian-gold hover:text-amber-600 whitespace-nowrap transition-colors"
            >
              ⭐ Collab Drops
            </button>
          </div>
        </div>
      </div>

      {/* ── Dropdown panel — desktop only ───────────────────────────── */}
      {section && activeTab && (
        <div
          className="hidden md:block absolute top-full left-0 w-full bg-white shadow-2xl border-t border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex gap-12">

              {/* Featured / left column */}
              <div className="flex-shrink-0 w-36">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Explore</p>
                <ul className="space-y-2.5">
                  {section.featured.map(link => (
                    <li key={link.label}>
                      <button
                        onClick={() => handleLinkClick(link.href)}
                        className="text-sm font-semibold text-gray-800 hover:text-nigerian-green transition-colors text-left"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Browse all button */}
                <button
                  onClick={() => handleLinkClick(section.featured[0].href)}
                  className="mt-6 text-xs font-semibold text-white bg-nigerian-green hover:bg-green-700 px-4 py-2 rounded-full transition-colors whitespace-nowrap"
                >
                  Browse all →
                </button>
              </div>

              {/* Divider */}
              <div className="w-px bg-gray-100 flex-shrink-0" />

              {/* Category columns */}
              <div className="flex-1 grid gap-8"
                style={{ gridTemplateColumns: `repeat(${Math.min(section.columns.length, 4)}, minmax(0, 1fr))` }}
              >
                {section.columns.map(col => (
                  <div key={col.heading}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                      {col.heading}
                    </p>
                    <ul className="space-y-2">
                      {col.links.map(link => (
                        <li key={link.label}>
                          <button
                            onClick={() => handleLinkClick(link.href)}
                            className="text-sm text-gray-600 hover:text-nigerian-green transition-colors text-left"
                          >
                            {link.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Right promo block */}
              <div className="flex-shrink-0 w-44 hidden lg:block">
                <div className="bg-gradient-to-br from-nigerian-green/10 to-nigerian-gold/10 rounded-2xl p-5 text-center">
                  <p className="text-2xl mb-2">🌍</p>
                  <p className="text-xs font-bold text-nigerian-green mb-1">Authentic African</p>
                  <p className="text-xs text-gray-500 mb-3">54 countries, one marketplace</p>
                  <button
                    onClick={() => handleLinkClick('/lookbook')}
                    className="text-xs font-semibold text-nigerian-green border border-nigerian-green rounded-full px-3 py-1.5 hover:bg-nigerian-green hover:text-white transition-colors"
                  >
                    Get Styled ✨
                  </button>
                </div>

                <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 mb-1">⭐ Collab Drops</p>
                  <p className="text-xs text-amber-600 mb-2">Limited edition designer collabs — live now</p>
                  <button
                    onClick={() => handleLinkClick('/collab-drops')}
                    className="text-xs font-semibold text-amber-700 hover:underline"
                  >
                    View drops →
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
