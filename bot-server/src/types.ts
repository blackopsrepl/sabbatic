export interface Bot {
  id: number;
  shortcode: string;
  name: string;
  soul: string;
  model: string;
  bot_key: string;
  openrouter_api_key: string | null;
  respond_to_any: number; // 0 or 1
  rate_limit_hourly: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateBotInput {
  shortcode: string;
  name: string;
  soul: string;
  model: string;
  bot_key: string;
  openrouter_api_key?: string;
  respond_to_any?: boolean;
  rate_limit_hourly?: number;
}

export interface UpdateBotInput {
  name?: string;
  soul?: string;
  model?: string;
  bot_key?: string;
  openrouter_api_key?: string | null;
  respond_to_any?: boolean;
  rate_limit_hourly?: number;
}

export interface WebhookPayload {
  user: {
    name: string;
  };
  room: {
    id: number;
    name: string | null;
  };
  message: {
    id: number;
    body: {
      html: string;
      plain: string;
    };
  };
}

export interface Message {
  id: number;
  user_id: number;
  user_name: string;
  body: string;
  created_at: string;
}

export interface EnvVars {
  OPENROUTER_API_KEY: string;
  BOT_SERVER_PORT: string;
  SABBATIC_BASE_URL: string;
}
