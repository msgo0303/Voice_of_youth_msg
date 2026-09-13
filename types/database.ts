export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
export type AdminStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';
export type FormStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
export type QuestionType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'DROPDOWN'
  | 'LINEAR_SCALE'
  | 'SATISFACTION';

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
  deadline_at?: string | null;
  completion_message?: string | null;
  response_chat_id?: number | null;
  response_topic_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  form_id: string;
  title: string;
  description?: string | null;
  type: QuestionType;
  options?: string[] | Record<string, any> | null;
  required: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionSnapshot {
  title: string;
  description?: string | null;
  type: QuestionType;
  options?: any;
  required: boolean;
}

export interface Response {
  id: string;
  form_id: string;
  telegram_user_id: number;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  submitted_at: string;
  updated_at?: string | null;
  is_edited?: boolean;
  telegram_message_id?: number | null;
  previous_telegram_message_id?: number | null;
}

export interface ResponseAnswer {
  id: string;
  response_id: string;
  question_id: string;
  question_snapshot: QuestionSnapshot;
  answer_value: string;
  created_at?: string;
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
