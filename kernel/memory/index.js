class MemoryInterface {
  async getMemory(entityType, entityId, key) {
    throw new Error('Not implemented');
  }

  async setMemory(entityType, entityId, key, value) {
    throw new Error('Not implemented');
  }
}

module.exports = MemoryInterface;
