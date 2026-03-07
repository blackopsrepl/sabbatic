class Bot::WebhookJob < ApplicationJob
  def perform(bot, message)
    Rails.logger.info("Bot::WebhookJob started", bot_user_id: bot.id, message_id: message.id, room_id: message.room_id)
    bot.deliver_webhook(message)
    Rails.logger.info("Bot::WebhookJob completed", bot_user_id: bot.id, message_id: message.id)
  rescue StandardError => error
    Rails.logger.error("Bot::WebhookJob failed", bot_user_id: bot.id, message_id: message.id, error_class: error.class.name, error_message: error.message)
    raise
  end
end
