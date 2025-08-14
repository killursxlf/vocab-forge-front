import SiteHeader from "@/components/layout/SiteHeader";
import heroImage from "@/assets/hero-lexitable.jpg";
import { Button } from "@/components/ui/button";

const Index = () => {
  const handleCTAMarketing = () => {
    document.getElementById("benefits")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div>
      <SiteHeader />
      <main>
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">Учим слова через таблицы и карточки</h1>
              <p className="text-xl text-muted-foreground mb-8">Создавайте свои таблицы, задавайте статусы слов и автоматически получайте карточки для эффективного повторения.</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="hero" size="lg" asChild>
                  <a href="/app">Открыть редактор</a>
                </Button>
                <Button variant="outline" size="lg" onClick={handleCTAMarketing}>Узнать больше</Button>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border shadow-sm">
              <img src={heroImage} alt="LexiTable — таблица превращается в карточки" loading="lazy" className="w-full h-auto" />
            </div>
          </div>
        </section>

        <section id="benefits" className="container mx-auto px-4 pb-24 space-y-10">
          <div className="grid md:grid-cols-3 gap-8">
            <article>
              <h2 className="text-2xl font-semibold mb-2">Свои колонки</h2>
              <p className="text-muted-foreground">Добавляйте любое количество столбцов: примеры, синонимы, часть речи — что угодно.</p>
            </article>
            <article>
              <h2 className="text-2xl font-semibold mb-2">Статусы слов</h2>
              <p className="text-muted-foreground">Новое, Изучаем, Выучено — контролируйте прогресс и фильтруйте карточки.</p>
            </article>
            <article>
              <h2 className="text-2xl font-semibold mb-2">Карточки из таблицы</h2>
              <p className="text-muted-foreground">Автоматически превращайте строки таблицы в красивые карточки для повторения.</p>
            </article>
          </div>
        </section>

        {/* Structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "LexiTable",
          description: "Конструктор словарей: таблицы слов с шаблонами и карточки для изучения.",
          url: "/"
        }) }} />
      </main>
    </div>
  );
};

export default Index;
