import AppLayout from "@/components/app/AppLayout";
import VocabTableBuilder from "@/components/vocab/VocabTableBuilder";

export default function AppPage() { 
  return (
    <AppLayout>
      <div className="w-full px-4 md:px-6 lg:px-10 py-6 md:py-10">
        <VocabTableBuilder />
      </div>
    </AppLayout>
  );
}