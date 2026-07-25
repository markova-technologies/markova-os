const ConnectorInterface = require('../interface');

class GoogleSheetsConnector extends ConnectorInterface {
  async connect(config) {
    // Validate oauth tokens or service account
    return { status: 'connected' };
  }

  async syncDown(config, lastSyncToken) {
    // Mock downloading rows
    return {
      records: [
        { id: 1, columnA: 'Value', columnB: 'Value2' }
      ],
      newSyncToken: Date.now().toString()
    };
  }

  async syncUp(config, records) {
    // Mock uploading rows
    return { status: 'success', synced: records.length };
  }
}

module.exports = GoogleSheetsConnector;
