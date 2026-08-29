import { ReactNode } from "react";
import { Link } from "wouter";
import logoImage from "@assets/Group 1000002646_1749631956471.png";

type AuthShellProps = {
  title: string;
  description: string;
  headerLink?: { href: string; label: string };
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ title, description, headerLink, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#fbfbfa] pattern-bg">
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10 sm:py-7 lg:px-12">
        <Link href="/" className="group inline-flex items-center gap-3" aria-label="Go to Afrolandx home">
          <img src={logoImage} alt="" className="h-9 w-9 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-10 sm:w-10" />
          <span className="text-xl font-bold tracking-tight text-[#087f4f] sm:text-2xl">Afrolandx</span>
        </Link>
        {headerLink && (
          <Link
            href={headerLink.href}
            className="inline-flex min-h-10 items-center rounded-[3px] bg-[#f5a000] px-4 py-2.5 text-sm font-semibold text-[#171717] shadow-sm transition-colors hover:bg-[#e69700] focus:outline-none focus:ring-2 focus:ring-[#f5a000] focus:ring-offset-2 sm:px-5"
          >
            {headerLink.label}
          </Link>
        )}
      </header>

      <main className="relative z-10 flex w-full flex-1 items-start justify-center px-6 pb-14 pt-10 sm:px-10 sm:pt-16 lg:justify-start lg:px-24 lg:pt-24 xl:px-28">
        <section className="w-full max-w-[360px]" aria-labelledby="auth-title">
          <div className="border border-[#ebeae7] bg-white px-7 py-8 shadow-[0_14px_36px_rgba(20,30,24,0.06)] sm:px-8 sm:py-9">
            <h1 id="auth-title" className="text-[21px] font-semibold tracking-[-0.02em] text-[#20201f] sm:text-[23px]">
              {title}
            </h1>
            <p className="mt-2.5 text-sm leading-6 text-[#70706d]">{description}</p>
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-7 border-t border-[#eeedea] pt-6">{footer}</div>}
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-6 py-6 text-xs text-[#6d6d69] sm:px-10 lg:px-12">
        Secure access to the Afrolandx marketplace
      </footer>
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-red-600" role="alert">{children}</p>;
}

export const authInputClass =
  "mt-2 h-12 w-full rounded-[3px] border border-[#d9d9d6] bg-white px-3.5 text-[15px] text-[#20201f] shadow-none outline-none transition placeholder:text-[#a1a19d] focus:border-[#087f4f] focus:ring-2 focus:ring-[#087f4f]/15 disabled:cursor-not-allowed disabled:bg-[#f7f7f5]";

export const authButtonClass =
  "flex h-12 w-full items-center justify-center rounded-[3px] bg-[#f5a000] px-4 text-[15px] font-semibold text-[#171717] shadow-sm transition-colors hover:bg-[#e69700] focus:outline-none focus:ring-2 focus:ring-[#f5a000] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";