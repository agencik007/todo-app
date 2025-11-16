export interface Todo {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  is_public: boolean;
  user_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface TodoCreate {
  title: string;
  description?: string;
  completed?: boolean;
  is_public?: boolean;
}

export interface TodoUpdate {
  title?: string;
  description?: string;
  completed?: boolean;
  is_public?: boolean;
}

