export interface User {
  id: number;
  email: string;
}

export type WordStatus = "NEW" | "LEARNING" | "LEARNED";

export interface ColumnDef {
  id: string;   
  key: string;     
  name: string;   
}

export interface Word {
  id: number;
  original: string;
  translation: string;
  status: WordStatus;
  createdAt: string;
  customFields: Record<string, string>;
}


export interface WordSetPage {
  id: number;                       
  title: string;                     
  customColumns: ColumnDef[];       
  words: Word[];                      
  hasMore: boolean;                    
  total: number;                       
}

export interface WordSet {
  id: number;
  title: string;
  customColumns: ColumnDef[];
  words: Word[];
}
