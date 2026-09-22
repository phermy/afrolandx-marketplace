import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import panAfricanImg from "@assets/stock_images/pan_african_diversity.webp";
import beadworkImg from "@assets/stock_images/nigerian_tribal_chie_11b29bb3.jpg";
import textileImg from "@assets/stock_images/hausa_traditional_cr_fa5db11d.jpg";
import artisanImg from "@assets/stock_images/nigeria_cultural_her_0933402b.jpg";
import craftImg from "@assets/stock_images/nigerian_tribal_chie_4e3710c4.jpg";

const slides = [
  {
    image: panAfricanImg,
    alt: "Women wearing colorful African traditional dress",
    title: "African Heritage",
    description: "Celebrating the creativity and traditions of our continent",
  },
  {
    image: beadworkImg,
    alt: "Woman wearing traditional African beaded jewelry",
    title: "Beautiful Beadwork",
    description: "Adornment inspired by generations of artistry",
  },
  {
    image: textileImg,
    alt: "Brightly colored African patterned textiles",
    title: "Bold African Textiles",
    description: "Colors and patterns that tell a story",
  },
  {
    image: artisanImg,
    alt: "African artisans making traditional crafts together",
    title: "Made by Artisans",
    description: "Discover the hands and skills behind each creation",
  },
  {
    image: craftImg,
    alt: "Handcrafted baskets and woven goods on display",
    title: "Handcrafted Finds",
    description: "Explore the beauty of everyday African craft",
  },
];

export default function HeritageCarousel() {
  const [carouselRef, carouselApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!carouselApi) return;
    const updateSelection = () => setSelectedIndex(carouselApi.selectedScrollSnap());
    carouselApi.on("select", updateSelection);
    updateSelection();
    return () => {
      carouselApi.off("select", updateSelection);
    };
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => carouselApi.scrollNext(), 5000);
    return () => window.clearInterval(timer);
  }, [carouselApi, paused]);

  return (
    <div
      className="relative min-h-[320px] overflow-hidden rounded-xl bg-gray-900 shadow-2xl"
      role="region"
      aria-roledescription="carousel"
      aria-label="African fashion and crafts"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div ref={carouselRef} className="absolute inset-0 overflow-hidden">
        <div className="flex h-full touch-pan-y">
          {slides.map((slide, index) => (
            <div
              key={slide.title}
              className="relative min-w-0 flex-[0_0_100%]"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
              aria-hidden={index !== selectedIndex}
            >
              <img
                src={slide.image}
                alt={slide.alt}
                className="absolute inset-0 h-full w-full object-cover"
                loading={index === 0 ? "eager" : "lazy"}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-9 left-4 right-4 pointer-events-none">
                <h3 className="text-lg font-bold text-white drop-shadow-lg md:text-xl">{slide.title}</h3>
                <p className="text-sm text-white/90 drop-shadow-md">{slide.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => carouselApi?.scrollPrev()}
          aria-label="Previous African heritage image"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => carouselApi?.scrollNext()}
          aria-label="Next African heritage image"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2" aria-label="Choose a slide">
        {slides.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => carouselApi?.scrollTo(index)}
            aria-label={`Show ${slide.title}`}
            aria-current={index === selectedIndex ? "true" : undefined}
            className={`h-2.5 w-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${index === selectedIndex ? "bg-white" : "bg-white/50 hover:bg-white/80"}`}
          />
        ))}
      </div>
    </div>
  );
}