export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
export type AdminStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';
export type FormStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type QuestionType = 'TEXT' | 'MULTIPLE_CHOICE' | 'RATING' | 'CHECKBOX';
export type AdminRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Admin {
  id: string;
  telegram_user_id: number;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  role: AdminRole;
  status: AdminStatus;
  created_at: string;
  updated_at: string;
}

export interface Form {
  id: string;
  title: string;
  description?: string | null;
  status: FormStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  form_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | Record<string, any>;
  is_required: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Response {
  id: string;
  form_id: string;
  telegram_user_id: number;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  submitted_at: string;
  telegram_message_id?: number | null;
}

export interface ResponseAnswer {
  id: string;
  response_id: string;
  question_id: string;
  answer_value: string;
  created_at: string;
}

export interface AdminRequest {
  id: string;
  telegram_user_id: number;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  requested_role: string;
  status: AdminRequestStatus;
  processed_by?: string | null;
  processed_at?: string | null;
  created_at: string;
}

export interface ForumTopic {
  id: string;
  chat_id: number;
  topic_id: number;
  topic_name: string;
  created_at: string;
}
