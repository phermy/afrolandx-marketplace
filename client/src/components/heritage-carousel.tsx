import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import panAfricanImg from "@assets/stock_images/pan_african_diversity.webp";
import beadworkImg from "@assets/stock_images/nigerian_tribal_chie_11b29bb3.jpg";
import textileImg from "@assets/stock_images/hausa_traditional_cr_fa5db11d.jpg";
import artisanImg from "@assets/stock_images/nigeria_cultural_her_0933402b.jpg";
import craftImg from "@assets/stock_images/nigerian_tribal_chie_4e3710c4.jpg";

const slides = [
  {
    image: panAfricanImg,
    alt: "Women wearing colourful African traditional dress",
    title: "African Heritage",
    description: "Celebrating the creativity and traditions of our continent",
  },
  {
    image: beadworkImg,
    alt: "Woman wearing traditional African beaded jewellery",
    title: "Beautiful Beadwork",
    description: "Adornment inspired by generations of artistry",
  },
  {
    image: textileImg,
    alt: "Brightly colored African patterned textiles",
    title: "Bold African Textiles",
    description: "Colours and patterns that tell a story",
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
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

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
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(motionPreference.matches);
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!carouselApi || !autoPlayEnabled || isHovered || isFocused || prefersReducedMotion) return;
    const timer = window.setInterval(() => carouselApi.scrollNext(), 5000);
    return () => window.clearInterval(timer);
  }, [carouselApi, autoPlayEnabled, isHovered, isFocused, prefersReducedMotion]);

  return (
    <div
      className="relative min-h-[320px] overflow-hidden rounded-xl bg-gray-900 shadow-2xl"
      role="region"
      aria-roledescription="carousel"
      aria-label="African fashion and crafts"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
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
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
              <div className="pointer-events-none absolute bottom-14 left-4 right-4 max-w-[calc(100%-2rem)] rounded-lg bg-black/75 px-4 py-3 text-left shadow-lg backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white md:text-xl">{slide.title}</h3>
                <p className="text-left text-sm text-white md:text-base">{slide.description}</p>
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
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => carouselApi?.scrollNext()}
          aria-label="Next African heritage image"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setAutoPlayEnabled((enabled) => !enabled)}
          aria-label={
            prefersReducedMotion
              ? "Automatic slide advance disabled by reduced motion preference"
              : `${autoPlayEnabled ? "Pause" : "Play"} automatic slide advance`
          }
          title={prefersReducedMotion ? "Disabled by reduced motion preference" : undefined}
          disabled={prefersReducedMotion}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {autoPlayEnabled ? (
            <Pause className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
      <div className="absolute bottom-1 left-0 right-0 z-10 flex justify-center gap-1 pr-8 sm:pr-0" role="group" aria-label="Choose a slide">
        {slides.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => carouselApi?.scrollTo(index)}
            aria-label={`Show ${slide.title}`}
            aria-current={index === selectedIndex ? "true" : undefined}
            className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full transition-colors ${index === selectedIndex ? "bg-white" : "bg-white/70 hover:bg-white"}`}
            />
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {selectedIndex + 1} of {slides.length}: {slides[selectedIndex]?.title}
      </p>
    </div>
  );
}