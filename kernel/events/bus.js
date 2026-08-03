const { createClient, commandOptions } = require('redis');
const { validateEvent } = require('./schemas');

/**
 * EventBus with Dual-Write capabilities (Redis Streams + Kafka/HTTP Broker Dual-Write)
 */
class EventBus {
  constructor(redisUrl, options = {}) {
    this.client = createClient({ url: redisUrl || process.env.REDIS_URL || 'redis://redis:6379' });
    this.client.on('error', (err) => console.error('Redis EventBus Error', err));
    this.streamKey = 'markova_events';
    this.kafkaBrokerUrl = options.kafkaBrokerUrl || process.env.KAFKA_BROKER_URL || null;
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

    // 1. Primary Write: Redis Stream (XADD)
    const id = await this.client.xAdd(this.streamKey, '*', event);

    // 2. Dual-Write: Kafka / Event Broker (Best-effort non-blocking)
    if (this.kafkaBrokerUrl) {
      this._publishToKafka(eventType, payload, event).catch(err => {
        console.warn(`⚠️ Kafka Dual-Write skipped/failed: ${err.message}`);
      });
    }

    return id;
  }

  async _publishToKafka(eventType, payload, metadata) {
    const axios = require('axios');
    await axios.post(`${this.kafkaBrokerUrl}/v1/events`, {
      eventType,
      payload,
      metadata
    }, { timeout: 2000 });
  }

  async consumeGroup(groupName, consumerName, callback) {
    await this.connect();

    try {
      await this.client.xGroupCreate(this.streamKey, groupName, '0', { MKSTREAM: true });
    } catch (e) {
      if (!e.message.includes('BUSYGROUP')) {
        console.error('Error creating consumer group', e);
        throw e;
      }
    }

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
