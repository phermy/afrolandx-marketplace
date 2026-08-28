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
    <div className="min-h-screen bg-[#fbfcfa] pattern-bg">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6 lg:px-12">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="Go to Afrolandx home">
          <img src={logoImage} alt="" className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
          <span className="text-xl font-bold tracking-tight text-[#087f4f] sm:text-2xl">Afrolandx</span>
        </Link>
        {headerLink && (
          <Link
            href={headerLink.href}
            className="rounded-md bg-[#087f4f] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06683f] focus:outline-none focus:ring-2 focus:ring-[#087f4f] focus:ring-offset-2 sm:px-4"
          >
            {headerLink.label}
          </Link>
        )}
      </header>

      <main className="flex min-h-[calc(100vh-145px)] items-start justify-center px-5 pb-12 pt-6 sm:px-8 sm:pt-12 lg:pt-16">
        <section className="w-full max-w-[400px]" aria-labelledby="auth-title">
          <div className="border border-gray-100 bg-white px-6 py-7 shadow-[0_10px_35px_rgba(20,40,30,0.06)] sm:px-8 sm:py-8">
            <h1 id="auth-title" className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-7 border-t border-gray-100 pt-6">{footer}</div>}
          </div>
        </section>
      </main>

      <footer className="px-5 py-5 text-center text-xs text-gray-500 sm:px-8 lg:px-12 lg:text-left">
        Secure access to Afrolandx marketplace
      </footer>
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-red-600" role="alert">{children}</p>;
}

export const authInputClass =
  "mt-1.5 h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-none outline-none transition focus:border-[#087f4f] focus:ring-2 focus:ring-[#087f4f]/15 disabled:cursor-not-allowed disabled:bg-gray-50";