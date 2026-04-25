const u = (id: string, label: string, country: string) => ({
  url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=320&h=320&q=75`,
  label,
  country,
});

export const AFRICAN_PRODUCTS = [
  // Nigerian Fashion
  u("1546961342-ea5f73061da4","Aso Oke Fabric","Nigeria"),
  u("1590845947676-fa6d1c8a0d13","Ankara Dress","Nigeria"),
  u("1531123897727-8f129e1688ce","Adire Textile","Nigeria"),
  u("1529626455594-4ff0802cfb7e","Iro & Buba","Nigeria"),
  u("1544161513-0179fe746fd5","Fila Cap","Nigeria"),
  u("1603344204980-4edb0ea63148","Agbada Robe","Nigeria"),
  u("1573873035-cded3c5d5853","Yoruba Beads","Nigeria"),
  u("1509631179647-0177331693ae","Kente Weave","Nigeria"),
  u("1607748862144-a1cde25c4688","Ankara Skirt","Nigeria"),
  u("1614887800970-53c8a6e6b8a4","Owambe Gele","Nigeria"),
  u("1636036162-e4b4f2dab1e3","Brocade Set","Nigeria"),
  u("1622016498782-a462db49cce2","Aso-ebi Lace","Nigeria"),

  // Ghanaian Products
  u("1573567666066-18bb6ac15720","Kente Cloth","Ghana"),
  u("1551698618-1dfe5d97d256","Kente Strips","Ghana"),
  u("1487222477894-8a7291b2e2c4","Beaded Necklace","Ghana"),
  u("1586023492125-27b2c045efd7","Batakari Tunic","Ghana"),
  u("1551022372-0bdac482-af90","Smock Fabric","Ghana"),
  u("1560707303-fc06c043e10f","Akan Jewelry","Ghana"),
  u("1565689942609-71c7b0065b38","Leather Sandals","Ghana"),
  u("1519225421980-9c2171e8c9bd","Wax Print Dress","Ghana"),

  // Kenyan Products
  u("1614624532983-4ce3efa6a3a4","Maasai Shuka","Kenya"),
  u("1541356665065-22676f35dd40","Kitenge Fabric","Kenya"),
  u("1503602642458-232111b5ffd8","Beaded Bracelet","Kenya"),
  u("1562774053-5b67f4b5e4a0","Kikoy Wrap","Kenya"),
  u("1611095090539-c6a7b77c8b1a","Soapstone Carving","Kenya"),
  u("1549497538-10430c27e73b","Handwoven Bag","Kenya"),
  u("1609174543290-d0f7b9e2c3a0","Sisal Basket","Kenya"),
  u("1620735689791-56c4fd10d24f","Maasai Jewelry","Kenya"),

  // South African Products
  u("1516026672322-375481afcd6f","Ndebele Beads","South Africa"),
  u("1508243771214-6d5ad13a96f6","Shweshwe Fabric","South Africa"),
  u("1592924357775-a72a4a7eb8c3","Zulu Basket","South Africa"),
  u("1580502304784-8985b7eb7260","Xhosa Beads","South Africa"),
  u("1573497491765-dccce02b29df","Leather Craft","South Africa"),
  u("1507003211169-0a1dd7228f2d","Cape Malay Fabric","South Africa"),
  u("1542272604-787c3835535d","Boho African Print","South Africa"),
  u("1601924582970-b69f6d4ad0f3","Woven Blanket","South Africa"),

  // Ethiopian Products
  u("1587174486073-ae5e5cff23aa","Habesha Kemis","Ethiopia"),
  u("1519334787261-ba2b0c98bab8","Tej Basket","Ethiopia"),
  u("1499084732479-de2c02d42fc","Tibeb Fabric","Ethiopia"),
  u("1571019613454-1cb2f99b2d8b","Gabi Scarf","Ethiopia"),
  u("1575822440938-b671d7beb89e","Ethiopian Jewelry","Ethiopia"),
  u("1597138804456-e7dca7f59d54","Lalibela Cross","Ethiopia"),
  u("1614624521800-5c5c5c5c5c5c","Injera Basket","Ethiopia"),
  u("1593030945-c73f1d32ab69","Harari Fabric","Ethiopia"),

  // Moroccan Products
  u("1539037116277-4db20889f2d4","Berber Carpet","Morocco"),
  u("1583473848882-f9a5bc7fd2ee","Leather Bag","Morocco"),
  u("1548013146-72479768bada","Zellige Tiles","Morocco"),
  u("1560707303-fc06c043e10f","Silver Jewelry","Morocco"),
  u("1594938175174-bf2903ce7a58","Kaftan Robe","Morocco"),
  u("1590736704728-f4baa4a7f09e","Argan Oil Set","Morocco"),
  u("1580418827493-f2b22c0a76cb","Fez Hat","Morocco"),
  u("1551817958-5c2d03aa9e89","Babouche Slipper","Morocco"),

  // Senegalese / West African
  u("1600878459138-e1123b37cb30","Boubou Robe","Senegal"),
  u("1547226706-e8e2c20e6bc2","Bogolan Cloth","Mali"),
  u("1524069290683-0457abfe42c3","Tie-Dye Fabric","Côte d'Ivoire"),
  u("1519225421980-9c2171e8c9bd","Wax Print Skirt","Togo"),
  u("1566375638-f26afaa9f5a7","Raffia Hat","Cameroon"),
  u("1551817958-5c2d03aa9e89","Brass Figure","Benin"),
  u("1547671527-3a3e62a40bd4","Kanga Wrap","Tanzania"),
  u("1611095090539-c6a7b77c8b1a","Ebony Sculpture","Congo"),

  // Jewelry & Accessories
  u("1487222477894-8a7291b2e2c4","Gold Anklet","West Africa"),
  u("1573873035-cded3c5d5853","Coral Necklace","Nigeria"),
  u("1503602642458-232111b5ffd8","Seed Bead Necklace","Kenya"),
  u("1580502304784-8985b7eb7260","Statement Earrings","South Africa"),
  u("1571019613454-1cb2f99b2d8b","Amber Bracelet","Ethiopia"),
  u("1560707303-fc06c043e10f","Silver Cuff","Morocco"),
  u("1560707303-fc06c043e10f","Cowrie Shell Necklace","Nigeria"),
  u("1616671276938-0a4e9bdee1ab","Beaded Headpiece","Kenya"),

  // Textiles & Fabrics
  u("1573567666066-18bb6ac15720","Adinkra Print","Ghana"),
  u("1509631179647-0177331693ae","Mudcloth Throw","Mali"),
  u("1539037116277-4db20889f2d4","Berber Rug","Morocco"),
  u("1592924357775-a72a4a7eb8c3","Coil Basket","South Africa"),
  u("1609174543290-d0f7b9e2c3a0","Sisal Tote","Kenya"),
  u("1583473848882-f9a5bc7fd2ee","Leather Clutch","Morocco"),
  u("1566375638-f26afaa9f5a7","Palm Leaf Hat","West Africa"),
  u("1547226706-e8e2c20e6bc2","Hand-dyed Scarf","Senegal"),

  // Modern African Fashion
  u("1607748862144-a1cde25c4688","Afrofusion Jacket","Pan-Africa"),
  u("1636036162-e4b4f2dab1e3","Dashiki Shirt","West Africa"),
  u("1600878459138-e1123b37cb30","Kaftan Maxi","Senegal"),
  u("1622016498782-a462db49cce2","Lace Blouse","Nigeria"),
  u("1586023492125-27b2c045efd7","Peplum Top","Ghana"),
  u("1587174486073-ae5e5cff23aa","Wrap Dress","Ethiopia"),
  u("1614624532983-4ce3efa6a3a4","Shuka Skirt","Kenya"),
  u("1601924582970-b69f6d4ad0f3","African Print Suit","Pan-Africa"),

  // Crafts & Homewares
  u("1548013146-72479768bada","Wooden Mask","West Africa"),
  u("1597138804456-e7dca7f59d54","Bronze Figurine","Benin City"),
  u("1611095090539-c6a7b77c8b1a","Soapstone Bowl","Kenya"),
  u("1592924357775-a72a4a7eb8c3","Woven Placemat","South Africa"),
  u("1519334787261-ba2b0c98bab8","Grass Basket","Ethiopia"),
  u("1565689942609-71c7b0065b38","Sandal Pair","Ghana"),
  u("1549497538-10430c27e73b","Batik Wall Art","Nigeria"),
  u("1580418827493-f2b22c0a76cb","Terracotta Pot","Côte d'Ivoire"),

  // Kids & Beauty
  u("1544161513-0179fe746fd5","Children's Ankara","Nigeria"),
  u("1503602642458-232111b5ffd8","Hair Beads","West Africa"),
  u("1590736704728-f4baa4a7f09e","Shea Butter Set","Ghana"),
  u("1629200845016-4bcb3a53bdac","Black Soap","Nigeria"),
  u("1571019613454-1cb2f99b2d8b","Coffee Ceremony Set","Ethiopia"),
  u("1539037116277-4db20889f2d4","Argan Skincare","Morocco"),
  u("1547671527-3a3e62a40bd4","Kitenge Kids Wear","Tanzania"),
  u("1524069290683-0457abfe42c3","Tie-Dye Kids Set","West Africa"),
];

interface CarouselRowProps {
  items: typeof AFRICAN_PRODUCTS;
  direction?: "left" | "right";
  speed?: number;
}

function CarouselRow({ items, direction = "left", speed = 35 }: CarouselRowProps) {
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden relative">
      <div
        className="flex gap-3"
        style={{
          animation: `${direction === "left" ? "marqueeLeft" : "marqueeRight"} ${speed}s linear infinite`,
          width: "max-content",
        }}
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            className="relative flex-shrink-0 w-36 h-36 md:w-44 md:h-44 rounded-xl overflow-hidden group cursor-pointer shadow-sm"
          >
            <img
              src={item.url}
              alt={item.label}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1573567666066-18bb6ac15720?auto=format&fit=crop&w=320&h=320&q=75";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <p className="text-white text-xs font-semibold leading-tight truncate">{item.label}</p>
              <p className="text-amber-300 text-xs truncate">{item.country}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AfricanProductCarousel() {
  const row1 = AFRICAN_PRODUCTS.slice(0, 36);
  const row2 = AFRICAN_PRODUCTS.slice(36, 72);
  const row3 = AFRICAN_PRODUCTS.slice(72);

  return (
    <div className="space-y-3 py-2">
      <CarouselRow items={row1} direction="left" speed={40} />
      <CarouselRow items={row2} direction="right" speed={32} />
      <CarouselRow items={row3} direction="left" speed={45} />
    </div>
  );
}
