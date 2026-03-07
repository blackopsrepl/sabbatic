require "net/http"
require "uri"

class Webhook < ApplicationRecord
  ENDPOINT_TIMEOUT = 7.seconds

  belongs_to :user

  def deliver(message)
    Rails.logger.info("Webhook deliver started: webhook_id=#{id} bot_user_id=#{user_id} message_id=#{message.id} room_id=#{message.room_id} url=#{url}")

    post(payload(message)).tap do |response|
      Rails.logger.info("Webhook deliver response: webhook_id=#{id} message_id=#{message.id} code=#{response.code} content_type=#{response.content_type}")

      if text = extract_text_from(response)
        Rails.logger.info("Webhook deliver text reply: webhook_id=#{id} message_id=#{message.id} bytes=#{text.bytesize}")
        receive_text_reply_to(message.room, text: text)
      elsif attachment = extract_attachment_from(response)
        Rails.logger.info("Webhook deliver attachment reply: webhook_id=#{id} message_id=#{message.id} attachment_id=#{attachment.id}")
        receive_attachment_reply_to(message.room, attachment: attachment)
      end
    end
  rescue Net::OpenTimeout, Net::ReadTimeout
    Rails.logger.warn("Webhook deliver timeout: webhook_id=#{id} bot_user_id=#{user_id} message_id=#{message.id} timeout_seconds=#{ENDPOINT_TIMEOUT}")
    receive_text_reply_to message.room, text: "Bot is still processing and may reply shortly (timeout after #{ENDPOINT_TIMEOUT} seconds)."
  rescue Errno::ECONNREFUSED, SocketError => error
    Rails.logger.warn("Webhook deliver connection failure: webhook_id=#{id} bot_user_id=#{user_id} message_id=#{message.id} url=#{url} error_class=#{error.class.name} error_message=#{error.message}")
    receive_text_reply_to message.room, text: "Failed to connect to bot webhook endpoint"
  end

  private
    def post(payload)
      http.request \
        Net::HTTP::Post.new(uri, "Content-Type" => "application/json").tap { |request| request.body = payload }
    end

    def http
      Net::HTTP.new(uri.host, uri.port).tap do |http|
        http.use_ssl = (uri.scheme == "https")
        http.open_timeout = ENDPOINT_TIMEOUT
        http.read_timeout = ENDPOINT_TIMEOUT
      end
    end

    def uri
      @uri ||= URI(url)
    end

    def payload(message)
      {
        user:    { id: message.creator.id, name: message.creator.name },
        room:    { id: message.room.id, name: message.room.name, path: room_bot_messages_path(message) },
        message: { id: message.id, body: { html: message.body.body, plain: without_recipient_mentions(message.plain_text_body) }, path: message_path(message) }
      }.to_json
    end

    def message_path(message)
      Rails.application.routes.url_helpers.room_at_message_path(message.room, message)
    end

    def room_bot_messages_path(message)
      Rails.application.routes.url_helpers.room_bot_messages_path(message.room, user.bot_key)
    end

    def extract_text_from(response)
      String.new(response.body).force_encoding("UTF-8") if response.code == "200" && response.content_type.in?(%w[ text/html text/plain ])
    end

    def receive_text_reply_to(room, text:)
      room.messages.create!(body: text, creator: user).broadcast_create
    end

    def extract_attachment_from(response)
      return if response.code != "200"
      return if response.content_type.blank? || response.content_type == "application/json"

      if mime_type = Mime::Type.lookup(response.content_type)
        ActiveStorage::Blob.create_and_upload! \
          io: StringIO.new(response.body), filename: "attachment.#{mime_type.symbol}", content_type: mime_type.to_s
      end
    end

    def receive_attachment_reply_to(room, attachment:)
      room.messages.create_with_attachment!(attachment: attachment, creator: user).broadcast_create
    end

    def without_recipient_mentions(body)
      body \
        .gsub(user.attachable_plain_text_representation(nil), "") # Remove mentions of the recipient user
        .gsub(/\A\p{Space}+|\p{Space}+\z/, "") # Remove leading and trailing whitespace uncluding unicode spaces
    end
end
