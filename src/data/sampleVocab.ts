import type { ColumnDef, Row } from "@/components/vocab/VocabTableBuilder";

export const SAMPLE_COLUMNS: ColumnDef[] = [
  { id: "word", key: "word", name: "Слово" },
  { id: "translation", key: "translation", name: "Перевод" },
  { id: "example", key: "example", name: "Пример" },
];

export const SAMPLE_ROWS: Row[] = [
  { id: "r1", word: "apple", translation: "яблоко", example: "An apple a day", status: "new" },
  { id: "r2", word: "book", translation: "книга", example: "Read a book", status: "learning" },
  { id: "r3", word: "river", translation: "река", example: "Across the river", status: "learned" },
  { id: "r4", word: "mountain", translation: "гора", example: "High mountain", status: "learning" },
  { id: "r5", word: "sun", translation: "солнце", example: "Bright sun", status: "new" },
];
