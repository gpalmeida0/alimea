import { Link } from "@/i18n/routing";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-serif text-6xl font-semibold text-brand">404</p>
      <p className="mt-2 text-muted-foreground">Página não encontrada · Page not found</p>
      <Link href="/" className="mt-6 text-sm text-brand-600 hover:underline">
        ← Alimea
      </Link>
    </div>
  );
}
