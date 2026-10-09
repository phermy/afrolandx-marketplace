import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type HomeHeroProps = {
  variant: "guest" | "shopper";
};

const imageRoot = "/images/home/maasai_warriors_kenya";

export default function HomeHero({ variant }: HomeHeroProps) {
  const isGuest = variant === "guest";

  return (
    <section className="relative isolate min-h-[34rem] overflow-hidden bg-[#172d29] sm:min-h-[30rem] lg:min-h-[32rem]">
      <img
        src={`${imageRoot}-1280.webp`}
        srcSet={`${imageRoot}-640.webp 640w, ${imageRoot}-1280.webp 1280w`}
        sizes="100vw"
        alt="Maasai people in traditional red clothing and beadwork beneath Mount Kilimanjaro"
        className="absolute inset-0 h-full w-full object-cover object-[58%_center] sm:object-center"
        loading="eager"
        {...{ fetchpriority: "high" }}
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#142a25]/95 via-[#142a25]/82 to-[#142a25]/10 sm:via-[#142a25]/72" />
      <div className="relative mx-auto flex min-h-[34rem] max-w-7xl items-center px-5 py-14 sm:min-h-[30rem] sm:px-8 lg:min-h-[32rem] lg:px-12">
        <div className="max-w-[42rem] text-left">
          <p className="mb-5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#efc77d] sm:text-xs">
            African design, found here
          </p>
          <h1
            className="max-w-[14ch] text-[2.65rem] font-semibold leading-[1.04] tracking-[-0.045em] text-[#fff8e9] sm:text-6xl lg:text-[4.65rem]"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            A continent of makers. A world of style.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#f3ead8] sm:mt-6 sm:text-lg sm:leading-8">
            Find pieces with a story, made by independent African designers and artisans. From handwoven cloth to occasion wear, make room for something with roots.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
            {isGuest ? (
              <>
                <Button
                  asChild
                  size="lg"
                  className="h-12 w-full rounded-md bg-[#e7b75b] px-6 font-semibold text-[#1e332c] shadow-none hover:bg-[#f0c978] sm:w-auto"
                >
                  <Link href="/products">Browse the marketplace</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-md border-white/55 bg-[#142a25]/25 px-6 font-semibold text-white hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  <Link href="/register">Create an account</Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="h-12 w-full rounded-md bg-[#e7b75b] px-6 font-semibold text-[#1e332c] shadow-none hover:bg-[#f0c978] sm:w-auto"
                  asChild
                >
                  <Link href="/products">Explore the collection</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-md border-white/55 bg-[#142a25]/25 px-6 font-semibold text-white hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  <Link href="/vendor/apply">Sell your work</Link>
                </Button>
              </>
            )}
          </div>
          {isGuest && (
            <p className="mt-5 text-sm text-[#f3ead8]">
              An independent maker?{" "}
              <Link href="/vendor/apply" className="font-semibold text-[#f1cb7d] underline decoration-[#f1cb7d]/60 underline-offset-4 hover:text-white">
                Start your application
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
