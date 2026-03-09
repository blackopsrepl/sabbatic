module Message::Broadcasts
  def broadcast_create
    safely_broadcast do
      broadcast_append_to room, :messages, target: [ room, :messages ]
      ActionCable.server.broadcast("unread_rooms", { roomId: room.id })
    end
  end

  def broadcast_remove
    safely_broadcast do
      broadcast_remove_to room, :messages
    end
  end

  private
    def safely_broadcast
      yield
    rescue *redis_connection_errors => error
      Rails.logger.warn("Skipping message broadcast due to Redis connectivity issue: #{error.class}: #{error.message}")
    end

    def redis_connection_errors
      [
        Errno::ECONNREFUSED,
        (Redis::CannotConnectError if defined?(Redis::CannotConnectError)),
        (RedisClient::CannotConnectError if defined?(RedisClient::CannotConnectError))
      ].compact
    end
end
