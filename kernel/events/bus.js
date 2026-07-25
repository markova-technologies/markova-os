const { createClient, commandOptions } = require('redis');
const { validateEvent } = require('./schemas');

class EventBus {
  constructor(redisUrl) {
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (err) => console.error('Redis EventBus Error', err));
    this.streamKey = 'markova_events';
  }

  async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async publish(eventType, payload, options = {}) {
    await this.connect();
    validateEvent(eventType, payload);

    const event = {
      type: eventType,
      payload: JSON.stringify(payload),
      timestamp: Date.now().toString(),
      source: options.source || 'unknown',
      traceId: options.traceId || '',
    };

    // Use XADD to add to Redis Stream
    const id = await this.client.xAdd(this.streamKey, '*', event);
    return id;
  }

  async consumeGroup(groupName, consumerName, callback) {
    await this.connect();

    // Create consumer group if it doesn't exist
    try {
      await this.client.xGroupCreate(this.streamKey, groupName, '0', { MKSTREAM: true });
    } catch (e) {
      if (!e.message.includes('BUSYGROUP')) {
        console.error('Error creating consumer group', e);
        throw e;
      }
    }

    // Poll for messages
    while (true) {
      try {
        const response = await this.client.xReadGroup(
          commandOptions({ isolated: true }),
          groupName,
          consumerName,
          [{ key: this.streamKey, id: '>' }],
          { COUNT: 10, BLOCK: 5000 }
        );

        if (response && response.length > 0) {
          const stream = response[0];
          for (const message of stream.messages) {
            const event = {
              id: message.id,
              type: message.message.type,
              payload: JSON.parse(message.message.payload),
              timestamp: parseInt(message.message.timestamp),
              source: message.message.source,
              traceId: message.message.traceId
            };

            await callback(event);

            // Acknowledge the message
            await this.client.xAck(this.streamKey, groupName, message.id);
          }
        }
      } catch (err) {
        console.error('Error consuming events', err);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}

module.exports = EventBus;
