import SiteHeader from "@/components/layout/SiteHeader";
import heroImage from "@/assets/hero-lexitable.jpg";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { t } = useTranslation();

  const handleCTAMarketing = () => {
    document.getElementById("benefits")?.scrollIntoView({ behavior: "smooth" });
  };

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: t("schema.name"),
    description: t("schema.description"),
    url: t("schema.url"),
  };

  return (
    <div>
      <SiteHeader />
      <main>
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                {t("hero.title")}
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                {t("hero.subtitle")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="hero" size="lg" asChild>
                  <a href="/app">{t("hero.buttons.openEditor")}</a>
                </Button>
                <Button variant="outline" size="lg" onClick={handleCTAMarketing}>
                  {t("hero.buttons.learnMore")}
                </Button>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border shadow-sm">
              <img
                src={heroImage}
                alt={t("hero.imageAlt")}
                loading="lazy"
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        <section id="benefits" className="container mx-auto px-4 pb-24 space-y-10">
          <div className="grid md:grid-cols-3 gap-8">
            <article>
              <h2 className="text-2xl font-semibold mb-2">
                {t("benefits.columns.title")}
              </h2>
              <p className="text-muted-foreground">
                {t("benefits.columns.text")}
              </p>
            </article>
            <article>
              <h2 className="text-2xl font-semibold mb-2">
                {t("benefits.statuses.title")}
              </h2>
              <p className="text-muted-foreground">
                {t("benefits.statuses.text")}
              </p>
            </article>
            <article>
              <h2 className="text-2xl font-semibold mb-2">
                {t("benefits.cards.title")}
              </h2>
              <p className="text-muted-foreground">
                {t("benefits.cards.text")}
              </p>
            </article>
          </div>
        </section>

        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
      </main>
    </div>
  );
};

export default Index;
